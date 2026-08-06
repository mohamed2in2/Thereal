"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

interface VideoGuardProps {
  children: React.ReactNode;
  studentName?: string;
  studentPhone?: string;
  videoId?: string;
  onViolation?: (type: string, count: number) => void;
  onExit?: () => void;
}

export function VideoGuard({
  children,
  studentName,
  studentPhone,
  videoId,
  onViolation,
  onExit,
}: VideoGuardProps) {
  const [hasViolation, setHasViolation] = useState(false);
  const [violationType, setViolationType] = useState<string>("");
  const [violationCount, setViolationCount] = useState(0);
  const [isTabHidden, setIsTabHidden] = useState(false);

  const reportedTypesRef = useRef<Set<string>>(new Set());

  // Report violation to backend API
  const reportViolation = useCallback(
    async (type: string, details?: string) => {
      // Avoid spamming API for same violation repeatedly within short period
      const key = `${type}-${Math.floor(Date.now() / 5000)}`;
      if (reportedTypesRef.current.has(key)) return;
      reportedTypesRef.current.add(key);

      try {
        await fetch("/api/security/violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, videoId, details }),
        });
      } catch (e) {
        // Silent catch for security endpoint errors
      }

      setViolationCount((prev) => {
        const next = prev + 1;
        onViolation?.(type, next);
        return next;
      });
    },
    [videoId, onViolation]
  );

  const triggerViolationModal = useCallback(
    (type: string, details?: string) => {
      setHasViolation(true);
      setViolationType(type);
      void reportViolation(type, details);
    },
    [reportViolation]
  );

  // 1. DevTools Detection Mechanisms
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    const checkDevTools = () => {
      // Threshold check for DevTools dock
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        triggerViolationModal("DEVTOOLS", "DevTools window size threshold exceeded");
        return;
      }

      // Timing Trap via Debugger
      const startTime = Date.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const endTime = Date.now();

      if (endTime - startTime > 120) {
        triggerViolationModal("DEVTOOLS", "Debugger breakpoint triggered");
      }
    };

    checkInterval = setInterval(checkDevTools, 1500);
    return () => clearInterval(checkInterval);
  }, [triggerViolationModal]);

  // 2. Keyboard & PrintScreen Shortcuts Prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        triggerViolationModal("DEVTOOLS", "Pressed F12");
        return;
      }

      // Ctrl / Cmd + Shift + I / J / C (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolationModal("DEVTOOLS", `Pressed Ctrl+Shift+${e.key.toUpperCase()}`);
        return;
      }

      // Ctrl / Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolationModal("DEVTOOLS", "Pressed Ctrl+U View Source");
        return;
      }

      // Ctrl / Cmd + S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolationModal("SCREENSHOT", "Pressed Ctrl+S Save Page");
        return;
      }

      // Ctrl / Cmd + P (Print Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
        triggerViolationModal("SCREENSHOT", "Pressed Ctrl+P Print");
        return;
      }

      // PrintScreen / SysReq
      if (e.key === "PrintScreen" || e.key === "SysReq") {
        e.preventDefault();
        e.stopPropagation();
        // Clear clipboard immediately
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
        triggerViolationModal("SCREENSHOT", "Pressed PrintScreen");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.key === "SysReq") {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [triggerViolationModal]);

  // 3. Right Click Context Menu Blocker
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    void reportViolation("CONTEXT_MENU", "Right click attempted");
  };

  // 4. Tab Visibility & Window Focus Loss Monitoring (Full Blur & Blackout Protection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setIsTabHidden(true);
        void reportViolation("TAB_SWITCH", "User switched away from tab");
      } else {
        setIsTabHidden(false);
      }
    };

    const handleWindowBlur = () => {
      setIsTabHidden(true);
      void reportViolation("TAB_SWITCH", "Window lost focus");
    };

    const handleWindowFocus = () => {
      setIsTabHidden(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [reportViolation]);

  return (
    <div
      onContextMenu={handleContextMenu}
      className="relative select-none w-full"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Printable CSS override to hide video if printed */}
      <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Video Content */}
      <div className={hasViolation ? "filter blur-lg pointer-events-none opacity-20" : ""}>
        {children}
      </div>

      {/* Tab Hidden Blur Overlay */}
      {isTabHidden && !hasViolation && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl mb-3">
            ⏸️
          </div>
          <h3 className="text-lg font-bold">تم إيقاف المشاهدة مؤقتاً</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            تم التوقف تلقائياً عند مغادرة الصفحة للحفاظ على رصيد المشاهدة الخاص بك.
          </p>
        </div>
      )}

      {/* Security Violation Modal Alert */}
      {hasViolation && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white dir-rtl">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-8 space-y-6 shadow-2xl shadow-rose-950/50">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-3xl animate-bounce">
              🚨
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-rose-400">
                تنبيه أمني عاجل
              </h2>
              <p className="text-base font-bold text-white">
                هذا الإجراء غير مسموح به وقد يعرضك للمساءلة القانونية والحظر النهائي
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-right text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">نوع المخالفة:</span>
                <span className="text-rose-400 font-bold">{violationType || "محاولة استخراج المحتوى"}</span>
              </div>
              {studentName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">اسم الحساب:</span>
                  <span className="text-slate-200">{studentName}</span>
                </div>
              )}
              {studentPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">رقم الهاتف:</span>
                  <span className="text-slate-200 dir-ltr">{studentPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">عدد المحاولات:</span>
                <span className="text-rose-400 font-bold">{violationCount}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              تم تسجيل هذه المحاولة وحفظ عنوان الـ IP والبيانات الأمنية في سجل المخالفات الخاص بإدارة المنصة.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setHasViolation(false);
                  if (onExit) onExit();
                }}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                فهمت وتعهد بعدم التكرار (متابعة)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
