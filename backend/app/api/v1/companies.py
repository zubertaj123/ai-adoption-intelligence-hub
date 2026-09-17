"""Company portfolio management — admin creates/edits companies."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, new_uuid, utcnow
from app.models import Company, Tool
from app.schemas import CompanyCreate, CompanyUpdate, CompanyResponse, PaginatedResponse
from app.api.deps import get_current_user, get_admin_user, get_company_scope, check_company_access
from app.services.audit import log_action

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=PaginatedResponse)
async def list_companies(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    search: str | None = None, sector: str | None = None, is_active: bool = True,
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(Company).where(Company.is_active == is_active)
    count_q = select(func.count(Company.id)).where(Company.is_active == is_active)

    if scope is not None:
        query = query.where(Company.id.in_(scope))
        count_q = count_q.where(Company.id.in_(scope))
    if search:
        s = f"%{search}%"
        query = query.where(Company.name.ilike(s))
        count_q = count_q.where(Company.name.ilike(s))
    if sector:
        query = query.where(Company.sector == sector)
        count_q = count_q.where(Company.sector == sector)

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(query.order_by(Company.name).offset((page - 1) * page_size).limit(page_size))
    companies = result.scalars().all()

    items = []
    for c in companies:
        tool_count = len([t for t in c.tools if t.is_active]) if c.tools else 0
        spend = sum(float(t.annual_spend or 0) for t in c.tools if t.is_active) if c.tools else 0
        items.append(CompanyResponse(
            id=c.id, name=c.name, display_name=c.display_name, sector=c.sector,
            description=c.description, website=c.website, employee_count=c.employee_count,
            hq_location=c.hq_location, is_active=c.is_active,
            initial_load_at=c.initial_load_at, created_at=c.created_at,
            tools_count=tool_count, total_spend=spend,
        ))

    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size,
                            total_pages=(total + page_size - 1) // page_size)


@router.post("", response_model=CompanyResponse, status_code=201)
async def create_company(data: CompanyCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_admin_user)):
    existing = await db.execute(select(Company).where(Company.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Company already exists")

    company = Company(id=new_uuid(), **data.model_dump(), created_by=current_user.id, created_at=utcnow())
    db.add(company)
    await db.flush()
    await log_action(db, "company", company.id, "create", user_id=current_user.id,
                     user_email=current_user.email, new_value=data.name)
    return CompanyResponse(id=company.id, name=company.name, display_name=company.display_name,
                          sector=company.sector, description=company.description, is_active=True,
                          created_at=company.created_at, website=company.website,
                          employee_count=company.employee_count, hq_location=company.hq_location)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    check_company_access(current_user, company_id)
    result = await db.execute(select(Company).where(Company.id == company_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")

    tool_count = len([t for t in c.tools if t.is_active]) if c.tools else 0
    spend = sum(float(t.annual_spend or 0) for t in c.tools if t.is_active) if c.tools else 0
    return CompanyResponse(
        id=c.id, name=c.name, display_name=c.display_name, sector=c.sector,
        description=c.description, website=c.website, employee_count=c.employee_count,
        hq_location=c.hq_location, is_active=c.is_active,
        initial_load_at=c.initial_load_at, created_at=c.created_at,
        tools_count=tool_count, total_spend=spend,
    )


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: str, data: CompanyUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_admin_user)):
    result = await db.execute(select(Company).where(Company.id == company_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(c, field, val)
    c.updated_at = utcnow()
    await db.flush()
    await log_action(db, "company", company_id, "update", user_id=current_user.id,
                     user_email=current_user.email, company_id=company_id)
    return CompanyResponse(id=c.id, name=c.name, display_name=c.display_name, sector=c.sector,
                          description=c.description, is_active=c.is_active, created_at=c.created_at,
                          website=c.website, employee_count=c.employee_count, hq_location=c.hq_location)


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_admin_user)):
    result = await db.execute(select(Company).where(Company.id == company_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")
    c.is_active = False
    c.updated_at = utcnow()
    await log_action(db, "company", company_id, "delete", user_id=current_user.id,
                     user_email=current_user.email, company_id=company_id)
