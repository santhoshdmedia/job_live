/**
 * Check if user has permission to view a page
 */
export const canViewPage = (pagePermissions, pageName) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) return false;
  
  const permission = pagePermissions.find(p => p.pageName === pageName);
  return permission ? permission.canView : false;
};

/**
 * Check if user has edit permission for a page
 */
export const canEditPage = (pagePermissions, pageName) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) return false;
  
  const permission = pagePermissions.find(p => p.pageName === pageName);
  return permission ? permission.canEdit : false;
};

/**
 * Check if user has delete permission for a page
 */
export const canDeletePage = (pagePermissions, pageName) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) return false;
  
  const permission = pagePermissions.find(p => p.pageName === pageName);
  return permission ? permission.canDelete : false;
};

/**
 * Get all accessible pages for user
 */
export const getAccessiblePages = (pagePermissions) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) return [];
  
  return pagePermissions
    .filter(p => p.canView)
    .map(p => p.pageName);
};

/**
 * Check if user has any permission for a page
 */
export const hasAnyPermission = (pagePermissions, pageName) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) return false;
  
  const permission = pagePermissions.find(p => p.pageName === pageName);
  return permission ? (permission.canView || permission.canEdit || permission.canDelete) : false;
};

/**
 * Get permission object for a page
 */
export const getPagePermissions = (pagePermissions, pageName) => {
  if (!pagePermissions || !Array.isArray(pagePermissions)) {
    return { canView: false, canEdit: false, canDelete: false };
  }
  
  const permission = pagePermissions.find(p => p.pageName === pageName);
  return permission || { canView: false, canEdit: false, canDelete: false };
};

/**
 * Check if user is super admin
 */
export const isSuperAdmin = (userRole) => {
  return userRole === "super admin";
};


