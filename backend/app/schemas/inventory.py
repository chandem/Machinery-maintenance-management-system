from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class SupplierRead(SupplierCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PartCreate(BaseModel):
    part_number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    unit: str = "pcs"
    unit_cost: Optional[Decimal] = Field(default=None, ge=0)
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0)
    supplier_id: Optional[int] = None


class PartRead(PartCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class InventoryCreate(BaseModel):
    part_id: int
    quantity_on_hand: Decimal = Field(default=Decimal("0"), ge=0)
    location: Optional[str] = None


class InventoryRead(InventoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class InventoryStatusRead(BaseModel):
    id: int
    part_id: int
    part_number: str
    part_name: str
    quantity_on_hand: Decimal
    reorder_level: Decimal
    status: str
    location: Optional[str]


class PartTransactionCreate(BaseModel):
    part_id: int
    transaction_type: str = Field(pattern="^(in|out|adjustment)$")
    quantity: Decimal = Field(gt=0)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0)
    reference: Optional[str] = None
    notes: Optional[str] = None


class PartTransactionRead(PartTransactionCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)
