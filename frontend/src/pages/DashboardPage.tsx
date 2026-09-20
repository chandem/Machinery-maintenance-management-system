import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DashboardSummary, Equipment, MaintenanceAnalytics, MaintenancePerformance, MaintenanceScheduleStatus } from "../api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [schedule, setSchedule] = useState<MaintenanceScheduleStatus[]>([]);
  const [performance, setPerformance] = useState<Array<MaintenancePerformance & { equipment: Equipment }>>([]);
  const [analytics, setAnalytics] = useState<MaintenanceAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, st, eq, an] = await Promise.all([
          api.get<DashboardSummary>("/api/v1/dashboard/summary"),
          api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status"),
          api.get<{ items: Equipment[] }>("/api/v1/equipment?page=1&page_size=20"),
          api.get<MaintenanceAnalytics>("/api/v1/maintenance/analytics"),
        ]);
        if (!cancelled) {
          setSummary(s);
          setSchedule(st.filter((x) => x.status === "due" || x.status === "overdue").slice(0, 8));
          const results = await Promise.all(
            eq.items.map(async (equipment) => ({
              equipment,
              ...(await api.get<MaintenancePerformance>(`/api/v1/maintenance/performance?equipment_id=${equipment.id}`)),
            }))
          );
          setPerformance(results.filter((x) => x.breakdown_events > 0));
          setAnalytics(an);
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
          <div className={`stat-card ${(summary.open_inspections ?? 0) ? "warn" : ""}`}>
            <div className="label">Open inspections</div>
            <div className="value">{summary.open_inspections ?? 0}</div>
          </div>
          <div className={`stat-card ${(summary.open_downtime_events ?? 0) ? "danger" : ""}`}>
            <div className="label">Open downtime</div>
            <div className="value">{summary.open_downtime_events ?? 0}</div>
          </div>
        </div>
      )}

      {analytics && analytics.preventive_work_orders > 0 && (
        <div className="stats analytics-stats">
          <div className="stat-card ok"><div className="label">PM completion</div><div className="value">{Number(analytics.preventive_completion_rate).toFixed(0)}%</div></div>
          <div className={analytics.overdue_preventive_work_orders ? "stat-card danger" : "stat-card"}><div className="label">Overdue PM WOs</div><div className="value">{analytics.overdue_preventive_work_orders}</div></div>
          <div className="stat-card"><div className="label">PM actual cost</div><div className="value">{Number(analytics.preventive_actual_cost).toLocaleString()}</div></div>
        </div>
      )}

      <div className="panel performance-panel">
        <div className="panel-header">
          <div>
            <h2>Maintenance performance</h2>
            <div className="muted">MTBF and MTTR from recorded breakdown events</div>
          </div>
        </div>
        {performance.length === 0 ? (
          <div className="empty">No breakdown history is available yet.</div>
        ) : (
          <table>
            <thead><tr><th>Equipment</th><th>Breakdowns</th><th>Downtime</th><th>MTTR</th><th>MTBF</th></tr></thead>
            <tbody>{performance.slice(0, 8).map((row) => (
              <tr key={row.equipment_id}>
                <td><strong>{row.equipment.asset_code}</strong><div className="muted">{row.equipment.name}</div></td>
                <td>{row.breakdown_events}</td><td>{Number(row.breakdown_hours).toFixed(1)} h</td>
                <td>{row.mttr_hours == null ? "—" : `${Number(row.mttr_hours).toFixed(1)} h`}</td>
                <td>{row.mtbf_hours == null ? "—" : `${Number(row.mtbf_hours).toFixed(1)} h`}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

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
