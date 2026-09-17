"""Dashboard — portfolio stats, activity feed, chart data, board report."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from app.database import get_db
from app.models import (Company, Tool, AdoptionSnapshot, AuditLog, KpiTarget,
                        BusinessFunction, GovernanceContact, TimeToValue, ToolGoal)
from app.schemas import PortfolioStats, ActivityItem
from app.api.deps import get_current_user, get_company_scope, check_company_access
from app.core.security import STAGE_LABELS

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=PortfolioStats)
async def get_portfolio_stats(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    base = select(Tool).where(Tool.is_active == True)
    if scope is not None:
        base = base.where(Tool.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        base = base.where(Tool.company_id == company_id)

    tools_result = await db.execute(base)
    tools = tools_result.scalars().all()

    total_tools = len(tools)
    deployed = sum(1 for t in tools if t.deployment_stage == 3)
    pilot = sum(1 for t in tools if t.deployment_stage == 1)
    failed = sum(1 for t in tools if t.deployment_stage == 4)
    total_spend = sum(float(t.annual_spend or 0) for t in tools)

    company_q = select(func.count(Company.id)).where(Company.is_active == True)
    if scope is not None:
        company_q = company_q.where(Company.id.in_(scope))
    if company_id:
        company_q = company_q.where(Company.id == company_id)
    total_companies = (await db.execute(company_q)).scalar()

    adoption_q = select(func.avg(AdoptionSnapshot.pct_daily_usage)).where(
        AdoptionSnapshot.pct_daily_usage.isnot(None)
    )
    if scope is not None:
        adoption_q = adoption_q.where(AdoptionSnapshot.company_id.in_(scope))
    if company_id:
        adoption_q = adoption_q.where(AdoptionSnapshot.company_id == company_id)
    avg_adoption = (await db.execute(adoption_q)).scalar() or 0

    return PortfolioStats(
        total_companies=total_companies, total_tools=total_tools,
        deployed_tools=deployed, pilot_tools=pilot, failed_tools=failed,
        total_annual_spend=total_spend, avg_adoption_pct=round(float(avg_adoption), 1),
        total_kpis=total_tools * 3,
    )


@router.get("/activity", response_model=list[ActivityItem])
async def get_activity_feed(
    limit: int = Query(20, ge=1, le=100),
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(AuditLog).where(AuditLog.action.in_(["create", "update", "upload"]))
    if scope is not None:
        query = query.where(AuditLog.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(AuditLog.company_id == company_id)

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).limit(limit))
    entries = result.scalars().all()

    items = []
    for e in entries:
        desc = f"{e.action.title()} {e.entity_type}"
        if e.new_value:
            desc += f": {e.new_value[:80]}"
        if e.field_changed:
            desc = f"Updated {e.field_changed} on {e.entity_type}"
            if e.old_value and e.new_value:
                desc += f" ({e.old_value[:30]} → {e.new_value[:30]})"

        company_name = None
        if e.company_id:
            c = (await db.execute(select(Company.name).where(Company.id == e.company_id))).scalar()
            company_name = c

        items.append(ActivityItem(
            id=e.id, entity_type=e.entity_type, action=e.action,
            description=desc, company_name=company_name,
            user_email=e.user_email, created_at=e.created_at,
        ))
    return items


@router.get("/spend-by-function")
async def spend_by_function(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(Tool).where(Tool.is_active == True, Tool.annual_spend.isnot(None))
    if scope is not None:
        query = query.where(Tool.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(Tool.company_id == company_id)

    tools = (await db.execute(query)).scalars().all()

    fn_spend = {}
    for t in tools:
        for tf in t.functions:
            fn_name = tf.function.display_name if tf.function else "Unassigned"
            fn_spend[fn_name] = fn_spend.get(fn_name, 0) + float(t.annual_spend or 0)

    return [{"function": k, "total_spend": v} for k, v in sorted(fn_spend.items(), key=lambda x: -x[1])]


@router.get("/spend-by-company")
async def spend_by_company(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = (
        select(Company.name, func.sum(Tool.annual_spend))
        .join(Tool, and_(Tool.company_id == Company.id, Tool.is_active == True))
        .where(Company.is_active == True)
        .group_by(Company.name)
        .order_by(func.sum(Tool.annual_spend).desc())
    )
    if scope is not None:
        query = query.where(Company.id.in_(scope))

    result = await db.execute(query)
    return [{"company": row[0], "total_spend": float(row[1] or 0)} for row in result.all()]


@router.get("/adoption-by-function")
async def adoption_by_function(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = (
        select(
            BusinessFunction.display_name,
            func.avg(AdoptionSnapshot.pct_licensed),
            func.avg(AdoptionSnapshot.pct_enabled),
            func.avg(AdoptionSnapshot.pct_daily_usage),
            func.count(AdoptionSnapshot.id),
        )
        .join(BusinessFunction, AdoptionSnapshot.function_id == BusinessFunction.id)
        .group_by(BusinessFunction.display_name, BusinessFunction.display_order)
        .order_by(BusinessFunction.display_order)
    )
    if scope is not None:
        query = query.where(AdoptionSnapshot.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(AdoptionSnapshot.company_id == company_id)

    result = await db.execute(query)
    return [{
        "function": row[0],
        "avg_pct_licensed": round(float(row[1] or 0), 1),
        "avg_pct_enabled": round(float(row[2] or 0), 1),
        "avg_pct_daily_usage": round(float(row[3] or 0), 1),
        "snapshot_count": row[4],
    } for row in result.all()]


@router.get("/stage-distribution")
async def stage_distribution(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = (
        select(Tool.deployment_stage, func.count(Tool.id))
        .where(Tool.is_active == True)
        .group_by(Tool.deployment_stage)
    )
    if scope is not None:
        query = query.where(Tool.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(Tool.company_id == company_id)

    result = await db.execute(query)
    return [{"stage": row[0], "label": STAGE_LABELS.get(row[0], "Unknown"), "count": row[1]}
            for row in result.all()]


@router.get("/board-report")
async def board_report(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
 
    fn_result = await db.execute(select(BusinessFunction).order_by(BusinessFunction.display_order))
    functions = fn_result.scalars().all()
 
    report_sections = []
    for bf in functions:
        # Get ALL adoption snapshots for this function (not limited to 10)
        snap_q = select(AdoptionSnapshot).where(AdoptionSnapshot.function_id == bf.id)
        if scope is not None:
            snap_q = snap_q.where(AdoptionSnapshot.company_id.in_(scope))
        if company_id:
            check_company_access(current_user, company_id)
            snap_q = snap_q.where(AdoptionSnapshot.company_id == company_id)
        snap_q = snap_q.order_by(AdoptionSnapshot.as_of_date.desc())
 
        snaps = (await db.execute(snap_q)).scalars().all()
 
        kpis = []
 
        if company_id:
            # Single company: show top 2 KPIs from that company's snapshots
            for s in snaps[:4]:
                tool_name = s.tool.name if s.tool else "Unknown"
                company_name = s.tool.company.name if s.tool and s.tool.company else ""
                for kpi_name, value, label in [
                    ("pct_licensed", s.pct_licensed, "% Licensed"),
                    ("pct_enabled", s.pct_enabled, "% Enabled"),
                ]:
                    if value is not None and len(kpis) < 2:
                        target_r = await db.execute(
                            select(KpiTarget).where(
                                KpiTarget.tool_id == s.tool_id,
                                KpiTarget.function_id == bf.id,
                                KpiTarget.kpi_name == kpi_name,
                            )
                        )
                        target = target_r.scalar_one_or_none()
                        baseline = float(target.baseline_value) if target and target.baseline_value else 0
                        target_val = float(target.target_value) if target and target.target_value else 100
                        current = float(value)
                        denom = target_val - baseline
                        progress = round((current - baseline) / denom * 100) if denom else 100
                        progress = max(0, min(100, progress))
                        kpis.append({
                            "tool_name": tool_name, "company_name": company_name,
                            "kpi_name": label, "baseline": baseline,
                            "current": current, "target": target_val,
                            "progress": progress, "as_of_date": str(s.as_of_date),
                        })
        else:
            # ALL companies: aggregate KPIs across portfolio
            # Calculate average % Licensed and % Enabled across all companies for this function
            licensed_values = []
            enabled_values = []
            latest_date = None
 
            for s in snaps:
                if s.pct_licensed is not None:
                    licensed_values.append(float(s.pct_licensed))
                if s.pct_enabled is not None:
                    enabled_values.append(float(s.pct_enabled))
                if latest_date is None and s.as_of_date:
                    latest_date = str(s.as_of_date)
 
            if licensed_values:
                avg_licensed = round(sum(licensed_values) / len(licensed_values), 2)
                kpis.append({
                    "tool_name": "Portfolio Average",
                    "company_name": f"{len(licensed_values)} tools",
                    "kpi_name": "% Licensed",
                    "baseline": 0, "current": avg_licensed, "target": 100,
                    "progress": max(0, min(100, round(avg_licensed))),
                    "as_of_date": latest_date or "",
                })
 
            if enabled_values:
                avg_enabled = round(sum(enabled_values) / len(enabled_values), 2)
                kpis.append({
                    "tool_name": "Portfolio Average",
                    "company_name": f"{len(enabled_values)} tools",
                    "kpi_name": "% Enabled",
                    "baseline": 0, "current": avg_enabled, "target": 100,
                    "progress": max(0, min(100, round(avg_enabled))),
                    "as_of_date": latest_date or "",
                })
 
        # Goals — get from all companies or filtered
        goals_q = select(ToolGoal).where(ToolGoal.function_id == bf.id)
        if company_id:
            # Filter goals by company through tool relationship
            goals_q = goals_q.join(Tool).where(Tool.company_id == company_id)
        goals_q = goals_q.limit(3)
        goals = (await db.execute(goals_q)).scalars().all()
 
        report_sections.append({
            "function_name": bf.display_name or bf.name,
            "function_id": bf.id,
            "icon": bf.icon or "",
            "gradient_from": bf.gradient_from or "#004D30",
            "gradient_to": bf.gradient_to or "#00D67B",
            "kpis": kpis,
            "goals": [{
                "tool_name": g.tool.name if g.tool else "Unknown",
                "first_order": g.first_order_goals,
                "second_order": g.second_order_goals,
                "third_order": g.third_order_goals,
            } for g in goals],
        })
 
    return {"sections": report_sections, "company_filter": company_id or "all"}
 


@router.get("/functions")
async def list_functions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BusinessFunction).order_by(BusinessFunction.display_order))
    fns = result.scalars().all()
    return [{"id": f.id, "name": f.name, "display_name": f.display_name,
             "display_order": f.display_order, "icon": f.icon} for f in fns]
