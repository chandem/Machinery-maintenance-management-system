import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { DowntimeEvent, Equipment, FuelRecord, MeterReading, WorkOrder } from "../api/types";

type QrInfo = { payload: string; qr_image_url: string; asset_code: string };

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [downtime, setDowntime] = useState<DowntimeEvent[]>([]);
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meterType, setMeterType] = useState("hour_meter");
  const [meterValue, setMeterValue] = useState("");
  const [fuelQty, setFuelQty] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [dtReason, setDtReason] = useState("");
  const [dtCategory, setDtCategory] = useState("breakdown");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [equipment, meterPage, woPage, fuelPage, dtPage, qrInfo] = await Promise.all([
        api.get<Equipment>(`/api/v1/equipment/${id}`),
        api.get<Page<MeterReading>>(`/api/v1/equipment/meter-readings?equipment_id=${id}&page_size=8`),
        api.get<Page<WorkOrder>>(`/api/v1/work-orders?equipment_id=${id}&page_size=8`),
        api.get<Page<FuelRecord>>(`/api/v1/fuel?equipment_id=${id}&page_size=8`),
        api.get<Page<DowntimeEvent>>(`/api/v1/downtime?equipment_id=${id}&page_size=8`),
        api.get<QrInfo>(`/api/v1/equipment/${id}/qr`).catch(() => null),
      ]);
      setEq(equipment);
      setReadings(meterPage.items);
      setOrders(woPage.items);
      setFuel(fuelPage.items);
      setDowntime(dtPage.items);
      setQr(qrInfo);
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

  async function onFuel(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/fuel", {
        equipment_id: Number(id),
        quantity: Number(fuelQty),
        unit_cost: fuelCost ? Number(fuelCost) : null,
        hour_meter: eq?.hour_meter ?? null,
        odometer: eq?.odometer ?? null,
      });
      setFuelQty("");
      setFuelCost("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to record fuel");
    } finally {
      setBusy(false);
    }
  }

  async function onDowntime(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/downtime", {
        equipment_id: Number(id),
        reason: dtReason,
        category: dtCategory,
        started_at: new Date().toISOString(),
      });
      setDtReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to start downtime");
    } finally {
      setBusy(false);
    }
  }

  async function endDowntime(eventId: number) {
    try {
      await api.patch(`/api/v1/downtime/${eventId}`, { ended_at: new Date().toISOString() });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to end downtime");
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
        {qr && (
          <div className="stat-card" style={{ textAlign: "center" }}>
            <div className="label">QR</div>
            <img src={qr.qr_image_url} alt={`QR ${qr.asset_code}`} width={96} height={96} style={{ marginTop: 4, borderRadius: 6 }} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <div className="panel">
          <div className="panel-header">
            <h2>Meter reading</h2>
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
              <input className="input" type="number" step="0.01" min="0" required value={meterValue} onChange={(e) => setMeterValue(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Save reading
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
            <h2>Fuel</h2>
          </div>
          <form onSubmit={onFuel} style={{ padding: "1rem 1.15rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="input" type="number" min="0.01" step="0.01" placeholder="Litres" required value={fuelQty} onChange={(e) => setFuelQty(e.target.value)} />
              <input className="input" type="number" min="0" step="0.01" placeholder="Unit cost" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Log
              </button>
            </div>
          </form>
          {fuel.length === 0 ? (
            <div className="empty">No fuel records.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {fuel.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {Number(f.quantity)} {f.unit}
                    </td>
                    <td>{f.unit_cost != null ? Number(f.unit_cost).toLocaleString() : "—"}</td>
                    <td className="muted">{new Date(f.recorded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Downtime</h2>
          </div>
          <form onSubmit={onDowntime} style={{ padding: "1rem 1.15rem" }}>
            <div className="form-group">
              <label>Reason</label>
              <input className="input" required value={dtReason} onChange={(e) => setDtReason(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={dtCategory} onChange={(e) => setDtCategory(e.target.value)}>
                <option value="breakdown">Breakdown</option>
                <option value="maintenance">Maintenance</option>
                <option value="operator">Operator</option>
                <option value="weather">Weather</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Start downtime
            </button>
          </form>
          {downtime.length === 0 ? (
            <div className="empty">No downtime events.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {downtime.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.reason}
                      <div className="muted">{d.category}</div>
                    </td>
                    <td>
                      {d.ended_at ? (
                        <span className="badge badge-completed">ended</span>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void endDowntime(d.id)}>
                          End now
                        </button>
                      )}
                    </td>
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
