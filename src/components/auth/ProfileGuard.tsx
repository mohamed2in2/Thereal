"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Single fetch — /api/auth/me has a 15s private browser cache so this is
    // essentially free on repeat visits. No retry loop needed.
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user?: { role?: string; profileCompleted?: boolean } | null }) => {
        if (cancelled) return;
        const me = data?.user;
        if (me?.role === "student" && !me.profileCompleted) {
          router.replace("/complete-profile");
          return;
        }
        setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
