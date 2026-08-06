import { AITool, UserRole } from "../types";

export class PermissionManager {
  public static isAllowed(tool: AITool, role: UserRole): boolean {
    if (tool.allowedRoles.includes("anonymous")) return true;
    return tool.allowedRoles.includes(role);
  }

  public static checkPermission(tool: AITool, role: UserRole): void {
    if (!this.isAllowed(tool, role)) {
      throw new Error(
        `Permission Denied: User role '${role}' is not authorized to execute tool '${tool.name}'. Required roles: [${tool.allowedRoles.join(", ")}]`
      );
    }
  }
}
