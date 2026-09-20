from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_write_user
from app.core.database import get_db
from app.models.documents import EquipmentDocument
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.documents import EquipmentDocumentCreate, EquipmentDocumentRead

router = APIRouter(tags=["Documents"])


@router.post("/documents", response_model=EquipmentDocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: EquipmentDocumentCreate,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    if db.get(Equipment, payload.equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    item = EquipmentDocument(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/documents", response_model=list[EquipmentDocumentRead])
def list_documents(equipment_id: int | None = None, db: Session = Depends(get_db)):
    query = select(EquipmentDocument).order_by(EquipmentDocument.id.desc())
    if equipment_id is not None:
        query = query.where(EquipmentDocument.equipment_id == equipment_id)
    return list(db.scalars(query).all())


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: User | None = Depends(require_write_user),
):
    item = db.get(EquipmentDocument, document_id)
    if item is None:
        raise HTTPException(404, "Document not found")
    db.delete(item)
    db.commit()
