from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogPage, AuditLogRead

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=AuditLogPage)
def list_audit_logs(
    user: Annotated[User, Depends(require_roles("admin", "manager"))],
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
):
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)

    total = db.scalar(count_query) or 0
    rows = db.scalars(
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    pages = (total + page_size - 1) // page_size if total else 0
    return AuditLogPage(
        items=[AuditLogRead.model_validate(row, from_attributes=True) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
