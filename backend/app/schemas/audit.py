from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[int]
    description: str
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
    pages: int
