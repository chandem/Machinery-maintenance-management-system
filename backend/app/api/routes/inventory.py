from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models import Inventory, Part, PartTransaction, Supplier
from app.schemas.inventory import (
    InventoryCreate,
    InventoryRead,
    InventoryStatusRead,
    PartCreate,
    PartRead,
    PartTransactionCreate,
    PartTransactionRead,
    SupplierCreate,
    SupplierRead,
)

router = APIRouter(tags=["Inventory"])


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if db.scalar(select(Supplier).where(Supplier.name == payload.name)):
        raise HTTPException(409, "Supplier name already exists")
    item = Supplier(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(db: Session = Depends(get_db)):
    return list(db.scalars(select(Supplier).order_by(Supplier.name)).all())


@router.post("/parts", response_model=PartRead, status_code=status.HTTP_201_CREATED)
def create_part(payload: PartCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if db.scalar(select(Part).where(Part.part_number == payload.part_number)):
        raise HTTPException(409, "Part number already exists")
    if payload.supplier_id and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(404, "Supplier not found")
    item = Part(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/parts", response_model=Page[PartRead])
def list_parts(params: PageParams = Depends(), db: Session = Depends(get_db)):
    query = select(Part).order_by(Part.name)
    return paginate(db, query, params, PartRead)


@router.post("/inventory", response_model=InventoryRead, status_code=status.HTTP_201_CREATED)
def create_inventory(payload: InventoryCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if not db.get(Part, payload.part_id):
        raise HTTPException(404, "Part not found")
    if db.scalar(select(Inventory).where(Inventory.part_id == payload.part_id)):
        raise HTTPException(409, "Inventory record already exists")
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/inventory", response_model=Page[InventoryRead])
def list_inventory(params: PageParams = Depends(), db: Session = Depends(get_db)):
    query = select(Inventory).order_by(Inventory.id)
    return paginate(db, query, params, InventoryRead)


@router.get("/inventory/status", response_model=list[InventoryStatusRead])
def inventory_status(low_stock_only: bool = False, db: Session = Depends(get_db)):
    rows = db.execute(select(Inventory, Part).join(Part, Part.id == Inventory.part_id).order_by(Part.name)).all()
    result = []
    for inventory, part in rows:
        if inventory.quantity_on_hand <= 0:
            stock_status = "out_of_stock"
        elif inventory.quantity_on_hand <= part.reorder_level:
            stock_status = "low_stock"
        else:
            stock_status = "ok"
        if low_stock_only and stock_status == "ok":
            continue
        result.append(
            InventoryStatusRead(
                id=inventory.id,
                part_id=part.id,
                part_number=part.part_number,
                part_name=part.name,
                quantity_on_hand=inventory.quantity_on_hand,
                reorder_level=part.reorder_level,
                status=stock_status,
                location=inventory.location,
            )
        )
    return result


@router.post("/inventory/transactions", response_model=PartTransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: PartTransactionCreate, db: Session = Depends(get_db), _: object = Depends(require_write_user)):
    if not db.get(Part, payload.part_id):
        raise HTTPException(404, "Part not found")
    inventory = db.scalar(select(Inventory).where(Inventory.part_id == payload.part_id))
    if not inventory:
        raise HTTPException(404, "Inventory record not found")
    if payload.transaction_type == "out":
        if inventory.quantity_on_hand < payload.quantity:
            raise HTTPException(400, "Insufficient stock")
        inventory.quantity_on_hand -= payload.quantity
    elif payload.transaction_type == "in":
        inventory.quantity_on_hand += payload.quantity
    else:
        inventory.quantity_on_hand = payload.quantity
    tx = PartTransaction(**payload.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.get("/inventory/transactions", response_model=Page[PartTransactionRead])
def list_transactions(
    part_id: int | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(PartTransaction).order_by(PartTransaction.id.desc())
    if part_id is not None:
        query = query.where(PartTransaction.part_id == part_id)
    return paginate(db, query, params, PartTransactionRead)
