# MMMS Frontend

React + TypeScript (Vite) UI for the Machinery Maintenance Management System.

## Run locally

Backend must be running on port 8000 (or set `VITE_API_BASE`).

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` and `/health` to the backend.

## Features (shell)

- Login / register (JWT)
- Dashboard KPIs + due maintenance
- Equipment list (search, filter, create, pagination)
- Work orders list (filter, pagination)
- Maintenance schedule status

## Build

```bash
npm run build
```
