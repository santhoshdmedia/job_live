import React from 'react';
import { useSelector } from 'react-redux';
import { Button, Tooltip } from 'antd';
import { canEditPage, canDeletePage, isSuperAdmin } from '../helper/permissionHelper';
import { LockOutlined } from '@ant-design/icons';

export const EditButton = ({ pageName, onClick, children, ...props }) => {
  const { user } = useSelector((state) => state.authSlice);
  const hasPermission = isSuperAdmin(user.role) || canEditPage(user.pagePermissions, pageName);

  if (!hasPermission) {
    return (
      <Tooltip title="You don't have permission to edit">
        <Button {...props} disabled icon={<LockOutlined />}>
          {children || 'Edit'}
        </Button>
      </Tooltip>
    );
  }

  return <Button {...props} onClick={onClick}>{children || 'Edit'}</Button>;
};

export const DeleteButton = ({ pageName, onClick, children, ...props }) => {
  const { user } = useSelector((state) => state.authSlice);
  const hasPermission = isSuperAdmin(user.role) || canDeletePage(user.pagePermissions, pageName);

  if (!hasPermission) {
    return (
      <Tooltip title="You don't have permission to delete">
        <Button {...props} disabled danger icon={<LockOutlined />}>
          {children || 'Delete'}
        </Button>
      </Tooltip>
    );
  }

  return <Button {...props} onClick={onClick} danger>{children || 'Delete'}</Button>;
};

export const AddButton = ({ pageName, onClick, children, ...props }) => {
  const { user } = useSelector((state) => state.authSlice);
  const hasPermission = isSuperAdmin(user.role) || canEditPage(user.pagePermissions, pageName);

  if (!hasPermission) {
    return null;
  }

  return <Button {...props} onClick={onClick}>{children || 'Add'}</Button>;
};