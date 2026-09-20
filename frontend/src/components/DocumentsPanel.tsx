import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Doc = {
  id: number;
  equipment_id: number;
  title: string;
  document_type: string;
  url: string;
  notes: string | null;
  created_at: string;
};

export default function DocumentsPanel({ equipmentId }: { equipmentId: number }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [docType, setDocType] = useState("manual");

  const load = useCallback(async () => {
    try {
      const rows = await api.get<Doc[]>(`/api/v1/documents?equipment_id=${equipmentId}`);
      setDocs(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load documents");
    }
  }, [equipmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/documents", {
        equipment_id: equipmentId,
        title,
        url,
        document_type: docType,
      });
      setTitle("");
      setUrl("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/api/v1/documents/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Delete failed");
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Documents</h2>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={onCreate} style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem" }}>
          <input className="input" placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" placeholder="https://…" required value={url} onChange={(e) => setUrl(e.target.value)} />
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="certificate">Certificate</option>
            <option value="photo">Photo</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }} disabled={busy}>
          Add link
        </button>
      </form>
      {docs.length === 0 ? (
        <div className="empty">No documents linked.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                    {d.title}
                  </a>
                </td>
                <td>{d.document_type}</td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(d.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
