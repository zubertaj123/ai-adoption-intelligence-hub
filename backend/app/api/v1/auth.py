"""Auth endpoints — login, refresh, current user."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db, utcnow
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserResponse, RefreshRequest
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.api.deps import get_current_user
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token_data = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "company_ids": user.company_ids,
    }
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    await db.execute(update(User).where(User.id == user.id).values(last_login_at=utcnow()))
    await log_action(db, "user", user.id, "login", user_id=user.id, user_email=user.email)

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse(
            id=user.id, email=user.email, first_name=user.first_name,
            last_name=user.last_name, role=user.role, is_active=user.is_active,
            company_ids=user.company_ids, last_login_at=user.last_login_at,
            created_at=user.created_at,
        )
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == payload["sub"], User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": user.id, "email": user.email, "role": user.role, "company_ids": user.company_ids}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=UserResponse(
            id=user.id, email=user.email, first_name=user.first_name,
            last_name=user.last_name, role=user.role, is_active=user.is_active,
            company_ids=user.company_ids, last_login_at=user.last_login_at,
            created_at=user.created_at,
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id, email=current_user.email,
        first_name=current_user.first_name, last_name=current_user.last_name,
        role=current_user.role, is_active=current_user.is_active,
        company_ids=current_user.company_ids,
        last_login_at=current_user.last_login_at, created_at=current_user.created_at,
    )
