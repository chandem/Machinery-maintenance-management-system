from fastapi import FastAPI

from app.api.router import api_router

app = FastAPI(title="Machinery Maintenance Management System", version="0.1.0")
app.include_router(api_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "mmms-api"}
