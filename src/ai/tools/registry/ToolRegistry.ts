import { AITool, UserRole } from "../types";
import { EducationalActionType } from "../../types";

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, AITool> = new Map();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public registerTool(tool: AITool): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  public getToolsByCategory(category: string): AITool[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  public getToolsByRole(role: UserRole): AITool[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.allowedRoles.includes("anonymous") || t.allowedRoles.includes(role)
    );
  }

  public getToolsByAction(action: EducationalActionType): AITool[] {
    return Array.from(this.tools.values()).filter((t) => t.educationalAction === action);
  }

  public getAllTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
