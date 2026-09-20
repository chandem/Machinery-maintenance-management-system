from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router

app = FastAPI(
    title="Machinery Maintenance Management System",
    version="0.4.0",
    description=(
        "Web API for construction and industrial machinery maintenance, "
        "work orders, spare parts, meter readings, inspections, and reports."
    ),
    contact={"name": "MMMS"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "mmms-api", "version": "0.4.0"}
