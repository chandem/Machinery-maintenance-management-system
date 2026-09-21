from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.documents import router as documents_router
from app.api.routes.equipment import router as equipment_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.maintenance import router as maintenance_router
from app.api.routes.operations import router as operations_router
from app.api.routes.purchase import router as purchase_router
from app.api.routes.reports import router as reports_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(dashboard_router)
api_router.include_router(equipment_router)
api_router.include_router(maintenance_router)
api_router.include_router(inventory_router)
api_router.include_router(operations_router)
api_router.include_router(purchase_router)
api_router.include_router(documents_router)
api_router.include_router(reports_router)
