"""User management — admin creates users, assigns to companies."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db, new_uuid, utcnow
from app.models import User, UserCompany
from app.schemas import UserCreate, UserUpdate, UserResponse, PaginatedResponse
from app.core.security import hash_password
from app.api.deps import get_current_user, get_admin_user
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    query = select(User)
    count_q = select(func.count(User.id))
    if role:
        query = query.where(User.role == role)
        count_q = count_q.where(User.role == role)
    if search:
        s = f"%{search}%"
        query = query.where((User.email.ilike(s)) | (User.first_name.ilike(s)) | (User.last_name.ilike(s)))
        count_q = count_q.where((User.email.ilike(s)) | (User.first_name.ilike(s)) | (User.last_name.ilike(s)))

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()

    return PaginatedResponse(
        items=[UserResponse(id=u.id, email=u.email, first_name=u.first_name, last_name=u.last_name,
               role=u.role, is_active=u.is_active, company_ids=u.company_ids,
               last_login_at=u.last_login_at, created_at=u.created_at) for u in users],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        id=new_uuid(), email=data.email, password_hash=hash_password(data.password),
        first_name=data.first_name, last_name=data.last_name,
        role=data.role, created_by=current_user.id, created_at=utcnow(),
    )
    db.add(user)
    await db.flush()

    for cid in data.company_ids:
        db.add(UserCompany(id=new_uuid(), user_id=user.id, company_id=cid, assigned_by=current_user.id))
    await db.flush()

    await log_action(db, "user", user.id, "create", user_id=current_user.id,
                     user_email=current_user.email, new_value=data.email)
    return UserResponse(id=user.id, email=user.email, first_name=user.first_name,
                       last_name=user.last_name, role=user.role, is_active=user.is_active,
                       company_ids=data.company_ids, created_at=user.created_at)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "company_user" and current_user.id != user_id:
        raise HTTPException(403, "Cannot view other users")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse(id=user.id, email=user.email, first_name=user.first_name,
                       last_name=user.last_name, role=user.role, is_active=user.is_active,
                       company_ids=user.company_ids, last_login_at=user.last_login_at, created_at=user.created_at)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str, data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    for field in ["first_name", "last_name", "role", "is_active"]:
        val = getattr(data, field)
        if val is not None:
            setattr(user, field, val)
    user.updated_at = utcnow()

    if data.company_ids is not None:
        await db.execute(delete(UserCompany).where(UserCompany.user_id == user_id))
        for cid in data.company_ids:
            db.add(UserCompany(id=new_uuid(), user_id=user_id, company_id=cid, assigned_by=current_user.id))

    await db.flush()
    await log_action(db, "user", user_id, "update", user_id=current_user.id, user_email=current_user.email)
    return UserResponse(id=user.id, email=user.email, first_name=user.first_name,
                       last_name=user.last_name, role=user.role, is_active=user.is_active,
                       company_ids=user.company_ids, last_login_at=user.last_login_at, created_at=user.created_at)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = False
    user.updated_at = utcnow()
    await log_action(db, "user", user_id, "delete", user_id=current_user.id, user_email=current_user.email)
