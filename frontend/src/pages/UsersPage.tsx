import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<UserRow[]>("/api/v1/auth/users");
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(id: number, role: string) {
    try {
      await api.patch(`/api/v1/auth/users/${id}`, { role });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Update failed");
    }
  }

  async function toggleActive(row: UserRow) {
    try {
      await api.patch(`/api/v1/auth/users/${row.id}`, { is_active: !row.is_active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Update failed");
    }
  }

  async function seedDemo() {
    setSeedBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await api.post<{ message: string; created: Record<string, number> }>("/api/v1/admin/seed");
      setMsg(`${res.message}${Object.keys(res.created || {}).length ? `: ${JSON.stringify(res.created)}` : ""}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Seed failed");
    } finally {
      setSeedBusy(false);
    }
  }

  if (user?.role !== "admin" && user?.role !== "manager") {
    return <div className="error-msg">Admin or manager role required.</div>;
  }

  return (
    <div>
      <h1 className="page-title">Users & admin</h1>
      <p className="page-sub">Roles, account status, and demo data tools</p>

      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      {user?.role === "admin" && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-header">
            <div>
              <h2>Demo data</h2>
              <div className="muted">Safe to re-run — skips existing asset codes / part numbers</div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={seedBusy} onClick={() => void seedDemo()}>
              {seedBusy ? "Seeding…" : "Seed demo fleet"}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Users</h2>
          <span className="muted">{rows.length} accounts</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">No users loaded.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.full_name}</strong>
                    </td>
                    <td>{row.email}</td>
                    <td style={{ textTransform: "capitalize" }}>{row.role}</td>
                    <td>
                      <span className={`badge ${row.is_active ? "badge-operational" : "badge-cancelled"}`}>
                        {row.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td>
                      {user?.role === "admin" && (
                        <div className="toolbar">
                          <select
                            className="input"
                            value={row.role}
                            onChange={(e) => void setRole(row.id, e.target.value)}
                            style={{ minWidth: 120 }}
                          >
                            <option value="admin">admin</option>
                            <option value="manager">manager</option>
                            <option value="technician">technician</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleActive(row)}>
                            {row.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
