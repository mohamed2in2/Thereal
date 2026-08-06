import { ToolRegistry } from "../registry/ToolRegistry";
import { StudentProfileTool } from "./StudentTools";
import { GetCurrentCourseTool, GetLessonTool } from "./CourseTools";
import { GenerateQuizTool, SubmitQuizTool } from "./QuizTools";
import { GetHomeworkTool } from "./HomeworkTools";
import { TeacherAnalyticsTool } from "./TeacherTools";
import { GenerateParentReportTool } from "./ParentTools";
import { TodayPlanTool } from "./StudyPlanTools";
import { SearchPlatformTool, StreakTool } from "./PlatformTools";

export function registerAllTools(): void {
  const registry = ToolRegistry.getInstance();

  registry.registerTool(new StudentProfileTool());
  registry.registerTool(new GetCurrentCourseTool());
  registry.registerTool(new GetLessonTool());
  registry.registerTool(new GenerateQuizTool());
  registry.registerTool(new SubmitQuizTool());
  registry.registerTool(new GetHomeworkTool());
  registry.registerTool(new TeacherAnalyticsTool());
  registry.registerTool(new GenerateParentReportTool());
  registry.registerTool(new TodayPlanTool());
  registry.registerTool(new SearchPlatformTool());
  registry.registerTool(new StreakTool());
}

export * from "./StudentTools";
export * from "./CourseTools";
export * from "./QuizTools";
export * from "./HomeworkTools";
export * from "./TeacherTools";
export * from "./ParentTools";
export * from "./StudyPlanTools";
export * from "./PlatformTools";
