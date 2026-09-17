"""Governance contacts, Time-to-Value milestones, and Tool Goals."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, new_uuid, utcnow
from app.models import GovernanceContact, TimeToValue, ToolGoal, Tool, Company
from app.schemas import (GovernanceCreate, GovernanceUpdate, GovernanceResponse,
                         TTVCreate, TTVUpdate, TTVResponse,
                         GoalCreate, GoalUpdate, GoalResponse, PaginatedResponse)
from app.api.deps import get_current_user, check_company_access, check_write_access, get_company_scope
from app.services.audit import log_action

# ═══════════════ GOVERNANCE ═══════════════
gov_router = APIRouter(prefix="/governance", tags=["Governance"])

@gov_router.get("", response_model=PaginatedResponse)
async def list_governance(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    company_id: str | None = None, search: str | None = None,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(GovernanceContact)
    count_q = select(func.count(GovernanceContact.id))
    if scope is not None:
        query = query.where(GovernanceContact.company_id.in_(scope))
        count_q = count_q.where(GovernanceContact.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(GovernanceContact.company_id == company_id)
        count_q = count_q.where(GovernanceContact.company_id == company_id)
    if search:
        s = f"%{search}%"
        query = query.where((GovernanceContact.name.ilike(s)) | (GovernanceContact.role.ilike(s)) | (GovernanceContact.title.ilike(s)))
        count_q = count_q.where((GovernanceContact.name.ilike(s)) | (GovernanceContact.role.ilike(s)) | (GovernanceContact.title.ilike(s)))
    total = (await db.execute(count_q)).scalar()
    result = await db.execute(query.join(Company).order_by(Company.name).offset((page-1)*page_size).limit(page_size))
    contacts = result.scalars().all()
    items = [GovernanceResponse(
        id=c.id, company_id=c.company_id, company_name=c.company.name if c.company else None,
        name=c.name, title=c.title, role=c.role, email=c.email, phone=c.phone,
        function_name=c.function.display_name if c.function else None,
        is_primary=c.is_primary, created_at=c.created_at,
    ) for c in contacts]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=(total+page_size-1)//page_size)

@gov_router.post("", response_model=GovernanceResponse, status_code=201)
async def create_contact(data: GovernanceCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    check_write_access(current_user, data.company_id)
    contact = GovernanceContact(id=new_uuid(), **data.model_dump(), created_by=current_user.id, created_at=utcnow())
    db.add(contact)
    await db.flush()
    await log_action(db, "governance", contact.id, "create", user_id=current_user.id, user_email=current_user.email, company_id=data.company_id, new_value=data.name)
    return GovernanceResponse(id=contact.id, company_id=contact.company_id, name=contact.name, title=contact.title, role=contact.role, email=contact.email, is_primary=contact.is_primary, created_at=contact.created_at)

@gov_router.patch("/{contact_id}", response_model=GovernanceResponse)
async def update_contact(contact_id: str, data: GovernanceUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(GovernanceContact).where(GovernanceContact.id == contact_id))
    c = result.scalar_one_or_none()
    if not c: raise HTTPException(404, "Contact not found")
    check_write_access(current_user, c.company_id)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(c, field, val)
    c.updated_at = utcnow()
    await db.flush()
    await log_action(db, "governance", contact_id, "update", user_id=current_user.id, user_email=current_user.email, company_id=c.company_id)
    return GovernanceResponse(id=c.id, company_id=c.company_id, name=c.name, title=c.title, role=c.role, email=c.email, is_primary=c.is_primary, created_at=c.created_at)

@gov_router.delete("/{contact_id}", status_code=204)
async def delete_contact(contact_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(GovernanceContact).where(GovernanceContact.id == contact_id))
    c = result.scalar_one_or_none()
    if not c: raise HTTPException(404, "Contact not found")
    check_write_access(current_user, c.company_id)
    await db.delete(c)
    await log_action(db, "governance", contact_id, "delete", user_id=current_user.id, user_email=current_user.email, company_id=c.company_id)


# ═══════════════ TIME TO VALUE ═══════════════
ttv_router = APIRouter(prefix="/ttv", tags=["Time to Value"])

def compute_ttv(t: TimeToValue) -> TTVResponse:
    def days_between(a, b):
        return (b - a).days if a and b else None
    return TTVResponse(
        id=t.id, tool_id=t.tool_id, tool_name=t.tool.name if t.tool else None,
        company_id=t.company_id, company_name=t.tool.company.name if t.tool and t.tool.company else None,
        pilot_start=t.pilot_start, pilot_end=t.pilot_end,
        security_approval=t.security_approval, deploy_date=t.deploy_date, first_benefit=t.first_benefit,
        pilot_days=days_between(t.pilot_start, t.pilot_end),
        approval_days=days_between(t.pilot_end, t.security_approval),
        deploy_lag_days=days_between(t.security_approval, t.deploy_date),
        benefit_days=days_between(t.deploy_date, t.first_benefit),
        total_ttv_days=days_between(t.pilot_start, t.first_benefit),
        notes=t.notes, updated_at=t.updated_at,
    )

@ttv_router.get("", response_model=list[TTVResponse])
async def list_ttv(company_id: str | None = None, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    scope = get_company_scope(current_user)
    query = select(TimeToValue)
    if scope is not None: query = query.where(TimeToValue.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(TimeToValue.company_id == company_id)
    result = await db.execute(query)
    return [compute_ttv(t) for t in result.scalars().all()]

@ttv_router.post("", response_model=TTVResponse, status_code=201)
async def create_ttv(data: TTVCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    tool = (await db.execute(select(Tool).where(Tool.id == data.tool_id))).scalar_one_or_none()
    if not tool: raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)
    ttv = TimeToValue(id=new_uuid(), tool_id=data.tool_id, company_id=tool.company_id,
                      pilot_start=data.pilot_start, pilot_end=data.pilot_end,
                      security_approval=data.security_approval, deploy_date=data.deploy_date,
                      first_benefit=data.first_benefit, notes=data.notes, updated_by=current_user.id)
    db.add(ttv)
    await db.flush()
    await log_action(db, "ttv", ttv.id, "create", user_id=current_user.id, user_email=current_user.email, company_id=tool.company_id)
    result = await db.execute(select(TimeToValue).where(TimeToValue.id == ttv.id))
    return compute_ttv(result.scalar_one())

@ttv_router.patch("/{ttv_id}", response_model=TTVResponse)
async def update_ttv(ttv_id: str, data: TTVUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(TimeToValue).where(TimeToValue.id == ttv_id))
    t = result.scalar_one_or_none()
    if not t: raise HTTPException(404, "TTV not found")
    check_write_access(current_user, t.company_id)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(t, field, val)
    t.updated_at = utcnow()
    t.updated_by = current_user.id
    await db.flush()
    await log_action(db, "ttv", ttv_id, "update", user_id=current_user.id, user_email=current_user.email, company_id=t.company_id)
    result = await db.execute(select(TimeToValue).where(TimeToValue.id == ttv_id))
    return compute_ttv(result.scalar_one())


# ═══════════════ GOALS ═══════════════
goals_router = APIRouter(prefix="/goals", tags=["Goals"])

@goals_router.get("", response_model=list[GoalResponse])
async def list_goals(tool_id: str | None = None, company_id: str | None = None, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    query = select(ToolGoal)
    if tool_id: query = query.where(ToolGoal.tool_id == tool_id)
    result = await db.execute(query)
    return [GoalResponse(id=g.id, tool_id=g.tool_id, function_id=g.function_id,
            first_order_goals=g.first_order_goals, second_order_goals=g.second_order_goals,
            third_order_goals=g.third_order_goals, updated_at=g.updated_at) for g in result.scalars().all()]

@goals_router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(data: GoalCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    tool = (await db.execute(select(Tool).where(Tool.id == data.tool_id))).scalar_one_or_none()
    if not tool: raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)
    goal = ToolGoal(id=new_uuid(), **data.model_dump(), updated_by=current_user.id)
    db.add(goal)
    await db.flush()
    return GoalResponse(id=goal.id, tool_id=goal.tool_id, function_id=goal.function_id,
           first_order_goals=goal.first_order_goals, second_order_goals=goal.second_order_goals,
           third_order_goals=goal.third_order_goals, updated_at=goal.updated_at)

@goals_router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(goal_id: str, data: GoalUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(ToolGoal).where(ToolGoal.id == goal_id))
    g = result.scalar_one_or_none()
    if not g: raise HTTPException(404, "Goal not found")
    tool = (await db.execute(select(Tool).where(Tool.id == g.tool_id))).scalar_one_or_none()
    if tool: check_write_access(current_user, tool.company_id)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(g, field, val)
    g.updated_at = utcnow()
    g.updated_by = current_user.id
    await db.flush()
    return GoalResponse(id=g.id, tool_id=g.tool_id, function_id=g.function_id,
           first_order_goals=g.first_order_goals, second_order_goals=g.second_order_goals,
           third_order_goals=g.third_order_goals, updated_at=g.updated_at)
