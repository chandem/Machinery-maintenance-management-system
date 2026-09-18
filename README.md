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

## Initial architecture

```
Frontend (React/TypeScript)
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

Initial repository architecture.
