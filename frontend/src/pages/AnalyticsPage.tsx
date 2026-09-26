import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { FleetAnalytics } from "../api/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<FleetAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<FleetAnalytics>("/api/v1/analytics/fleet")
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load management analytics"); });
    return () => { cancelled = true; };
  }, []);

  const money = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const hours = (value: number | null) => value == null ? "—" : `${Number(value).toFixed(1)} h`;
  const maxTrend = Math.max(...(data?.monthly_trend ?? []).map((row) => Number(row.total_operating_cost)), 1);

  if (error) return <div><h1 className="page-title">Management Analytics</h1><div className="error-msg">{error}</div></div>;
  if (!data) return <div><h1 className="page-title">Management Analytics</h1><p className="page-sub">Loading fleet analytics…</p></div>;

  const attention = data.equipment.filter((row) => row.attention_reasons.length > 0);
  const downtimeRows = data.equipment.filter((row) => row.downtime_hours > 0).sort((a, b) => b.downtime_hours - a.downtime_hours);
  const costRows = data.equipment.filter((row) => row.total_operating_cost > 0).sort((a, b) => b.total_operating_cost - a.total_operating_cost);

  return (
    <div>
      <h1 className="page-title">Management Analytics</h1>
      <p className="page-sub">Fleet reliability, maintenance performance, downtime and operating cost</p>
      <div className="stats">
        <div className="stat-card"><div className="label">Fleet size</div><div className="value">{data.fleet_size}</div></div>
        <div className="stat-card ok"><div className="label">Availability</div><div className="value">{data.availability_percent == null ? "—" : `${Number(data.availability_percent).toFixed(1)}%`}</div></div>
        <div className={`stat-card ${data.down_assets + data.out_of_service_assets ? "danger" : ""}`}><div className="label">Down / OOS</div><div className="value">{data.down_assets + data.out_of_service_assets}</div></div>
        <div className={`stat-card ${data.open_work_orders ? "warn" : ""}`}><div className="label">Open WOs</div><div className="value">{data.open_work_orders}</div></div>
        <div className={`stat-card ${data.overdue_pm ? "danger" : ""}`}><div className="label">Overdue PM</div><div className="value">{data.overdue_pm}</div></div>
        <div className="stat-card"><div className="label">Operating cost</div><div className="value">{money(data.total_operating_cost)}</div></div>
      </div>

      <div className="dashboard-insights">
        <div className="panel"><div className="panel-header"><div><h2>Reliability</h2><div className="muted">Fleet breakdown performance</div></div></div>
          <div className="health-list">
            <div><span>Breakdown events</span><strong>{data.breakdown_events}</strong></div>
            <div><span>Average MTTR</span><strong>{hours(data.average_mttr_hours)}</strong></div>
            <div><span>Average MTBF</span><strong>{hours(data.average_mtbf_hours)}</strong></div>
            <div><span>Breakdown downtime</span><strong>{hours(data.breakdown_downtime_hours)}</strong></div>
            <div><span>Total downtime</span><strong>{hours(data.total_downtime_hours)}</strong></div>
          </div>
        </div>
        <div className="panel"><div className="panel-header"><div><h2>Preventive maintenance</h2><div className="muted">PM execution performance</div></div></div>
          <div className="health-list">
            <div><span>PM work orders</span><strong>{data.pm_work_orders}</strong></div>
            <div><span>Completed PM</span><strong>{data.completed_pm_work_orders}</strong></div>
            <div><span>PM completion</span><strong>{data.pm_completion_percent == null ? "—" : `${Number(data.pm_completion_percent).toFixed(1)}%`}</strong></div>
            <div><span>Overdue PM</span><strong>{data.overdue_pm}</strong></div>
          </div>
        </div>
      </div>

      <div className="panel"><div className="panel-header"><div><h2>Operating cost breakdown</h2><div className="muted">Current fleet totals</div></div><strong>{money(data.total_operating_cost)}</strong></div>
        <div className="stats analytics-stats">
          <div className="stat-card"><div className="label">Fuel</div><div className="value">{money(data.fuel_cost)}</div></div>
          <div className="stat-card"><div className="label">Maintenance</div><div className="value">{money(data.maintenance_cost)}</div></div>
          <div className="stat-card"><div className="label">Parts</div><div className="value">{money(data.parts_cost)}</div></div>
          <div className="stat-card"><div className="label">Labor</div><div className="value">{money(data.labor_cost)}</div></div>
          <div className="stat-card"><div className="label">Cost / hour</div><div className="value">{data.operating_cost_per_hour == null ? "—" : money(data.operating_cost_per_hour)}</div></div>
        </div>
      </div>

      <div className="panel"><div className="panel-header"><div><h2>Monthly operating cost</h2><div className="muted">Fuel, maintenance, parts and labor</div></div></div>
        {data.monthly_trend.length === 0 ? <div className="empty">No monthly cost history yet.</div> :
          <div className="health-list">{data.monthly_trend.map((row) => <div key={row.period} style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}><span>{row.period}</span><strong>{money(row.total_operating_cost)}</strong></div>
            <div style={{ marginTop: "0.4rem", height: 8, background: "var(--border)", borderRadius: 999 }}><div style={{ width: `${Math.max(2, Number(row.total_operating_cost) / maxTrend * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} /></div>
          </div>)}</div>}
      </div>

      <div className="panel"><div className="panel-header"><div><h2>Equipment requiring attention</h2><div className="muted">Current operational and maintenance indicators</div></div><strong>{attention.length}</strong></div>
        {attention.length === 0 ? <div className="empty">No equipment is currently flagged.</div> :
          <table><thead><tr><th>Asset</th><th>Status</th><th>Indicators</th><th>MTBF</th><th>MTTR</th><th>Downtime</th><th>Cost/hour</th></tr></thead>
            <tbody>{attention.slice(0, 20).map((row) => <tr key={row.equipment_id}>
              <td><strong>{row.asset_code}</strong><div className="muted">{row.equipment_name}</div></td>
              <td><span className={`badge badge-${row.status}`}>{row.status.replace(/_/g, " ")}</span></td>
              <td>{row.attention_reasons.join(" · ")}</td><td>{hours(row.mtbf_hours)}</td><td>{hours(row.mttr_hours)}</td><td>{hours(row.downtime_hours)}</td><td>{row.cost_per_hour == null ? "—" : money(row.cost_per_hour)}</td>
            </tr>)}</tbody></table>}
      </div>

      <div className="panel"><div className="panel-header"><div><h2>Downtime by asset</h2><div className="muted">Total recorded downtime</div></div><strong>{hours(data.total_downtime_hours)}</strong></div>
        {downtimeRows.length === 0 ? <div className="empty">No downtime history yet.</div> :
          <table><thead><tr><th>Asset</th><th>Breakdowns</th><th>Breakdown hours</th><th>Total downtime</th><th>Open WOs</th></tr></thead>
            <tbody>{downtimeRows.slice(0, 20).map((row) => <tr key={row.equipment_id}><td><strong>{row.asset_code}</strong><div className="muted">{row.equipment_name}</div></td><td>{row.breakdown_events}</td><td>{hours(row.breakdown_hours)}</td><td>{hours(row.downtime_hours)}</td><td>{row.open_work_orders}</td></tr>)}</tbody></table>}
      </div>

      <div className="panel"><div className="panel-header"><div><h2>Cost by equipment</h2><div className="muted">Operating cost and cost per operating hour</div></div></div>
        {costRows.length === 0 ? <div className="empty">No equipment cost data yet.</div> :
          <table><thead><tr><th>Asset</th><th>Total</th><th>Cost/hour</th><th>Status</th></tr></thead>
            <tbody>{costRows.slice(0, 20).map((row) => <tr key={row.equipment_id}><td><strong>{row.asset_code}</strong><div className="muted">{row.equipment_name}</div></td><td><strong>{money(row.total_operating_cost)}</strong></td><td>{row.cost_per_hour == null ? "—" : money(row.cost_per_hour)}</td><td>{row.status.replace(/_/g, " ")}</td></tr>)}</tbody></table>}
      </div>
    </div>
  );
}
