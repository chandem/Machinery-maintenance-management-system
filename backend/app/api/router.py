from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.equipment import router as equipment_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.maintenance import router as maintenance_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(equipment_router)
api_router.include_router(maintenance_router)
api_router.include_router(inventory_router)
