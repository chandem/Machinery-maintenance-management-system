import { useEffect, useState } from "react";
import { api, ApiError, Page } from "../api/client";

type AuditLog = {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  created_at: string;
};

export default function AuditLogPage() {
  const [data, setData] = useState<Page<AuditLog> | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), page_size: "25" });
      if (action) params.set("action", action);
      if (entityType) params.set("entity_type", entityType);
      const result = await api.get<Page<AuditLog>>(`/api/v1/audit?${params.toString()}`);
      setData(result);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); }, []);

  return (
    <div>
      <div className="page-actions">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-sub">Track important changes made in the maintenance system</p>
        </div>
      </div>

      <div className="panel">
        <div className="form-grid">
          <label>Action
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="status_change">Status change</option>
              <option value="delete">Delete</option>
              <option value="transaction">Transaction</option>
              <option value="service_complete">Service complete</option>
            </select>
          </label>
          <label>Entity
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All entities</option>
              <option value="equipment">Equipment</option>
              <option value="work_order">Work order</option>
              <option value="maintenance_plan">Maintenance plan</option>
              <option value="inventory">Inventory</option>
              <option value="fuel">Fuel</option>
              <option value="inspection">Inspection</option>
              <option value="downtime">Downtime</option>
              <option value="supplier">Supplier</option>
              <option value="part">Part</option>
              <option value="work_order_labor">Work-order labor</option>
              <option value="work_order_task">Work-order task</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end", gap: "0.5rem" }}>
            <button onClick={() => void load(1)} disabled={loading}>{loading ? "Loading…" : "Apply"}</button>
            <button className="secondary" onClick={() => { setAction(""); setEntityType(""); setTimeout(() => void load(1), 0); }}>Clear</button>
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Activity history</h2>
          <span className="muted">{data?.total ?? 0} records</span>
        </div>
        {loading && !data ? <div className="loading">Loading audit trail…</div> :
          !data || data.items.length === 0 ? <div className="empty">No audit records found.</div> :
          <>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Date & time</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>{row.user_id == null ? "System" : `User #${row.user_id}`}</td>
                      <td><span className="badge">{row.action.replace(/_/g, " ")}</span></td>
                      <td>{row.entity_type.replace(/_/g, " ")}{row.entity_id != null ? ` #${row.entity_id}` : ""}</td>
                      <td>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="page-actions" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
              <span className="muted">Page {data.page} of {Math.max(data.pages, 1)}</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Previous</button>
                <button className="secondary" disabled={page >= data.pages || loading} onClick={() => void load(page + 1)}>Next</button>
              </div>
            </div>
          </>}
      </div>
    </div>
  );
}
