from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.maintenance import add_work_order_part, get_work_order_cost, return_work_order_part
from app.core.database import Base
from app.models import Equipment, Inventory, Part, PartTransaction, WorkOrder
from app.schemas.maintenance import WorkOrderCreate, WorkOrderPartCreate, WorkOrderPartReturn, WorkOrderLaborCreate


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


def seed_work_order(db: Session):
    equipment = Equipment(asset_code="EX-001", name="Excavator")
    part = Part(part_number="FLT-001", name="Oil Filter", unit_cost=Decimal("100.00"))
    db.add_all([equipment, part])
    db.flush()
    db.add(Inventory(part_id=part.id, quantity_on_hand=Decimal("10.00"), location="Main Store"))
    db.flush()
    order = WorkOrder(
        work_order_number="WO-001",
        equipment_id=equipment.id,
        title="Routine service",
        maintenance_type="preventive",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order, part


def test_issue_return_and_cost_summary(db: Session):
    order, part = seed_work_order(db)

    item = add_work_order_part(
        order.id,
        WorkOrderPartCreate(part_id=part.id, quantity=Decimal("2.00")),
        db,
    )
    inventory = db.scalar(select(Inventory).where(Inventory.part_id == part.id))
    assert inventory.quantity_on_hand == Decimal("8.00")
    assert item.quantity == Decimal("2.00")
    assert db.scalar(select(PartTransaction).where(PartTransaction.transaction_type == "out")).quantity == Decimal("2.00")
    assert db.get(WorkOrder, order.id).actual_cost == Decimal("200.00")

    summary = get_work_order_cost(order.id, db)
    assert summary.parts_cost == Decimal("200.00")
    assert summary.labor_cost == Decimal("0")
    assert summary.total_cost == Decimal("200.00")

    return_work_order_part(
        order.id,
        item.id,
        WorkOrderPartReturn(quantity=Decimal("0.50"), notes="Unused filter stock"),
        db,
    )
    assert inventory.quantity_on_hand == Decimal("8.50")
    assert db.get(WorkOrder, order.id).actual_cost == Decimal("150.00")

    summary = get_work_order_cost(order.id, db)
    assert summary.parts_cost == Decimal("150.00")
    assert summary.total_cost == Decimal("150.00")


def test_return_cannot_exceed_remaining_quantity(db: Session):
    order, part = seed_work_order(db)
    item = add_work_order_part(
        order.id,
        WorkOrderPartCreate(part_id=part.id, quantity=Decimal("2.00")),
        db,
    )

    with pytest.raises(HTTPException) as exc:
        return_work_order_part(
            order.id,
            item.id,
            WorkOrderPartReturn(quantity=Decimal("2.01")),
            db,
        )
    assert exc.value.status_code == 400


def test_cost_summary_includes_labor(db: Session):
    order, part = seed_work_order(db)
    add_work_order_part(
        order.id,
        WorkOrderPartCreate(part_id=part.id, quantity=Decimal("1.00")),
        db,
    )

    from app.api.routes.maintenance import add_work_order_labor

    add_work_order_labor(
        order.id,
        WorkOrderLaborCreate(worker_name="Technician", hours=Decimal("3.00"), hourly_rate=Decimal("50.00")),
        db,
    )

    summary = get_work_order_cost(order.id, db)
    assert summary.parts_cost == Decimal("100.00")
    assert summary.labor_cost == Decimal("150.00")
    assert summary.total_cost == Decimal("250.00")
