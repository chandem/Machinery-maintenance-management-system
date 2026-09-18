from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.maintenance import maintenance_plan_status
from app.core.database import Base
from app.models import Equipment, MaintenancePlan


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


def seed(db: Session, due_date=None, due_meter=None, hour_meter=None):
    equipment = Equipment(asset_code="EX-100", name="Excavator", hour_meter=hour_meter)
    db.add(equipment)
    db.flush()
    plan = MaintenancePlan(
        equipment_id=equipment.id,
        name="Engine service",
        next_due_date=due_date,
        next_due_meter=due_meter,
        active=True,
    )
    db.add(plan)
    db.commit()


def test_schedule_status_due_by_date(db: Session):
    seed(db, due_date=date.today())
    result = maintenance_plan_status(db)
    assert result[0].status == "due"


def test_schedule_status_overdue_by_date(db: Session):
    seed(db, due_date=date.today() - timedelta(days=1))
    result = maintenance_plan_status(db)
    assert result[0].status == "overdue"


def test_schedule_status_due_by_meter(db: Session):
    seed(db, due_meter=Decimal("1000"), hour_meter=Decimal("1000"))
    result = maintenance_plan_status(db)
    assert result[0].status == "due"
    assert result[0].current_meter == Decimal("1000.00")


def test_schedule_status_overdue_by_meter(db: Session):
    seed(db, due_meter=Decimal("1000"), hour_meter=Decimal("1001"))
    result = maintenance_plan_status(db)
    assert result[0].status == "overdue"


def test_schedule_status_scheduled(db: Session):
    seed(db, due_date=date.today() + timedelta(days=10), due_meter=Decimal("2000"), hour_meter=Decimal("1500"))
    result = maintenance_plan_status(db)
    assert result[0].status == "scheduled"
