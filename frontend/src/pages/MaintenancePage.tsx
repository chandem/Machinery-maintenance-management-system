import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { MaintenanceScheduleStatus } from "../api/types";

export default function MaintenancePage() {
  const [rows, setRows] = useState<MaintenanceScheduleStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<MaintenanceScheduleStatus[]>("/api/v1/maintenance-plans/status");
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load schedule");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Maintenance schedule</h1>
      <p className="page-sub">Active plans with due / overdue status</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Plan status</h2>
        </div>
        {rows.length === 0 ? (
          <div className="empty">No active maintenance plans.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Plan</th>
                <th>Next due date</th>
                <th>Current / due meter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.asset_code}</strong>
                    <div className="muted">{row.equipment_name}</div>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.next_due_date ?? "—"}</td>
                  <td>
                    {row.current_meter != null ? Number(row.current_meter).toLocaleString() : "—"}
                    {row.next_due_meter != null && (
                      <span className="muted"> / {Number(row.next_due_meter).toLocaleString()}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${row.status}`}>{row.status}</span>
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
