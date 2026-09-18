import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment } from "../api/types";

export default function EquipmentPage() {
  const [data, setData] = useState<Page<Equipment> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_code: "", name: "", manufacturer: "", status: "operational" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "15" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = await api.get<Page<Equipment>>(`/api/v1/equipment?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load equipment");
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/equipment", {
        asset_code: form.asset_code,
        name: form.name,
        manufacturer: form.manufacturer || null,
        status: form.status,
      });
      setShowForm(false);
      setForm({ asset_code: "", name: "", manufacturer: "", status: "operational" });
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Equipment</h1>
      <p className="page-sub">Asset registry and status</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>All equipment</h2>
          <div className="toolbar">
            <input
              className="input"
              placeholder="Search code, name…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="operational">Operational</option>
              <option value="maintenance">Maintenance</option>
              <option value="down">Down</option>
              <option value="out_of_service">Out of service</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Add equipment"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Asset code</label>
                <input className="input" required value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Manufacturer</label>
                <input className="input" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="operational">Operational</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="down">Down</option>
                  <option value="out_of_service">Out of service</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }} disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        )}

        {!data || data.items.length === 0 ? (
          <div className="empty">No equipment found. Add your first asset.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Name</th>
                  <th>Manufacturer</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((eq) => (
                  <tr key={eq.id}>
                    <td>
                      <strong>{eq.asset_code}</strong>
                    </td>
                    <td>{eq.name}</td>
                    <td>{eq.manufacturer ?? "—"}</td>
                    <td>{eq.hour_meter != null ? Number(eq.hour_meter).toLocaleString() : "—"}</td>
                    <td>
                      <span className={`badge badge-${eq.status}`}>{eq.status.replace(/_/g, " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              <span>
                Page {data.page} of {data.pages || 1} · {data.total} total
              </span>
              <div className="btns">
                <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page >= (data.pages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
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
