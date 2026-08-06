"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function GradingQueue() {
  const { error } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch("/api/admin/plan-submissions?status=pending");
        const data = await res.json();
        if (res.ok) setSubmissions(data.submissions || []);
        else error(data.error);
      } catch {
        error("تعذر جلب التقييمات");
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [error]);

  if (loading) return <div className="p-10 text-center text-[var(--ink-3)] animate-pulse">جارٍ التحميل...</div>;
  if (submissions.length === 0) return <div className="p-10 text-center text-[var(--ink-3)]">لا توجد مشاريع تنتظر التقييم</div>;

  return (
    <div className="space-y-4">
      {submissions.map(sub => (
        <div key={sub.id} className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-[var(--ink)]">{sub.student?.name}</p>
              <p className="text-xs text-[var(--ink-2)]">{sub.enrollment?.plan?.title}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">قيد الانتظار</span>
          </div>
          <div className="mt-4">
            <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="text-brand text-sm hover:underline">
              عرض الملف المرفق
            </a>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg">تقييم المشروع</button>
          </div>
        </div>
      ))}
    </div>
  );
}
