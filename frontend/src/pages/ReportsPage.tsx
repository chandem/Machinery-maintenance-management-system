import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

type CostByEquipment = { equipment_id: number; asset_code: string; name: string; work_order_cost: number; fuel_cost: number; total_cost: number; work_order_count: number };
type CostReport = { total_work_order_cost: number; total_fuel_cost: number; total_cost: number; by_equipment: CostByEquipment[] };
type AvailabilityItem = { equipment_id: number; asset_code: string; name: string; status: string; downtime_hours_open: number | null; downtime_events_total: number; open_work_orders: number };
type AvailabilityReport = { total_equipment: number; operational: number; availability_pct: number; items: AvailabilityItem[] };
type EquipmentOption = { id: number; asset_code: string; name: string };

export default function ReportsPage() {
  const [costs, setCosts] = useState<CostReport | null>(null);
  const [avail, setAvail] = useState<AvailabilityReport | null>(null);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (equipmentId) params.set("equipment_id", equipmentId);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const query = params.toString() ? `?${params.toString()}` : "";
      const [c, a] = await Promise.all([
        api.get<CostReport>(`/api/v1/reports/costs${query}`),
        api.get<AvailabilityReport>(`/api/v1/reports/availability${query}`),
      ]);
      setCosts(c);
      setAvail(a);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.get<{ items: EquipmentOption[] }>("/api/v1/equipment?page=1&page_size=100")
      .then((r) => { if (!cancelled) setEquipment(r.items); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { void loadReports(); }, []);

  const money = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const exportCsv = () => {
    if (!costs) return;
    const rows = [["Asset", "Name", "WO Cost", "Fuel Cost", "Total Cost", "WO Count"], ...costs.by_equipment.map((r) => [r.asset_code, r.name, r.work_order_cost, r.fuel_cost, r.total_cost, r.work_order_count])];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mmms-cost-report.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      <div className="page-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div><h1 className="page-title">Reports</h1><p className="page-sub">Filtered fleet costs and availability</p></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button className="secondary" onClick={exportCsv} disabled={!costs}>Export CSV</button>
          <button className="secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <div className="panel report-filters">
        <div className="form-grid">
          <label>Equipment<select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}><option value="">All equipment</option>{equipment.map((e) => <option key={e.id} value={e.id}>{e.asset_code} — {e.name}</option>)}</select></label>
          <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>End date<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <div style={{ display: "flex", alignItems: "end", gap: "0.5rem" }}><button onClick={() => void loadReports()} disabled={loading}>{loading ? "Loading…" : "Apply filters"}</button><button className="secondary" onClick={() => { setEquipmentId(""); setStartDate(""); setEndDate(""); setTimeout(() => void loadReports(), 0); }}>Clear</button></div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {avail && <div className="stats">
        <div className="stat-card"><div className="label">Fleet size</div><div className="value">{avail.total_equipment}</div></div>
        <div className="stat-card ok"><div className="label">Operational</div><div className="value">{avail.operational}</div></div>
        <div className="stat-card"><div className="label">Availability</div><div className="value">{Number(avail.availability_pct).toFixed(1)}%</div></div>
        <div className="stat-card"><div className="label">WO costs</div><div className="value">{money(costs?.total_work_order_cost ?? 0)}</div></div>
        <div className="stat-card"><div className="label">Fuel costs</div><div className="value">{money(costs?.total_fuel_cost ?? 0)}</div></div>
        <div className="stat-card ok"><div className="label">Total cost</div><div className="value">{money(costs?.total_cost ?? 0)}</div></div>
      </div>}

      <div className="panel"><div className="panel-header"><h2>Cost by equipment</h2></div>
        {!costs || costs.by_equipment.length === 0 ? <div className="empty">No cost data for the selected filters.</div> :
          <table><thead><tr><th>Asset</th><th>WO cost</th><th>Fuel</th><th>Total</th><th>WOs</th></tr></thead><tbody>
            {costs.by_equipment.map((row) => <tr key={row.equipment_id}><td><Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}><strong>{row.asset_code}</strong></Link><div className="muted">{row.name}</div></td><td>{money(row.work_order_cost)}</td><td>{money(row.fuel_cost)}</td><td><strong>{money(row.total_cost)}</strong></td><td>{row.work_order_count}</td></tr>)}
          </tbody></table>}
      </div>

      <div className="panel"><div className="panel-header"><h2>Availability</h2></div>
        {!avail || avail.items.length === 0 ? <div className="empty">No equipment for the selected filters.</div> :
          <table><thead><tr><th>Asset</th><th>Status</th><th>Open downtime (h)</th><th>DT events</th><th>Open WOs</th></tr></thead><tbody>
            {avail.items.map((row) => <tr key={row.equipment_id}><td><Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}><strong>{row.asset_code}</strong></Link><div className="muted">{row.name}</div></td><td><span className={`badge badge-${row.status}`}>{row.status.replace(/_/g, " ")}</span></td><td>{row.downtime_hours_open == null ? "—" : Number(row.downtime_hours_open).toFixed(1)}</td><td>{row.downtime_events_total}</td><td>{row.open_work_orders}</td></tr>)}
          </tbody></table>}
      </div>
    </div>
  );
}
