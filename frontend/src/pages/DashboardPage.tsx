import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DashboardSummary, DowntimeSummary, Equipment, MaintenanceAnalytics, MaintenancePerformance, MaintenanceScheduleStatus } from "../api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [schedule, setSchedule] = useState<MaintenanceScheduleStatus[]>([]);
  const [performance, setPerformance] = useState<Array<MaintenancePerformance & { equipment: Equipment }>>([]);
  const [downtime, setDowntime] = useState<Array<DowntimeSummary & { equipment: Equipment }>>([]);
  const [analytics, setAnalytics] = useState<MaintenanceAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
            eq.items.map(async (equipment) => {
              const [maintenancePerformance, downtimeSummary] = await Promise.all([
                api.get<MaintenancePerformance>(`/api/v1/maintenance/performance?equipment_id=${equipment.id}`),
                api.get<DowntimeSummary>(`/api/v1/downtime/summary?equipment_id=${equipment.id}`),
              ]);
              return { equipment, maintenancePerformance, downtimeSummary };
            })
          );
          setPerformance(results
            .map(({ equipment, maintenancePerformance }) => ({ equipment, ...maintenancePerformance }))
            .filter((x) => x.breakdown_events > 0));
          setDowntime(results
            .map(({ equipment, downtimeSummary }) => ({ equipment, ...downtimeSummary }))
            .filter((x) => x.total_events > 0)
            .sort((a, b) => Number(b.total_hours) - Number(a.total_hours)));
          setAnalytics(an);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
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

      {loading && <div className="panel dashboard-loading"><div className="empty">Loading fleet health data…</div></div>}

      {!loading && !error && (
        <div className="quick-actions">
          <a className="quick-action" href="/equipment"><strong>Equipment</strong><span>View and manage fleet assets →</span></a>
          <a className="quick-action" href="/work-orders"><strong>Work orders</strong><span>Track active maintenance work →</span></a>
          <a className="quick-action" href="/maintenance"><strong>Maintenance</strong><span>Review due and scheduled service →</span></a>
          <a className="quick-action" href="/inventory"><strong>Inventory</strong><span>Monitor parts and stock levels →</span></a>
        </div>
      )}

      {summary && !loading && (
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

      {analytics && !loading && analytics.preventive_work_orders > 0 && (
        <div className="stats analytics-stats">
          <div className="stat-card ok"><div className="label">PM completion</div><div className="value">{Number(analytics.preventive_completion_rate).toFixed(0)}%</div></div>
          <div className={analytics.overdue_preventive_work_orders ? "stat-card danger" : "stat-card"}><div className="label">Overdue PM WOs</div><div className="value">{analytics.overdue_preventive_work_orders}</div></div>
          <div className="stat-card"><div className="label">PM actual cost</div><div className="value">{Number(analytics.preventive_actual_cost).toLocaleString()}</div></div>
        </div>
      )}

      {summary && !loading && <div className="dashboard-insights">
        <div className="panel"><div className="panel-header"><h2>Fleet health</h2></div><div className="health-list">
          <div><span>Operational availability</span><strong>{summary.total_equipment ? Math.round(summary.operational_equipment / summary.total_equipment * 100) : 0}%</strong></div>
          <div><span>Open maintenance work</span><strong>{summary.open_work_orders}</strong></div>
          <div><span>Assets needing attention</span><strong>{summary.down_equipment + summary.overdue_maintenance_plans}</strong></div>
        </div></div>
        <div className="panel"><div className="panel-header"><h2>Parts & operations</h2></div><div className="health-list">
          <div><span>Inventory value</span><strong>{summary.total_parts_inventory_value == null ? "—" : Number(summary.total_parts_inventory_value).toLocaleString()}</strong></div>
          <div><span>Out of stock</span><strong>{summary.out_of_stock_parts}</strong></div>
          <div><span>Open downtime</span><strong>{summary.open_downtime_events ?? 0}</strong></div>
        </div></div>
      </div>}

      <div className="panel performance-panel">
        <div className="panel-header">
          <div>
            <h2>Downtime analysis</h2>
            <div className="muted">Recorded downtime by asset, including open events</div>
          </div>
        </div>
        {downtime.length === 0 ? (
          <div className="empty">No downtime history is available yet.</div>
        ) : (
          <>
            <div className="stats analytics-stats">
              <div className="stat-card"><div className="label">Downtime hours</div><div className="value">{downtime.reduce((sum, row) => sum + Number(row.total_hours), 0).toFixed(1)}</div></div>
              <div className="stat-card danger"><div className="label">Breakdown hours</div><div className="value">{downtime.reduce((sum, row) => sum + Number(row.breakdown_hours), 0).toFixed(1)}</div></div>
              <div className="stat-card warn"><div className="label">Open events</div><div className="value">{downtime.reduce((sum, row) => sum + row.open_events, 0)}</div></div>
            </div>
            <table>
              <thead><tr><th>Equipment</th><th>Events</th><th>Total downtime</th><th>Breakdown</th><th>Maintenance</th><th>Open</th></tr></thead>
              <tbody>{downtime.slice(0, 8).map((row) => (
                <tr key={row.equipment_id}>
                  <td><strong>{row.equipment.asset_code}</strong><div className="muted">{row.equipment.name}</div></td>
                  <td>{row.total_events}</td>
                  <td>{Number(row.total_hours).toFixed(1)} h</td>
                  <td>{Number(row.breakdown_hours).toFixed(1)} h</td>
                  <td>{Number(row.maintenance_hours).toFixed(1)} h</td>
                  <td>{row.open_events}</td>
                </tr>
              ))}</tbody>
            </table>
          </>
        )}
      </div>

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
