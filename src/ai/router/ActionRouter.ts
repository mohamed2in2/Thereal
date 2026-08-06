import { ActionRegistry } from "../actions/ActionRegistry";
import { EducationalAction, EducationalActionType, EducationalIntent } from "../types";

export class ActionRouter {
  private registry: ActionRegistry;

  constructor(registry?: ActionRegistry) {
    this.registry = registry || ActionRegistry.getInstance();
  }

  public route(intent: EducationalIntent): EducationalAction {
    const actionType: EducationalActionType = intent.action || "EXPLAIN";
    return this.registry.getAction(actionType);
  }

  public routeByType(type: EducationalActionType): EducationalAction {
    return this.registry.getAction(type);
  }
}
