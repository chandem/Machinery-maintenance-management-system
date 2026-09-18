# MMMS Backend

FastAPI backend foundation for the Machinery Maintenance Management System.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check: `GET /health`
