# MMMS Roadmap

## Phase 1 — Foundation
- [x] FastAPI, Alembic, JWT, pagination, Docker, React shell, CI
- [x] Auth required on write endpoints (`REQUIRE_AUTH_WRITES`)

## Phase 2 — Equipment
- [x] CRUD, detail, meters, status, categories/locations/operators API
- [x] QR identification payload + image URL on equipment detail
- [ ] Document uploads

## Phase 3 — Maintenance
- [x] Plans (API + create UI), schedule status, work orders + lifecycle
- [x] Parts, labor, tasks, cost on WO detail

## Phase 4 — Operations
- [x] Inspections (API + UI)
- [x] Fuel (API + equipment UI)
- [x] Downtime (API + equipment UI)
- [ ] Richer defect workflow / availability KPIs

## Phase 5 — Inventory & Purchasing
- [x] Parts, stock, transactions, dashboard
- [x] Purchase requests (API + UI lifecycle)
- [ ] Cost / utilization reports

## Phase 6 — Advanced
- [ ] Notifications, telematics, predictive, multi-tenant
