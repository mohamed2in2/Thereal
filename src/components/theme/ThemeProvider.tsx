"use client";

import { useEffect } from "react";
import { applyTheme, getResolvedTheme, getSystemTheme, getStoredPreference } from "@/lib/theme";

/**
 * Keeps document theme in sync after hydration and when OS preference changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getResolvedTheme());

    const onThemeChange = () => applyTheme(getResolvedTheme());
    window.addEventListener("themechange", onThemeChange);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getStoredPreference() === "system" || getStoredPreference() === null) {
        applyTheme(getSystemTheme());
        window.dispatchEvent(new Event("themechange"));
      }
    };
    media.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("themechange", onThemeChange);
      media.removeEventListener("change", onSystemChange);
    };
  }, []);

  return children;
}
