# Machinery Maintenance Management System (MMMS)

A web-based system for managing construction and industrial machinery, maintenance, inspections, work orders, spare parts, operators, costs, and equipment availability.

## Quick start (Docker)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8000 |
| **API docs** | http://localhost:8000/docs |

Register the first user in the UI (becomes **admin**), or via API:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","full_name":"Admin","password":"secret123"}'
```

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# start Postgres, then:
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:8000`.

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT auth
- **Frontend:** React 18, TypeScript, Vite, React Router

## Current capabilities (v0.3 + frontend shell)

### API
Auth, dashboard summary, equipment (CRUD + filters + pagination), categories/locations/operators, meter readings, maintenance plans & schedule status, work orders (lifecycle, parts, labor, cost), inventory.

### UI
- Login / register
- Dashboard KPIs + due/overdue plans
- Equipment list (search, status filter, create, pagination)
- Work orders list (status filter, pagination)
- Maintenance schedule view

## Status

Backend foundation + React shell are in place. Next: richer detail pages, inventory UI, and locking API routes behind auth.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
