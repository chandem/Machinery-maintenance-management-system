from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.core.pagination import Page, PageParams, paginate
from app.models.inventory import Part
from app.models.purchase import PurchaseRequest
from app.models.user import User
from app.schemas.purchase import PurchaseRequestCreate, PurchaseRequestRead, PurchaseRequestUpdate

router = APIRouter(prefix="/purchase-requests", tags=["Purchase"])

PR_TRANSITIONS = {
    "draft": {"submitted", "cancelled"},
    "submitted": {"approved", "cancelled"},
    "approved": {"ordered", "cancelled"},
    "ordered": {"received", "cancelled"},
    "received": set(),
    "cancelled": set(),
}


@router.post("", response_model=PurchaseRequestRead, status_code=status.HTTP_201_CREATED)
def create_purchase_request(
    payload: PurchaseRequestCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.get(Part, payload.part_id) is None:
        raise HTTPException(404, "Part not found")
    item = PurchaseRequest(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=Page[PurchaseRequestRead])
def list_purchase_requests(
    status_filter: str | None = None,
    part_id: int | None = None,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
):
    query = select(PurchaseRequest).order_by(PurchaseRequest.id.desc())
    if status_filter:
        query = query.where(PurchaseRequest.status == status_filter)
    if part_id is not None:
        query = query.where(PurchaseRequest.part_id == part_id)
    return paginate(db, query, params, PurchaseRequestRead)


@router.patch("/{request_id}", response_model=PurchaseRequestRead)
def update_purchase_request(
    request_id: int,
    payload: PurchaseRequestUpdate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    item = db.get(PurchaseRequest, request_id)
    if item is None:
        raise HTTPException(404, "Purchase request not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        new_status = data["status"]
        if new_status != item.status:
            allowed = PR_TRANSITIONS.get(item.status, set())
            if new_status not in allowed:
                raise HTTPException(
                    400,
                    f"Invalid status transition: {item.status} -> {new_status}. Allowed: {sorted(allowed) or 'none'}",
                )
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item
