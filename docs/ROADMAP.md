# MMMS Roadmap

## Phase 1 — Foundation
- [x] Repository initialized
- [x] Product scope defined
- [x] Initial architecture documented
- [x] Backend application skeleton (FastAPI)
- [x] Database schema (Alembic migrations)
- [x] Authentication (JWT register/login, roles)
- [x] Pagination on list endpoints
- [x] Docker Compose (Postgres + API)
- [ ] Frontend shell
- [x] CI pipeline (compile + pytest)

## Phase 2 — Equipment Management
- [x] Equipment CRUD
- [x] Categories CRUD
- [x] Locations CRUD
- [x] Equipment status + search/filter
- [x] Meter readings (create + list, auto-sync equipment meters)
- [x] Operators CRUD
- [ ] Equipment documents
- [ ] QR identification

## Phase 3 — Maintenance
- [x] Maintenance plans
- [x] Maintenance schedule status (due / overdue)
- [x] Work orders + status lifecycle validation
- [x] Parts consumption on work orders (issue / return)
- [x] Labor tracking + cost roll-up
- [x] Work-order cost endpoint
- [ ] Task checklist on work orders
- [ ] Maintenance history views

## Phase 4 — Operations
- [ ] Inspections
- [ ] Defect management
- [ ] Fuel records
- [ ] Operator assignment history
- [ ] Downtime tracking
- [ ] Availability metrics

## Phase 5 — Inventory & Reporting
- [x] Spare-parts inventory + suppliers
- [x] Stock status / low-stock alerts
- [x] Part transactions
- [x] Dashboard summary KPIs
- [ ] Purchase requests
- [ ] Cost reports
- [ ] Equipment utilization
- [ ] Full maintenance KPI dashboard

## Phase 6 — Advanced Intelligence
- [ ] Notifications
- [ ] Automated scheduling
- [ ] Telematics integration
- [ ] Predictive maintenance
- [ ] Failure-risk scoring
- [ ] Fleet analytics
