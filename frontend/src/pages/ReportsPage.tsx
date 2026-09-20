import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

type CostByEquipment = {
  equipment_id: number;
  asset_code: string;
  name: string;
  work_order_cost: number;
  fuel_cost: number;
  total_cost: number;
  work_order_count: number;
};

type CostReport = {
  total_work_order_cost: number;
  total_fuel_cost: number;
  total_cost: number;
  by_equipment: CostByEquipment[];
};

type AvailabilityItem = {
  equipment_id: number;
  asset_code: string;
  name: string;
  status: string;
  downtime_hours_open: number | null;
  downtime_events_total: number;
  open_work_orders: number;
};

type AvailabilityReport = {
  total_equipment: number;
  operational: number;
  availability_pct: number;
  items: AvailabilityItem[];
};

export default function ReportsPage() {
  const [costs, setCosts] = useState<CostReport | null>(null);
  const [avail, setAvail] = useState<AvailabilityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, a] = await Promise.all([
          api.get<CostReport>("/api/v1/reports/costs"),
          api.get<AvailabilityReport>("/api/v1/reports/availability"),
        ]);
        if (!cancelled) {
          setCosts(c);
          setAvail(a);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load reports");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">Costs and fleet availability</p>

      {error && <div className="error-msg">{error}</div>}

      {avail && (
        <div className="stats">
          <div className="stat-card">
            <div className="label">Fleet size</div>
            <div className="value">{avail.total_equipment}</div>
          </div>
          <div className="stat-card ok">
            <div className="label">Operational</div>
            <div className="value">{avail.operational}</div>
          </div>
          <div className="stat-card">
            <div className="label">Availability</div>
            <div className="value">{Number(avail.availability_pct).toFixed(1)}%</div>
          </div>
          {costs && (
            <>
              <div className="stat-card">
                <div className="label">WO costs</div>
                <div className="value" style={{ fontSize: "1.25rem" }}>
                  {Number(costs.total_work_order_cost).toLocaleString()}
                </div>
              </div>
              <div className="stat-card">
                <div className="label">Fuel costs</div>
                <div className="value" style={{ fontSize: "1.25rem" }}>
                  {Number(costs.total_fuel_cost).toLocaleString()}
                </div>
              </div>
              <div className="stat-card ok">
                <div className="label">Total cost</div>
                <div className="value" style={{ fontSize: "1.25rem" }}>
                  {Number(costs.total_cost).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Cost by equipment</h2>
        </div>
        {!costs || costs.by_equipment.length === 0 ? (
          <div className="empty">No cost data yet (complete WOs or log fuel with unit cost).</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>WO cost</th>
                <th>Fuel</th>
                <th>Total</th>
                <th>WOs</th>
              </tr>
            </thead>
            <tbody>
              {costs.by_equipment.map((row) => (
                <tr key={row.equipment_id}>
                  <td>
                    <Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}>
                      <strong>{row.asset_code}</strong>
                    </Link>
                    <div className="muted">{row.name}</div>
                  </td>
                  <td>{Number(row.work_order_cost).toLocaleString()}</td>
                  <td>{Number(row.fuel_cost).toLocaleString()}</td>
                  <td>
                    <strong>{Number(row.total_cost).toLocaleString()}</strong>
                  </td>
                  <td>{row.work_order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-header">
          <h2>Availability</h2>
        </div>
        {!avail || avail.items.length === 0 ? (
          <div className="empty">No equipment.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Status</th>
                <th>Open downtime (h)</th>
                <th>DT events</th>
                <th>Open WOs</th>
              </tr>
            </thead>
            <tbody>
              {avail.items.map((row) => (
                <tr key={row.equipment_id}>
                  <td>
                    <Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}>
                      <strong>{row.asset_code}</strong>
                    </Link>
                    <div className="muted">{row.name}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${row.status}`}>{row.status.replace(/_/g, " ")}</span>
                  </td>
                  <td>{row.downtime_hours_open != null ? Number(row.downtime_hours_open).toFixed(1) : "—"}</td>
                  <td>{row.downtime_events_total}</td>
                  <td>{row.open_work_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
