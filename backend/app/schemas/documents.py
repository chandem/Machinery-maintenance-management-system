from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class EquipmentDocumentCreate(BaseModel):
    equipment_id: int
    title: str = Field(min_length=1, max_length=200)
    document_type: str = "other"
    url: str = Field(min_length=1, max_length=500)
    notes: Optional[str] = None


class EquipmentDocumentRead(BaseModel):
    id: int
    equipment_id: int
    title: str
    document_type: str
    url: str
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
