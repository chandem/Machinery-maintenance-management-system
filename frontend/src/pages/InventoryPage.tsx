import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { InventoryStatus } from "../api/types";

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryStatus[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    part_number: "",
    name: "",
    unit_cost: "",
    reorder_level: "5",
    quantity_on_hand: "0",
    location: "Main store",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = lowOnly ? "?low_stock_only=true" : "";
      const data = await api.get<InventoryStatus[]>(`/api/v1/inventory/status${q}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load inventory");
    }
  }, [lowOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const part = await api.post<{ id: number }>("/api/v1/parts", {
        part_number: form.part_number,
        name: form.name,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        reorder_level: Number(form.reorder_level) || 0,
      });
      await api.post("/api/v1/inventory", {
        part_id: part.id,
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        location: form.location || null,
      });
      setShowForm(false);
      setForm({
        part_number: "",
        name: "",
        unit_cost: "",
        reorder_level: "5",
        quantity_on_hand: "0",
        location: "Main store",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Inventory</h1>
      <p className="page-sub">Spare parts stock levels and reorder alerts</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Stock status</h2>
          <div className="toolbar">
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Low / out of stock only
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Add part"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Part number</label>
                <input className="input" required value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Unit cost</label>
                <input className="input" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Reorder level</label>
                <input className="input" type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Qty on hand</label>
                <input className="input" type="number" min="0" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Location</label>
                <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>
              {busy ? "Saving…" : "Create part + stock"}
            </button>
          </form>
        )}

        {rows.length === 0 ? (
          <div className="empty">No inventory records. Add a part to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Name</th>
                <th>On hand</th>
                <th>Reorder at</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.part_number}</strong>
                  </td>
                  <td>{r.part_name}</td>
                  <td>{Number(r.quantity_on_hand).toLocaleString()}</td>
                  <td>{Number(r.reorder_level).toLocaleString()}</td>
                  <td>{r.location ?? "—"}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span>
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
