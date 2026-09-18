from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Inventory, Part, PartTransaction, Supplier
from app.schemas.inventory import (
    InventoryCreate,
    InventoryRead,
    PartCreate,
    PartRead,
    PartTransactionCreate,
    PartTransactionRead,
    SupplierCreate,
    SupplierRead,
)

router = APIRouter(tags=["inventory"])


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Supplier).where(Supplier.name == payload.name)):
        raise HTTPException(409, "Supplier name already exists")
    item = Supplier(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(db: Session = Depends(get_db)):
    return db.scalars(select(Supplier).order_by(Supplier.name)).all()


@router.post("/parts", response_model=PartRead, status_code=status.HTTP_201_CREATED)
def create_part(payload: PartCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Part).where(Part.part_number == payload.part_number)):
        raise HTTPException(409, "Part number already exists")
    if payload.supplier_id and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(404, "Supplier not found")
    item = Part(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/parts", response_model=list[PartRead])
def list_parts(db: Session = Depends(get_db)):
    return db.scalars(select(Part).order_by(Part.name)).all()


@router.post("/inventory", response_model=InventoryRead, status_code=status.HTTP_201_CREATED)
def create_inventory(payload: InventoryCreate, db: Session = Depends(get_db)):
    if not db.get(Part, payload.part_id):
        raise HTTPException(404, "Part not found")
    if db.scalar(select(Inventory).where(Inventory.part_id == payload.part_id)):
        raise HTTPException(409, "Inventory record already exists")
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/inventory", response_model=list[InventoryRead])
def list_inventory(db: Session = Depends(get_db)):
    return db.scalars(select(Inventory).order_by(Inventory.id)).all()


@router.post("/inventory/transactions", response_model=PartTransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: PartTransactionCreate, db: Session = Depends(get_db)):
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


@router.get("/inventory/transactions", response_model=list[PartTransactionRead])
def list_transactions(part_id: int | None = None, db: Session = Depends(get_db)):
    query = select(PartTransaction)
    if part_id is not None:
        query = query.where(PartTransaction.part_id == part_id)
    return db.scalars(query.order_by(PartTransaction.id.desc())).all()
