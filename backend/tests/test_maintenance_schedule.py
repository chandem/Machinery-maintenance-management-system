from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.maintenance import complete_maintenance_service, create_work_order, maintenance_plan_status, update_work_order
from app.core.database import Base
from app.models import Equipment, MaintenancePlan
from app.schemas.maintenance import MaintenanceServiceComplete, WorkOrderCreate, WorkOrderUpdate


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)


def seed(db: Session):
    equipment = Equipment(asset_code="EX-100", name="Excavator", hour_meter=Decimal("1000"))
    db.add(equipment)
    db.flush()
    plan = MaintenancePlan(
        equipment_id=equipment.id,
        name="Engine service",
        interval_days=30,
        interval_hours=Decimal("250"),
        next_due_date=date.today(),
        next_due_meter=Decimal("1000"),
        active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return equipment, plan


def test_complete_service_advances_date_and_meter(db: Session):
    _, plan = seed(db)
    result = complete_maintenance_service(
        plan.id,
        MaintenanceServiceComplete(service_date=date.today(), service_meter=Decimal("1000")),
        db,
    )
    assert result.last_service_date == date.today()
    assert result.last_service_meter == Decimal("1000.00")
    assert result.next_due_date == date.today() + timedelta(days=30)
    assert result.next_due_meter == Decimal("1250.00")
    assert maintenance_plan_status(db)[0].status == "scheduled"


def test_complete_service_rejects_early_date(db: Session):
    _, plan = seed(db)
    with pytest.raises(Exception):
        complete_maintenance_service(
            plan.id,
            MaintenanceServiceComplete(
                service_date=date.today() - timedelta(days=1),
                service_meter=Decimal("1000"),
            ),
            db,
        )


def test_preventive_work_order_completion_advances_plan(db: Session):
    equipment, plan = seed(db)
    order = create_work_order(
        WorkOrderCreate(
            work_order_number="WO-PM-001",
            equipment_id=equipment.id,
            maintenance_plan_id=plan.id,
            title="Engine service",
            maintenance_type="preventive",
        ),
        db,
    )
    result = update_work_order(order.id, WorkOrderUpdate(status="completed"), db)
    db.refresh(plan)
    assert result.status == "completed"
    assert plan.last_service_date == date.today()
    assert plan.next_due_date == date.today() + timedelta(days=30)
    assert plan.next_due_meter == Decimal("1250.00")


def test_work_order_rejects_plan_for_other_equipment(db: Session):
    equipment, plan = seed(db)
    other = Equipment(asset_code="LD-200", name="Loader", hour_meter=Decimal("500"))
    db.add(other)
    db.commit()
    db.refresh(other)
    with pytest.raises(Exception):
        create_work_order(
            WorkOrderCreate(
                work_order_number="WO-BAD-001",
                equipment_id=other.id,
                maintenance_plan_id=plan.id,
                title="Wrong equipment",
            ),
            db,
        )


def test_work_order_part_issuance_updates_stock_transaction_and_cost(db: Session):
    equipment, _ = seed(db)
    part = Part(
        part_number="FLT-001",
        name="Engine Filter",
        unit="pcs",
        unit_cost=Decimal("150"),
        reorder_level=2,
    )
    db.add(part)
    db.flush()
    inventory = Inventory(part_id=part.id, quantity_on_hand=Decimal("10"), location="Main Store")
    db.add(inventory)
    order = create_work_order(
        WorkOrderCreate(
            work_order_number="WO-PART-001",
            equipment_id=equipment.id,
            title="Filter replacement",
        ),
        db,
    )
    db.commit()

    result = add_work_order_part(
        order.id,
        WorkOrderPartCreate(part_id=part.id, quantity=Decimal("3")),
        db,
    )
    db.refresh(inventory)
    db.refresh(order)
    tx = db.scalar(
        select(PartTransaction).where(
            PartTransaction.part_id == part.id,
            PartTransaction.transaction_type == "out",
        )
    )

    assert result.quantity == Decimal("3.00")
    assert inventory.quantity_on_hand == Decimal("7.00")
    assert tx is not None
    assert tx.quantity == Decimal("3.00")
    assert tx.reference == "WO:WO-PART-001:PART:" + str(part.id)
    assert order.actual_cost == Decimal("450.00")


def test_work_order_part_issuance_rejects_insufficient_stock(db: Session):
    equipment, _ = seed(db)
    part = Part(part_number="FLT-002", name="Hydraulic Filter", unit_cost=Decimal("100"))
    db.add(part)
    db.flush()
    db.add(Inventory(part_id=part.id, quantity_on_hand=Decimal("2")))
    order = create_work_order(
        WorkOrderCreate(
            work_order_number="WO-PART-002",
            equipment_id=equipment.id,
            title="Hydraulic filter replacement",
        ),
        db,
    )
    db.commit()

    with pytest.raises(Exception):
        add_work_order_part(
            order.id,
            WorkOrderPartCreate(part_id=part.id, quantity=Decimal("3")),
            db,
        )


def test_return_work_order_part_restores_stock_and_reduces_cost(db: Session):
    equipment, _ = seed(db)
    part = Part(part_number="FLT-003", name="Fuel Filter", unit_cost=Decimal("200"))
    db.add(part)
    db.flush()
    inventory = Inventory(part_id=part.id, quantity_on_hand=Decimal("10"))
    db.add(inventory)
    order = create_work_order(
        WorkOrderCreate(
            work_order_number="WO-PART-003",
            equipment_id=equipment.id,
            title="Fuel filter replacement",
        ),
        db,
    )
    db.commit()

    item = add_work_order_part(
        order.id,
        WorkOrderPartCreate(part_id=part.id, quantity=Decimal("4")),
        db,
    )
    returned = return_work_order_part(
        order.id,
        item.id,
        WorkOrderPartReturn(quantity=Decimal("1"), notes="Unused filter"),
        db,
    )
    db.refresh(inventory)
    db.refresh(order)

    assert returned.id == item.id
    assert inventory.quantity_on_hand == Decimal("7.00")
    assert order.actual_cost == Decimal("600.00")

    with pytest.raises(Exception):
        return_work_order_part(
            order.id,
            item.id,
            WorkOrderPartReturn(quantity=Decimal("4")),
            db,
        )
