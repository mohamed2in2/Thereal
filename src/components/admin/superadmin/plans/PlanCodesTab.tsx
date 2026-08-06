"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function PlanCodesTab({ planId }: { planId: string }) {
  const { success, error: toastError } = useToast();
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCodes = () => {
    setLoading(true);
    fetch(`/api/admin/superadmin/plans/${planId}/codes`)
      .then(r => r.json())
      .then(data => {
        if (data.codes) setCodes(data.codes);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCodes();
  }, [planId]);

  const generateCode = async () => {
    try {
      const res = await fetch(`/api/admin/superadmin/plans/${planId}/codes`, {
        method: "POST"
      });
      if (res.ok) {
        success("تم توليد كود جديد");
        fetchCodes();
      } else {
        toastError("حدث خطأ");
      }
    } catch {
      toastError("حدث خطأ");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">الأكواد ({codes.length})</h3>
        <button onClick={generateCode} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold">
          + توليد كود جديد
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">جاري التحميل...</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-gray-50 rounded">
          لا توجد أكواد مولدة بعد لهذه الخطة.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-right">
                <th className="p-3 border-b">الكود</th>
                <th className="p-3 border-b">الحالة</th>
                <th className="p-3 border-b">تاريخ الاستخدام</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold tracking-widest">{c.code}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${c.usedAt ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {c.usedAt ? 'مستخدم' : 'متاح'}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {c.usedAt ? new Date(c.usedAt).toLocaleString('ar-EG') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
