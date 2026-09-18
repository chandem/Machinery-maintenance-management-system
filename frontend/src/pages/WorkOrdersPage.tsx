import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Page } from "../api/client";
import type { WorkOrder } from "../api/types";

export default function WorkOrdersPage() {
  const [data, setData] = useState<Page<WorkOrder> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "15" });
      if (status) params.set("status_filter", status);
      const res = await api.get<Page<WorkOrder>>(`/api/v1/work-orders?${params}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load work orders");
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="page-title">Work orders</h1>
      <p className="page-sub">Execution and tracking of maintenance jobs</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>All work orders</h2>
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
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="verified">Verified</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {!data || data.items.length === 0 ? (
          <div className="empty">No work orders yet. Create them via the API or maintenance flow.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((wo) => (
                  <tr key={wo.id}>
                    <td>
                      <strong>{wo.work_order_number}</strong>
                    </td>
                    <td>{wo.title}</td>
                    <td style={{ textTransform: "capitalize" }}>{wo.maintenance_type}</td>
                    <td>
                      <span className={`badge badge-${wo.priority}`}>{wo.priority}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${wo.status}`}>{wo.status.replace(/_/g, " ")}</span>
                    </td>
                    <td>{wo.scheduled_date ?? "—"}</td>
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
