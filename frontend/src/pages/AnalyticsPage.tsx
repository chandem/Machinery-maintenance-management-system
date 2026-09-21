import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DashboardSummary, DowntimeSummary, Equipment, MaintenanceAnalytics, MaintenancePerformance, MaintenanceScheduleStatus, FuelOperatingCostSummary, FuelOperatingCostTrend } from "../api/types";

type RiskRow = {
  equipment: Equipment;
  reasons: string[];
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [schedule, setSchedule] = useState<MaintenanceScheduleStatus[]>([]);
  const [performance, setPerformance] = useState<Array<MaintenancePerformance & { equipment: Equipment }>>([]);
  const [downtime, setDowntime] = useState<Array<DowntimeSummary & { equipment: Equipment }>>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceAnalytics | null>(null);
  const [costs, setCosts] = useState<FuelOperatingCostSummary | null>(null);
  const [trends, setTrends] = useState<FuelOperatingCostTrend[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, eq, st, ma, oc, tr] = await Promise.all([
          api.get<DashboardSummary>("/api/v1/dashboard/summary"),
          api.get<{ items: Equipment[] }>("/api/v1/equipment?page=1&page_size=100"),
          api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status"),
          api.get<MaintenanceAnalytics>("/api/v1/maintenance/analytics"),
          api.get<FuelOperatingCostSummary>("/api/v1/fuel/operating-costs"),
          api.get<FuelOperatingCostTrend[]>("/api/v1/fuel/operating-cost-trends"),
        ]);
        const results = await Promise.all(eq.items.map(async (asset) => {
          const [p, d] = await Promise.all([
            api.get<MaintenancePerformance>(`/api/v1/maintenance/performance?equipment_id=${asset.id}`),
            api.get<DowntimeSummary>(`/api/v1/downtime/summary?equipment_id=${asset.id}`),
          ]);
          return { equipment: asset, performance: p, downtime: d };
        }));
        if (!cancelled) {
          setSummary(s);
          setEquipment(eq.items);
          setSchedule(st);
          setMaintenance(ma);
          setCosts(oc);
          setTrends(tr);
          setPerformance(results.map((r) => ({ equipment: r.equipment, ...r.performance })).filter((r) => r.breakdown_events > 0));
          setDowntime(results.map((r) => ({ equipment: r.equipment, ...r.downtime })).filter((r) => r.total_events > 0));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load management analytics");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const riskRows = useMemo<RiskRow[]>(() => {
    const pMap = new Map(performance.map((r) => [r.equipment_id, r]));
    const dMap = new Map(downtime.map((r) => [r.equipment_id, r]));
    const overdue = new Set(schedule.filter((r) => r.status === "overdue").map((r) => r.equipment_id));
    return equipment.map((asset) => {
      const p = pMap.get(asset.id);
      const d = dMap.get(asset.id);
      const reasons: string[] = [];
      if (asset.status === "down" || asset.status === "out_of_service") reasons.push(asset.status.replace(/_/g, " "));
      if (overdue.has(asset.id)) reasons.push("overdue PM");
      if ((p?.breakdown_events ?? 0) >= 2) reasons.push(`${p?.breakdown_events} breakdowns`);
      if (d && Number(d.total_hours) >= 8) reasons.push(`${Number(d.total_hours).toFixed(1)} h downtime`);
      if (p?.mttr_hours != null && Number(p.mttr_hours) >= 8) reasons.push(`MTTR ${Number(p.mttr_hours).toFixed(1)} h`);
      return { equipment: asset, reasons };
    }).filter((r) => r.reasons.length > 0).sort((a, b) => b.reasons.length - a.reasons.length);
  }, [equipment, performance, downtime, schedule]);

  const avg = (values: Array<number | null>) => {
    const valid = values.filter((v): v is number => v != null && Number.isFinite(Number(v))).map(Number);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const totalDowntime = downtime.reduce((sum, r) => sum + Number(r.total_hours), 0);
  const totalBreakdown = downtime.reduce((sum, r) => sum + Number(r.breakdown_hours), 0);
  const avgMttr = avg(performance.map((r) => r.mttr_hours));
  const avgMtbf = avg(performance.map((r) => r.mtbf_hours));
  const maxTrend = Math.max(...trends.map((r) => Number(r.total_operating_cost)), 1);

  return (
    <div>
      <h1 className="page-title">Management Analytics</h1>
      <p className="page-sub">Fleet reliability, maintenance performance, downtime and operating cost</p>
      {error && <div className="error-msg">{error}</div>}

      {summary && (
        <div className="stats">
          <div className="stat-card"><div className="label">Fleet size</div><div className="value">{summary.total_equipment}</div></div>
          <div className="stat-card ok"><div className="label">Availability</div><div className="value">{summary.total_equipment ? Math.round(summary.operational_equipment / summary.total_equipment * 100) : 0}%</div></div>
          <div className={`stat-card ${summary.down_equipment ? "danger" : ""}`}><div className="label">Down assets</div><div className="value">{summary.down_equipment}</div></div>
          <div className={`stat-card ${summary.open_work_orders ? "warn" : ""}`}><div className="label">Open WOs</div><div className="value">{summary.open_work_orders}</div></div>
          <div className={`stat-card ${summary.overdue_maintenance_plans ? "danger" : ""}`}><div className="label">Overdue PM</div><div className="value">{summary.overdue_maintenance_plans}</div></div>
          <div className="stat-card"><div className="label">Operating cost</div><div className="value">{costs ? Number(costs.total_operating_cost).toLocaleString() : "—"}</div></div>
        </div>
      )}

      <div className="dashboard-insights">
        <div className="panel">
          <div className="panel-header"><div><h2>Reliability</h2><div className="muted">Recorded breakdown performance</div></div></div>
          <div className="health-list">
            <div><span>Breakdown events</span><strong>{performance.reduce((s, r) => s + r.breakdown_events, 0)}</strong></div>
            <div><span>Average MTTR</span><strong>{avgMttr == null ? "—" : `${avgMttr.toFixed(1)} h`}</strong></div>
            <div><span>Average MTBF</span><strong>{avgMtbf == null ? "—" : `${avgMtbf.toFixed(1)} h`}</strong></div>
            <div><span>Breakdown downtime</span><strong>{totalBreakdown.toFixed(1)} h</strong></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h2>Maintenance</h2><div className="muted">Preventive maintenance performance</div></div></div>
          <div className="health-list">
            <div><span>PM work orders</span><strong>{maintenance?.preventive_work_orders ?? "—"}</strong></div>
            <div><span>PM completion</span><strong>{maintenance ? `${Number(maintenance.preventive_completion_rate).toFixed(0)}%` : "—"}</strong></div>
            <div><span>Overdue PM WOs</span><strong>{maintenance?.overdue_preventive_work_orders ?? "—"}</strong></div>
            <div><span>PM actual cost</span><strong>{maintenance ? Number(maintenance.preventive_actual_cost).toLocaleString() : "—"}</strong></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div><h2>Operating cost breakdown</h2><div className="muted">Current totals by cost category</div></div></div>
        {costs ? (
          <div className="stats analytics-stats">
            <div className="stat-card"><div className="label">Fuel</div><div className="value">{Number(costs.total_fuel_cost).toLocaleString()}</div></div>
            <div className="stat-card"><div className="label">Maintenance</div><div className="value">{Number(costs.total_maintenance_cost).toLocaleString()}</div></div>
            <div className="stat-card"><div className="label">Parts</div><div className="value">{Number(costs.total_parts_cost).toLocaleString()}</div></div>
            <div className="stat-card"><div className="label">Labor</div><div className="value">{Number(costs.total_labor_cost).toLocaleString()}</div></div>
          </div>
        ) : <div className="empty">No operating cost data available.</div>}
      </div>

      <div className="panel">
        <div className="panel-header"><div><h2>Monthly operating cost</h2><div className="muted">Last available trend returned by the cost service</div></div></div>
        {trends.length === 0 ? <div className="empty">No monthly cost history yet.</div> : (
          <div className="health-list">
            {trends.map((row) => (
              <div key={row.period} style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <span>{row.period}</span><strong>{Number(row.total_operating_cost).toLocaleString()}</strong>
                </div>
                <div style={{ marginTop: "0.4rem", height: 8, background: "var(--border)", borderRadius: 999 }}>
                  <div style={{ width: `${Math.max(2, Number(row.total_operating_cost) / maxTrend * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><div><h2>Equipment requiring attention</h2><div className="muted">Assets with current operational or maintenance indicators</div></div><strong>{riskRows.length}</strong></div>
        {riskRows.length === 0 ? <div className="empty">No equipment is currently flagged.</div> : (
          <table>
            <thead><tr><th>Asset</th><th>Status</th><th>Indicators</th><th>MTBF</th><th>MTTR</th><th>Downtime</th></tr></thead>
            <tbody>{riskRows.slice(0, 15).map((row) => {
              const p = performance.find((x) => x.equipment_id === row.equipment.id);
              const d = downtime.find((x) => x.equipment_id === row.equipment.id);
              return (
                <tr key={row.equipment.id}>
                  <td><strong>{row.equipment.asset_code}</strong><div className="muted">{row.equipment.name}</div></td>
                  <td><span className={`badge badge-${row.equipment.status}`}>{row.equipment.status.replace(/_/g, " ")}</span></td>
                  <td>{row.reasons.join(" · ")}</td>
                  <td>{p?.mtbf_hours == null ? "—" : `${Number(p.mtbf_hours).toFixed(1)} h`}</td>
                  <td>{p?.mttr_hours == null ? "—" : `${Number(p.mttr_hours).toFixed(1)} h`}</td>
                  <td>{d ? `${Number(d.total_hours).toFixed(1)} h` : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><div><h2>Downtime by asset</h2><div className="muted">Total recorded downtime across assets</div></div><strong>{totalDowntime.toFixed(1)} h</strong></div>
        {downtime.length === 0 ? <div className="empty">No downtime history yet.</div> : (
          <table>
            <thead><tr><th>Asset</th><th>Events</th><th>Total</th><th>Breakdown</th><th>Maintenance</th><th>Open</th></tr></thead>
            <tbody>{downtime.slice().sort((a,b) => Number(b.total_hours) - Number(a.total_hours)).slice(0, 15).map((r) => (
              <tr key={r.equipment_id}><td><strong>{r.equipment.asset_code}</strong><div className="muted">{r.equipment.name}</div></td><td>{r.total_events}</td><td>{Number(r.total_hours).toFixed(1)} h</td><td>{Number(r.breakdown_hours).toFixed(1)} h</td><td>{Number(r.maintenance_hours).toFixed(1)} h</td><td>{r.open_events}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Cost by equipment</h2></div>
        {!costs || costs.by_equipment.length === 0 ? <div className="empty">No equipment cost data yet.</div> : (
          <table>
            <thead><tr><th>Asset</th><th>Fuel</th><th>Maintenance</th><th>Parts</th><th>Labor</th><th>Total</th><th>Cost/hour</th></tr></thead>
            <tbody>{costs.by_equipment.slice().sort((a,b) => Number(b.total_operating_cost) - Number(a.total_operating_cost)).slice(0, 15).map((r) => (
              <tr key={r.equipment_id}><td><strong>{r.asset_code}</strong><div className="muted">{r.equipment_name}</div></td><td>{Number(r.fuel_cost).toLocaleString()}</td><td>{Number(r.maintenance_cost).toLocaleString()}</td><td>{Number(r.parts_cost).toLocaleString()}</td><td>{Number(r.labor_cost).toLocaleString()}</td><td><strong>{Number(r.total_operating_cost).toLocaleString()}</strong></td><td>{r.cost_per_hour == null ? "—" : Number(r.cost_per_hour).toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
