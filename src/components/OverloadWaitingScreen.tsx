"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RefreshCw, Lock, Sparkles, Server } from "lucide-react";

interface Props {
  message?: string;
  remainingMinutes?: number;
}

export function OverloadWaitingScreen({ message, remainingMinutes = 15 }: Props) {
  const [timeLeft, setTimeLeft] = useState(remainingMinutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 font-sans relative overflow-hidden"
    >
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400 mb-6 animate-pulse">
          <ShieldAlert className="h-4 w-4" />
          <span>حماية السيرفر الاستباقية مُفعّلة</span>
        </div>

        {/* Server Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-inner">
          <Server className="h-10 w-10 animate-bounce" />
        </div>

        <h1 className="text-2xl font-black text-white sm:text-3xl mb-3">
          المنصة تشهد إقبالاً كثيفاً جداً ✨
        </h1>

        <p className="text-sm leading-relaxed text-slate-300 mb-8">
          {message ||
            "لحماية استقرار السيرفر وضمان تجربة سلسة لكل الطلاب، تم تفعيل نظام تنظيم المرور مؤقتاً. يرجى الانتظار القليل ثم إعادة المحاولة."}
        </p>

        {/* Countdown Timer Card */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-inner">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            الوقت المتبقي لانتهاء فترة التهداة المؤقتة
          </span>
          <div className="flex items-center justify-center gap-3 dir-ltr text-3xl font-black text-amber-400 font-mono">
            <div className="rounded-xl bg-slate-900 px-4 py-2 border border-slate-800">
              {String(mins).padStart(2, "0")}
              <span className="block text-[10px] font-sans font-normal text-slate-500 mt-1">دقيقة</span>
            </div>
            <span className="text-slate-600">:</span>
            <div className="rounded-xl bg-slate-900 px-4 py-2 border border-slate-800">
              {String(secs).padStart(2, "0")}
              <span className="block text-[10px] font-sans font-normal text-slate-500 mt-1">ثانية</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-500 active:scale-98"
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة التحديث وتجربة الدخول</span>
          </button>

          <Link
            href="/adminpanel"
            className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors pt-2"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>دخول إدارة المنصة /adminpanel</span>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <span>منصة Code-UP التعليمية | حماية التوافر الذكية</span>
      </div>
    </div>
  );
}
