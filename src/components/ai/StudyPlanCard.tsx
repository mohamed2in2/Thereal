/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { StudyPlanItem, DailyStudyPlan } from "@/types";
import { staggerContainerVariants, staggerItemVariants } from "@/lib/animations";
import { Button } from "@/components/ui/Button";

export function StudyPlanCard() {
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<"pending" | "in_progress" | "completed">("pending");
  const [planId, setPlanId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const fetchStudyPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/study-plan");
      const data = await response.json() as { success: boolean; plan: DailyStudyPlan | null; message?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch study plan");
      }

      if (data.plan) {
        setStudyPlan(data.plan.content);
        setPlanStatus(data.plan.status as "pending" | "in_progress" | "completed");
        setPlanId(data.plan.id);
      } else {
        setStudyPlan(null);
        setError("لا توجد خطة تدريبية لهذا اليوم");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch needs to hydrate local component state from the server response.
    void fetchStudyPlan();
  }, [fetchStudyPlan]);

  const generateNewPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/study-plan", { method: "POST" });
      const data = await response.json() as { success: boolean; plan: DailyStudyPlan };

      if (!response.ok || !data.success) {
        throw new Error("Failed to generate study plan");
      }

      setStudyPlan(data.plan.content);
      setPlanStatus(data.plan.status as "pending" | "in_progress" | "completed");
      setPlanId(data.plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const updatePlanStatus = async (newStatus: "pending" | "in_progress" | "completed") => {
    if (!planId) return;

    try {
      const response = await fetch("/api/ai/study-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: planId, status: newStatus }),
      });

      const data = await response.json() as { success: boolean; plan: DailyStudyPlan };
      if (data.success) {
        setPlanStatus(newStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      video: "📹 فيديو",
      quiz: "📝 كويز",
      reading: "📖 قراءة",
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
      medium: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
      low: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    };
    return colors[priority] || colors.low;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">خطتك التدريبية لهذا اليوم</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => generateNewPlan()}>
          ↻ إنشاء جديدة
        </Button>
      </div>

      {error && (
        <motion.div
          className="mb-4 p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}

      {!studyPlan ? (
        <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-gray-500 dark:text-gray-400 mb-4">لا توجد خطة تدريبية محفوظة</p>
          <Button onClick={generateNewPlan} isLoading={loading}>
            إنشاء خطة تدريبية الآن
          </Button>
        </motion.div>
      ) : (
        <>
          <motion.div
            className="space-y-3 mb-6"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {studyPlan.map((item: StudyPlanItem, index: number) => (
              <motion.div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${getPriorityColor(item.priority)}`}
                variants={staggerItemVariants}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {getTypeLabel(item.type)}
                      </span>
                      {item.priority === "high" && (
                        <span className="px-2 py-0.5 text-xs bg-red-300 dark:bg-red-600 text-red-900 dark:text-red-100 rounded-full font-bold">
                          أولوية عالية
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {item.topic}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      ⏱️ {item.duration} دقيقة
                    </p>
                  </div>
                  <input type="checkbox" className="w-5 h-5 mt-1 cursor-pointer rounded" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Status controls */}
          <motion.div
            className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              size="sm"
              variant={planStatus === "pending" ? "primary" : "outline"}
              onClick={() => updatePlanStatus("pending")}
              className="flex-1"
            >
              لم تبدأ
            </Button>
            <Button
              size="sm"
              variant={planStatus === "in_progress" ? "primary" : "outline"}
              onClick={() => updatePlanStatus("in_progress")}
              className="flex-1"
            >
              جاري
            </Button>
            <Button
              size="sm"
              variant={planStatus === "completed" ? "primary" : "outline"}
              onClick={() => updatePlanStatus("completed")}
              className="flex-1"
            >
              مكتملة
            </Button>
          </motion.div>

          {/* Chat toggle */}
          <motion.button
            onClick={() => setShowChat(!showChat)}
            className="w-full mt-4 py-2 px-4 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            💬 {showChat ? "إغلاق" : "فتح"} محادثة المساعد الذكي
          </motion.button>

          {showChat && (
            <motion.div
              className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                هل تريد تحديث الخطة؟ يمكنك طلب خطة جديدة أو تعديل المواضيع حسب احتياجاتك.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="اكتب رسالتك هنا..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button size="sm">إرسال</Button>
              </div>
            </motion.div>
          )}

          {/* Quick stats */}
          <motion.div
            className="mt-4 grid grid-cols-3 gap-2 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                {studyPlan.reduce((sum: number, item: StudyPlanItem) => sum + item.duration, 0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">إجمالي الدقائق</p>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm font-semibold text-green-600 dark:text-green-300">
                {studyPlan.filter((item: StudyPlanItem) => item.type === "video").length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">فيديوهات</p>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-300">
                {studyPlan.filter((item: StudyPlanItem) => item.type === "quiz").length}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">كويزات</p>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
