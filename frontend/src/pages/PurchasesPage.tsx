import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Page } from "../api/client";
import type { Part } from "../api/types";

type PurchaseRequest = {
  id: number;
  part_id: number;
  quantity: number;
  status: string;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
};

const NEXT: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export default function PurchasesPage() {
  const [data, setData] = useState<Page<PurchaseRequest> | null>(null);
  const [page, setPage] = useState(1);
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ part_id: "", quantity: "1", requested_by: "", notes: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Page<PurchaseRequest>>(`/api/v1/purchase-requests?page=${page}&page_size=15`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load purchase requests");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .get<Page<Part>>("/api/v1/parts?page_size=100")
      .then((p) => setParts(p.items))
      .catch(() => setParts([]));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/purchase-requests", {
        part_id: Number(form.part_id),
        quantity: Number(form.quantity),
        requested_by: form.requested_by || null,
        notes: form.notes || null,
        status: "draft",
      });
      setShowForm(false);
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function advance(id: number, status: string) {
    try {
      await api.patch(`/api/v1/purchase-requests/${id}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Update failed");
    }
  }

  const partLabel = (pid: number) => {
    const p = parts.find((x) => x.id === pid);
    return p ? `${p.part_number} — ${p.name}` : `#${pid}`;
  };

  return (
    <div>
      <h1 className="page-title">Purchase requests</h1>
      <p className="page-sub">Reorder workflow for spare parts</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Requests</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New request"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Part</label>
                <select className="input" required value={form.part_id} onChange={(e) => setForm({ ...form, part_id: e.target.value })}>
                  <option value="">Select…</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Quantity</label>
                <input className="input" type="number" min="0.01" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Requested by</label>
                <input className="input" value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        )}

        {!data || data.items.length === 0 ? (
          <div className="empty">No purchase requests.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>{partLabel(row.part_id)}</td>
                    <td>{Number(row.quantity)}</td>
                    <td>
                      <span className={`badge badge-${row.status === "received" ? "completed" : "draft"}`}>{row.status}</span>
                    </td>
                    <td>{row.requested_by || "—"}</td>
                    <td>
                      <div className="toolbar">
                        {(NEXT[row.status] ?? []).map((s) => (
                          <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void advance(row.id, s)}>
                            → {s}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              <span>
                Page {data.page} of {data.pages || 1}
              </span>
              <div className="btns">
                <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={page >= (data.pages || 1)} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
