from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    maintenance_type: Mapped[str] = mapped_column(String(30), default="preventive", index=True)
    interval_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    interval_days: Mapped[Optional[int]] = mapped_column()
    last_service_date: Mapped[Optional[date]] = mapped_column(Date)
    last_service_meter: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    next_due_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    next_due_meter: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), index=True)
    active: Mapped[bool] = mapped_column(default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    equipment: Mapped["Equipment"] = relationship(back_populates="maintenance_plans")
    work_orders: Mapped[list["WorkOrder"]] = relationship(back_populates="maintenance_plan")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id", ondelete="CASCADE"), index=True)
    maintenance_plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("maintenance_plans.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    maintenance_type: Mapped[str] = mapped_column(String(30), default="corrective", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", index=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    scheduled_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    estimated_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    actual_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    equipment: Mapped["Equipment"] = relationship(back_populates="work_orders")
    maintenance_plan: Mapped[Optional[MaintenancePlan]] = relationship(back_populates="work_orders")
    tasks: Mapped[list["WorkOrderTask"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")
    parts: Mapped[list["WorkOrderPart"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")
    labor: Mapped[list["WorkOrderLabor"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")


class WorkOrderLabor(Base):
    __tablename__ = "work_order_labor"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), index=True)
    worker_name: Mapped[str] = mapped_column(String(150))
    role: Mapped[Optional[str]] = mapped_column(String(100))
    hours: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    work_order: Mapped[WorkOrder] = relationship(back_populates="labor")


class WorkOrderTask(Base):
    __tablename__ = "work_order_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    estimated_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    actual_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    work_order: Mapped[WorkOrder] = relationship(back_populates="tasks")
