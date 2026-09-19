import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/equipment", label: "Equipment" },
  { to: "/work-orders", label: "Work Orders" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/inventory", label: "Inventory" },
];

export default function Layout() {
  const { user, logout } = useAuth();

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
            </NavLink>
          ))}
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
