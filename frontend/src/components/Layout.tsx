import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/alerts", label: "Alerts" },
  { to: "/equipment", label: "Equipment" },
  { to: "/work-orders", label: "Work Orders" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/inspections", label: "Inspections" },
  { to: "/inventory", label: "Inventory" },
  { to: "/fuel", label: "Fuel & Costs" },
  { to: "/purchases", label: "Purchases" },
  { to: "/fleet-management", label: "Fleet Management" },
  { to: "/analytics", label: "Analytics" },
  { to: "/reports", label: "Reports" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ count: number }>("/api/v1/admin/alerts");
        if (!cancelled) setAlertCount(res.count);
      } catch {
        if (!cancelled) setAlertCount(null);
      }
    })();
    const t = window.setInterval(() => {
      void api
        .get<{ count: number }>("/api/v1/admin/alerts")
        .then((res) => {
          if (!cancelled) setAlertCount(res.count);
        })
        .catch(() => undefined);
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>MMMS</h1>
          <span>Machinery Maintenance</span>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
              {l.to === "/alerts" && alertCount != null && alertCount > 0 && (
                <span className="nav-badge">{alertCount > 99 ? "99+" : alertCount}</span>
              )}
            </NavLink>
          ))}
          {(user?.role === "admin" || user?.role === "manager") && (
            <>
              <NavLink to="/audit" className={({ isActive }) => (isActive ? "active" : "")}>
                Audit Trail
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
                Users
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div>{user?.full_name}</div>
          <div style={{ textTransform: "capitalize" }}>{user?.role}</div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {user?.email}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
