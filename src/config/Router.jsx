import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Layout from "./Layout";
import PermissionGuard from "../components/PermissionGuard";
import AdminJobManagement from "../pages/Adminjobmanagement";
import Designerjobdashboard from "../pages/Designerjobdashboard";
import OfflineProduct from "../pages/Stock/OfflineProduct";
import MaterialIssueManager from "../pages/Materialissuemanager";
import Productionuploadpanel from "../pages/Productionuploadpanel";
import DeliveryPanel from "../pages/DeliveryPanel";
import MyJobs from "../pages/Myjobs";
import QualityCheckDashboard from "../pages/QualityCheckDashboard";
import ErectionPanel from "../pages/Erectionpanel";
import AddProduct from "../pages/AddProduct";

const ProtectedRoute = ({ children, pageName }) => (
  <PermissionGuard pageName={pageName}>{children}</PermissionGuard>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },

  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "dashboard",
        element: (
          <ProtectedRoute pageName="dashboard">
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/job-management",
        element: (
          <ProtectedRoute pageName="admin-job-management">
            <AdminJobManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute pageName="users">
            <OfflineProduct />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-jobs",
        element: (
          <ProtectedRoute pageName="my-jobs">
            <MyJobs />
          </ProtectedRoute>
        ),
      },
      {
        path: "material-issue-manager",
        element: (
          <ProtectedRoute pageName="material-issue-manager">
            <MaterialIssueManager />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/designer-job-dashboard",
        element: (
          <ProtectedRoute pageName="admin-designer-job-dashboard">
            <Designerjobdashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "production-panel",
        element: (
          <ProtectedRoute pageName="production-panel">
            <Productionuploadpanel />
          </ProtectedRoute>
        ),
      },
      {
        path: "quality-check",
        element: (
          <ProtectedRoute pageName="quality-check-dashboard">
            <QualityCheckDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "delivery-panel",
        element: (
          <ProtectedRoute pageName="delivery-panel">
            <DeliveryPanel />
          </ProtectedRoute>
        ),
      },
      {
        path: "erection-panel",
        element: (
          <ProtectedRoute pageName="erection-panel">
            <ErectionPanel />
          </ProtectedRoute>
        ),
      },
      {
        path: "add-product",
        element: (
          <ProtectedRoute pageName="add-product">
            <AddProduct />
          </ProtectedRoute>
        ),
      },
      // ← REMOVED wildcard here — it was fighting the auth redirect
    ],
  },

  // Top-level wildcard: only reached after Layout auth check passes
  // Redirects unknown paths to dashboard
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);