// Constants to avoid magic strings
const SUPER_ADMIN_ROLE = "super admin";
const DEFAULT_PERMISSION = { canView: false, canEdit: false, canDelete: false };

/**
 * Safely retrieves a permission object for a given page.
 * Returns null if not found (internal helper).
 */
const findPermission = (pagePermissions, pageName) => {
  if (!Array.isArray(pagePermissions) || !pageName) return null;
  return pagePermissions.find((p) => p.pageName === pageName) ?? null;
};

/** Check if user has permission to view a page */
export const canViewPage = (pagePermissions, pageName) => {
  return findPermission(pagePermissions, pageName)?.canView ?? false;
};

/** Check if user has edit permission for a page */
export const canEditPage = (pagePermissions, pageName) => {
  return findPermission(pagePermissions, pageName)?.canEdit ?? false;
};

/** Check if user has delete permission for a page */
export const canDeletePage = (pagePermissions, pageName) => {
  return findPermission(pagePermissions, pageName)?.canDelete ?? false;
};

/** Get all page names the user is allowed to view */
export const getAccessiblePages = (pagePermissions) => {
  if (!Array.isArray(pagePermissions)) return [];
  return pagePermissions.filter((p) => p.canView).map((p) => p.pageName);
};

/** Check if user has at least one permission (view/edit/delete) on a page */
export const hasAnyPermission = (pagePermissions, pageName) => {
  const p = findPermission(pagePermissions, pageName);
  return p ? p.canView || p.canEdit || p.canDelete : false;
};

/** Get full permission object for a page, with safe defaults */
export const getPagePermissions = (pagePermissions, pageName) => {
  return findPermission(pagePermissions, pageName) ?? { ...DEFAULT_PERMISSION };
};

/** Check if the given role is super admin */
export const isSuperAdmin = (userRole) => {
  return userRole === SUPER_ADMIN_ROLE;
};