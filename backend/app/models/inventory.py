from decimal import Decimal
from typing import Optional

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    parts: Mapped[list["Part"]] = relationship(back_populates="supplier")


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_number: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(30), default="pcs")
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    reorder_level: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))

    supplier: Mapped[Optional[Supplier]] = relationship(back_populates="parts")
    inventory: Mapped[Optional["Inventory"]] = relationship(back_populates="part", cascade="all, delete-orphan", uselist=False)


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"), unique=True, index=True)
    quantity_on_hand: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    location: Mapped[Optional[str]] = mapped_column(String(150))

    part: Mapped[Part] = relationship(back_populates="inventory")


class PartTransaction(Base):
    __tablename__ = "part_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    reference: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
