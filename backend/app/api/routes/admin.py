"""Admin utilities: demo seed data and operational alerts feed."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.equipment import Equipment, EquipmentCategory, Location, Operator
from app.models.inventory import Inventory, Part
from app.models.maintenance import MaintenancePlan, WorkOrder
from app.models.operations import DowntimeEvent, Inspection
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])


class AlertItem(BaseModel):
    level: str  # danger | warn | info
    category: str
    title: str
    detail: str
    href: str | None = None


class AlertsResponse(BaseModel):
    generated_at: datetime
    count: int
    items: list[AlertItem]


class SeedResponse(BaseModel):
    message: str
    created: dict


@router.get("/alerts", response_model=AlertsResponse)
def operational_alerts(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager", "technician", "viewer")),
):
    """Aggregated actionable alerts for the header / alerts page."""
    items: list[AlertItem] = []
    today = date.today()

    plans = db.execute(
        select(MaintenancePlan, Equipment)
        .join(Equipment, Equipment.id == MaintenancePlan.equipment_id)
        .where(MaintenancePlan.active.is_(True))
    ).all()
    for plan, eq in plans:
        overdue = plan.next_due_date is not None and plan.next_due_date < today
        meter_over = (
            plan.next_due_meter is not None
            and eq.hour_meter is not None
            and eq.hour_meter > plan.next_due_meter
        )
        if overdue or meter_over:
            items.append(
                AlertItem(
                    level="danger",
                    category="maintenance",
                    title="Overdue maintenance plan",
                    detail=f"{eq.asset_code}: {plan.name}",
                    href=f"/equipment/{eq.id}",
                )
            )

    down = db.scalars(select(Equipment).where(Equipment.status.in_(("down", "out_of_service")))).all()
    for eq in down:
        items.append(
            AlertItem(
                level="danger",
                category="equipment",
                title="Equipment not operational",
                detail=f"{eq.asset_code} — {eq.status}",
                href=f"/equipment/{eq.id}",
            )
        )

    open_dt = db.scalars(select(DowntimeEvent).where(DowntimeEvent.ended_at.is_(None)).limit(20)).all()
    for ev in open_dt:
        eq = db.get(Equipment, ev.equipment_id)
        code = eq.asset_code if eq else f"#{ev.equipment_id}"
        items.append(
            AlertItem(
                level="warn",
                category="downtime",
                title="Open downtime event",
                detail=f"{code}: {ev.reason}",
                href=f"/equipment/{ev.equipment_id}",
            )
        )

    open_insp = db.scalars(select(Inspection).where(Inspection.status == "open").limit(20)).all()
    for insp in open_insp:
        eq = db.get(Equipment, insp.equipment_id)
        code = eq.asset_code if eq else f"#{insp.equipment_id}"
        items.append(
            AlertItem(
                level="warn",
                category="inspection",
                title="Open inspection",
                detail=f"{code}: {insp.inspection_type}",
                href="/inspections",
            )
        )

    inv_rows = db.execute(select(Inventory, Part).join(Part, Part.id == Inventory.part_id)).all()
    for inv, part in inv_rows:
        if inv.quantity_on_hand <= 0:
            items.append(
                AlertItem(
                    level="danger",
                    category="inventory",
                    title="Part out of stock",
                    detail=f"{part.part_number} — {part.name}",
                    href="/inventory",
                )
            )
        elif inv.quantity_on_hand <= part.reorder_level:
            items.append(
                AlertItem(
                    level="warn",
                    category="inventory",
                    title="Low stock",
                    detail=f"{part.part_number}: {inv.quantity_on_hand} on hand (reorder {part.reorder_level})",
                    href="/inventory",
                )
            )

    open_wo = db.scalar(
        select(func.count())
        .select_from(WorkOrder)
        .where(WorkOrder.status.in_(("draft", "scheduled", "in_progress")), WorkOrder.priority == "critical")
    ) or 0
    if open_wo:
        items.append(
            AlertItem(
                level="danger",
                category="work_order",
                title="Critical open work orders",
                detail=f"{open_wo} critical job(s) still open",
                href="/work-orders",
            )
        )

    # priority sort
    order = {"danger": 0, "warn": 1, "info": 2}
    items.sort(key=lambda a: order.get(a.level, 9))
    items = items[:40]

    return AlertsResponse(
        generated_at=datetime.now(timezone.utc),
        count=len(items),
        items=items,
    )


@router.post("/seed", response_model=SeedResponse)
def seed_demo_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Populate sample categories, locations, operators, equipment, parts (idempotent-ish)."""
    created: dict[str, int] = {}

    def ensure_category(name: str) -> EquipmentCategory:
        row = db.scalar(select(EquipmentCategory).where(EquipmentCategory.name == name))
        if row:
            return row
        row = EquipmentCategory(name=name, description=f"{name} equipment")
        db.add(row)
        db.flush()
        created["categories"] = created.get("categories", 0) + 1
        return row

    def ensure_location(name: str) -> Location:
        row = db.scalar(select(Location).where(Location.name == name))
        if row:
            return row
        row = Location(name=name)
        db.add(row)
        db.flush()
        created["locations"] = created.get("locations", 0) + 1
        return row

    cat_exc = ensure_category("Excavator")
    cat_truck = ensure_category("Haul Truck")
    loc_yard = ensure_location("Main Yard")
    loc_site = ensure_location("Site A")

    op = db.scalar(select(Operator).where(Operator.employee_code == "OP-001"))
    if not op:
        op = Operator(employee_code="OP-001", full_name="Demo Operator", phone="+10000000000", active=True)
        db.add(op)
        db.flush()
        created["operators"] = 1

    samples = [
        ("EXC-100", "CAT 320D", cat_exc.id, loc_yard.id, "operational", Decimal("4200")),
        ("EXC-101", "Komatsu PC210", cat_exc.id, loc_site.id, "maintenance", Decimal("5100")),
        ("TRK-200", "Volvo A40G", cat_truck.id, loc_yard.id, "operational", Decimal("18000")),
        ("TRK-201", "CAT 777G", cat_truck.id, loc_site.id, "down", Decimal("22000")),
    ]
    eq_ids = []
    for code, name, cat_id, loc_id, status, hours in samples:
        eq = db.scalar(select(Equipment).where(Equipment.asset_code == code))
        if not eq:
            eq = Equipment(
                asset_code=code,
                name=name,
                manufacturer=name.split()[0],
                status=status,
                hour_meter=hours,
                category_id=cat_id,
                location_id=loc_id,
                operator_id=op.id,
            )
            db.add(eq)
            db.flush()
            created["equipment"] = created.get("equipment", 0) + 1
        eq_ids.append(eq.id)

    # Plans
    for eq_id in eq_ids[:2]:
        exists = db.scalar(
            select(MaintenancePlan).where(
                MaintenancePlan.equipment_id == eq_id,
                MaintenancePlan.name == "250h service",
            )
        )
        if not exists:
            db.add(
                MaintenancePlan(
                    equipment_id=eq_id,
                    name="250h service",
                    maintenance_type="preventive",
                    interval_hours=Decimal("250"),
                    interval_days=90,
                    next_due_date=date.today() - timedelta(days=2),
                    next_due_meter=Decimal("4500"),
                    active=True,
                )
            )
            created["plans"] = created.get("plans", 0) + 1

    # Parts + inventory
    parts_spec = [
        ("FLT-01", "Hydraulic filter", Decimal("45.00"), Decimal("5"), Decimal("12")),
        ("OIL-15W40", "Engine oil 15W40 (20L)", Decimal("68.00"), Decimal("4"), Decimal("2")),
        ("BRK-PAD", "Brake pad set", Decimal("120.00"), Decimal("2"), Decimal("0")),
    ]
    for pnum, pname, cost, reorder, qty in parts_spec:
        part = db.scalar(select(Part).where(Part.part_number == pnum))
        if not part:
            part = Part(part_number=pnum, name=pname, unit_cost=cost, reorder_level=reorder, unit="pcs")
            db.add(part)
            db.flush()
            created["parts"] = created.get("parts", 0) + 1
        inv = db.scalar(select(Inventory).where(Inventory.part_id == part.id))
        if not inv:
            db.add(Inventory(part_id=part.id, quantity_on_hand=qty, location="Main store"))
            created["inventory"] = created.get("inventory", 0) + 1

    db.commit()
    if not created:
        return SeedResponse(message="Demo data already present", created={})
    return SeedResponse(message="Demo data seeded", created=created)
