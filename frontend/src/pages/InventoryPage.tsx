import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { InventoryStatus, PartTransaction } from "../api/types";

const emptyForm = {
  part_number: "",
  name: "",
  unit_cost: "",
  reorder_level: "5",
  quantity_on_hand: "0",
  location: "Main store",
};

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryStatus[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<InventoryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [tx, setTx] = useState({ type: "in", quantity: "", reference: "", notes: "" });
  const [history, setHistory] = useState<PartTransaction[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = lowOnly ? "?low_stock_only=true" : "";
      setRows(await api.get<InventoryStatus[]>(`/api/v1/inventory/status${q}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load inventory");
    }
  }, [lowOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => ({
    total: rows.length,
    low: rows.filter((r) => r.status === "low_stock").length,
    out: rows.filter((r) => r.status === "out_of_stock").length,
    units: rows.reduce((sum, r) => sum + Number(r.quantity_on_hand), 0),
  }), [rows]);

  async function openHistory(part: InventoryStatus) {
    setSelected(part);
    setError(null);
    try {
      const data = await api.get<{ items: PartTransaction[] }>(
        `/api/v1/inventory/transactions?part_id=${part.part_id}&page_size=10`
      );
      setHistory(data.items);
    } catch (err) {
      setHistory([]);
      setError(err instanceof ApiError ? err.detail : "Failed to load transaction history");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const part = await api.post<{ id: number }>("/api/v1/parts", {
        part_number: form.part_number.trim(),
        name: form.name.trim(),
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        reorder_level: Number(form.reorder_level) || 0,
      });
      await api.post("/api/v1/inventory", {
        part_id: part.id,
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        location: form.location.trim() || null,
      });
      setShowForm(false);
      setForm(emptyForm);
      setNotice("Part and opening stock created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onTransaction(e: FormEvent) {
    e.preventDefault();
    if (!selected || Number(tx.quantity) <= 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.post("/api/v1/inventory/transactions", {
        part_id: selected.part_id,
        transaction_type: tx.type,
        quantity: Number(tx.quantity),
        reference: tx.reference.trim() || null,
        notes: tx.notes.trim() || null,
      });
      setTx({ type: "in", quantity: "", reference: "", notes: "" });
      setNotice(`${tx.type === "in" ? "Stock received" : tx.type === "out" ? "Stock issued" : "Stock adjusted"} successfully.`);
      await load();
      const refreshed = await api.get<InventoryStatus[]>("/api/v1/inventory/status");
      const next = refreshed.find((r) => r.part_id === selected.part_id);
      if (next) await openHistory(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">Spare parts stock, reorder alerts, and movement history</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close form" : "+ Add part"}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {notice && <div className="success-msg">{notice}</div>}

      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Parts tracked</span><strong>{summary.total}</strong></div>
        <div className="stat-card"><span className="stat-label">Low stock</span><strong>{summary.low}</strong></div>
        <div className="stat-card"><span className="stat-label">Out of stock</span><strong>{summary.out}</strong></div>
        <div className="stat-card"><span className="stat-label">Units on hand</span><strong>{summary.units.toLocaleString()}</strong></div>
      </div>

      {showForm && (
        <form className="panel" onSubmit={onCreate} style={{ marginBottom: "1rem", padding: "1rem 1.15rem" }}>
          <div className="panel-header"><h2>New spare part</h2><span className="muted">Create the part and its opening stock record</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
            <div className="form-group" style={{ margin: 0 }}><label>Part number</label><input className="input" required value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Unit cost</label><input className="input" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Reorder level</label><input className="input" type="number" min="0" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Opening quantity</label><input className="input" type="number" min="0" step="0.01" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>Store location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>{busy ? "Saving…" : "Create part"}</button>
        </form>
      )}

      <div className="panel">
        <div className="panel-header">
          <div><h2>Stock status</h2><span className="muted">{rows.length} records shown</span></div>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Low / out only
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="empty">No inventory records match this filter.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Part</th><th>On hand</th><th>Reorder</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.part_number}</strong><div className="muted">{r.part_name}</div></td>
                    <td><strong>{Number(r.quantity_on_hand).toLocaleString()}</strong></td>
                    <td>{Number(r.reorder_level).toLocaleString()}</td>
                    <td>{r.location ?? "—"}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span></td>
                    <td><button className="btn btn-sm" type="button" onClick={() => void openHistory(r)}>Manage stock</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="panel-header">
            <div><h2>{selected.part_number} · {selected.part_name}</h2><span className="muted">Current stock: {Number(selected.quantity_on_hand).toLocaleString()} · {selected.location ?? "No location"}</span></div>
            <button className="btn btn-sm" type="button" onClick={() => setSelected(null)}>Close</button>
          </div>

          <form onSubmit={onTransaction} style={{ padding: "0 1.15rem 1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 150px 1fr 1fr auto", gap: "0.75rem", alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}><label>Movement</label><select className="input" value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}><option value="in">Receive stock</option><option value="out">Issue stock</option><option value="adjustment">Set stock</option></select></div>
              <div className="form-group" style={{ margin: 0 }}><label>Quantity</label><input className="input" required type="number" min="0.01" step="0.01" value={tx.quantity} onChange={(e) => setTx({ ...tx, quantity: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Reference</label><input className="input" placeholder="PO, invoice, job no." value={tx.reference} onChange={(e) => setTx({ ...tx, reference: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Notes</label><input className="input" placeholder="Optional note" value={tx.notes} onChange={(e) => setTx({ ...tx, notes: e.target.value })} /></div>
              <button className="btn btn-primary" type="submit" disabled={busy}>Post movement</button>
            </div>
          </form>

          <div style={{ padding: "0 1.15rem 1.15rem" }}>
            <h3 style={{ marginBottom: "0.6rem" }}>Recent movements</h3>
            {history.length === 0 ? <div className="empty">No transactions recorded for this part.</div> : (
              <table>
                <thead><tr><th>Type</th><th>Quantity</th><th>Reference</th><th>Notes</th></tr></thead>
                <tbody>{history.map((item) => <tr key={item.id}><td><span className={`badge badge-${item.transaction_type}`}>{item.transaction_type}</span></td><td>{Number(item.quantity).toLocaleString()}</td><td>{item.reference ?? "—"}</td><td>{item.notes ?? "—"}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
