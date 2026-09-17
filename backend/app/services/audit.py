"""
Audit service — append-only log of all data mutations.
Drives the activity feed and provides compliance trail.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog
from app.database import new_uuid, utcnow


async def log_action(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    action: str,
    user_id: str | None = None,
    user_email: str | None = None,
    company_id: str | None = None,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    ip_address: str | None = None,
):
    entry = AuditLog(
        id=new_uuid(),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        field_changed=field_changed,
        old_value=str(old_value)[:1000] if old_value is not None else None,
        new_value=str(new_value)[:1000] if new_value is not None else None,
        company_id=company_id,
        user_id=user_id,
        user_email=user_email,
        ip_address=ip_address,
        created_at=utcnow(),
    )
    db.add(entry)
