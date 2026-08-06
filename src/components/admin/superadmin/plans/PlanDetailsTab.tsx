"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function PlanDetailsTab({ planId, onDelete }: { planId: string; onDelete?: () => void }) {
  const { success, error: toastError } = useToast();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [descriptionPoints, setDescriptionPoints] = useState<string[]>([]);

  const handleDelete = async () => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الخطة الدراسية نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        success("تم حذف الخطة الدراسية بنجاح");
        if (onDelete) onDelete();
      } else {
        toastError(data.error || "تعذر حذف الخطة");
      }
    } catch {
      toastError("حدث خطأ أثناء محاولة الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const fetchPlanDetails = () => {
    fetch(`/api/admin/superadmin/plans/${planId}`)
      .then(r => r.json())
      .then(data => {
        if (data.plan) {
          setPlan(data.plan);
          let desc = data.plan.description || "";
          let parsed: string[] = [];
          if (desc.startsWith('[') && desc.endsWith(']')) {
            try {
              parsed = JSON.parse(desc);
            } catch {
              parsed = desc.split('\n').filter(Boolean);
            }
          } else {
            parsed = desc.split('\n').filter(Boolean);
          }
          if (parsed.length === 0) parsed = [""];
          setDescriptionPoints(parsed);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlanDetails();
  }, [planId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const filteredPoints = descriptionPoints.map(p => p.trim()).filter(Boolean);
    const serializedDesc = JSON.stringify(filteredPoints);
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.title,
          description: serializedDesc,
          price: Number(plan.price),
          discountPrice: plan.discountPrice ? Number(plan.discountPrice) : null,
          durationDays: Number(plan.durationDays),
          chatEnabled: plan.chatEnabled,
          gradingAIEnabled: plan.gradingAIEnabled,
          educationalStage: plan.educationalStage,
          monthIndex: Number(plan.monthIndex),
          lastKnownUpdatedAt: plan.updatedAt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan); // Update plan to get new updatedAt
        success("تم الحفظ بنجاح");
      } else {
        const errorData = await res.json().catch(() => null);
        toastError(errorData?.error || "فشل الحفظ");
      }
    } catch {
      toastError("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishErrors([]);
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}/publish`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        success("تم نشر الخطة الدراسية بنجاح 🚀");
        fetchPlanDetails();
      } else {
        if (data.details && Array.isArray(data.details)) {
          setPublishErrors(data.details);
          toastError("لم يتم النشر. توجد أخطاء في متطلبات الخطة.");
        } else {
          toastError(data.error || "فشل نشر الخطة");
        }
      }
    } catch {
      toastError("حدث خطأ أثناء النشر");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="text-center py-10">جاري التحميل...</div>;
  if (!plan) return <div className="text-center py-10 text-red-500">حدث خطأ في تحميل الخطة</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      <form onSubmit={handleSave} className="space-y-4">
        <h3 className="font-bold text-lg border-b pb-2">إعدادات الخطة الدراسية</h3>
        
        <div>
          <label className="block text-sm font-bold mb-1">اسم الخطة</label>
          <input 
            type="text" 
            value={plan.title} 
            onChange={e => setPlan({...plan, title: e.target.value})}
            className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
            style={{ borderColor: "var(--border)" }}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1.5 text-[var(--ink)]">ميزات وتفاصيل الخطة (نقاط الوصف)</label>
          <div className="space-y-2 mb-2">
            {descriptionPoints.map((point, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center text-[var(--ink-2)] shrink-0">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={point}
                  onChange={e => {
                    const next = [...descriptionPoints];
                    next[index] = e.target.value;
                    setDescriptionPoints(next);
                  }}
                  className="flex-1 p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)] text-sm"
                  style={{ borderColor: "var(--border)" }}
                  placeholder="اكتب ميزة أو نقطة وصف هنا..."
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = descriptionPoints.filter((_, i) => i !== index);
                    setDescriptionPoints(next.length === 0 ? [""] : next);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border-none cursor-pointer text-lg font-bold transition-colors"
                  title="حذف"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDescriptionPoints([...descriptionPoints, ""])}
            className="text-xs text-brand font-bold bg-transparent border-none cursor-pointer hover:underline transition-all flex items-center gap-1"
          >
            <span>+</span> إضافة نقطة جديدة
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">المرحلة الدراسية</label>
            <select
              value={plan.educationalStage}
              onChange={e => setPlan({...plan, educationalStage: e.target.value})}
              className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="sec_1">أولى بكالوريا</option>
              <option value="sec_2">ثانية بكالوريا</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">مؤشر الشهر</label>
            <input 
              type="number"
              min="1"
              max="12"
              value={plan.monthIndex}
              onChange={e => setPlan({...plan, monthIndex: Number(e.target.value)})}
              className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1">السعر (جنيه)</label>
            <input 
              type="number" 
              value={plan.price} 
              onChange={e => setPlan({...plan, price: e.target.value})}
              className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">سعر الخصم (اختياري)</label>
            <input 
              type="number" 
              value={plan.discountPrice || ""} 
              onChange={e => setPlan({...plan, discountPrice: e.target.value ? Number(e.target.value) : null})}
              className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">المدة (بالأيام)</label>
            <input 
              type="number" 
              value={plan.durationDays} 
              onChange={e => setPlan({...plan, durationDays: e.target.value})}
              className="w-full p-2 border rounded bg-[var(--surface-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input 
              type="checkbox"
              checked={plan.chatEnabled}
              onChange={e => setPlan({...plan, chatEnabled: e.target.checked})}
              className="w-4 h-4 rounded text-indigo-600"
            />
            تفعيل شات المساعد الذكي
          </label>
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input 
              type="checkbox"
              checked={plan.gradingAIEnabled}
              onChange={e => setPlan({...plan, gradingAIEnabled: e.target.checked})}
              className="w-4 h-4 rounded text-indigo-600"
            />
            تفعيل تقييم المشاريع بالذكاء الاصطناعي
          </label>
        </div>

        <div>
          <label className="block text-sm font-bold mb-1">الحالة الحالية</label>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              plan.status === "published" ? "bg-green-100 text-green-700" :
              plan.status === "archived" ? "bg-gray-100 text-gray-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {plan.status === "published" ? "منشورة (Published)" : plan.status === "archived" ? "مؤرشفة (Archived)" : "مسودة (Draft)"}
            </span>
            
            {plan.status !== "published" && (
              <select 
                value={plan.status} 
                onChange={e => setPlan({...plan, status: e.target.value})}
                className="p-1 border rounded bg-[var(--surface-2)] text-sm text-[var(--ink)]"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="draft">مسودة (Draft)</option>
                <option value="archived">مؤرشفة (Archived)</option>
              </select>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded disabled:opacity-50 transition-colors border-none cursor-pointer"
        >
          {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </form>

      {/* Publish Area */}
      {plan.status === "draft" && (
        <div className="mt-8 p-6 border border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 rounded-2xl space-y-4">
          <h4 className="font-bold text-base text-orange-700 dark:text-orange-400">نشر الخطة الدراسية</h4>
          <p className="text-sm text-[var(--ink-muted)]">
            سيقوم النظام بإجراء فحص أمان وجودة قبل تفعيل الخطة لتأكيد جاهزيتها ومطابقة محتوى الدروس والاختبارات الافتراضية.
          </p>

          {publishErrors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl space-y-1">
              <span className="text-sm font-bold text-red-700 dark:text-red-400 block mb-1">أخطاء تمنع النشر:</span>
              <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 space-y-1">
                {publishErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors border-none cursor-pointer text-sm"
          >
            {publishing ? "جاري التحقق والنشر..." : "تأكيد ونشر الخطة الآن"}
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-8 p-6 border border-red-200 bg-red-50/30 dark:bg-red-950/10 rounded-2xl space-y-4">
        <h4 className="font-bold text-base text-red-700 dark:text-red-400">منطقة الخطورة (Danger Zone)</h4>
        <p className="text-xs text-[var(--ink-muted)]">
          حذف هذه الخطة سيقوم بإزالتها نهائياً من النظام مع جميع البيانات والاشتراكات المتعلقة بها. لا يمكن التراجع عن هذا الإجراء.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-50 transition-colors border-none cursor-pointer text-sm"
        >
          {deleting ? "جاري الحذف..." : "حذف الخطة الدراسية نهائياً"}
        </button>
      </div>
    </div>
  );
}
