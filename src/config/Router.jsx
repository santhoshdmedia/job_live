import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Layout from"./Layout";
import PermissionGuard from "../components/PermissionGuard";
import AdminJobManagement from "../pages/Adminjobmanagement";
import Designerjobdashboard from "../pages/Designerjobdashboard";
import OfflineProduct from "../pages/Stock/OfflineProduct";
import MaterialIssueManager from "../pages/MaterialIssueManager";
import Productionuploadpanel from "../pages/Productionuploadpanel"
import { useSelector } from "react-redux";
import DeliveryPanel from "../pages/DeliveryPanel";
import MyJobs from "../pages/MyJobs";
import QualityCheckDashboard from "../pages/QualityCheckDashboard";


// Wrapper component for permission-protected routes
const ProtectedRoute = ({ children, pageName }) => (
  <PermissionGuard pageName={pageName}>{children}</PermissionGuard>
);



export const router = createBrowserRouter([
 {
    path: "/",
    element: <Login />,
  },
  {
    path: "/dashboard",
    element: <Layout />,
    children: [
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute pageName="dashboard">
            <Dashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/admin/job-management",
    element: <Layout />,
    children: [
      {
        path: "/admin/job-management",
        element: (
          <ProtectedRoute pageName="admin-job-management">
            <AdminJobManagement />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/users",
    element: <Layout />,
    children: [
      {
        path: "/users",
        element: (
          <ProtectedRoute pageName="users">
            <OfflineProduct />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/my-jobs",
    element: <Layout />,
    children: [
      {
        path: "/my-jobs",
        element: (
          <ProtectedRoute pageName="my-jobs">
            <MyJobs />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/material-issue-manager",
    element: <Layout />,
    children: [
      {
        path: "/material-issue-manager",
        element: (
          <ProtectedRoute pageName="material-issue-manager">
           <MaterialIssueManager />
          </ProtectedRoute>
        ),
      },
    ],
  },
  
  {
    path: "/admin/designer-job-dashboard",
    element: <Layout />,
    children: [
      {
        path: "/admin/designer-job-dashboard",
        element: (
          <ProtectedRoute pageName="admin-designer-job-dashboard">
            <Designerjobdashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/production-panel",
    element: <Layout />,
    children: [
      {
        path: "/production-panel",
        element: (
          <ProtectedRoute pageName="production-panel">
            <Productionuploadpanel />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/quality-check",
    element: <Layout />,
    children: [
      {
        path: "/quality-check",
        element: (
          <ProtectedRoute pageName="quality-check-dashboard">
            <QualityCheckDashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/delivery-panel",
    element: <Layout />,
    children: [
      {
        path: "/delivery-panel",
        element: (
          <ProtectedRoute pageName="delivery-panel">
            <DeliveryPanel />
          </ProtectedRoute>
        ),
      },
    ],
  },

]);