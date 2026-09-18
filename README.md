# Machinery Maintenance Management System (MMMS)

A web-based system for managing construction and industrial machinery, maintenance, inspections, work orders, spare parts, operators, costs, and equipment availability.

## Core objectives

- Central equipment and asset registry
- Preventive and corrective maintenance
- Maintenance scheduling and work orders
- Service history and meter readings
- Spare-parts and inventory control
- Equipment downtime and availability tracking
- Maintenance cost tracking
- Inspection and compliance records
- Dashboard and reporting
- Role-based access control
- Audit trail
- Future-ready IoT/telematics and predictive-maintenance integration

## Current API capabilities (v0.2)

| Area | Endpoints |
|------|-----------|
| **Health** | `GET /health` |
| **Dashboard** | `GET /api/v1/dashboard/summary` |
| **Equipment** | CRUD + search/filter by status, category, location |
| **Categories / Locations / Operators** | Create + list (+ operator update) |
| **Meter readings** | Create (auto-updates equipment meters) + list |
| **Maintenance plans** | Create, list, complete service, schedule status |
| **Work orders** | Create, list (filter), update with **status lifecycle validation**, parts issue/return, labor, cost |
| **Inventory** | Suppliers, parts, stock levels, transactions, low-stock status |

### Work-order status lifecycle

```
Draft → Scheduled → In Progress → Completed → Verified → Closed
                 ↘ cancelled at most stages
```

Invalid transitions are rejected by the API.

## Initial architecture

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

## Main modules

1. Dashboard
2. Equipment
3. Maintenance
4. Work Orders
5. Inspections
6. Spare Parts & Inventory
7. Operators
8. Fuel & Operating Hours
9. Costs
10. Reports
11. Notifications
12. Users, Roles & Audit Logs
13. Settings

## Development principle

Build the reliable operational core first, then add analytics, automation, telematics, and predictive maintenance.

## Status

Backend foundation + equipment, maintenance, inventory, and dashboard APIs are in place. Authentication and frontend are next.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
