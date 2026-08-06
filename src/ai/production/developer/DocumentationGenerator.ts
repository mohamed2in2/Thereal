import { ToolRegistry } from "../../tools/registry/ToolRegistry";

export class DocumentationGenerator {
  public static generateArchitectureDocs(): string {
    const tools = ToolRegistry.getInstance().getAllTools();

    let markdown = `# Code-UP AI Engine - Architecture Documentation\n\n`;
    markdown += `## Universal Platform Tools (${tools.length})\n\n`;

    for (const t of tools) {
      markdown += `### ${t.name}\n`;
      markdown += `- **Category**: ${t.category}\n`;
      markdown += `- **Description**: ${t.description}\n`;
      markdown += `- **Allowed Roles**: ${t.allowedRoles.join(", ")}\n\n`;
    }

    return markdown;
  }
}
