from fastapi import APIRouter
from app.api.routes.equipment import router as equipment_router
from app.api.routes.maintenance import router as maintenance_router
from app.api.routes.inventory import router as inventory_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(equipment_router)
api_router.include_router(maintenance_router)
api_router.include_router(inventory_router)
