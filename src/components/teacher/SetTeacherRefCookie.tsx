"use client";

import { useEffect } from "react";

export function SetTeacherRefCookie({ teacherId }: { teacherId: string }) {
  useEffect(() => {
    if (!teacherId) return;
    try {
      document.cookie = `teacher_ref=${teacherId}; max-age=${30 * 24 * 60 * 60}; path=/; samesite=lax`;
    } catch {}
  }, [teacherId]);

  return null;
}
