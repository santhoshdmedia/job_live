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
import SiteVisitDashboard from "../pages/Sitevisitdashboard";
import PickupDashboard from "../pages/PickupDashboard";
import StaffMonitorPage from "../pages/StaffMonitorPage";
import StaffAdminPanel from "../pages/staff/StaffDetailDraver";
import MyTasksPage from "../pages/Mytaskspage";


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
        path: "site-visit-dashboard",
        element: (
          <ProtectedRoute pageName="site-visit-dashboard">
            <SiteVisitDashboard />
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
        path: "pickup-dashboard",
        element: (
          <ProtectedRoute pageName="pickup-dashboard">
            <PickupDashboard />
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
        path: "Staff-monitor",
        element: (
          <ProtectedRoute pageName="Staff-monitor">
            <StaffMonitorPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "staff-admin",
        element: (
          <ProtectedRoute pageName="staff-admin">
            <StaffAdminPanel />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-tasks",
        element: (
          <ProtectedRoute pageName="my-tasks">
            <MyTasksPage />
          </ProtectedRoute>
        ),
      },
      // In router.jsx — remove PermissionGuard from add-product
      {
        path: "add-product",
        element: <AddProduct />,
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