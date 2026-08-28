"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  IconVideo,
  IconClipboard,
  IconFile,
  IconFolder,
  IconShield,
} from "@/components/admin/AdminIcons";

interface ContentItem {
  id: string;
  type: "VIDEO" | "HOMEWORK" | "QUIZ" | "EXAM" | "SOLUTION_VIDEO" | "PDF";
  sourceId: string;
  title: string;
  folderId?: string;
  folderName?: string;
}

interface FolderInfo {
  id: string;
  name: string;
  order: number;
}

interface PrerequisiteEdge {
  id?: string;
  targetContentId: string;
  prerequisiteContentId: string;
  prerequisiteTitle?: string;
  prerequisiteType?: string;
  requiredStatus?: string;
  minScore?: number | null;
}

interface ContentFlowManagerProps {
  courseId: string;
  courseTitle?: string;
}

export function ContentFlowManager({ courseId, courseTitle }: ContentFlowManagerProps) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [prerequisites, setPrerequisites] = useState<PrerequisiteEdge[]>([]);
  const [flowMode, setFlowMode] = useState<"free" | "per_folder" | "course" | "custom">("per_folder");

  const loadData = useCallback(async (isInitial = true) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/prerequisites`);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          setItems(data.items);
          setFolders(data.folders || []);
          setPrerequisites(data.prerequisites || []);

          if (!data.sequentialAccess && (!data.prerequisites || data.prerequisites.length === 0)) {
            setFlowMode("free");
          } else {
            setFlowMode("per_folder");
          }
          if (isInitial) setLoading(false);
          return;
        }
      }

      // If empty, auto-sync from course folders
      const syncRes = await fetch(`/api/admin/courses/${courseId}/prerequisites/sync`, {
        method: "POST",
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setItems(syncData.items || []);
        setPrerequisites(syncData.prerequisites || []);
      }
    } catch (err) {
      console.error("Error loading flow data:", err);
      if (isInitial) toastError("تعذر تحميل مسار المحتوى");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [courseId, toastError]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Group items by folderId
  const itemsByFolder = useMemo(() => {
    const grouped: Record<string, { name: string; items: ContentItem[] }> = {};

    // Initialize with known folders
    folders.forEach((f) => {
      grouped[f.id] = { name: f.name, items: [] };
    });

    // Place items in order
    items.forEach((item) => {
      const fid = item.folderId || "unknown";
      if (!grouped[fid]) {
        grouped[fid] = { name: item.folderName || "عام", items: [] };
      }
      grouped[fid].items.push(item);
    });

    return grouped;
  }, [items, folders]);

  // Re-sync all content from course folders
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/prerequisites/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setPrerequisites(data.prerequisites || []);
        toastSuccess(`تمت مزامنة ${data.count || 0} عنصر محتوى بنجاح`);
      } else {
        toastError(data.error || "فشلت المزامنة");
      }
    } catch {
      toastError("خطأ في الاتصال بالسيرفر");
    } finally {
      setSyncing(false);
    }
  };

  // Move item up within its folder
  const moveItemUpInFolder = (folderId: string, itemIndex: number) => {
    if (itemIndex === 0) return;
    const folderItems = itemsByFolder[folderId]?.items;
    if (!folderItems) return;

    const targetItem = folderItems[itemIndex];
    const prevItem = folderItems[itemIndex - 1];

    const globalIdx1 = items.findIndex((i) => i.id === targetItem.id);
    const globalIdx2 = items.findIndex((i) => i.id === prevItem.id);

    if (globalIdx1 !== -1 && globalIdx2 !== -1) {
      const newItems = [...items];
      const temp = newItems[globalIdx1];
      newItems[globalIdx1] = newItems[globalIdx2];
      newItems[globalIdx2] = temp;
      setItems(newItems);

      // If in per_folder mode, update prerequisites to match new local order
      if (flowMode === "per_folder") {
        updateFolderChainPrereqs(folderId, newItems);
      }
    }
  };

  // Move item down within its folder
  const moveItemDownInFolder = (folderId: string, itemIndex: number) => {
    const folderItems = itemsByFolder[folderId]?.items;
    if (!folderItems || itemIndex >= folderItems.length - 1) return;

    const targetItem = folderItems[itemIndex];
    const nextItem = folderItems[itemIndex + 1];

    const globalIdx1 = items.findIndex((i) => i.id === targetItem.id);
    const globalIdx2 = items.findIndex((i) => i.id === nextItem.id);

    if (globalIdx1 !== -1 && globalIdx2 !== -1) {
      const newItems = [...items];
      const temp = newItems[globalIdx1];
      newItems[globalIdx1] = newItems[globalIdx2];
      newItems[globalIdx2] = temp;
      setItems(newItems);

      // If in per_folder mode, update prerequisites to match new local order
      if (flowMode === "per_folder") {
        updateFolderChainPrereqs(folderId, newItems);
      }
    }
  };

  // Helper to re-generate prerequisites for a folder given new item array
  const updateFolderChainPrereqs = (folderId: string, currentItems: ContentItem[]) => {
    const folderItems = currentItems.filter((i) => (i.folderId || "unknown") === folderId);
    const folderItemIds = new Set(folderItems.map((i) => i.id));
    const otherPrereqs = prerequisites.filter((p) => !folderItemIds.has(p.targetContentId));

    const newFolderPrereqs: PrerequisiteEdge[] = [];
    for (let i = 1; i < folderItems.length; i++) {
      const prev = folderItems[i - 1];
      const curr = folderItems[i];
      newFolderPrereqs.push({
        targetContentId: curr.id,
        prerequisiteContentId: prev.id,
        prerequisiteTitle: prev.title,
        prerequisiteType: prev.type,
        requiredStatus: "COMPLETED",
      });
    }

    setPrerequisites([...otherPrereqs, ...newFolderPrereqs]);
  };

  // Auto-chain sequential per folder
  const handleAutoChainPerFolder = () => {
    const newPrereqs: PrerequisiteEdge[] = [];

    Object.values(itemsByFolder).forEach((f) => {
      for (let i = 1; i < f.items.length; i++) {
        const prev = f.items[i - 1];
        const curr = f.items[i];
        newPrereqs.push({
          targetContentId: curr.id,
          prerequisiteContentId: prev.id,
          prerequisiteTitle: prev.title,
          prerequisiteType: prev.type,
          requiredStatus: "COMPLETED",
        });
      }
    });

    setPrerequisites(newPrereqs);
    setFlowMode("per_folder");
    toastInfo("تم تطبيق القفل التتابعي داخل كل مجلد — اضغط حفظ للتأكيد");
  };

  // Disable all locks & make free
  const handleDisableAllLocks = () => {
    setPrerequisites([]);
    setFlowMode("free");
    toastInfo("تم اختيار وضع المشاهدة الحرة — اضغط حفظ للتأكيد 🔓");
  };

  // Clear single folder locks
  const handleClearFolderLocks = (folderId: string) => {
    const folderItemIds = new Set(itemsByFolder[folderId]?.items.map((i) => i.id) || []);
    const filtered = prerequisites.filter((p) => !folderItemIds.has(p.targetContentId));
    setPrerequisites(filtered);
    toastInfo("تم إلغاء أقفال عناصر هذا المجلد");
  };

  // Auto-chain single folder
  const handleAutoChainFolder = (folderId: string) => {
    const folderItems = itemsByFolder[folderId]?.items || [];
    if (folderItems.length <= 1) return;

    const folderItemIds = new Set(folderItems.map((i) => i.id));
    const filtered = prerequisites.filter((p) => !folderItemIds.has(p.targetContentId));

    for (let i = 1; i < folderItems.length; i++) {
      const prev = folderItems[i - 1];
      const curr = folderItems[i];
      filtered.push({
        targetContentId: curr.id,
        prerequisiteContentId: prev.id,
        prerequisiteTitle: prev.title,
        prerequisiteType: prev.type,
        requiredStatus: "COMPLETED",
      });
    }

    setPrerequisites(filtered);
    toastSuccess(`تم تطبيق الترتيب التتابعي للمجلد (${itemsByFolder[folderId]?.name})`);
  };

  // Set custom prerequisite for single item
  const setPrerequisiteForItem = (targetId: string, prerequisiteId: string) => {
    const filtered = prerequisites.filter((p) => p.targetContentId !== targetId);
    if (prerequisiteId && prerequisiteId !== "NONE") {
      const prereqItem = items.find((i) => i.id === prerequisiteId);
      filtered.push({
        targetContentId: targetId,
        prerequisiteContentId: prerequisiteId,
        prerequisiteTitle: prereqItem?.title,
        prerequisiteType: prereqItem?.type,
        requiredStatus: "COMPLETED",
      });
    }
    setPrerequisites(filtered);
  };

  // Save current graph
  const handleSave = async () => {
    setSaving(true);
    try {
      let bodyData: any = {
        mode: flowMode,
        sequentialAccess: flowMode !== "free",
      };

      if (flowMode === "free") {
        bodyData.mode = "free";
      } else if (flowMode === "per_folder") {
        const folderChains: Record<string, string[]> = {};
        Object.entries(itemsByFolder).forEach(([fid, fData]) => {
          folderChains[fid] = fData.items.map((i) => i.id);
        });
        bodyData.folderChains = folderChains;
      } else if (flowMode === "course") {
        bodyData.orderedItemIds = items.map((i) => i.id);
      } else {
        bodyData.customEdges = prerequisites;
      }

      const res = await fetch(`/api/admin/courses/${courseId}/prerequisites`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "تم حفظ الترتيب وأقفال المحتوى بنجاح! 💾");
        if (data.prerequisites) {
          setPrerequisites(data.prerequisites);
        }
      } else {
        toastError(data.error || "تعذر حفظ التغييرات");
      }
    } catch {
      toastError("حدث خطأ أثناء حفظ المسار");
    } finally {
      setSaving(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "VIDEO":
      case "SOLUTION_VIDEO":
        return {
          icon: <IconVideo className="w-3.5 h-3.5" />,
          label: type === "SOLUTION_VIDEO" ? "فيديو حل" : "فيديو شرح",
          color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
        };
      case "HOMEWORK":
        return {
          icon: <IconClipboard className="w-3.5 h-3.5" />,
          label: "واجب منزلي",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        };
      case "QUIZ":
      case "EXAM":
        return {
          icon: <IconShield className="w-3.5 h-3.5" />,
          label: type === "EXAM" ? "امتحان شامل" : "اختبار",
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        };
      case "PDF":
        return {
          icon: <IconFile className="w-3.5 h-3.5" />,
          label: "ملف / ملحق",
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      default:
        return {
          icon: <IconFile className="w-3.5 h-3.5" />,
          label: type,
          color: "text-[var(--ink-muted)] bg-gray-500/10 border-gray-500/20",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-[var(--ink-muted)]">جاري تحميل مسار المحتوى والمجلدات...</p>
      </div>
    );
  }

  const folderEntries = Object.entries(itemsByFolder);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--ink)] flex items-center gap-2">
              <span>مسار وفتح المحتوى وشروط التتابع</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                {items.length} عنصر · {folderEntries.length} مجلد/محاضرة
              </span>
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              تحكم في فتح المحتوى لكل مجلد على حدة أو اجعل الكورس حراً بالكامل للبدء من أي مكان.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg)] transition-colors flex items-center gap-1.5"
            >
              <span>{syncing ? "جاري المزامنة..." : "🔄 مزامنة المحتوى"}</span>
            </button>

            <button
              type="button"
              onClick={handleDisableAllLocks}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${
                flowMode === "free"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : "text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20"
              }`}
            >
              🔓 جعل الكورس حراً بالكامل
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md shadow-sky-500/20 transition-all flex items-center gap-2"
            >
              {saving ? "جاري الحفظ..." : "💾 حفظ المسار والتغييرات"}
            </button>
          </div>
        </div>

        {/* Global Policy Selector */}
        <div className="mt-6 pt-5 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Policy 1: Free Start Anywhere */}
          <div
            onClick={() => setFlowMode("free")}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
              flowMode === "free"
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-[var(--border)] hover:border-[var(--ink-muted)]/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔓</span>
              <div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  مشاهدة حرة بالكامل (Free)
                </h4>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  لا توجد أي أقفال. الطالب حر في فتح أي درس أو واجب والبدء من أي مكان.
                </p>
              </div>
            </div>
          </div>

          {/* Policy 2: Per-Folder Sequential */}
          <div
            onClick={() => {
              setFlowMode("per_folder");
              handleAutoChainPerFolder();
            }}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
              flowMode === "per_folder"
                ? "border-sky-500 bg-sky-500/10"
                : "border-[var(--border)] hover:border-[var(--ink-muted)]/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📂</span>
              <div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  تتابع داخل كل مجلد (Per Folder)
                </h4>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  الطالب يبدأ من أي مجلد يعجبه، وداخل المجلد يتدرج (فيديو ← واجب ← امتحان).
                </p>
              </div>
            </div>
          </div>

          {/* Policy 3: Custom Dependencies */}
          <div
            onClick={() => setFlowMode("custom")}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
              flowMode === "custom"
                ? "border-purple-500 bg-purple-500/10"
                : "border-[var(--border)] hover:border-[var(--ink-muted)]/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <div>
                <h4 className="text-sm font-black text-[var(--ink)]">
                  تخصيص يدوي مخصص (Custom)
                </h4>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  حدد شروط فتح دقيقة لكل عنصر على حدة من أي مجلد آخر.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Folders List with Self-Contained Items */}
      {folderEntries.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center">
          <p className="text-lg font-bold text-[var(--ink)]">لا يوجد محتوى أو مجلدات في هذا الكورس بعد</p>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            قم بإضافة محاضرات وفيديوهات أو واجبات أولاً، ثم اضغط على "مزامنة المحتوى".
          </p>
          <button
            type="button"
            onClick={handleSync}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 text-white"
          >
            🔄 مزامنة المحتوى الآن
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {folderEntries.map(([folderId, folderData]) => {
            return (
              <div
                key={folderId}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4"
              >
                {/* Folder Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                      <IconFolder className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-[var(--ink)]">
                        {folderData.name}
                      </h3>
                      <p className="text-[11px] text-[var(--ink-muted)]">
                        {folderData.items.length} عنصر داخل هذا المجلد
                      </p>
                    </div>
                  </div>

                  {flowMode !== "free" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAutoChainFolder(folderId)}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border border-sky-500/20 transition-colors"
                      >
                        ⚡ تتابع تلقائي للمجلد
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearFolderLocks(folderId)}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg text-[var(--ink-muted)] hover:text-red-500 border border-[var(--border)] transition-colors"
                      >
                        🔓 فتح حر للمجلد
                      </button>
                    </div>
                  )}
                </div>

                {/* Items Inside Folder */}
                {folderData.items.length === 0 ? (
                  <p className="text-xs text-[var(--ink-muted)] py-4 text-center">
                    لا يوجد محتوى مضاف داخل هذه المحاضرة.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {folderData.items.map((item, itemIdx) => {
                      const typeInfo = getTypeBadge(item.type);
                      const isFirstInFolder = itemIdx === 0;
                      const isLastInFolder = itemIdx === folderData.items.length - 1;

                      // Check current prerequisite
                      const currentPrereq =
                        flowMode === "free"
                          ? null
                          : flowMode === "per_folder"
                          ? !isFirstInFolder
                            ? folderData.items[itemIdx - 1]
                            : null
                          : items.find(
                              (i) =>
                                i.id ===
                                prerequisites.find(
                                  (p) => p.targetContentId === item.id
                                )?.prerequisiteContentId
                            );

                      return (
                        <div
                          key={item.id}
                          className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-sky-500/30"
                        >
                          {/* Item Identity */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[11px] font-black text-[var(--ink-muted)] shrink-0">
                              {itemIdx + 1}
                            </span>

                            <div
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${typeInfo.color}`}
                            >
                              {typeInfo.icon}
                              <span>{typeInfo.label}</span>
                            </div>

                            <p className="text-xs font-bold text-[var(--ink)] truncate">
                              {item.title}
                            </p>
                          </div>

                          {/* Item Prerequisite Status & Controls */}
                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            {flowMode === "free" ? (
                              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                🔓 مفتوح للجميع
                              </span>
                            ) : flowMode === "per_folder" ? (
                              <div className="text-[11px]">
                                {isFirstInFolder ? (
                                  <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                    🔓 بداية المجلد (مفتوح تلقائياً)
                                  </span>
                                ) : (
                                  <span className="font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                    🔒 يتطلب: {folderData.items[itemIdx - 1]?.title.slice(0, 20)}...
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                                  يتطلب:
                                </span>
                                <select
                                  value={currentPrereq?.id || "NONE"}
                                  onChange={(e) =>
                                    setPrerequisiteForItem(item.id, e.target.value)
                                  }
                                  className="text-[11px] font-bold bg-[var(--card)] border border-[var(--border)] text-[var(--ink)] rounded-lg px-2 py-1 outline-none focus:border-sky-500"
                                >
                                  <option value="NONE">🔓 مفتوح</option>
                                  {items
                                    .filter((other) => other.id !== item.id)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        🔒 {other.title.slice(0, 25)} ({other.folderName})
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}

                            {/* Up / Down within this folder */}
                            <div className="flex items-center gap-0.5 bg-[var(--card)] p-0.5 rounded-lg border border-[var(--border)]">
                              <button
                                type="button"
                                onClick={() => moveItemUpInFolder(folderId, itemIdx)}
                                disabled={isFirstInFolder}
                                title="تحريك لأعلى"
                                className="p-1 rounded text-xs hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                ⬆️
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItemDownInFolder(folderId, itemIdx)}
                                disabled={isLastInFolder}
                                title="تحريك لأسفل"
                                className="p-1 rounded text-xs hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                ⬇️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
