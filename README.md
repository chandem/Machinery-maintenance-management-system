# Machinery Maintenance Management System (MMMS)

A web-based system for managing construction and industrial machinery, maintenance, inspections, work orders, spare parts, operators, costs, and equipment availability.

## Quick start (Docker)

```bash
docker compose up --build
```

API: http://localhost:8000  ·  Docs: http://localhost:8000/docs

Then register the first user (becomes **admin** automatically):

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","full_name":"Admin","password":"secret123"}'
```

Login (OAuth2 form or JSON):

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin@example.com&password=secret123"
```

## Local (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# start Postgres, then:
alembic upgrade head
uvicorn app.main:app --reload
```

## Current API capabilities (v0.3)

| Area | Endpoints |
|------|-----------|
| **Health** | `GET /health` |
| **Auth** | `POST /auth/register`, `/auth/login`, `/auth/login/json`, `GET /auth/me`, user list/update (admin) |
| **Dashboard** | `GET /api/v1/dashboard/summary` |
| **Equipment** | CRUD + search/filter + **pagination** |
| **Categories / Locations / Operators** | Create + list (+ operator update) |
| **Meter readings** | Create + paginated list |
| **Maintenance plans** | Create, paginated list, complete service, schedule status |
| **Work orders** | Create, paginated list, status lifecycle, parts, labor, cost |
| **Inventory** | Suppliers, parts, stock, transactions (paginated where useful) |

### Pagination

List endpoints that return collections use:

```
?page=1&page_size=20
```

Response shape:

```json
{
  "items": [ ... ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

### Roles

`admin` · `manager` · `technician` · `viewer`  
First registered user is promoted to **admin**. Auth is available; most business routes are still open so you can explore without a token. Protect them with `Depends(get_current_user)` when ready.

### Work-order status lifecycle

```
Draft → Scheduled → In Progress → Completed → Verified → Closed
                 ↘ cancelled at most stages
```

## Architecture

```
Frontend (React/TypeScript)   ← planned
        |
        v
REST API (FastAPI/Python)
        |
        +---- PostgreSQL
        +---- File/Object Storage
        +---- Background Jobs
        |
        +---- Future: IoT / GPS / Telematics / ML
```

## Status

Backend foundation complete through auth, pagination, equipment, maintenance, inventory, and dashboard. Frontend shell is next.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
