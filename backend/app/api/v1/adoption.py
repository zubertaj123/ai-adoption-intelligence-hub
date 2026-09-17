"""Adoption snapshots — submit new adoption data, retrieve history."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, new_uuid, utcnow
from app.models import AdoptionSnapshot, Tool
from app.schemas import AdoptionSnapshotCreate, AdoptionSnapshotResponse, PaginatedResponse
from app.api.deps import get_current_user, check_company_access, check_write_access, get_company_scope
from app.services.audit import log_action

router = APIRouter(prefix="/adoption", tags=["Adoption"])


def snap_to_response(s: AdoptionSnapshot) -> AdoptionSnapshotResponse:
    return AdoptionSnapshotResponse(
        id=s.id, tool_id=s.tool_id, function_id=s.function_id,
        tool_name=s.tool.name if s.tool else None,
        function_name=s.function.display_name if s.function else None,
        company_id=s.company_id, as_of_date=s.as_of_date,
        employee_pool=s.employee_pool, licenses_bought=s.licenses_bought,
        employees_enabled=s.employees_enabled, avg_daily_users=s.avg_daily_users,
        pct_licensed=float(s.pct_licensed) if s.pct_licensed else None,
        pct_enabled=float(s.pct_enabled) if s.pct_enabled else None,
        pct_daily_usage=float(s.pct_daily_usage) if s.pct_daily_usage else None,
        source=s.source, notes=s.notes, created_at=s.created_at,
    )


@router.get("", response_model=PaginatedResponse)
async def list_snapshots(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    company_id: str | None = None, tool_id: str | None = None,
    function_id: str | None = None, latest_only: bool = False,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(AdoptionSnapshot)
    count_q = select(func.count(AdoptionSnapshot.id))

    if scope is not None:
        query = query.where(AdoptionSnapshot.company_id.in_(scope))
        count_q = count_q.where(AdoptionSnapshot.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(AdoptionSnapshot.company_id == company_id)
        count_q = count_q.where(AdoptionSnapshot.company_id == company_id)
    if tool_id:
        query = query.where(AdoptionSnapshot.tool_id == tool_id)
        count_q = count_q.where(AdoptionSnapshot.tool_id == tool_id)
    if function_id:
        query = query.where(AdoptionSnapshot.function_id == function_id)
        count_q = count_q.where(AdoptionSnapshot.function_id == function_id)

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        query.order_by(AdoptionSnapshot.as_of_date.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    snaps = result.scalars().all()
    return PaginatedResponse(
        items=[snap_to_response(s) for s in snaps],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=AdoptionSnapshotResponse, status_code=201)
async def create_snapshot(data: AdoptionSnapshotCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    tool_result = await db.execute(select(Tool).where(Tool.id == data.tool_id))
    tool = tool_result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)

    pct_l = round(data.licenses_bought / data.employee_pool * 100, 2) if data.employee_pool and data.licenses_bought else None
    pct_e = round(data.employees_enabled / data.licenses_bought * 100, 2) if data.licenses_bought and data.employees_enabled else None
    pct_d = round(data.avg_daily_users / data.employees_enabled * 100, 2) if data.employees_enabled and data.avg_daily_users else None

    snap = AdoptionSnapshot(
        id=new_uuid(), tool_id=data.tool_id, function_id=data.function_id,
        company_id=tool.company_id, as_of_date=data.as_of_date,
        employee_pool=data.employee_pool, licenses_bought=data.licenses_bought,
        employees_enabled=data.employees_enabled, avg_daily_users=data.avg_daily_users,
        pct_licensed=pct_l, pct_enabled=pct_e, pct_daily_usage=pct_d,
        source="manual", notes=data.notes, created_by=current_user.id, created_at=utcnow(),
    )
    db.add(snap)
    await db.flush()

    await log_action(db, "adoption", snap.id, "create", user_id=current_user.id,
                     user_email=current_user.email, company_id=tool.company_id,
                     new_value=f"{tool.name} adoption as of {data.as_of_date}")

    result = await db.execute(select(AdoptionSnapshot).where(AdoptionSnapshot.id == snap.id))
    return snap_to_response(result.scalar_one())


@router.get("/history/{tool_id}")
async def get_tool_adoption_history(
    tool_id: str, function_id: str | None = None,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user),
):
    tool_result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = tool_result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_company_access(current_user, tool.company_id)

    query = select(AdoptionSnapshot).where(AdoptionSnapshot.tool_id == tool_id)
    if function_id:
        query = query.where(AdoptionSnapshot.function_id == function_id)
    query = query.order_by(AdoptionSnapshot.as_of_date.asc())

    result = await db.execute(query)
    snaps = result.scalars().all()
    return [snap_to_response(s) for s in snaps]
