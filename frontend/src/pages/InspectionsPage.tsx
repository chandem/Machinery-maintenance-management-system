import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Page } from "../api/client";
import type { Equipment, Inspection } from "../api/types";

export default function InspectionsPage() {
  const [data, setData] = useState<Page<Inspection> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    equipment_id: "",
    inspection_type: "routine",
    inspector_name: "",
    findings: "",
    severity: "medium",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "15" });
      if (status) params.set("status_filter", status);
      const res = await api.get<Page<Inspection>>(`/api/v1/inspections?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load inspections");
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showForm) return;
    void api
      .get<Page<Equipment>>("/api/v1/equipment?page_size=100")
      .then((p) => setEquipment(p.items))
      .catch(() => setEquipment([]));
  }, [showForm]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/inspections", {
        equipment_id: Number(form.equipment_id),
        inspection_type: form.inspection_type,
        inspector_name: form.inspector_name || null,
        findings: form.findings || null,
        severity: form.severity,
        status: "open",
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

  async function setInspectionStatus(id: number, next: string) {
    try {
      await api.patch(`/api/v1/inspections/${id}`, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Update failed");
    }
  }

  return (
    <div>
      <h1 className="page-title">Inspections</h1>
      <p className="page-sub">Safety and condition checks</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>All inspections</h2>
          <div className="toolbar">
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="closed">Closed</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New inspection"}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Equipment</label>
                <select
                  className="input"
                  required
                  value={form.equipment_id}
                  onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.asset_code} — {eq.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Type</label>
                <select
                  className="input"
                  value={form.inspection_type}
                  onChange={(e) => setForm({ ...form, inspection_type: e.target.value })}
                >
                  <option value="routine">Routine</option>
                  <option value="safety">Safety</option>
                  <option value="pre_use">Pre-use</option>
                  <option value="compliance">Compliance</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Inspector</label>
                <input
                  className="input"
                  value={form.inspector_name}
                  onChange={(e) => setForm({ ...form, inspector_name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Severity</label>
                <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "0.75rem" }}>
              <label>Findings</label>
              <input className="input" value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        )}

        {!data || data.items.length === 0 ? (
          <div className="empty">No inspections yet.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Equipment</th>
                  <th>Type</th>
                  <th>Findings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{new Date(row.inspected_at).toLocaleString()}</td>
                    <td>
                      <Link to={`/equipment/${row.equipment_id}`} style={{ color: "var(--accent)" }}>
                        #{row.equipment_id}
                      </Link>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{row.inspection_type.replace(/_/g, " ")}</td>
                    <td>{row.findings || "—"}</td>
                    <td>
                      <span className={`badge badge-${row.status === "passed" ? "completed" : row.status === "failed" ? "down" : "draft"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.status === "open" && (
                        <div className="toolbar">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setInspectionStatus(row.id, "passed")}>
                            Pass
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setInspectionStatus(row.id, "failed")}>
                            Fail
                          </button>
                        </div>
                      )}
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
