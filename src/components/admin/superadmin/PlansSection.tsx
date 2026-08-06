"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { PlanList } from "./plans/PlanList";
import { PlanEditor } from "./plans/PlanEditor";
import { UnmatchedQueue } from "./plans/UnmatchedQueue";
import { GradingQueue } from "./plans/GradingQueue";

interface PlansSectionProps {
  userRole: "superadmin" | "admin" | "staff";
}

export function PlansSection({ userRole }: PlansSectionProps) {
  const [activeTab, setActiveTab] = useState<"list" | "unmatched" | "grading">("list");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (selectedPlanId) {
    return <PlanEditor planId={selectedPlanId} onBack={() => setSelectedPlanId(null)} />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === "list" ? "text-brand border-b-2 border-brand" : "text-ink-2 hover:text-ink"
          }`}
        >
          الخطط الدراسية
        </button>
        <button
          onClick={() => setActiveTab("unmatched")}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === "unmatched" ? "text-brand border-b-2 border-brand" : "text-ink-2 hover:text-ink"
          }`}
        >
          المحتوى غير المطابق
        </button>
        <button
          onClick={() => setActiveTab("grading")}
          className={`px-4 py-3 font-bold transition-colors ${
            activeTab === "grading" ? "text-brand border-b-2 border-brand" : "text-ink-2 hover:text-ink"
          }`}
        >
          التقييمات
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "list" && <PlanList onSelectPlan={setSelectedPlanId} />}
        {activeTab === "unmatched" && <UnmatchedQueue />}
        {activeTab === "grading" && <GradingQueue />}
      </div>
    </div>
  );
}
