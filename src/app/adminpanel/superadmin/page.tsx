"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { useToast } from "@/components/ui/Toast";
import { StudentsSection } from "@/components/admin/superadmin/StudentsSection";
import { TeachersSection } from "@/components/admin/superadmin/TeachersSection";
import { ConfirmActionModal } from "@/components/admin/superadmin/ConfirmActionModal";
import { ActivityLogsSection } from "@/components/admin/superadmin/ActivityLogsSection";
import { DeletedStudentsSection } from "@/components/admin/superadmin/DeletedStudentsSection";
import { DeletedTeachersSection } from "@/components/admin/superadmin/DeletedTeachersSection";
import { StaffAccountsSection } from "@/components/admin/superadmin/StaffAccountsSection";
import { ErrorMonitorSection } from "@/components/admin/superadmin/ErrorMonitorSection";
import { DailyExamsSection } from "@/components/admin/superadmin/DailyExamsSection";
import { LeaderboardPrizesSection } from "@/components/admin/superadmin/LeaderboardPrizesSection";
import { DangerZoneSection } from "@/components/admin/superadmin/DangerZoneSection";
import { InstanceControlSection } from "@/components/admin/superadmin/InstanceControlSection";
import { SiteTextSection } from "@/components/admin/superadmin/SiteTextSection";
import { AdvancedSettingsSection } from "@/components/admin/superadmin/AdvancedSettingsSection";
import { AccessGate } from "@/components/admin/superadmin/AccessGate";
import { WalletSection } from "@/components/admin/superadmin/WalletSection";
import { PlansSection } from "@/components/admin/superadmin/PlansSection";
import { WhatsAppSection } from "@/components/admin/WhatsAppSection";
import { SecuritySection } from "@/components/admin/SecuritySection";
import { IconMenu, IconTrash } from "@/components/admin/AdminIcons";
import dynamic from "next/dynamic";

// Lazy-load AI sections to keep main bundle lean
const AIOverview = dynamic(() => import("@/components/admin/superadmin/ai/AIOverview"), { ssr: false });
const AILiveMonitor = dynamic(() => import("@/components/admin/superadmin/ai/AILiveMonitor"), { ssr: false });
const AIRequests = dynamic(() => import("@/components/admin/superadmin/ai/AIRequests"), { ssr: false });
const AIPlayground = dynamic(() => import("@/components/admin/superadmin/ai/AIPlayground"), { ssr: false });
const AIProviders = dynamic(() => import("@/components/admin/superadmin/ai/AIProviders"), { ssr: false });
const AIGeminiPool = dynamic(() => import("@/components/admin/superadmin/ai/AIGeminiPool"), { ssr: false });
const AIBudgetCenter = dynamic(() => import("@/components/admin/superadmin/ai/AIBudgetCenter"), { ssr: false });
const AIPromptLibrary = dynamic(() => import("@/components/admin/superadmin/ai/AIPromptLibrary"), { ssr: false });
const AIKnowledgeBase = dynamic(() => import("@/components/admin/superadmin/ai/AIKnowledgeBase"), { ssr: false });
const AIEducationalActions = dynamic(() => import("@/components/admin/superadmin/ai/AIEducationalActions"), { ssr: false });
const AITools = dynamic(() => import("@/components/admin/superadmin/ai/AITools"), { ssr: false });
const AIMemoryManager = dynamic(() => import("@/components/admin/superadmin/ai/AIMemoryManager"), { ssr: false });
const AIStudentAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AIStudentAnalytics"), { ssr: false });
const AITeacherAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AITeacherAnalytics"), { ssr: false });
const AIParentAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AIParentAnalytics"), { ssr: false });
const AIProviderAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AIProviderAnalytics"), { ssr: false });
const AICostAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AICostAnalytics"), { ssr: false });
const AICacheAnalytics = dynamic(() => import("@/components/admin/superadmin/ai/AICacheAnalytics"), { ssr: false });
const AIAlertsCenter = dynamic(() => import("@/components/admin/superadmin/ai/AIAlertsCenter"), { ssr: false });
const AIAuditLogs = dynamic(() => import("@/components/admin/superadmin/ai/AIAuditLogs"), { ssr: false });
const AIFeatureFlags = dynamic(() => import("@/components/admin/superadmin/ai/AIFeatureFlags"), { ssr: false });
const AISettings = dynamic(() => import("@/components/admin/superadmin/ai/AISettings"), { ssr: false });
const AISystemHealth = dynamic(() => import("@/components/admin/superadmin/ai/AISystemHealth"), { ssr: false });

const ROLE_LABEL: Record<string, string> = {
  superadmin: "المشرف العام",
  admin: "مشرف",
  staff: "موظف",
};

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface TeacherCourse {
  id: string;
  title: string;
  subject: string;
  educationalStage: string;
  isPaid: boolean;
  price: number;
  enrolledStudents: number;
  revenue: number;
}

interface OverviewTeacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  totalCourses: number;
  courses: TeacherCourse[];
}

interface OverviewData {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalRevenue: number;
  teachers: OverviewTeacher[];
}

interface Teacher {
  id: string;
  name: string;
  email?: string;
  _count?: { courses?: number };
  courses?: { id: string; title: string; subject: string }[];
  createdAt?: string | Date;
}

import { SuperadminReferredStudentsSection } from "@/components/admin/superadmin/SuperadminReferredStudentsSection";

const SECTION_TITLES: Record<string, string> = {
  overview: "نظرة عامة",
  whatsapp: "خدمة WhatsApp (Baileys)",
  plans: "الخطط الدراسية",
  students: "إدارة المتعلمين",
  teachers: "إدارة المعلمين",
  "teacher-referrals": "برامج إحالة المعلمين",
  create: "إنشاء حساب مدرس",
  "daily-exams": "امتحانات لوحة الشرف",
  "leaderboard-prizes": "جوائز لوحة الشرف اليومية (24 ساعة)",
  "staff-accounts": "المشرفون والموظفون",
  "site-text": "نصوص الموقع",
  "advanced-settings": "الإعدادات المتقدمة",
  errors: "مراقبة الأخطاء والتحذيرات",
  "danger-zone": "منطقة الخطر — حذف جماعي",
  instance: "Instance — لوحة المالك",
  // AI Section
  "ai-overview": "AI — نظرة عامة",
  "ai-live": "AI — المراقبة الحية",
  "ai-requests": "AI — الطلبات",
  "ai-playground": "AI — ساحة التجربة",
  "ai-providers": "AI — مزودي الخدمة",
  "ai-gemini-pool": "AI — Gemini Pool",
  "ai-budget": "AI — مركز الميزانية",
  "ai-prompts": "AI — مكتبة البرومبت",
  "ai-knowledge": "AI — قاعدة المعرفة",
  "ai-actions": "AI — الأوامر التعليمية",
  "ai-tools": "AI — الأدوات",
  "ai-memory": "AI — إدارة الذاكرة",
  "ai-student-analytics": "AI — تحليلات الطلاب",
  "ai-teacher-analytics": "AI — تحليلات المعلمين",
  "ai-parent-analytics": "AI — تحليلات الأهالي",
  "ai-provider-analytics": "AI — تحليلات المزودين",
  "ai-cost-analytics": "AI — تحليلات التكلفة",
  "ai-cache-analytics": "AI — تحليلات الكاش",
  "ai-alerts": "AI — مركز التنبيهات",
  "ai-audit": "AI — سجلات التدقيق",
  "ai-feature-flags": "AI — أعلام الميزات",
  "ai-settings": "AI — الإعدادات",
  "ai-health": "AI — صحة النظام",
};

export default function SuperadminPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: "", password: "" });
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteTargetTeacher, setDeleteTargetTeacher] = useState<Teacher | null>(null);
  const [userRole, setUserRole] = useState<"superadmin" | "admin" | "staff">("superadmin");
  const [isOwner, setIsOwner] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  const fetchTeachers = async () => {
    const res = await fetch("/api/admin/teachers", { credentials: "include" });
    if (res.status === 401) {
      toastError("انتهت جلسة المشرف. سجّل الدخول من لوحة الإدارة.");
      setLoading(false);
      router.replace("/adminpanel");
      return;
    }
    const data = await readJson<{ teachers?: Teacher[]; error?: string }>(res);
    setTeachers(data?.teachers || []);
    setLoading(false);
  };

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/admin/superadmin/overview", { credentials: "include" });
      const data = await readJson<OverviewData>(res);
      if (data) setOverview(data);
    } catch {
      /* non-critical */
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      const meData = await meRes.json() as { user?: { role?: string; isOwner?: boolean } };
      const role = meData?.user?.role;
      if (role === "admin" || role === "staff") setUserRole(role);
      setIsOwner(!!meData?.user?.isOwner);
      await Promise.all([fetchTeachers(), fetchOverview()]);
    };
    void init();
  }, []);

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTeacher),
    });
    const data = await readJson<{ error?: string }>(res);
    setCreating(false);
    if (res.ok) {
      toastSuccess(`تم إنشاء حساب المعلم "${newTeacher.name}" بنجاح`);
      setNewTeacher({ name: "", password: "" });
      fetchTeachers();
    } else {
      toastError(data?.error || "تعذر إنشاء حساب المعلم");
    }
  };

  const deleteTeacher = async (teacherId: string, teacherName: string, actionPassword: string) => {
    const res = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionPassword }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (res.ok) {
      toastSuccess(`تم حذف حساب المعلم "${teacherName}" بنجاح`);
      setDeleteTargetTeacher(null);
      fetchTeachers();
    } else {
      throw new Error(data?.error ?? "تعذر حذف حساب المعلم");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/adminpanel");
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <AdminSidebar
        role={userRole}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onLogout={handleLogout}
        isOwner={isOwner}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <div className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <div
          className="sticky top-0 z-10 lg:backdrop-blur-xl px-4 sm:px-6 py-3.5 flex items-center gap-3"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--border)] transition-colors shrink-0"
            style={{ color: "var(--ink-2)" }}
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <h1
            className="text-base sm:text-xl font-black truncate flex-1"
            style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}
          >
            {SECTION_TITLES[activeSection] ?? activeSection}
          </h1>
          <span
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--gold-soft)", color: "var(--gold-2)" }}
          >
            {ROLE_LABEL[userRole]}
          </span>
          <DarkModeToggle />
        </div>

        <div className="p-6">
          {activeSection === "overview" && (
            <div dir="rtl" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "إجمالي الطلاب",  value: overviewLoading ? "…" : (overview?.totalStudents ?? 0).toLocaleString("ar-EG"), icon: "🎓", accent: "var(--brand)"  },
                  { label: "المعلمون",         value: overviewLoading ? "…" : (overview?.totalTeachers ?? 0).toLocaleString("ar-EG"), icon: "👨‍🏫", accent: "var(--brand)"  },
                  { label: "إجمالي الكورسات", value: overviewLoading ? "…" : (overview?.totalCourses ?? 0).toLocaleString("ar-EG"),  icon: "📚", accent: "var(--gold-2)" },
                  { label: "إجمالي الإيرادات", value: overviewLoading ? "…" : `${(overview?.totalRevenue ?? 0).toLocaleString("ar-EG")} ج.م`, icon: "💰", accent: "var(--gold-2)" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl p-5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
                  >
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="text-3xl font-black leading-none" style={{ color: card.accent, fontFamily: "var(--font-head)" }}>{card.value}</div>
                    <div className="text-sm mt-1.5" style={{ color: "var(--ink-2)" }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Teachers + Courses Table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <h2 className="font-black text-base" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
                    المعلمون وكورساتهم
                  </h2>
                  <button
                    onClick={() => setActiveSection("create")}
                    className="px-4 py-2 text-white text-sm font-bold rounded-lg transition-opacity hover:opacity-90 cursor-pointer border-none"
                    style={{ background: "var(--brand)" }}
                  >
                    + إضافة مدرس
                  </button>
                </div>

                {overviewLoading ? (
                  <div className="p-10 text-center" style={{ color: "var(--ink-3)" }}>
                    <div className="text-3xl mb-2 animate-pulse">⏳</div>
                    جارٍ التحميل...
                  </div>
                ) : !overview || overview.teachers.length === 0 ? (
                  <div className="p-10 text-center" style={{ color: "var(--ink-3)" }}>
                    <div className="text-4xl mb-2">👨‍🏫</div>
                    <p>لا يوجد مدرسون بعد</p>
                  </div>
                ) : (
                  <div style={{ borderTop: "0" }}>
                    {overview.teachers.map((t) => {
                      const isExpanded = expandedTeacher === t.id;
                      const teacherStudents = t.courses.reduce((s, c) => s + c.enrolledStudents, 0);
                      const teacherRevenue = t.courses.reduce((s, c) => s + c.revenue, 0);
                      return (
                        <div key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                          {/* Teacher row */}
                          <button
                            onClick={() => setExpandedTeacher(isExpanded ? null : t.id)}
                            className="w-full p-4 flex items-center gap-3 text-right transition-colors cursor-pointer border-none"
                            style={{ background: "transparent" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            <div
                              className="w-10 h-10 text-white rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
                              style={{ background: "var(--brand)" }}
                            >
                              {t.name[0]}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="font-semibold truncate" style={{ color: "var(--ink)" }}>{t.name}</p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                                {t.totalCourses} كورس · {teacherStudents} طالب
                              </p>
                            </div>
                            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                              <span className="text-sm font-bold" style={{ color: "var(--brand)" }}>
                                {teacherRevenue.toLocaleString("ar-EG")} ج.م
                              </span>
                              <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>إجمالي الإيرادات</span>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTargetTeacher({ id: t.id, name: t.name }); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                style={{ color: "var(--danger)" }}
                                aria-label={`حذف ${t.name}`}
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                              <span
                                className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                style={{ color: "var(--ink-3)" }}
                              >
                                ▾
                              </span>
                            </div>
                          </button>

                          {/* Courses sub-table */}
                          {isExpanded && (
                            <div style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                              {t.courses.length === 0 ? (
                                <p className="p-4 text-sm text-center" style={{ color: "var(--ink-3)" }}>لا توجد كورسات بعد</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--ink-3)" }}>
                                        <th className="px-4 py-2 text-right font-medium">الكورس</th>
                                        <th className="px-4 py-2 text-right font-medium">المادة</th>
                                        <th className="px-4 py-2 text-center font-medium">الطلاب</th>
                                        <th className="px-4 py-2 text-center font-medium">السعر</th>
                                        <th className="px-4 py-2 text-center font-medium">الإيرادات</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {t.courses.map((c) => (
                                        <tr
                                          key={c.id}
                                          className="transition-colors"
                                          style={{ borderTop: "1px solid var(--border)" }}
                                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
                                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                        >
                                          <td className="px-4 py-3 font-medium max-w-[200px] truncate" style={{ color: "var(--ink)" }}>
                                            {c.title}
                                          </td>
                                          <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-2)" }}>
                                            {c.subject}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span
                                              className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold min-w-[2rem]"
                                              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                                            >
                                              {c.enrolledStudents}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {c.isPaid ? (
                                              <span className="font-semibold" style={{ color: "var(--gold-2)" }}>
                                                {c.price.toLocaleString("ar-EG")} ج.م
                                              </span>
                                            ) : (
                                              <span className="text-xs" style={{ color: "var(--ink-3)" }}>مجاني</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className="font-bold" style={{ color: c.revenue > 0 ? "var(--brand)" : "var(--ink-3)" }}>
                                              {c.revenue > 0 ? `${c.revenue.toLocaleString("ar-EG")} ج.م` : "—"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ borderTop: "2px solid var(--border-strong)", background: "var(--surface-2)" }}>
                                        <td colSpan={2} className="px-4 py-2.5 text-xs font-bold" style={{ color: "var(--ink-2)" }}>
                                          الإجمالي
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                          <span className="font-black" style={{ color: "var(--brand)" }}>{teacherStudents}</span>
                                        </td>
                                        <td />
                                        <td className="px-4 py-2.5 text-center">
                                          <span className="font-black" style={{ color: "var(--brand)" }}>
                                            {teacherRevenue.toLocaleString("ar-EG")} ج.م
                                          </span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}


          {activeSection === "whatsapp" && <WhatsAppSection />}

          {activeSection === "security-violations" && <SecuritySection />}

          {activeSection === "plans" && <PlansSection userRole={userRole} />}

          {activeSection === "wallet" && <WalletSection />}

          {activeSection === "students" && <StudentsSection userRole={userRole} />}

          {activeSection === "deleted-students" && <DeletedStudentsSection userRole={userRole} />}

          {activeSection === "daily-exams" && <DailyExamsSection />}

          {activeSection === "leaderboard-prizes" && <LeaderboardPrizesSection />}

          {activeSection === "logs" && <ActivityLogsSection />}

          {activeSection === "staff-accounts" && <StaffAccountsSection userRole={userRole} />}

          {activeSection === "site-text" && <SiteTextSection />}

          {activeSection === "advanced-settings" && <AdvancedSettingsSection />}

          {activeSection === "errors" && <ErrorMonitorSection />}

          {activeSection === "danger-zone" && (
            <AccessGate id="danger-zone" title="منطقة الخطر">
              <DangerZoneSection />
            </AccessGate>
          )}

          {activeSection === "instance" && isOwner && (
            <AccessGate id="instance" title="Instance — لوحة المالك">
              <InstanceControlSection />
            </AccessGate>
          )}

          {/* ── AI Section Pages ── */}
          {activeSection === "ai-overview" && <AIOverview />}
          {activeSection === "ai-live" && <AILiveMonitor />}
          {activeSection === "ai-requests" && <AIRequests />}
          {activeSection === "ai-playground" && <AIPlayground />}
          {activeSection === "ai-providers" && <AIProviders />}
          {activeSection === "ai-gemini-pool" && <AIGeminiPool />}
          {activeSection === "ai-budget" && <AIBudgetCenter />}
          {activeSection === "ai-prompts" && <AIPromptLibrary />}
          {activeSection === "ai-knowledge" && <AIKnowledgeBase />}
          {activeSection === "ai-actions" && <AIEducationalActions />}
          {activeSection === "ai-tools" && <AITools />}
          {activeSection === "ai-memory" && <AIMemoryManager />}
          {activeSection === "ai-student-analytics" && <AIStudentAnalytics />}
          {activeSection === "ai-teacher-analytics" && <AITeacherAnalytics />}
          {activeSection === "ai-parent-analytics" && <AIParentAnalytics />}
          {activeSection === "ai-provider-analytics" && <AIProviderAnalytics />}
          {activeSection === "ai-cost-analytics" && <AICostAnalytics />}
          {activeSection === "ai-cache-analytics" && <AICacheAnalytics />}
          {activeSection === "ai-alerts" && <AIAlertsCenter />}
          {activeSection === "ai-audit" && <AIAuditLogs />}
          {activeSection === "ai-feature-flags" && <AIFeatureFlags />}
          {activeSection === "ai-settings" && <AISettings />}
          {activeSection === "ai-health" && <AISystemHealth />}

          {deleteTargetTeacher && (
            <ConfirmActionModal
              title="حذف حساب المعلم نهائياً"
              description={`تحذير: سيتم حذف حساب المعلم "‏${deleteTargetTeacher.name}‏" وجميع كورساته نهائياً.`}
              actionLabel="حذف نهائياً"
              variant="danger"
              onConfirm={(password) =>
                deleteTeacher(deleteTargetTeacher.id, deleteTargetTeacher.name, password)
              }
              onClose={() => setDeleteTargetTeacher(null)}
            />
          )}

          {activeSection === "teachers" && <TeachersSection userRole={userRole} />}

          {activeSection === "teacher-referrals" && <SuperadminReferredStudentsSection />}

          {activeSection === "deleted-teachers" && <DeletedTeachersSection userRole={userRole} />}

          {/* ════════ AI SECTIONS ════════ */}
          {(activeSection === "ai-overview" || activeSection === "ai-control") && <AIOverview />}
          {activeSection === "ai-live" && <AILiveMonitor />}
          {activeSection === "ai-requests" && <AIRequests />}
          {activeSection === "ai-playground" && <AIPlayground />}
          {activeSection === "ai-providers" && <AIProviders />}
          {activeSection === "ai-gemini-pool" && <AIGeminiPool />}
          {activeSection === "ai-budget" && <AIBudgetCenter />}
          {activeSection === "ai-prompts" && <AIPromptLibrary />}
          {activeSection === "ai-knowledge" && <AIKnowledgeBase />}
          {activeSection === "ai-actions" && <AIEducationalActions />}
          {activeSection === "ai-tools" && <AITools />}
          {activeSection === "ai-memory" && <AIMemoryManager />}
          {activeSection === "ai-student-analytics" && <AIStudentAnalytics />}
          {activeSection === "ai-teacher-analytics" && <AITeacherAnalytics />}
          {activeSection === "ai-parent-analytics" && <AIParentAnalytics />}
          {activeSection === "ai-provider-analytics" && <AIProviderAnalytics />}
          {activeSection === "ai-cost-analytics" && <AICostAnalytics />}
          {activeSection === "ai-cache-analytics" && <AICacheAnalytics />}
          {activeSection === "ai-alerts" && <AIAlertsCenter />}
          {activeSection === "ai-audit" && <AIAuditLogs />}
          {activeSection === "ai-feature-flags" && <AIFeatureFlags />}
          {activeSection === "ai-settings" && <AISettings />}
          {activeSection === "ai-health" && <AISystemHealth />}

          {activeSection === "create" && (
            <div className="max-w-md">
              <h2
                className="text-xl font-black mb-6"
                style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}
              >
                إنشاء حساب مدرس جديد
              </h2>
              <form
                onSubmit={createTeacher}
                className="rounded-2xl p-6 space-y-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "var(--ink-2)" }}>اسم المعلم</label>
                  <input
                    type="text"
                    required
                    value={newTeacher.name}
                    onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--font-body)" }}
                    placeholder="أ. محمد إبراهيم"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "var(--ink-2)" }}>كلمة المرور</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newTeacher.password}
                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "var(--font-body)" }}
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-3 text-white font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer border-none"
                  style={{ background: "var(--brand)", boxShadow: "0 6px 18px -6px var(--brand-shadow)", fontFamily: "var(--font-head)", fontSize: 16 }}
                >
                  {creating ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
