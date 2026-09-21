import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, FuelRecord, FuelSummary, FuelOperatingCostSummary, FuelOperatingCostTrend } from "../api/types";

function money(value: number | null) {
  return value == null ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function FuelPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [summary, setSummary] = useState<FuelSummary | null>(null);
  const [operatingCosts, setOperatingCosts] = useState<FuelOperatingCostSummary | null>(null);
  const [costTrends, setCostTrends] = useState<FuelOperatingCostTrend[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ equipment_id: "", quantity: "", unit_cost: "", hour_meter: "", odometer: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (equipmentId) params.set("equipment_id", equipmentId);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const [eqPage, fuelPage, fuelSummary, costSummary, trendData] = await Promise.all([
        api.get<Page<Equipment>>("/api/v1/equipment?page_size=100"),
        api.get<Page<FuelRecord>>(`/api/v1/fuel?${params.toString()}`),
        api.get<FuelSummary>(`/api/v1/fuel/summary?${new URLSearchParams({
          ...(equipmentId ? { equipment_id: equipmentId } : {}),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        }).toString()}`),
        api.get<FuelOperatingCostSummary>(`/api/v1/fuel/operating-costs?${new URLSearchParams({
          ...(equipmentId ? { equipment_id: equipmentId } : {}),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        }).toString()}`),
        api.get<FuelOperatingCostTrend[]>(`/api/v1/fuel/operating-cost-trends?${new URLSearchParams({
          ...(equipmentId ? { equipment_id: equipmentId } : {}),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        }).toString()}`),
      ]);
      setEquipment(eqPage.items);
      setRecords(fuelPage.items);
      setSummary(fuelSummary);
      setOperatingCosts(costSummary);
      setCostTrends(trendData);
      if (!form.equipment_id && eqPage.items.length) setForm((f) => ({ ...f, equipment_id: String(eqPage.items[0].id) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load fuel data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page, equipmentId, startDate, endDate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.equipment_id || !form.quantity) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<FuelRecord>("/api/v1/fuel", {
        equipment_id: Number(form.equipment_id),
        quantity: Number(form.quantity),
        unit: "L",
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        hour_meter: form.hour_meter ? Number(form.hour_meter) : null,
        odometer: form.odometer ? Number(form.odometer) : null,
        notes: form.notes || null,
      });
      setForm((f) => ({ ...f, quantity: "", unit_cost: "", hour_meter: "", odometer: "", notes: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to record fuel");
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setEquipmentId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  return (
    <div>
      <h1 className="page-title">Fuel & Operating Cost</h1>
      <p className="page-sub">Track fuel usage, fuel spend, and meter-based consumption across the fleet.</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="stats fuel-stats">
        <div className="stat-card"><div className="label">Fuel records</div><div className="value">{summary?.total_records ?? "—"}</div></div>
        <div className="stat-card"><div className="label">Fuel quantity</div><div className="value">{summary ? `${money(summary.total_quantity)} L` : "—"}</div></div>
        <div className="stat-card"><div className="label">Fuel cost</div><div className="value">{summary ? money(summary.total_fuel_cost) : "—"}</div></div>
        <div className="stat-card"><div className="label">Avg. unit cost</div><div className="value">{summary?.average_unit_cost != null ? money(summary.average_unit_cost) : "—"}</div></div>
      </div>

      <div className="panel fuel-filters" style={{ marginBottom: "1rem" }}>
        <div className="panel-header"><h2>Filters</h2><button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button></div>
        <div className="toolbar" style={{ padding: "1rem 1.15rem" }}>
          <select className="input" value={equipmentId} onChange={(e) => { setEquipmentId(e.target.value); setPage(1); }}>
            <option value="">All equipment</option>
            {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.asset_code} — {eq.name}</option>)}
          </select>
          <input className="input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          <input className="input" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-header"><h2>Total operating cost</h2><span className="muted">Fuel + maintenance + parts + labor</span></div>
        <div className="stats operating-cost-stats">
          <div className="stat-card"><div className="label">Fuel</div><div className="value">{money(operatingCosts?.total_fuel_cost ?? null)}</div></div>
          <div className="stat-card"><div className="label">Maintenance</div><div className="value">{money(operatingCosts?.total_maintenance_cost ?? null)}</div></div>
          <div className="stat-card"><div className="label">Parts</div><div className="value">{money(operatingCosts?.total_parts_cost ?? null)}</div></div>
          <div className="stat-card"><div className="label">Labor</div><div className="value">{money(operatingCosts?.total_labor_cost ?? null)}</div></div>
          <div className="stat-card"><div className="label">Total</div><div className="value">{money(operatingCosts?.total_operating_cost ?? null)}</div></div>
        </div>
        <div className="table-scroll"><table className="fuel-table">
          <thead><tr><th>Equipment</th><th>Fuel</th><th>Maintenance</th><th>Parts</th><th>Labor</th><th>Total</th><th>Cost/hour</th></tr></thead>
          <tbody>{operatingCosts?.by_equipment.map((row) => (
            <tr key={row.equipment_id}>
              <td><Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}>{row.asset_code}</Link><div className="muted">{row.equipment_name}</div></td>
              <td>{money(row.fuel_cost)}</td><td>{money(row.maintenance_cost)}</td><td>{money(row.parts_cost)}</td><td>{money(row.labor_cost)}</td><td><strong>{money(row.total_operating_cost)}</strong></td><td>{money(row.cost_per_hour)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-header"><h2>Operating cost trend</h2><span className="muted">Monthly cost breakdown for the selected period</span></div>
        {!costTrends.length ? <div className="empty">No cost trend data for the selected period.</div> : (
          <div className="cost-trend">
            {costTrends.map((row) => {
              const max = Math.max(...costTrends.map((x) => x.total_operating_cost), 1);
              const totalWidth = Math.max((row.total_operating_cost / max) * 100, row.total_operating_cost > 0 ? 2 : 0);
              return (
                <div className="cost-trend-row" key={row.period}>
                  <div className="cost-trend-label">{row.period}</div>
                  <div className="cost-trend-track">
                    <div className="cost-trend-bar" style={{ width: `${totalWidth}%` }}>
                      <span className="cost-trend-segment fuel" style={{ width: `${row.total_operating_cost ? (row.fuel_cost / row.total_operating_cost) * 100 : 0}%` }} />
                      <span className="cost-trend-segment maintenance" style={{ width: `${row.total_operating_cost ? (row.maintenance_cost / row.total_operating_cost) * 100 : 0}%` }} />
                      <span className="cost-trend-segment parts" style={{ width: `${row.total_operating_cost ? (row.parts_cost / row.total_operating_cost) * 100 : 0}%` }} />
                      <span className="cost-trend-segment labor" style={{ width: `${row.total_operating_cost ? (row.labor_cost / row.total_operating_cost) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <strong>{money(row.total_operating_cost)}</strong>
                </div>
              );
            })}
            <div className="cost-trend-legend">
              <span><i className="fuel" />Fuel</span><span><i className="maintenance" />Maintenance</span><span><i className="parts" />Parts</span><span><i className="labor" />Labor</span>
            </div>
          </div>
        )}
      </div>\n\n      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-header"><h2>Record fuel issue</h2><span className="muted">Meter readings improve consumption accuracy</span></div>
        <form onSubmit={onSubmit} className="fuel-form">
          <div className="form-group"><label>Equipment</label><select className="input" required value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}><option value="">Select equipment</option>{equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.asset_code} — {eq.name}</option>)}</select></div>
          <div className="form-group"><label>Quantity (L)</label><input className="input" type="number" min="0.01" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="form-group"><label>Unit cost</label><input className="input" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
          <div className="form-group"><label>Hour meter</label><input className="input" type="number" min="0" step="0.01" value={form.hour_meter} onChange={(e) => setForm({ ...form, hour_meter: e.target.value })} /></div>
          <div className="form-group"><label>Odometer</label><input className="input" type="number" min="0" step="0.01" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></div>
          <div className="form-group"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Record fuel"}</button>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-header"><h2>Equipment consumption</h2><span className="muted">Calculated from consecutive recorded meters</span></div>
        {loading ? <div className="empty">Loading…</div> : !summary?.by_equipment.length ? <div className="empty">No fuel data for the selected filters.</div> : (
          <div className="table-scroll"><table className="fuel-table">
            <thead><tr><th>Equipment</th><th>Quantity</th><th>Fuel cost</th><th>Avg/unit</th><th>L/hour</th><th>L/km</th></tr></thead>
            <tbody>{summary.by_equipment.map((row) => (
              <tr key={row.equipment_id}>
                <td><Link to={`/equipment/${row.equipment_id}`}><strong style={{ color: "var(--accent)" }}>{row.asset_code}</strong></Link><div className="muted">{row.equipment_name}</div></td>
                <td>{money(row.quantity)} L</td><td>{money(row.fuel_cost)}</td><td>{money(row.average_unit_cost)}</td><td>{money(row.liters_per_hour)}</td><td>{row.liters_per_km == null ? "—" : Number(row.liters_per_km).toFixed(3)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Fuel history</h2><span className="muted">{records.length} shown</span></div>
        {loading ? <div className="empty">Loading…</div> : !records.length ? <div className="empty">No fuel records.</div> : (
          <div className="table-scroll"><table className="fuel-table">
            <thead><tr><th>Date</th><th>Equipment</th><th>Quantity</th><th>Unit cost</th><th>Hour meter</th><th>Odometer</th></tr></thead>
            <tbody>{records.map((row) => { const eq = equipment.find((x) => x.id === row.equipment_id); return (
              <tr key={row.id}><td>{new Date(row.recorded_at).toLocaleString()}</td><td><Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}>{eq?.asset_code ?? `Equipment #${row.equipment_id}`}</Link></td><td>{money(row.quantity)} {row.unit}</td><td>{money(row.unit_cost)}</td><td>{money(row.hour_meter)}</td><td>{money(row.odometer)}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
        <div className="pagination">
          <span>Page {page}</span>
          <div className="btns">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn btn-ghost btn-sm" disabled={records.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
