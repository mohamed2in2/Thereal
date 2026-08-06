"use client";

import Link from "next/link";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "md" | "2xl";
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  maxWidth = "md",
}: AuthShellProps) {
  const widthClass = maxWidth === "2xl" ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10"
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
          <BrandLogo size={40} showText={true} />
        </Link>
        <DarkModeToggle />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className={`w-full ${widthClass}`}>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/35 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:bg-slate-950/55 dark:border-slate-800/70">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
            <div className="absolute -top-20 right-8 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" aria-hidden />
            <div className="absolute -bottom-24 left-10 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden />

            <div className="relative p-5 sm:p-8">
              <div className="text-center mb-7 sm:mb-8 animate-fade-up">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/60 bg-sky-50/80 px-3 py-1 text-xs font-bold text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  تسجيل آمن ومباشر
                </div>
                <h1 className="mt-4 text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-xl mx-auto leading-6">
                  {subtitle}
                </p>
              </div>

              {children}

              {footer && <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
