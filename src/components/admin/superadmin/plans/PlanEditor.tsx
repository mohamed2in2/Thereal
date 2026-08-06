"use client";

import { useState } from "react";
import { IconChevronLeft } from "@/components/admin/AdminIcons";
import { PlanDetailsTab } from "./PlanDetailsTab";
import { PlanLessonsTab } from "./PlanLessonsTab";
import { PlanLinksTab } from "./PlanLinksTab";
import { PlanCodesTab } from "./PlanCodesTab";
import { PlanContentTab } from "./PlanContentTab";

interface PlanEditorProps {
  planId: string;
  onBack: () => void;
}

export function PlanEditor({ planId, onBack }: PlanEditorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "links" | "lessons" | "content" | "codes">("details");

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors border-none cursor-pointer"
        >
          <IconChevronLeft className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="text-xl font-black" style={{ color: "var(--ink)" }}>إدارة الخطة الدراسية</h2>
      </div>

      <div className="flex items-center gap-2 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "details", label: "تفاصيل الخطة" },
          { id: "links", label: "ربط الكورسات" },
          { id: "lessons", label: "بنية الدروس" },
          { id: "content", label: "🎬 بناء المحتوى" },
          { id: "codes", label: "أكواد الاشتراك" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "text-brand border-b-2 border-brand" : "text-ink-2 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 p-6 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {activeTab === "details" && <PlanDetailsTab planId={planId} onDelete={onBack} />}
        {activeTab === "links" && <PlanLinksTab planId={planId} />}
        {activeTab === "lessons" && <PlanLessonsTab planId={planId} />}
        {activeTab === "content" && <PlanContentTab planId={planId} />}
        {activeTab === "codes" && <PlanCodesTab planId={planId} />}
      </div>
    </div>
  );
}
