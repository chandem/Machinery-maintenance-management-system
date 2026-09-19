# MMMS Roadmap

## Phase 1 — Foundation
- [x] Repository initialized
- [x] Product scope defined
- [x] Initial architecture documented
- [x] Backend application skeleton (FastAPI)
- [x] Database schema (Alembic migrations)
- [x] Authentication (JWT register/login, roles)
- [x] Pagination on list endpoints
- [x] Docker Compose (Postgres + API + frontend)
- [x] Frontend shell (React/TypeScript)
- [x] CI pipeline (compile + pytest)

## Phase 2 — Equipment Management
- [x] Equipment CRUD (API + UI list/create)
- [x] Equipment detail page (status, meters, linked WOs)
- [x] Categories / Locations / Operators CRUD (API)
- [x] Equipment status + search/filter
- [x] Meter readings (API + UI record)
- [ ] Equipment documents
- [ ] QR identification

## Phase 3 — Maintenance
- [x] Maintenance plans (API)
- [x] Maintenance schedule status (API + UI)
- [x] Work orders + status lifecycle (API + UI transitions)
- [x] Work order create + detail (UI)
- [x] Parts consumption on work orders (API)
- [x] Labor tracking + cost roll-up (API + UI cost summary)
- [ ] Parts/labor issue from UI
- [ ] Task checklist on work orders

## Phase 4 — Operations
- [ ] Inspections
- [ ] Defect management
- [ ] Fuel records
- [ ] Operator assignment history
- [ ] Downtime tracking
- [ ] Availability metrics

## Phase 5 — Inventory & Reporting
- [x] Spare-parts inventory + suppliers (API)
- [x] Stock status / low-stock (API + UI)
- [x] Add part + stock (UI)
- [x] Part transactions (API)
- [x] Dashboard summary KPIs (API + UI)
- [ ] Purchase requests
- [ ] Cost reports
- [ ] Equipment utilization

## Phase 6 — Advanced Intelligence
- [ ] Notifications
- [ ] Automated scheduling
- [ ] Telematics integration
- [ ] Predictive maintenance
- [ ] Failure-risk scoring
- [ ] Fleet analytics
