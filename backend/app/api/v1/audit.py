"""Audit log — read-only access to mutation history."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import AuditLog
from app.schemas import PaginatedResponse
from app.api.deps import get_current_user, get_company_scope

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=PaginatedResponse)
async def list_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entity_type: str | None = None,
    action: str | None = None,
    company_id: str | None = None,
    user_email: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scope = get_company_scope(current_user)
    query = select(AuditLog)
    count_q = select(func.count(AuditLog.id))

    if scope is not None:
        query = query.where(AuditLog.company_id.in_(scope))
        count_q = count_q.where(AuditLog.company_id.in_(scope))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_q = count_q.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
        count_q = count_q.where(AuditLog.action == action)
    if company_id:
        query = query.where(AuditLog.company_id == company_id)
        count_q = count_q.where(AuditLog.company_id == company_id)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))
        count_q = count_q.where(AuditLog.user_email.ilike(f"%{user_email}%"))

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    entries = result.scalars().all()

    return PaginatedResponse(
        items=[{
            "id": e.id, "entity_type": e.entity_type, "entity_id": e.entity_id,
            "action": e.action, "field_changed": e.field_changed,
            "old_value": e.old_value, "new_value": e.new_value,
            "company_id": e.company_id, "user_email": e.user_email,
            "ip_address": e.ip_address, "created_at": str(e.created_at),
        } for e in entries],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )
