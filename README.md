# Machinery Maintenance Management System (MMMS)

Web CMMS for construction and industrial machinery: assets, maintenance, work orders, spare parts, inspections, fuel, downtime, purchases, and reports.

## Quick start (Docker)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8000 |
| **API docs** | http://localhost:8000/docs |

Register the first user in the UI (becomes **admin**). Write endpoints require JWT when `REQUIRE_AUTH_WRITES=true`.

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT
- **Frontend:** React 18, TypeScript, Vite, React Router

## Capabilities (v0.4)

- Auth (register/login, roles)
- Equipment CRUD, meters, QR, categories/locations/operators
- Maintenance plans + schedule status + analytics
- Work orders (lifecycle, parts, labor, tasks, cost)
- Inventory, stock status, transactions
- Inspections, fuel, downtime
- Purchase requests
- Equipment document metadata (URL links)
- Reports: cost by asset, fleet availability
- Dashboard KPIs

## Local development

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
