"""Tool inventory CRUD — scoped by company access."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db, new_uuid, utcnow
from app.models import Tool, ToolFunction, Company
from app.schemas import ToolCreate, ToolUpdate, ToolResponse, PaginatedResponse
from app.core.security import STAGE_LABELS
from app.api.deps import get_current_user, check_company_access, check_write_access, get_company_scope
from app.services.audit import log_action

router = APIRouter(prefix="/tools", tags=["Tools"])


def tool_to_response(t: Tool) -> ToolResponse:
    return ToolResponse(
        id=t.id, company_id=t.company_id,
        portco_name=t.company.name if t.company else None,  # RENAMED from company_name
        name=t.name, vendor=t.vendor, product=t.product, use_case=t.use_case,  # ADDED product
        biz_owner_name=t.biz_owner_name, biz_owner_role=t.biz_owner_role,
        tech_owner_name=t.tech_owner_name, tech_owner_role=t.tech_owner_role,
        project_spend=float(t.project_spend) if t.project_spend else None,
        annual_spend=float(t.annual_spend) if t.annual_spend else None,
        pricing_model=t.pricing_model, token_limit=t.token_limit,
        deployment_stage=t.deployment_stage,
        deployment_stage_label=STAGE_LABELS.get(t.deployment_stage),
        fail_reason=t.fail_reason, complexity=t.complexity, is_active=t.is_active,
        function_names=[tf.function.display_name or tf.function.name for tf in t.functions if tf.function],
        created_at=t.created_at, updated_at=t.updated_at,
    )


@router.get("", response_model=PaginatedResponse)
async def list_tools(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    company_id: str | None = None, stage: int | None = None,
    function_id: str | None = None, search: str | None = None,
    pricing_model: str | None = None, complexity: str | None = None,
    product: str | None = None,  # ADDED
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(Tool).where(Tool.is_active == True)
    count_q = select(func.count(Tool.id)).where(Tool.is_active == True)

    if scope is not None:
        query = query.where(Tool.company_id.in_(scope))
        count_q = count_q.where(Tool.company_id.in_(scope))
    if company_id:
        check_company_access(current_user, company_id)
        query = query.where(Tool.company_id == company_id)
        count_q = count_q.where(Tool.company_id == company_id)
    if stage is not None:
        query = query.where(Tool.deployment_stage == stage)
        count_q = count_q.where(Tool.deployment_stage == stage)
    if search:
        s = f"%{search}%"
        query = query.where((Tool.name.ilike(s)) | (Tool.vendor.ilike(s)))
        count_q = count_q.where((Tool.name.ilike(s)) | (Tool.vendor.ilike(s)))
    if pricing_model:
        query = query.where(Tool.pricing_model == pricing_model)
        count_q = count_q.where(Tool.pricing_model == pricing_model)
    if complexity:
        query = query.where(Tool.complexity == complexity)
        count_q = count_q.where(Tool.complexity == complexity)
    if product:  # ADDED
        query = query.where(Tool.product == product)
        count_q = count_q.where(Tool.product == product)

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        query.join(Company).order_by(Company.name, Tool.name)
        .offset((page - 1) * page_size).limit(page_size)
    )
    tools = result.scalars().unique().all()

    return PaginatedResponse(
        items=[tool_to_response(t) for t in tools],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=ToolResponse, status_code=201)
async def create_tool(data: ToolCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    check_write_access(current_user, data.company_id)

    tool = Tool(
        id=new_uuid(), company_id=data.company_id, name=data.name, vendor=data.vendor,
        product=data.product, use_case=data.use_case, biz_owner_name=data.biz_owner_name, biz_owner_role=data.biz_owner_role,
        tech_owner_name=data.tech_owner_name, tech_owner_role=data.tech_owner_role,
        project_spend=data.project_spend, annual_spend=data.annual_spend,
        pricing_model=data.pricing_model, token_limit=data.token_limit,
        deployment_stage=data.deployment_stage, fail_reason=data.fail_reason,
        complexity=data.complexity, created_by=current_user.id, created_at=utcnow(),
    )
    db.add(tool)
    await db.flush()

    for fid in data.function_ids:
        db.add(ToolFunction(id=new_uuid(), tool_id=tool.id, function_id=fid))
    await db.flush()

    await log_action(db, "tool", tool.id, "create", user_id=current_user.id,
                     user_email=current_user.email, company_id=data.company_id, new_value=data.name)

    result = await db.execute(select(Tool).where(Tool.id == tool.id))
    return tool_to_response(result.scalar_one())


@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(tool_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_company_access(current_user, tool.company_id)
    return tool_to_response(tool)


@router.patch("/{tool_id}", response_model=ToolResponse)
async def update_tool(tool_id: str, data: ToolUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)

    update_data = data.model_dump(exclude_unset=True)
    function_ids = update_data.pop("function_ids", None)
    for field, val in update_data.items():
        old = getattr(tool, field)
        if val != old:
            await log_action(db, "tool", tool_id, "update", user_id=current_user.id,
                             user_email=current_user.email, company_id=tool.company_id,
                             field_changed=field, old_value=str(old), new_value=str(val))
            setattr(tool, field, val)

    if function_ids is not None:
        await db.execute(delete(ToolFunction).where(ToolFunction.tool_id == tool_id))
        for fid in function_ids:
            db.add(ToolFunction(id=new_uuid(), tool_id=tool_id, function_id=fid))

    tool.updated_at = utcnow()
    tool.updated_by = current_user.id
    await db.flush()

    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    return tool_to_response(result.scalar_one())


@router.patch("/{tool_id}/stage")
async def update_stage(tool_id: str, stage: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    if stage < 0 or stage > 4:
        raise HTTPException(400, "Stage must be 0-4")
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)

    old_stage = tool.deployment_stage
    tool.deployment_stage = stage
    if stage == 4 and not tool.fail_reason:
        tool.fail_reason = "Other"
    tool.updated_at = utcnow()
    tool.updated_by = current_user.id
    await db.flush()

    await log_action(db, "tool", tool_id, "update", user_id=current_user.id,
                     user_email=current_user.email, company_id=tool.company_id,
                     field_changed="deployment_stage",
                     old_value=STAGE_LABELS.get(old_stage), new_value=STAGE_LABELS.get(stage))
    return {"status": "ok", "tool_id": tool_id, "stage": stage, "label": STAGE_LABELS.get(stage)}


@router.delete("/{tool_id}", status_code=204)
async def delete_tool(tool_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")
    check_write_access(current_user, tool.company_id)
    tool.is_active = False
    tool.updated_at = utcnow()
    await log_action(db, "tool", tool_id, "delete", user_id=current_user.id,
                     user_email=current_user.email, company_id=tool.company_id, old_value=tool.name)
