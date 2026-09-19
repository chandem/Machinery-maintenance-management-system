import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, MeterReading, WorkOrder } from "../api/types";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [meterType, setMeterType] = useState("hour_meter");
  const [meterValue, setMeterValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [equipment, meterPage, woPage] = await Promise.all([
        api.get<Equipment>(`/api/v1/equipment/${id}`),
        api.get<Page<MeterReading>>(`/api/v1/equipment/meter-readings?equipment_id=${id}&page_size=10`),
        api.get<Page<WorkOrder>>(`/api/v1/work-orders?equipment_id=${id}&page_size=10`),
      ]);
      setEq(equipment);
      setReadings(meterPage.items);
      setOrders(woPage.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load equipment");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMeter(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/equipment/meter-readings", {
        equipment_id: Number(id),
        reading_type: meterType,
        reading_value: Number(meterValue),
        source: "manual",
      });
      setMeterValue("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to record reading");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: string) {
    if (!id || !eq) return;
    setStatusBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Equipment>(`/api/v1/equipment/${id}`, { status });
      setEq(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  if (!eq && !error) return <p className="muted">Loading…</p>;
  if (!eq) return <div className="error-msg">{error}</div>;

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        <Link to="/equipment" style={{ color: "var(--accent)" }}>
          ← Equipment
        </Link>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {eq.asset_code}
          </h1>
          <p className="page-sub" style={{ marginBottom: "0.5rem" }}>
            {eq.name}
            {eq.manufacturer && ` · ${eq.manufacturer}`}
            {eq.model && ` ${eq.model}`}
          </p>
          <span className={`badge badge-${eq.status}`}>{eq.status.replace(/_/g, " ")}</span>
        </div>
        <div className="toolbar">
          {(["operational", "maintenance", "down", "out_of_service"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={statusBusy || eq.status === s}
              onClick={() => void updateStatus(s)}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginTop: "1rem" }}>{error}</div>}

      <div className="stats" style={{ marginTop: "1.5rem" }}>
        <div className="stat-card">
          <div className="label">Hour meter</div>
          <div className="value">{eq.hour_meter != null ? Number(eq.hour_meter).toLocaleString() : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Odometer</div>
          <div className="value">{eq.odometer != null ? Number(eq.odometer).toLocaleString() : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Serial</div>
          <div className="value" style={{ fontSize: "1rem" }}>
            {eq.serial_number ?? "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Plate</div>
          <div className="value" style={{ fontSize: "1rem" }}>
            {eq.plate_number ?? "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        <div className="panel">
          <div className="panel-header">
            <h2>Record meter reading</h2>
          </div>
          <form onSubmit={onMeter} style={{ padding: "1rem 1.15rem" }}>
            <div className="form-group">
              <label>Type</label>
              <select className="input" value={meterType} onChange={(e) => setMeterType(e.target.value)}>
                <option value="hour_meter">Hour meter</option>
                <option value="odometer">Odometer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Value</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={meterValue}
                onChange={(e) => setMeterValue(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Saving…" : "Save reading"}
            </button>
          </form>
          {readings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reading_type}</td>
                    <td>{Number(r.reading_value).toLocaleString()}</td>
                    <td className="muted">{new Date(r.recorded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Work orders</h2>
            <Link to="/work-orders" className="btn btn-ghost btn-sm">
              All WOs
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="empty">No work orders for this asset.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => (
                  <tr key={wo.id}>
                    <td>
                      <Link to={`/work-orders/${wo.id}`}>
                        <strong style={{ color: "var(--accent)" }}>{wo.work_order_number}</strong>
                      </Link>
                    </td>
                    <td>{wo.title}</td>
                    <td>
                      <span className={`badge badge-${wo.status}`}>{wo.status.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
