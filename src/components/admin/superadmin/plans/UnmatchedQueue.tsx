"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function UnmatchedQueue() {
  const { error } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/admin/superadmin/plans/unmatched-content");
        const data = await res.json();
        if (res.ok) setItems(data.items || []);
        else error(data.error);
      } catch {
        error("تعذر جلب المحتوى غير المطابق");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [error]);

  if (loading) return <div className="p-10 text-center text-[var(--ink-3)] animate-pulse">جارٍ التحميل...</div>;
  if (items.length === 0) return <div className="p-10 text-center text-[var(--ink-3)]">لا يوجد محتوى غير مطابق يحتاج لتدخل</div>;

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="font-bold text-[var(--ink)]">{item.video?.title || "فيديو بدون عنوان"}</p>
          <p className="text-sm text-[var(--ink-2)] mt-1">{item.reason}</p>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg">تعيين إلى درس</button>
            <button className="px-4 py-2 text-sm font-bold text-[var(--ink-2)] bg-[var(--surface-2)] rounded-lg">تجاهل</button>
          </div>
        </div>
      ))}
    </div>
  );
}
