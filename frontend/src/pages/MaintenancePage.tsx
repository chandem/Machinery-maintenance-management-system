import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, MaintenanceScheduleStatus } from "../api/types";

export default function MaintenancePage() {
  const [rows, setRows] = useState<MaintenanceScheduleStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    equipment_id: "",
    name: "",
    interval_days: "30",
    interval_hours: "",
    next_due_date: "",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status");
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load schedule");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showForm) return;
    void api
      .get<Page<Equipment>>("/api/v1/equipment?page_size=100")
      .then((p) => setEquipment(p.items))
      .catch(() => setEquipment([]));
  }, [showForm]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/maintenance-plans", {
        equipment_id: Number(form.equipment_id),
        name: form.name,
        maintenance_type: "preventive",
        interval_days: form.interval_days ? Number(form.interval_days) : null,
        interval_hours: form.interval_hours ? Number(form.interval_hours) : null,
        next_due_date: form.next_due_date || null,
        active: true,
      });
      setShowForm(false);
      setForm({ equipment_id: "", name: "", interval_days: "30", interval_hours: "", next_due_date: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Maintenance schedule</h1>
      <p className="page-sub">Active plans with due / overdue status</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Plan status</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New plan"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Equipment</label>
                <select className="input" required value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}>
                  <option value="">Select…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.asset_code} — {eq.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Plan name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Engine service" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Interval days</label>
                <input className="input" type="number" min="1" value={form.interval_days} onChange={(e) => setForm({ ...form, interval_days: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Interval hours</label>
                <input className="input" type="number" min="0" value={form.interval_hours} onChange={(e) => setForm({ ...form, interval_hours: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Next due date</label>
                <input className="input" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>
              {busy ? "Saving…" : "Create plan"}
            </button>
          </form>
        )}

        {rows.length === 0 ? (
          <div className="empty">No active maintenance plans.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Plan</th>
                <th>Next due date</th>
                <th>Current / due meter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.asset_code}</strong>
                    <div className="muted">{row.equipment_name}</div>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.next_due_date ?? "—"}</td>
                  <td>
                    {row.current_meter != null ? Number(row.current_meter).toLocaleString() : "—"}
                    {row.next_due_meter != null && (
                      <span className="muted"> / {Number(row.next_due_meter).toLocaleString()}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${row.status}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
