import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { DowntimeEvent, Equipment, FuelRecord, MaintenancePlan, MeterReading, WorkOrder } from "../api/types";
import DocumentsPanel from "../components/DocumentsPanel";

type QrInfo = { payload: string; qr_image_url: string; asset_code: string };
type Operator = { id: number; employee_code: string; full_name: string; active: boolean };

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [downtime, setDowntime] = useState<DowntimeEvent[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
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
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    plate_number: "",
    warranty_expiry: "",
    category_id: "",
    location_id: "",
    operator_id: "",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [equipment, meterPage, woPage, fuelPage, dtPage, planPage, qrInfo, ops, cats, locs] =
        await Promise.all([
          api.get<Equipment>(`/api/v1/equipment/${id}`),
          api.get<Page<MeterReading>>(`/api/v1/equipment/meter-readings?equipment_id=${id}&page_size=8`),
          api.get<Page<WorkOrder>>(`/api/v1/work-orders?equipment_id=${id}&page_size=8`),
          api.get<Page<FuelRecord>>(`/api/v1/fuel?equipment_id=${id}&page_size=8`),
          api.get<Page<DowntimeEvent>>(`/api/v1/downtime?equipment_id=${id}&page_size=8`),
          api.get<Page<MaintenancePlan>>(`/api/v1/maintenance-plans?equipment_id=${id}&active_only=true&page_size=20`),
          api.get<QrInfo>(`/api/v1/equipment/${id}/qr`).catch(() => null),
          api.get<Operator[]>(`/api/v1/equipment/operators?active_only=false`),
          api.get<{ id: number; name: string }[]>(`/api/v1/equipment/categories`),
          api.get<{ id: number; name: string }[]>(`/api/v1/equipment/locations`),
        ]);
      setEq(equipment);
      setReadings(meterPage.items);
      setOrders(woPage.items);
      setFuel(fuelPage.items);
      setDowntime(dtPage.items);
      setPlans(planPage.items);
      setQr(qrInfo);
      setOperators(ops);
      setCategories(cats);
      setLocations(locs);
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

  function startEdit() {
    setEditForm({
      name: eq?.name ?? "",
      manufacturer: eq?.manufacturer ?? "",
      model: eq?.model ?? "",
      serial_number: eq?.serial_number ?? "",
      plate_number: eq?.plate_number ?? "",
      warranty_expiry: eq?.warranty_expiry ?? "",
      category_id: eq?.category_id ? String(eq.category_id) : "",
      location_id: eq?.location_id ? String(eq.location_id) : "",
      operator_id: eq?.operator_id ? String(eq.operator_id) : "",
      notes: eq?.notes ?? "",
    });
    setEditing(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setEditBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Equipment>(`/api/v1/equipment/${id}`, {
        ...editForm,
        manufacturer: editForm.manufacturer || null,
        model: editForm.model || null,
        serial_number: editForm.serial_number || null,
        plate_number: editForm.plate_number || null,
        warranty_expiry: editForm.warranty_expiry || null,
        category_id: editForm.category_id ? Number(editForm.category_id) : null,
        location_id: editForm.location_id ? Number(editForm.location_id) : null,
        operator_id: editForm.operator_id ? Number(editForm.operator_id) : null,
        notes: editForm.notes || null,
      });
      setEq(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Equipment update failed");
    } finally {
      setEditBusy(false);
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
          <button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
            Edit asset
          </button>
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

      {error && (
        <div className="error-msg" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {editing && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="panel-header">
            <h2>Edit asset information</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
          <form onSubmit={saveEdit} style={{ padding: "1rem 1.15rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Name</label>
                <input className="input" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Manufacturer</label>
                <input className="input" value={editForm.manufacturer} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Model</label>
                <input className="input" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Serial number</label>
                <input className="input" value={editForm.serial_number} onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Plate number</label>
                <input className="input" value={editForm.plate_number} onChange={(e) => setEditForm({ ...editForm, plate_number: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Warranty expiry</label>
                <input className="input" type="date" value={editForm.warranty_expiry} onChange={(e) => setEditForm({ ...editForm, warranty_expiry: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category</label>
                <select className="input" value={editForm.category_id} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {categories.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Location</label>
                <select className="input" value={editForm.location_id} onChange={(e) => setEditForm({ ...editForm, location_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {locations.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Operator</label>
                <select className="input" value={editForm.operator_id} onChange={(e) => setEditForm({ ...editForm, operator_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {operators.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.employee_code} — {x.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <textarea className="input" rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={editBusy}>
              {editBusy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      )}

      <div className="panel asset-profile" style={{ marginTop: "1.25rem" }}>
        <div className="panel-header">
          <h2>Asset profile</h2>
          <span className="muted">Registry information</span>
        </div>
        <div className="asset-profile-grid">
          <div>
            <span className="muted">Category</span>
            <strong>{categories.find((x) => x.id === eq.category_id)?.name ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Location</span>
            <strong>{locations.find((x) => x.id === eq.location_id)?.name ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Operator</span>
            <strong>{operators.find((x) => x.id === eq.operator_id)?.full_name ?? "Unassigned"}</strong>
          </div>
          <div>
            <span className="muted">Plate number</span>
            <strong>{eq.plate_number ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Purchase date</span>
            <strong>{eq.purchase_date ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Purchase cost</span>
            <strong>{eq.purchase_cost != null ? Number(eq.purchase_cost).toLocaleString() : "—"}</strong>
          </div>
          <div>
            <span className="muted">Warranty expiry</span>
            <strong>{eq.warranty_expiry ?? "—"}</strong>
          </div>
          <div>
            <span className="muted">Record created</span>
            <strong>{new Date(eq.created_at).toLocaleDateString()}</strong>
          </div>
        </div>
        {eq.notes && (
          <div className="asset-notes">
            <span className="muted">Notes</span>
            <div>{eq.notes}</div>
          </div>
        )}
      </div>

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

        {plans.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h2>Maintenance plans</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Next due</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.next_due_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <DocumentsPanel equipmentId={eq.id} />
      </div>
    </div>
  );
}
