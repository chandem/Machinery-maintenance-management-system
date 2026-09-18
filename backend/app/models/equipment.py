from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EquipmentCategory(Base):
    __tablename__ = "equipment_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)

    equipment: Mapped[list["Equipment"]] = relationship(back_populates="category")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)

    equipment: Mapped[list["Equipment"]] = relationship(back_populates="location")


class Operator(Base):
    __tablename__ = "operators"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    license_number: Mapped[Optional[str]] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(default=True, nullable=False)

    equipment: Mapped[list["Equipment"]] = relationship(back_populates="operator")


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(100))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    plate_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date)
    purchase_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="operational", index=True)
    hour_meter: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    odometer: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    warranty_expiry: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment_categories.id"))
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id"))
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("operators.id"))

    category: Mapped[Optional[EquipmentCategory]] = relationship(back_populates="equipment")
    location: Mapped[Optional[Location]] = relationship(back_populates="equipment")
    operator: Mapped[Optional[Operator]] = relationship(back_populates="equipment")
    meter_readings: Mapped[list["MeterReading"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), index=True)
    reading_type: Mapped[str] = mapped_column(String(30))
    reading_value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    source: Mapped[Optional[str]] = mapped_column(String(50))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    equipment: Mapped[Equipment] = relationship(back_populates="meter_readings")
