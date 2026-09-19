from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PurchaseRequestCreate(BaseModel):
    part_id: int
    quantity: Decimal = Field(gt=0)
    requested_by: Optional[str] = None
    notes: Optional[str] = None
    status: str = "draft"


class PurchaseRequestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quantity: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[str] = None
    notes: Optional[str] = None
    requested_by: Optional[str] = None


class PurchaseRequestRead(BaseModel):
    id: int
    part_id: int
    quantity: Decimal
    status: str
    requested_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
