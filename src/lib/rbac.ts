/**
 * Role-Based Access Control
 * Roles: superadmin | admin | staff
 */

export type AdminRole = "superadmin" | "admin" | "staff";

export type Permission =
  | "view_students"
  | "suspend_student"
  | "soft_delete_student"
  | "restore_student"
  | "hard_delete_student"
  | "view_deleted_students"
  | "view_teachers"
  | "edit_teacher_name"
  | "reset_teacher_password"
  | "delete_teacher"
  | "create_teacher"
  | "view_logs"
  | "view_staff_accounts"
  | "manage_staff_accounts"
  | "view_error_logs"
  | "bulk_delete_users"
  | "reset_student_devices";

/** Permission matrix — what each admin role may do */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  superadmin: [
    "view_students",
    "suspend_student",
    "soft_delete_student",
    "restore_student",
    "hard_delete_student",
    "view_deleted_students",
    "view_teachers",
    "edit_teacher_name",
    "reset_teacher_password",
    "delete_teacher",
    "create_teacher",
    "view_logs",
    "view_staff_accounts",
    "manage_staff_accounts",
    "view_error_logs",
    "bulk_delete_users",
    "reset_student_devices",
  ],
  admin: [
    "view_students",
    "suspend_student",
    "soft_delete_student",
    "restore_student",
    "view_deleted_students",
    "view_teachers",
    "create_teacher",
    "edit_teacher_name",
    "reset_teacher_password",
    "view_logs",
    "view_staff_accounts",
    "reset_student_devices",
  ],
  staff: [
    "view_students",
    "view_deleted_students",
    "view_teachers",
    "view_logs",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/** Returns true when the role is any admin-panel role (not student/teacher) */
export function isAdminRole(role: string): boolean {
  return role === "superadmin" || role === "admin" || role === "staff";
}

/** Convenience — returns 403 message when permission is missing */
export function permissionError(permission: Permission): string {
  return `ليس لديك صلاحية: ${permission}`;
}
