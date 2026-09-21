import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

type AlertItem = {
  level: string;
  category: string;
  title: string;
  detail: string;
  href: string | null;
};

type AlertsResponse = {
  generated_at: string;
  count: number;
  items: AlertItem[];
};

export default function AlertsPage() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<AlertsResponse>("/api/v1/admin/alerts");
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Failed to load alerts");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Alerts</h1>
      <p className="page-sub">Live operational issues across maintenance, stock, and downtime</p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Active alerts</h2>
            {data && (
              <div className="muted">Updated {new Date(data.generated_at).toLocaleString()}</div>
            )}
          </div>
          <strong>{data?.count ?? "—"}</strong>
        </div>
        {!data ? (
          <div className="empty">Loading…</div>
        ) : data.items.length === 0 ? (
          <div className="empty">No active alerts. Fleet looks healthy.</div>
        ) : (
          <div className="health-list">
            {data.items.map((a, i) => (
              <div key={`${a.title}-${i}`}>
                <span>
                  <strong>{a.title}</strong>
                  <br />
                  <small>
                    <span className="muted" style={{ textTransform: "uppercase" }}>
                      {a.category}
                    </span>{" "}
                    · {a.detail}
                  </small>
                </span>
                <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span className={a.level === "danger" ? "badge badge-overdue" : "badge badge-due"}>
                    {a.level}
                  </span>
                  {a.href && (
                    <Link to={a.href} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
