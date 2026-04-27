import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { canViewPage, isSuperAdmin } from '../helper/permissionHelper';

const PermissionGuard = ({ children, pageName, requiredPermission = 'view' }) => {
  const { user } = useSelector((state) => state.authSlice);

  // Super admin has access to everything
  if (isSuperAdmin(user.role)) {
    return children;
  }

  // Check if user has the required permission
  const hasPermission = canViewPage(user.pagePermissions, pageName);

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min- bg-gray-50">
        <Result
          status="403"
          title="403"
          subTitle="Sorry, you don't have permission to access this page."
          icon={<LockOutlined style={{ fontSize: 72, color: '#ff4d4f' }} />}
          extra={
            <Button type="primary" onClick={() => window.history.back()}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};

export default PermissionGuard;