import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type {
  Equipment,
  Part,
  WorkOrder,
  WorkOrderCost,
  WorkOrderLabor,
  WorkOrderPart,
  WorkOrderTask,
} from "../api/types";
import { WO_NEXT } from "../api/types";

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [eq, setEq] = useState<Equipment | null>(null);
  const [cost, setCost] = useState<WorkOrderCost | null>(null);
  const [parts, setParts] = useState<WorkOrderPart[]>([]);
  const [labor, setLabor] = useState<WorkOrderLabor[]>([]);
  const [tasks, setTasks] = useState<WorkOrderTask[]>([]);
  const [catalog, setCatalog] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [partForm, setPartForm] = useState({ part_id: "", quantity: "1" });
  const [laborForm, setLaborForm] = useState({ worker_name: "", hours: "1", hourly_rate: "50", role: "" });
  const [taskDesc, setTaskDesc] = useState("");
  const [returningPartId, setReturningPartId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const order = await api.get<WorkOrder>(`/api/v1/work-orders/${id}`);
      setWo(order);
      const [equipment, costData, partsData, laborData, tasksData] = await Promise.all([
        api.get<Equipment>(`/api/v1/equipment/${order.equipment_id}`),
        api.get<WorkOrderCost>(`/api/v1/work-orders/${id}/cost`).catch(() => null),
        api.get<WorkOrderPart[]>(`/api/v1/work-orders/${id}/parts`),
        api.get<WorkOrderLabor[]>(`/api/v1/work-orders/${id}/labor`),
        api.get<WorkOrderTask[]>(`/api/v1/work-orders/${id}/tasks`),
      ]);
      setEq(equipment);
      setCost(costData);
      setParts(partsData);
      setLabor(laborData);
      setTasks(tasksData);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load work order");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .get<Page<Part>>("/api/v1/parts?page_size=100")
      .then((p) => setCatalog(p.items))
      .catch(() => setCatalog([]));
  }, []);

  async function transition(next: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<WorkOrder>(`/api/v1/work-orders/${id}`, { status: next });
      setWo(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPart(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/work-orders/${id}/parts`, {
        part_id: Number(partForm.part_id),
        quantity: Number(partForm.quantity),
      });
      setPartForm({ part_id: "", quantity: "1" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to add part");
    } finally {
      setBusy(false);
    }
  }

  async function returnPart(item: WorkOrderPart) {
    if (!id) return;
    const qty = window.prompt(`Return quantity for ${partName(item.part_id)}:`, "1");
    if (qty === null) return;
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Return quantity must be greater than zero.");
      return;
    }
    setReturningPartId(item.id);
    setError(null);
    try {
      await api.post(`/api/v1/work-orders/${id}/parts/${item.id}/return`, { quantity });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to return part");
    } finally {
      setReturningPartId(null);
    }
  }

  async function addLabor(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/work-orders/${id}/labor`, {
        worker_name: laborForm.worker_name,
        hours: Number(laborForm.hours),
        hourly_rate: Number(laborForm.hourly_rate),
        role: laborForm.role || null,
      });
      setLaborForm({ worker_name: "", hours: "1", hourly_rate: "50", role: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to add labor");
    } finally {
      setBusy(false);
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!id || !taskDesc.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/work-orders/${id}/tasks`, { description: taskDesc.trim() });
      setTaskDesc("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to add task");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: WorkOrderTask) {
    if (!id) return;
    const next = task.status === "done" ? "pending" : "done";
    try {
      await api.patch(`/api/v1/work-orders/${id}/tasks/${task.id}`, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to update task");
    }
  }

  if (!wo && !error) return <p className="muted">Loading…</p>;
  if (!wo) return <div className="error-msg">{error}</div>;

  const nextStatuses = WO_NEXT[wo.status] ?? [];
  const partName = (pid: number) => catalog.find((p) => p.id === pid)?.name ?? `#${pid}`;

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        <Link to="/work-orders" style={{ color: "var(--accent)" }}>
          ← Work orders
        </Link>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {wo.work_order_number}
          </h1>
          <p className="page-sub" style={{ marginBottom: "0.5rem" }}>
            {wo.title}
          </p>
          <span className={`badge badge-${wo.status}`}>{wo.status.replace(/_/g, " ")}</span>{" "}
          <span className={`badge badge-${wo.priority}`}>{wo.priority}</span>
        </div>
        {nextStatuses.length > 0 && (
          <div className="toolbar">
            {nextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${s === "cancelled" ? "btn-ghost" : "btn-primary"}`}
                disabled={busy}
                onClick={() => void transition(s)}
              >
                → {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error-msg" style={{ marginTop: "1rem" }}>{error}</div>}

      <div className="stats" style={{ marginTop: "1.5rem" }}>
        <div className="stat-card">
          <div className="label">Type</div>
          <div className="value" style={{ fontSize: "1.1rem", textTransform: "capitalize" }}>
            {wo.maintenance_type}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Equipment</div>
          <div className="value" style={{ fontSize: "1.1rem" }}>
            {eq ? (
              <Link to={`/equipment/${eq.id}`} style={{ color: "var(--accent)" }}>
                {eq.asset_code}
              </Link>
            ) : (
              `#${wo.equipment_id}`
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Parts cost</div>
          <div className="value" style={{ fontSize: "1.25rem" }}>
            {cost ? Number(cost.parts_cost).toLocaleString() : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Labor cost</div>
          <div className="value" style={{ fontSize: "1.25rem" }}>
            {cost ? Number(cost.labor_cost).toLocaleString() : "—"}
          </div>
        </div>
        <div className="stat-card ok">
          <div className="label">Total</div>
          <div className="value" style={{ fontSize: "1.25rem" }}>
            {cost ? Number(cost.total_cost).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div className="wo-workflow">
        {["draft", "scheduled", "in_progress", "completed", "verified", "closed"].map((step) => (
          <div key={step} className={`wo-step ${wo.status === step ? "active" : ""} ${WO_NEXT[step]?.includes(wo.status) ? "available" : ""}`}>
            <span className="wo-step-dot" />
            <span>{step.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <div className="panel">
          <div className="panel-header">
            <h2>Parts</h2>
          </div>
          <form onSubmit={addPart} style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <select
                className="input"
                required
                value={partForm.part_id}
                onChange={(e) => setPartForm({ ...partForm, part_id: e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              >
                <option value="">Part…</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.part_number} — {p.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={partForm.quantity}
                onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })}
                style={{ width: 80 }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Issue
              </button>
            </div>
          </form>
          {parts.length === 0 ? (
            <div className="empty">No parts issued.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id}>
                    <td>{partName(p.part_id)}</td>
                    <td>{Number(p.quantity)}</td>
                    <td>{p.unit_cost != null ? Number(p.unit_cost).toLocaleString() : "—"}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" disabled={returningPartId === p.id} onClick={() => void returnPart(p)}>{returningPartId === p.id ? "Returning…" : "Return"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Labor</h2>
          </div>
          <form onSubmit={addLabor} style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px auto", gap: "0.5rem" }}>
              <input
                className="input"
                placeholder="Worker"
                required
                value={laborForm.worker_name}
                onChange={(e) => setLaborForm({ ...laborForm, worker_name: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Hrs"
                required
                value={laborForm.hours}
                onChange={(e) => setLaborForm({ ...laborForm, hours: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Rate"
                required
                value={laborForm.hourly_rate}
                onChange={(e) => setLaborForm({ ...laborForm, hourly_rate: e.target.value })}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Add
              </button>
            </div>
          </form>
          {labor.length === 0 ? (
            <div className="empty">No labor logged.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Hours</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {labor.map((l) => (
                  <tr key={l.id}>
                    <td>{l.worker_name}</td>
                    <td>{Number(l.hours)}</td>
                    <td>{Number(l.hourly_rate).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Tasks</h2>
          </div>
          <form onSubmit={addTask} style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="input"
                placeholder="Task description"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Add
              </button>
            </div>
          </form>
          {tasks.length > 0 && <div className="wo-task-progress"><div className="wo-task-bar"><span style={{ width: `${(tasks.filter((t) => t.status === "done").length / tasks.length) * 100}%` }} /></div><span>{tasks.filter((t) => t.status === "done").length}/{tasks.length} tasks complete</span></div>}
          {tasks.length === 0 ? (
            <div className="empty">No tasks.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.description}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleTask(t)}>
                        <span className={`badge badge-${t.status === "done" ? "completed" : "draft"}`}>{t.status}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-header">
          <h2>Details</h2>
        </div>
        <table>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Description</th>
              <td>{wo.description || "—"}</td>
            </tr>
            <tr>
              <th>Scheduled</th>
              <td>{wo.scheduled_date ?? "—"}</td>
            </tr>
            <tr>
              <th>Started</th>
              <td>{wo.started_at ? new Date(wo.started_at).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <th>Completed</th>
              <td>{wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <th>Notes</th>
              <td>{wo.notes || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
