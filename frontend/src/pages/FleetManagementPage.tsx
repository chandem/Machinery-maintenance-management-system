import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Category = { id: number; name: string; description: string | null };
type Location = { id: number; name: string; description: string | null };
type Operator = { id: number; employee_code: string; full_name: string; phone: string | null; license_number: string | null; active: boolean };

export default function FleetManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [tab, setTab] = useState<"operators" | "locations" | "categories">("operators");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [operatorForm, setOperatorForm] = useState({ employee_code: "", full_name: "", phone: "", license_number: "" });
  const [locationForm, setLocationForm] = useState({ name: "", description: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ops, locs, cats] = await Promise.all([
        api.get<Operator[]>("/api/v1/equipment/operators?active_only=false"),
        api.get<Location[]>("/api/v1/equipment/locations"),
        api.get<Category[]>("/api/v1/equipment/categories"),
      ]);
      setOperators(ops); setLocations(locs); setCategories(cats);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load fleet management data");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try {
      if (tab === "operators") {
        await api.post("/api/v1/equipment/operators", { ...operatorForm, phone: operatorForm.phone || null, license_number: operatorForm.license_number || null, active: true });
        setOperatorForm({ employee_code: "", full_name: "", phone: "", license_number: "" });
        setMessage("Operator created successfully.");
      } else if (tab === "locations") {
        await api.post("/api/v1/equipment/locations", { ...locationForm, description: locationForm.description || null });
        setLocationForm({ name: "", description: "" });
        setMessage("Location created successfully.");
      } else {
        await api.post("/api/v1/equipment/categories", { ...categoryForm, description: categoryForm.description || null });
        setCategoryForm({ name: "", description: "" });
        setMessage("Category created successfully.");
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed");
    } finally { setBusy(false); }
  }

  async function toggleOperator(op: Operator) {
    setBusy(true); setError(null); setMessage(null);
    try {
      await api.patch(`/api/v1/equipment/operators/${op.id}`, { active: !op.active });
      setMessage(`${op.full_name} is now ${op.active ? "inactive" : "active"}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Operator update failed");
    } finally { setBusy(false); }
  }

  return <div>
    <h1 className="page-title">Fleet management</h1>
    <p className="page-sub">Manage operators, operating locations and equipment categories.</p>
    {error && <div className="error-msg">{error}</div>}
    {message && <div className="success-msg">{message}</div>}

    <div className="management-tabs">
      {(["operators", "locations", "categories"] as const).map(x =>
        <button key={x} type="button" className={`management-tab ${tab === x ? "active" : ""}`} onClick={() => { setTab(x); setError(null); setMessage(null); }}>
          {x[0].toUpperCase() + x.slice(1)}
        </button>
      )}
    </div>

    <div className="management-grid">
      <div className="panel">
        <div className="panel-header"><h2>Add {tab.slice(0, -1)}</h2></div>
        <form onSubmit={submit} style={{ padding: "1rem 1.15rem" }}>
          {tab === "operators" && <>
            <div className="form-group"><label>Employee code</label><input className="input" required value={operatorForm.employee_code} onChange={e => setOperatorForm({ ...operatorForm, employee_code: e.target.value })} /></div>
            <div className="form-group"><label>Full name</label><input className="input" required value={operatorForm.full_name} onChange={e => setOperatorForm({ ...operatorForm, full_name: e.target.value })} /></div>
            <div className="form-group"><label>Phone</label><input className="input" value={operatorForm.phone} onChange={e => setOperatorForm({ ...operatorForm, phone: e.target.value })} /></div>
            <div className="form-group"><label>License number</label><input className="input" value={operatorForm.license_number} onChange={e => setOperatorForm({ ...operatorForm, license_number: e.target.value })} /></div>
          </>}
          {tab !== "operators" && <>
            <div className="form-group"><label>Name</label><input className="input" required value={tab === "locations" ? locationForm.name : categoryForm.name} onChange={e => tab === "locations" ? setLocationForm({ ...locationForm, name: e.target.value }) : setCategoryForm({ ...categoryForm, name: e.target.value })} /></div>
            <div className="form-group"><label>Description</label><textarea className="input" rows={3} value={tab === "locations" ? locationForm.description : categoryForm.description} onChange={e => tab === "locations" ? setLocationForm({ ...locationForm, description: e.target.value }) : setCategoryForm({ ...categoryForm, description: e.target.value })} /></div>
          </>}
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Create"}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>{tab === "operators" ? "Operators" : tab === "locations" ? "Locations" : "Categories"}</h2><span className="muted">{tab === "operators" ? operators.length : tab === "locations" ? locations.length : categories.length} records</span></div>
        <div className="table-scroll">
          {tab === "operators" && <table><thead><tr><th>Employee</th><th>Contact</th><th>License</th><th>Status</th><th></th></tr></thead><tbody>{operators.map(op => <tr key={op.id}><td><strong>{op.employee_code}</strong><div className="muted">{op.full_name}</div></td><td>{op.phone ?? "—"}</td><td>{op.license_number ?? "—"}</td><td><span className={`badge ${op.active ? "badge-operational" : "badge-out_of_service"}`}>{op.active ? "active" : "inactive"}</span></td><td><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void toggleOperator(op)}>{op.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table>}
          {tab === "locations" && <table><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>{locations.map(x => <tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.description ?? "—"}</td></tr>)}</tbody></table>}
          {tab === "categories" && <table><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>{categories.map(x => <tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.description ?? "—"}</td></tr>)}</tbody></table>}
        </div>
      </div>
    </div>
  </div>;
}
