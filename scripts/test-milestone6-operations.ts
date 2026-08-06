import { BudgetPolicies } from "../src/ai/admin/budget/BudgetPolicies";
import { BudgetTracker } from "../src/ai/admin/budget/BudgetTracker";
import { BudgetAlerts } from "../src/ai/admin/budget/BudgetAlerts";
import { BudgetManager } from "../src/ai/admin/budget/BudgetManager";
import { ProviderMonitor } from "../src/ai/admin/monitoring/ProviderMonitor";
import { GeminiClusterDashboard } from "../src/ai/admin/monitoring/GeminiClusterDashboard";
import { AIRequestExplorer } from "../src/ai/admin/explorer/AIRequestExplorer";
import { LiveAIDashboard } from "../src/ai/admin/dashboard/LiveAIDashboard";
import { BudgetOptimizer, AIFinancialAdvisor } from "../src/ai/admin/optimizer/BudgetOptimizer";
import { RoutingAnalytics } from "../src/ai/admin/routing/RoutingAnalytics";
import { StudentAIAnalytics, TeacherAnalytics, ParentAnalytics, CacheAnalytics, ProviderComparison } from "../src/ai/admin/analytics/AIAnalytics";
import { AlertCenter } from "../src/ai/admin/alerts/AlertCenter";
import { AIOperationsConfig } from "../src/ai/admin/config/AIOperationsConfig";
import { AIAuditSystem } from "../src/ai/admin/audit_logging/AIAuditSystem";

// Force Gemini pool for integration test
process.env.GEMINI_KEY_1 = "test_gemini_key_one";
process.env.GEMINI_KEY_2 = "test_gemini_key_two";

async function runMilestone6Tests() {
  console.log("===========================================================================");
  console.log("   Code-UP Milestone 6 — AI Operations Platform Verification              ");
  console.log("===========================================================================\n");

  let passed = 0; let failed = 0;
  function assert(condition: boolean, name: string) {
    if (condition) { console.log(`  ✓ ${name}`); passed++; }
    else { console.error(`  ✗ FAIL: ${name}`); failed++; }
  }

  // ─── PART 1: Budget Manager ────────────────────────────────────────────────
  console.log("[PART 1] Budget Manager\n");
  const policies = BudgetPolicies.getInstance();
  const policy = policies.getPolicy();
  assert(policy.globalDailyBudgetUsd > 0, "BudgetPolicies: globalDailyBudgetUsd is set");
  assert(policy.perStudentDailyUsd > 0, "BudgetPolicies: perStudentDailyUsd is set");
  assert(policies.estimateCostUsd("gemini", 1000) > 0, "BudgetPolicies: estimateCostUsd() returns positive value");

  const tracker = BudgetTracker.getInstance();
  tracker.record({ costUsd: 1.50, providerId: "gemini", subject: "الفيزياء", grade: "الصف الثالث الثانوي", studentId: "std_001", action: "EXPLAIN" });
  tracker.record({ costUsd: 2.00, providerId: "deepseek_v4_flash", subject: "الرياضيات", action: "EXAM" });
  const snapshot = tracker.getSnapshot();
  assert(snapshot.globalDailyUsd >= 3.50, "BudgetTracker: globalDailyUsd accumulates correctly");
  assert(snapshot.byProvider["gemini"] === 1.50, "BudgetTracker: byProvider tracks correctly");
  assert(snapshot.bySubject["الفيزياء"] === 1.50, "BudgetTracker: bySubject tracks correctly");

  const mgr = BudgetManager.getInstance();
  const result = mgr.preflight({ providerId: "gemini", estimatedTokens: 500, action: "EXPLAIN", studentId: "std_001" });
  assert(result.estimatedCostUsd > 0, "BudgetManager.preflight: returns estimated cost");
  assert(typeof result.allowed === "boolean", "BudgetManager.preflight: returns allowed boolean");

  const alerts = BudgetAlerts.getInstance();
  const level = alerts.getCurrentLevel();
  assert(typeof level === "string", `BudgetAlerts: getCurrentLevel() = '${level}'`);

  // ─── PART 2–3: Provider & Gemini Monitoring ────────────────────────────────
  console.log("\n[PARTS 2–3] Provider Monitoring & Gemini Cluster Dashboard\n");
  const monitor = ProviderMonitor.getInstance();
  monitor.recordSuccess("gemini", { latencyMs: 245, promptTokens: 120, completionTokens: 80, costUsd: 0.00015, cacheHit: false });
  monitor.recordSuccess("gemini", { latencyMs: 180, promptTokens: 100, completionTokens: 60, costUsd: 0.00012, cacheHit: true });
  monitor.recordFailure("deepseek_v4_flash", "rate_limit");
  monitor.recordSuccess("deepseek_v4_flash", { latencyMs: 350, promptTokens: 200, completionTokens: 150, costUsd: 0.00049, cacheHit: false });

  const geminiStats = monitor.getStats("gemini");
  assert(geminiStats.successCount === 2, "ProviderMonitor: tracks success count for gemini");
  assert(geminiStats.cacheHits === 1, "ProviderMonitor: tracks cache hits");
  assert(monitor.getAverageLatency("gemini") > 0, "ProviderMonitor: getAverageLatency() works");
  assert(monitor.getSuccessRate("gemini") === 100, "ProviderMonitor: getSuccessRate() is 100%");
  assert(monitor.getCacheHitRate("gemini") === 50, "ProviderMonitor: getCacheHitRate() is 50%");

  const cluster = GeminiClusterDashboard.getInstance();
  const summary = cluster.getSummary();
  assert(summary.totalKeys >= 1, `GeminiClusterDashboard: totalKeys=${summary.totalKeys}`);
  assert(summary.keys.every(k => !k.keyId.includes("test_gemini_key") || k.displayName.startsWith("Gemini #")), "GeminiClusterDashboard: keys have display names");
  assert(summary.keys.every(k => !("secretKey" in k)), "GeminiClusterDashboard: no secretKey exposed");

  // ─── PART 4: AI Request Explorer ──────────────────────────────────────────
  console.log("\n[PART 4] AI Request Explorer\n");
  const explorer = AIRequestExplorer.getInstance();
  explorer.record({ studentId: "std_001", role: "student", providerId: "gemini", model: "gemini-pro", action: "EXPLAIN", subject: "الفيزياء", grade: "الصف الثالث الثانوي", promptTokens: 120, completionTokens: 80, estimatedCostUsd: 0.00015, latencyMs: 245, cacheHit: false, knowledgeLoaded: true, toolsUsed: ["GetLesson"], responseLength: 450, fallbackUsed: false, retryCount: 0, safetyFlags: [] });
  explorer.record({ studentId: "std_002", role: "student", providerId: "deepseek_v4_flash", model: "deepseek-chat", action: "QUIZ", subject: "الرياضيات", grade: "الصف الثاني الثانوي", promptTokens: 200, completionTokens: 150, estimatedCostUsd: 0.00049, latencyMs: 350, cacheHit: true, knowledgeLoaded: false, toolsUsed: [], responseLength: 200, fallbackUsed: false, retryCount: 0, safetyFlags: [] });

  const searchByStudent = explorer.search({ studentId: "std_001" });
  assert(searchByStudent.length >= 1, "AIRequestExplorer: search by studentId works");
  assert(searchByStudent[0].studentId === "std_001", "AIRequestExplorer: search returns correct student records");

  const searchByProvider = explorer.search({ providerId: "gemini" });
  assert(searchByProvider.length >= 1, "AIRequestExplorer: search by providerId works");

  const searchByCacheHit = explorer.search({ cacheHit: true });
  assert(searchByCacheHit.length >= 1, "AIRequestExplorer: search by cacheHit=true works");

  const todayStats = explorer.getTodaysStats();
  assert(todayStats.totalRequests >= 2, "AIRequestExplorer: getTodaysStats() counts correctly");
  assert(todayStats.totalCostUsd > 0, "AIRequestExplorer: getTodaysStats() accumulates cost");

  // ─── PART 5: Live Dashboard ────────────────────────────────────────────────
  console.log("\n[PART 5] Live AI Dashboard\n");
  const dashboard = LiveAIDashboard.getInstance();
  dashboard.recordRequest({ hour: "14:00", tokens: 200, costUsd: 0.00015, latencyMs: 245, isError: false });
  dashboard.recordRequest({ hour: "14:00", tokens: 350, costUsd: 0.00049, latencyMs: 350, isError: false });
  const dashData = dashboard.getDashboardData();
  assert(dashData.cards.length >= 4, "LiveAIDashboard: returns dashboard cards");
  assert(dashData.hourlyData.length >= 1, "LiveAIDashboard: returns hourly data points");
  assert(dashData.providerDistribution.length >= 1, "LiveAIDashboard: returns provider distribution");
  assert(dashData.budgetLevel !== undefined, "LiveAIDashboard: includes budgetLevel");

  // ─── PARTS 6–7: Budget Optimizer & Financial Advisor ──────────────────────
  console.log("\n[PARTS 6–7] Budget Optimizer & AI Financial Advisor\n");
  const optimizer = BudgetOptimizer.getInstance();
  const optimizerReport = optimizer.analyze();
  assert(typeof optimizerReport.totalCostUsd === "number", "BudgetOptimizer: analyze() returns totalCostUsd");
  assert(optimizerReport.recommendations !== undefined, "BudgetOptimizer: recommendations array present");

  const advisor = AIFinancialAdvisor.getInstance();
  const advisorReport = advisor.generateMidnightReport();
  assert(advisorReport.date.length > 0, "AIFinancialAdvisor: report has date");
  assert(typeof advisorReport.potentialSavingsUsd === "number", "AIFinancialAdvisor: potentialSavingsUsd is number");
  const formatted = advisor.formatReport(advisorReport);
  assert(formatted.includes("تقرير المستشار المالي"), "AIFinancialAdvisor: formatted report contains Arabic header");

  // ─── PART 8: Routing Analytics ────────────────────────────────────────────
  console.log("\n[PART 8] Routing Analytics\n");
  const routing = RoutingAnalytics.getInstance();
  const decision = routing.explainSelection({ requestId: "req_test_001", selectedProviderId: "gemini", estimatedCostUsd: 0.00015, action: "EXPLAIN" });
  assert(decision.reasons.length > 0, `RoutingAnalytics: explains selection with ${decision.reasons.length} reasons`);
  assert(decision.confidence >= 70, `RoutingAnalytics: confidence=${decision.confidence}% >= 70%`);
  assert(decision.alternativesConsidered.length > 0, "RoutingAnalytics: lists alternative providers");

  // ─── PARTS 9–11: Student, Teacher, Parent Analytics ───────────────────────
  console.log("\n[PARTS 9–11] Student / Teacher / Parent Analytics\n");
  const studentAnalytics = StudentAIAnalytics.getInstance();
  const studentProfile = studentAnalytics.getProfile("std_001");
  assert(studentProfile.questionsAsked >= 1, "StudentAIAnalytics: questionsAsked >= 1");
  assert(studentProfile.aiDependencyScore >= 0, "StudentAIAnalytics: aiDependencyScore is valid");
  assert(studentProfile.favoriteSubject.length > 0, "StudentAIAnalytics: favoriteSubject is set");

  const teacherAnalytics = TeacherAnalytics.getInstance();
  const teacherProfile = teacherAnalytics.getProfile("tch_001");
  assert(typeof teacherProfile.totalCostUsd === "number", "TeacherAnalytics: getProfile() works");

  const parentAnalytics = ParentAnalytics.getInstance();
  parentAnalytics.recordReportGenerated("prt_001");
  parentAnalytics.recordReportGenerated("prt_001");
  parentAnalytics.recordReportRead("prt_001");
  const parentProfile = parentAnalytics.getProfile("prt_001");
  assert(parentProfile.reportsGenerated === 2, "ParentAnalytics: tracks generated reports");
  assert(parentProfile.readRate === 50, "ParentAnalytics: readRate=50% (1 of 2 read)");

  // ─── PART 12: Cache Analytics ─────────────────────────────────────────────
  console.log("\n[PART 12] Cache Analytics\n");
  const cache = CacheAnalytics.getInstance();
  cache.recordHit("PromptCache", 800, 12);
  cache.recordHit("PromptCache", 600, 8);
  cache.recordMiss("PromptCache");
  cache.recordHit("RAGCache", 1200, 20);
  const cacheStats = cache.getAllStats();
  const promptTier = cacheStats.find(t => t.tier === "PromptCache");
  assert(promptTier !== undefined, "CacheAnalytics: PromptCache tier tracked");
  assert(promptTier!.hits === 2, "CacheAnalytics: hits=2 for PromptCache");
  assert(promptTier!.hitRate === 67, "CacheAnalytics: hitRate=67% (2 of 3)");
  assert(promptTier!.savedTokens === 1400, "CacheAnalytics: savedTokens=1400");

  // ─── PART 13: Provider Comparison ─────────────────────────────────────────
  console.log("\n[PART 13] Provider Comparison\n");
  const comparison = ProviderComparison.getInstance();
  const table = comparison.getComparisonTable();
  assert(table.length >= 1, `ProviderComparison: ${table.length} providers in comparison table`);
  assert(table.every(r => typeof r.successRate === "number"), "ProviderComparison: all rows have successRate");

  // ─── PART 14: Alert Center ────────────────────────────────────────────────
  console.log("\n[PART 14] Alert Center\n");
  const alertCenter = AlertCenter.getInstance();
  alertCenter.alertProviderOffline("deepseek_v4_flash");
  alertCenter.alertRateLimit("gemini", 15);
  alertCenter.alertHighLatency("deepseek_v4_flash", 2500);
  alertCenter.alertSecurityThreat("prompt_injection", "std_999");
  alertCenter.alertBudgetThreshold("Economy", 75);
  const allAlerts = alertCenter.getAlerts({ limit: 20 });
  assert(allAlerts.length >= 5, `AlertCenter: ${allAlerts.length} alerts emitted`);
  const criticalAlerts = alertCenter.getAlerts({ severity: "Critical" });
  assert(criticalAlerts.length >= 1, "AlertCenter: Critical alerts for security threat");
  const securityAlerts = alertCenter.getAlerts({ category: "Security" });
  assert(securityAlerts.length >= 1, "AlertCenter: Security category alerts exist");
  alertCenter.resolve(allAlerts[0].id);
  assert(!alertCenter.getAlerts({ limit: 20 }).find(a => a.id === allAlerts[0].id)?.resolved === false, "AlertCenter: resolve() marks alert as resolved");

  // ─── PART 15: AI Operations Config ────────────────────────────────────────
  console.log("\n[PART 15] AI Operations Config\n");
  const config = AIOperationsConfig.getInstance();
  const settings = config.getSettings();
  assert(settings.globalDailyBudgetUsd > 0, "AIOperationsConfig: globalDailyBudgetUsd is set");
  assert(settings.providerMode === "balanced", "AIOperationsConfig: default providerMode is 'balanced'");
  config.updateSettings({ globalDailyBudgetUsd: 100 }, "superadmin@code-up.com", "192.168.1.1", "Increasing budget for exam season");
  assert(config.getSettings().globalDailyBudgetUsd === 100, "AIOperationsConfig: updateSettings() persists changes");
  config.toggleAction("EXAM", false, "superadmin@code-up.com", "192.168.1.1");
  assert(!config.isActionEnabled("EXAM"), "AIOperationsConfig: toggleAction() disables EXAM");

  // ─── PART 16: Audit Trail ─────────────────────────────────────────────────
  console.log("\n[PART 16] Audit Trail\n");
  const audit = AIAuditSystem.getInstance();
  const trail = audit.getAuditTrail(50);
  assert(trail.length >= 2, `AIAuditSystem: audit trail has ${trail.length} records`);
  assert(trail[0].who === "superadmin@code-up.com", "AIAuditSystem: 'who' field is set correctly");
  assert(trail[0].ip === "192.168.1.1", "AIAuditSystem: 'ip' field is set correctly");
  assert(trail[0].previousValue !== undefined, "AIAuditSystem: previousValue is recorded");
  const configChanges = audit.filterByAction("UPDATE_AI_CONFIG");
  assert(configChanges.length >= 1, "AIAuditSystem: filterByAction() finds config changes");

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  console.log("\n===========================================================================");
  console.log(`   Milestone 6 Verification: ${passed} Passed, ${failed} Failed   `);
  console.log("===========================================================================\n");
  if (failed > 0) process.exit(1);
}

runMilestone6Tests().catch(err => { console.error("Test error:", err); process.exit(1); });
