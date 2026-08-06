"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { EDUCATIONAL_STAGES } from "@/types";
import { StudentDetailModal } from "./StudentDetailModal";
import { useToast } from "@/components/ui/Toast";
import { hasPermission } from "@/lib/rbac";

interface Student {
  id: string;
  name: string;
  age: number | null;
  educationalStage: string | null;
  phone: string | null;
  parentPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SearchFilters {
  name: string;
  stage: string;
  age: string;
  phone: string;
  parentPhone: string;
}

const PAGE_SIZE = 20;

const EMPTY_FILTERS: SearchFilters = {
  name: "",
  stage: "",
  age: "",
  phone: "",
  parentPhone: "",
};

function stageLabel(value: string | null) {
  if (!value) return "—";
  return EDUCATIONAL_STAGES.find((s) => s.value === value)?.label ?? value;
}

export function StudentsSection({ userRole = "superadmin" }: { userRole?: string }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const canManageDevices = hasPermission(userRole, "suspend_student");
  const [maxDevices, setMaxDevices] = useState<number | null>(null);
  const [deviceBounds, setDeviceBounds] = useState({ min: 1, max: 10 });
  const [draftMaxDevices, setDraftMaxDevices] = useState("");
  const [savingDevices, setSavingDevices] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastSearch = useRef<{ filters: SearchFilters; page: number }>({ filters: EMPTY_FILTERS, page: 0 });

  const search = useCallback(async (f: SearchFilters, pageOffset: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.name) params.set("name", f.name);
    if (f.stage) params.set("stage", f.stage);
    if (f.age) params.set("age", f.age);
    if (f.phone) params.set("phone", f.phone);
    if (f.parentPhone) params.set("parentPhone", f.parentPhone);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset * PAGE_SIZE));

    try {
      const res = await fetch(`/api/admin/superadmin/students?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { students?: Student[]; total?: number };
      if (res.ok) {
        setStudents(data.students ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    lastSearch.current = { filters, page: 0 };
    void search(filters, 0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    lastSearch.current = { ...lastSearch.current, page: newPage };
    void search(lastSearch.current.filters, newPage);
  };

  const handleStudentModified = () => {
    setSelectedId(null);
    void search(lastSearch.current.filters, lastSearch.current.page);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setPage(0);
    void search(EMPTY_FILTERS, 0);
  };

  // Load the global device limit (number of devices a student may sign in from).
  useEffect(() => {
    if (!canManageDevices) return;
    fetch("/api/admin/superadmin/settings/max-devices", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { maxDevices?: number; min?: number; max?: number } | null) => {
        if (!d || typeof d.maxDevices !== "number") return;
        setMaxDevices(d.maxDevices);
        setDraftMaxDevices(String(d.maxDevices));
        setDeviceBounds({ min: d.min ?? 1, max: d.max ?? 10 });
      })
      .catch(() => {});
  }, [canManageDevices]);

  const handleSaveMaxDevices = async () => {
    const n = Number(draftMaxDevices);
    if (!Number.isFinite(n) || n < deviceBounds.min || n > deviceBounds.max) {
      toastError(`عدد الأجهزة يجب أن يكون بين ${deviceBounds.min} و ${deviceBounds.max}`);
      return;
    }
    setSavingDevices(true);
    try {
      const res = await fetch("/api/admin/superadmin/settings/max-devices", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxDevices: n }),
      });
      const json = (await res.json()) as { maxDevices?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر حفظ الحد");
      setMaxDevices(json.maxDevices ?? n);
      setDraftMaxDevices(String(json.maxDevices ?? n));
      toastSuccess(`تم ضبط الحد الأقصى للأجهزة على ${json.maxDevices ?? n}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "تعذر حفظ الحد");
    } finally {
      setSavingDevices(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl">
      {/* Device limit setting */}
      {canManageDevices && maxDevices !== null && (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-white font-bold text-sm">الحد الأقصى لأجهزة المتعلم</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                عدد الأجهزة التي يمكن للمتعلم تسجيل الدخول منها. عند الوصول للحد، يُمنع الدخول من جهاز جديد حتى يُصفّر المعلم أجهزته.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={deviceBounds.min}
                max={deviceBounds.max}
                value={draftMaxDevices}
                onChange={(e) => setDraftMaxDevices(e.target.value)}
                className="w-20 px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveMaxDevices}
                disabled={savingDevices || draftMaxDevices === String(maxDevices)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingDevices ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-6"
      >
        <h3 className="text-white font-bold text-sm mb-4">بحث عن طالب</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">الاسم</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              placeholder="اسم المتعلم"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">الصف التدريبي</label>
            <select
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">كل الصفوف</option>
              {EDUCATIONAL_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">السن</label>
            <input
              type="number"
              value={filters.age}
              onChange={(e) => setFilters({ ...filters, age: e.target.value })}
              placeholder="مثال: 14"
              min={6}
              max={25}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">رقم المتعلم</label>
            <input
              type="text"
              value={filters.phone}
              onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
              placeholder="01XXXXXXXXX"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">رقم ولي الأمر</label>
            <input
              type="text"
              value={filters.parentPhone}
              onChange={(e) => setFilters({ ...filters, parentPhone: e.target.value })}
              placeholder="01XXXXXXXXX"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "جارٍ البحث..." : "بحث"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            عرض الكل
          </button>
        </div>
      </form>

      {/* Results Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">
            {loading ? "جارٍ التحميل..." : `${total} طالب`}
          </h3>
        </div>

        {!loading && students.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>لا توجد نتائج</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-right px-4 py-3 font-medium">الاسم</th>
                    <th className="text-right px-4 py-3 font-medium">الصف</th>
                    <th className="text-right px-4 py-3 font-medium">السن</th>
                    <th className="text-right px-4 py-3 font-medium">رقم الهاتف</th>
                    <th className="text-right px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {s.name[0]}
                          </div>
                          <span className="text-white font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {stageLabel(s.educationalStage)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{s.age ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                        {s.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            s.isActive
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          {s.isActive ? "نشط" : "موقوف"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-medium rounded-lg border border-blue-600/30 transition-colors"
                        >
                          عرض الملف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  صفحة {page + 1} من {totalPages} · إجمالي {total} طالب
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0 || loading}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1 || loading}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <StudentDetailModal
          studentId={selectedId}
          userRole={userRole}
          onClose={() => setSelectedId(null)}
          onStudentModified={handleStudentModified}
        />
      )}
    </div>
  );
}
