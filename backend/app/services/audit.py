from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def record_audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    description: str,
    user: Optional[User] = None,
) -> AuditLog:
    # Route functions receive a real User through FastAPI dependency injection.
    # Some unit tests call route functions directly, where an unresolved Depends
    # object can be passed instead. Treat that case as an anonymous audit entry.
    user_id = getattr(user, "id", None)

    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(entry)
    return entry
