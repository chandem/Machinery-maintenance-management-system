import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment } from "../api/types";

export default function EquipmentPage() {
  const [data, setData] = useState<Page<Equipment> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_code: "", name: "", manufacturer: "", status: "operational" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "15" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (categoryId) params.set("category_id", categoryId);
      if (locationId) params.set("location_id", locationId);
      const res = await api.get<Page<Equipment>>(`/api/v1/equipment?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load equipment");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, categoryId, locationId]);

  useEffect(() => {
    void Promise.all([
      api.get<{ id: number; name: string }[]>("/api/v1/equipment/categories"),
      api.get<{ id: number; name: string }[]>("/api/v1/equipment/locations"),
    ]).then(([cats, locs]) => { setCategories(cats); setLocations(locs); }).catch((err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to load equipment filters");
    });
  }, []);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return { operational: items.filter(e => e.status === "operational").length, maintenance: items.filter(e => e.status === "maintenance").length, unavailable: items.filter(e => e.status === "down" || e.status === "out_of_service").length };
  }, [data]);

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
      <p className="page-sub">Asset registry, classification, location and operating status</p>

      <div className="stats equipment-stats">
        <div className="stat-card"><div className="label">Assets</div><div className="value">{data?.total ?? "—"}</div></div>
        <div className="stat-card ok"><div className="label">Operational</div><div className="value">{counts.operational}</div></div>
        <div className="stat-card warn"><div className="label">Maintenance</div><div className="value">{counts.maintenance}</div></div>
        <div className="stat-card danger"><div className="label">Down / OOS</div><div className="value">{counts.unavailable}</div></div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <div><h2>All equipment</h2><div className="muted">{data ? `${data.total} assets in registry` : "Loading fleet registry…"}</div></div>
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
            <select className="input" value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="input" value={locationId} onChange={(e) => { setPage(1); setLocationId(e.target.value); }}><option value="">All locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            {(categoryId || locationId) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCategoryId(""); setLocationId(""); setPage(1); }}>Clear filters</button>}
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

        {loading ? (
          <div className="empty">Loading equipment…</div>
        ) : !data || data.items.length === 0 ? (
          <div className="empty">No equipment found. Add your first asset.</div>
        ) : (
          <>
            <div className="table-scroll">
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
                      <Link to={`/equipment/${eq.id}`}>
                        <strong style={{ color: "var(--accent)" }}>{eq.asset_code}</strong>
                      </Link>
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
            </div>
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
