"""
FastAPI dependencies — auth, db session, tenant scoping.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import decode_token
from app.models import User

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "tb_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_tb_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("tb_admin", "tb_user"):
        raise HTTPException(status_code=403, detail="TB staff access required")
    return current_user


def get_company_scope(current_user: User) -> list[str] | None:
    """Returns company IDs the user can access, or None for full access."""
    if current_user.role in ("tb_admin", "tb_user"):
        return None  # unrestricted
    return current_user.company_ids


def check_company_access(current_user: User, company_id: str):
    """Raise 403 if user cannot access the given company."""
    if current_user.role in ("tb_admin", "tb_user"):
        return
    if company_id not in current_user.company_ids:
        raise HTTPException(status_code=403, detail="Access denied to this company")


def check_write_access(current_user: User, company_id: str):
    """Raise 403 if user cannot write to the given company."""
    if current_user.role == "tb_admin":
        return
    if current_user.role == "tb_user":
        raise HTTPException(status_code=403, detail="Read-only access")
    if company_id not in current_user.company_ids:
        raise HTTPException(status_code=403, detail="Access denied to this company")
