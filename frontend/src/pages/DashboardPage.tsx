import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DashboardSummary, MaintenanceScheduleStatus } from "../api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [schedule, setSchedule] = useState<MaintenanceScheduleStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, st] = await Promise.all([
          api.get<DashboardSummary>("/api/v1/dashboard/summary"),
          api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status"),
        ]);
        if (!cancelled) {
          setSummary(s);
          setSchedule(st.filter((x) => x.status === "due" || x.status === "overdue").slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Fleet health and maintenance overview</p>

      {error && <div className="error-msg">{error}</div>}

      {summary && (
        <div className="stats">
          <div className="stat-card">
            <div className="label">Equipment</div>
            <div className="value">{summary.total_equipment}</div>
          </div>
          <div className="stat-card ok">
            <div className="label">Operational</div>
            <div className="value">{summary.operational_equipment}</div>
          </div>
          <div className={`stat-card ${summary.down_equipment ? "danger" : ""}`}>
            <div className="label">Down</div>
            <div className="value">{summary.down_equipment}</div>
          </div>
          <div className={`stat-card ${summary.open_work_orders ? "warn" : ""}`}>
            <div className="label">Open WOs</div>
            <div className="value">{summary.open_work_orders}</div>
          </div>
          <div className={`stat-card ${summary.overdue_maintenance_plans ? "danger" : ""}`}>
            <div className="label">Overdue plans</div>
            <div className="value">{summary.overdue_maintenance_plans}</div>
          </div>
          <div className={`stat-card ${summary.low_stock_parts ? "warn" : ""}`}>
            <div className="label">Low stock</div>
            <div className="value">{summary.low_stock_parts}</div>
          </div>
          <div className={`stat-card ${summary.out_of_stock_parts ? "danger" : ""}`}>
            <div className="label">Out of stock</div>
            <div className="value">{summary.out_of_stock_parts}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Due / overdue maintenance</h2>
        </div>
        {schedule.length === 0 ? (
          <div className="empty">No due or overdue plans right now.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Plan</th>
                <th>Due date</th>
                <th>Meter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
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
