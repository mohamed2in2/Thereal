"use client";
import { useState, useEffect } from "react";

interface RequestItem {
  id: string;
  createdAt: string;
  studentName: string;
  action: string;
  provider: string;
  status: string;
  tokens: number;
  cost: number;
  prompt: string;
  response: string;
}

export default function AIRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);

  useEffect(() => {
    // Demo data for requests explorer
    setRequests([
      {
        id: "req_101",
        createdAt: new Date().toLocaleTimeString("ar-EG"),
        studentName: "أحمد محمود",
        action: "Explain",
        provider: "DeepSeek V4 Flash",
        status: "success",
        tokens: 450,
        cost: 0.00045,
        prompt: "اشرح لي قاعدة نيوتن الثالث بشكل مبسط مع أمثلة من الحياة اليومية",
        response: "لكل فعل رد فعل مساوٍ له في المقدار ومضاد له في الاتجاه. مثال: دفع الجدار، طيران الصاروخ."
      },
      {
        id: "req_102",
        createdAt: new Date(Date.now() - 120000).toLocaleTimeString("ar-EG"),
        studentName: "سارة علي",
        action: "Quiz",
        provider: "Gemini Flash",
        status: "success",
        tokens: 620,
        cost: 0,
        prompt: "إنشاء 3 أسئلة اختيارات في الكيمياء العضوية للصف الثالث الثانوي",
        response: "السؤال 1: ما هو الصيغة العامة للألكانات؟ ..."
      },
      {
        id: "req_103",
        createdAt: new Date(Date.now() - 300000).toLocaleTimeString("ar-EG"),
        studentName: "عمر خالد",
        action: "Summary",
        provider: "Cache",
        status: "cache_hit",
        tokens: 0,
        cost: 0,
        prompt: "تلخيص الباب الأول في الفيزياء",
        response: "ملخص الباب الأول: التيار الكهربي وقانون أوم..."
      }
    ]);
  }, []);

  const filtered = requests.filter(r => 
    r.studentName.includes(search) || r.action.toLowerCase().includes(search.toLowerCase()) || r.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="بحث بأسماء الطلاب، المزودين، أو العمليات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm text-right">
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="p-3">الوقت</th>
                <th className="p-3">الطالب</th>
                <th className="p-3">العملية</th>
                <th className="p-3">المزود</th>
                <th className="p-3">التوكنات</th>
                <th className="p-3">التكلفة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: selectedReq?.id === req.id ? "var(--brand-soft)" : "transparent"
                  }}
                >
                  <td className="p-3 font-mono text-xs text-[var(--ink-3)]">{req.createdAt}</td>
                  <td className="p-3 font-bold text-[var(--ink)]">{req.studentName}</td>
                  <td className="p-3 font-semibold text-[var(--brand)]">{req.action}</td>
                  <td className="p-3 text-xs text-[var(--ink-2)]">{req.provider}</td>
                  <td className="p-3 font-mono text-xs">{req.tokens}</td>
                  <td className="p-3 font-mono text-xs text-[var(--gold-2)]">${req.cost.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedReq && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="font-bold text-base" style={{ color: "var(--ink)", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
              تفاصيل الطلب ({selectedReq.id})
            </h3>
            <div>
              <label className="text-xs text-[var(--ink-3)] block font-bold mb-1">البرومبت / السؤال</label>
              <div className="p-3 rounded-xl text-xs font-mono bg-[var(--surface-2)] text-[var(--ink)] leading-relaxed">
                {selectedReq.prompt}
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--ink-3)] block font-bold mb-1">استجابة AI</label>
              <div className="p-3 rounded-xl text-xs font-mono bg-[var(--surface-2)] text-[var(--ink)] leading-relaxed max-h-60 overflow-y-auto">
                {selectedReq.response}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
