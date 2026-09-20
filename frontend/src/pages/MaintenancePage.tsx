import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, MaintenanceScheduleStatus } from "../api/types";

export default function MaintenancePage() {
  const [rows, setRows] = useState<MaintenanceScheduleStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [form, setForm] = useState({
    equipment_id: "",
    name: "",
    interval_days: "30",
    interval_hours: "",
    next_due_date: "",
  });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status");
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load schedule");
    } finally {
      setLoading(false);
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

  async function generateWorkOrder(row: MaintenanceScheduleStatus) {
    setActionId(row.id);
    setError(null);
    try {
      const number = `PM-${row.asset_code}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${row.id}`;
      await api.post("/api/v1/work-orders", {
        work_order_number: number,
        equipment_id: row.equipment_id,
        maintenance_plan_id: row.id,
        title: row.name,
        description: `Preventive maintenance generated from plan: ${row.name}`,
        maintenance_type: "preventive",
        priority: row.status === "overdue" ? "high" : "medium",
        status: "draft",
        scheduled_date: row.next_due_date,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to generate work order");
    } finally {
      setActionId(null);
    }
  }

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

  const overdue = rows.filter((r) => r.status === "overdue").length;
  const due = rows.filter((r) => r.status === "due").length;
  const scheduled = rows.filter((r) => r.status === "scheduled").length;

  return (
    <div>
      <h1 className="page-title">Maintenance schedule</h1>
      <p className="page-sub">{rows.length} active plans · {overdue} overdue · {due} due now · {scheduled} scheduled</p>

      <div className="stats maintenance-stats">
        <div className="stat-card"><span className="label">Active plans</span><span className="value">{rows.length}</span></div>
        <div className="stat-card"><span className="label">Overdue</span><span className="value">{overdue}</span></div>
        <div className="stat-card"><span className="label">Due now</span><span className="value">{due}</span></div>
        <div className="stat-card"><span className="label">Scheduled</span><span className="value">{scheduled}</span></div>
      </div>

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

        {loading ? (
          <div className="empty">Loading maintenance schedule…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No active maintenance plans.</div>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Plan</th>
                <th>Next due date</th>
                <th>Current / due meter</th>
                <th>Status</th>
                <th>Action</th>
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
                  <td><button type="button" className="btn btn-primary btn-sm" disabled={actionId === row.id} onClick={() => void generateWorkOrder(row)}>{actionId === row.id ? "Creating…" : "Create work order"}</button></td>
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
