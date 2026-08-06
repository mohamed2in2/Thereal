"use client";

import { useEffect, useState } from "react";

interface TeacherSummary {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  promoCode: string;
  promoCodeCreatedAt?: string;
  referredStudentsCount: number;
  attributionsCount: number;
  totalAmount: number;
}

export function SuperadminReferredStudentsSection() {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [platformTotal, setPlatformTotal] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/superadmin/referred-students", { credentials: "include" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.teachers)) {
          setTeachers(data.teachers);
          setPlatformTotal(data.platformTotalAmount || 0);
        }
      } catch (err) {
        console.error("Failed to load superadmin referred-students data:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="p-8 text-center text-sm font-bold text-[var(--ink-3)] animate-pulse">
        جارٍ تحميل نظرة عامة على برامج الإحالة للمعلمين...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Banner KPI */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-lg mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
              برامج إحالة المعلمين (Referred Students)
            </h2>
            <p className="text-xs" style={{ color: "var(--ink-2)" }}>
              متابعة شاملة لجميع المعلمين المفعل لديهم برنامج الإحالة وإجمالي الإيرادات الناتجة عن أكوادهم.
            </p>
          </div>
          <div className="bg-[var(--surface-2)] p-4 rounded-xl text-center shrink-0 border border-[var(--border)]">
            <div className="text-xs font-bold text-[var(--ink-3)] mb-0.5">إجمالي الإيرادات العامة</div>
            <div className="text-2xl font-black text-[var(--brand)] font-mono">
              {platformTotal.toLocaleString("ar-EG")} ج.م
            </div>
          </div>
        </div>
      </div>

      {/* Teachers Overview Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-black text-base" style={{ color: "var(--ink)", fontFamily: "var(--font-head)" }}>
            المعلمون المشاركون في البرنامج ({teachers.length})
          </h3>
        </div>

        {teachers.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--ink-3)" }}>
            لا يوجد معلمون مفعل لديهم برنامج الإحالة حالياً. يمكنك تفعيل البرنامج من جدول المعلمين.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--ink-3)" }}>
                  <th className="px-4 py-3 font-medium">اسم المعلم</th>
                  <th className="px-4 py-3 font-medium">كود الخصم</th>
                  <th className="px-4 py-3 font-medium">الطلاب المحالون</th>
                  <th className="px-4 py-3 font-medium">عدد المبيعات</th>
                  <th className="px-4 py-3 font-medium text-left">إجمالي المبالغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {teachers.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3 font-bold" style={{ color: "var(--ink)" }}>
                      {t.teacherName}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--brand)" }}>
                      {t.promoCode}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "var(--gold-2)" }}>
                      {t.referredStudentsCount} طالب
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--ink-2)" }}>
                      {t.attributionsCount} عملية
                    </td>
                    <td className="px-4 py-3 font-black text-left font-mono" style={{ color: "var(--brand)" }}>
                      {t.totalAmount.toLocaleString("ar-EG")} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
