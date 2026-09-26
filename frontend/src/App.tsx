import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EquipmentPage from "./pages/EquipmentPage";
import EquipmentDetailPage from "./pages/EquipmentDetailPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailPage from "./pages/WorkOrderDetailPage";
import MaintenancePage from "./pages/MaintenancePage";
import InventoryPage from "./pages/InventoryPage";
import InspectionsPage from "./pages/InspectionsPage";
import PurchasesPage from "./pages/PurchasesPage";
import FleetManagementPage from "./pages/FleetManagementPage";
import FuelPage from "./pages/FuelPage";
import ReportsPage from "./pages/ReportsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UsersPage from "./pages/UsersPage";
import AlertsPage from "./pages/AlertsPage";
import AuditLogPage from "./pages/AuditLogPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="fuel" element={<FuelPage />} />
        <Route path="inspections" element={<InspectionsPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="fleet-management" element={<FleetManagementPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
