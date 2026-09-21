import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, WorkOrder } from "../api/types";

export default function WorkOrdersPage() {
  const [data, setData] = useState<Page<WorkOrder> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState({
    work_order_number: "",
    equipment_id: "",
    title: "",
    maintenance_type: "corrective",
    priority: "medium",
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "15" });
      if (status) params.set("status_filter", status);
      const res = await api.get<Page<WorkOrder>>(`/api/v1/work-orders?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load work orders");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

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
      const body: Record<string, unknown> = {
        equipment_id: Number(form.equipment_id),
        title: form.title,
        maintenance_type: form.maintenance_type,
        priority: form.priority,
      };
      if (form.work_order_number.trim()) {
        body.work_order_number = form.work_order_number.trim();
      }
      await api.post("/api/v1/work-orders", body);
      setShowForm(false);
      setForm({ work_order_number: "", equipment_id: "", title: "", maintenance_type: "corrective", priority: "medium" });
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Work orders</h1>
      <p className="page-sub">Execution and tracking of maintenance jobs</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>All work orders</h2>
            <div className="muted">{data ? `${data.total} maintenance jobs` : "Loading maintenance jobs…"}</div>
          </div>
          <div className="toolbar">
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="verified">Verified</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New work order"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>WO number (optional)</label>
                <input
                  className="input"
                  value={form.work_order_number}
                  onChange={(e) => setForm({ ...form, work_order_number: e.target.value })}
                  placeholder="Auto if blank"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Equipment</label>
                <select
                  className="input"
                  required
                  value={form.equipment_id}
                  onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.asset_code} — {eq.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Title</label>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Type</label>
                <select
                  className="input"
                  value={form.maintenance_type}
                  onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                >
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                  <option value="emergency">Emergency</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="empty">Loading work orders…</div>
        ) : !data || data.items.length === 0 ? (
          <div className="empty">No work orders yet. Create one to get started.</div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((wo) => (
                    <tr key={wo.id}>
                      <td>
                        <Link to={`/work-orders/${wo.id}`}>
                          <strong style={{ color: "var(--accent)" }}>{wo.work_order_number}</strong>
                        </Link>
                      </td>
                      <td>{wo.title}</td>
                      <td style={{ textTransform: "capitalize" }}>{wo.maintenance_type}</td>
                      <td>
                        <span className={`badge badge-${wo.priority}`}>{wo.priority}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${wo.status}`}>{wo.status.replace(/_/g, " ")}</span>
                      </td>
                      <td>{wo.scheduled_date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Page {data.page} of {data.pages || 1} · {data.total} total
              </span>
              <div className="btns">
                <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page >= (data.pages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
