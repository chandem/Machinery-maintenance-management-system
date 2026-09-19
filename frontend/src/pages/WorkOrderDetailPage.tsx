import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Equipment, WorkOrder, WorkOrderCost } from "../api/types";
import { WO_NEXT } from "../api/types";

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [eq, setEq] = useState<Equipment | null>(null);
  const [cost, setCost] = useState<WorkOrderCost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const order = await api.get<WorkOrder>(`/api/v1/work-orders/${id}`);
      setWo(order);
      const [equipment, costData] = await Promise.all([
        api.get<Equipment>(`/api/v1/equipment/${order.equipment_id}`),
        api.get<WorkOrderCost>(`/api/v1/work-orders/${id}/cost`).catch(() => null),
      ]);
      setEq(equipment);
      setCost(costData);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load work order");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(next: string) {
    if (!id || !wo) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<WorkOrder>(`/api/v1/work-orders/${id}`, { status: next });
      setWo(updated);
      const costData = await api.get<WorkOrderCost>(`/api/v1/work-orders/${id}/cost`).catch(() => null);
      setCost(costData);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!wo && !error) return <p className="muted">Loading…</p>;
  if (!wo) return <div className="error-msg">{error}</div>;

  const nextStatuses = WO_NEXT[wo.status] ?? [];

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

      <div className="panel">
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
              <th>Verified</th>
              <td>{wo.verified_at ? new Date(wo.verified_at).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <th>Closed</th>
              <td>{wo.closed_at ? new Date(wo.closed_at).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <th>Estimated cost</th>
              <td>{wo.estimated_cost != null ? Number(wo.estimated_cost).toLocaleString() : "—"}</td>
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
