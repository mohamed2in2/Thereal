"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { animate, useReducedMotion } from "framer-motion";

const arDigits = (n: number) => n.toLocaleString("ar-EG", { useGrouping: false });

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribeToHover(onChange: () => void) {
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on devices with a real pointer (desktop). SSR and touch get the cheap path. */
export function useCanHover() {
  return useSyncExternalStore(
    subscribeToHover,
    () => window.matchMedia(HOVER_QUERY).matches,
    () => false,
  );
}

/**
 * Counts a number up (in Arabic-Indic digits) the first time it scrolls into view.
 * Writes straight to the DOM node — no re-renders per frame. Render the final
 * value as children so SSR/no-JS still shows the real number.
 */
export function useCountUp(target: number, suffix = "") {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fmt = (n: number) => arDigits(n) + suffix;
    if (reduced) {
      el.textContent = fmt(target);
      return;
    }

    el.textContent = fmt(0);
    let controls: ReturnType<typeof animate> | undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        controls = animate(0, target, {
          duration: 1.6,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (v) => {
            el.textContent = fmt(Math.round(v));
          },
        });
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      controls?.stop();
    };
  }, [target, suffix, reduced]);

  return ref;
}

/*
 * One shared 30s clock for every countdown on the page. Components subscribe via
 * useSyncExternalStore, so all chips tick together and SSR sees a stable `0`
 * (rendered as "no countdown yet") until the store hydrates.
 */
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
let clockNow = 0;

function subscribeToClock(listener: () => void) {
  if (clockListeners.size === 0) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((notify) => notify());
    }, 30_000);
  }
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

const getClockNow = () => clockNow;
const getServerClockNow = () => 0;

type PluralForms = Record<Intl.LDMLPluralRule, string>;

const AR_PLURALS = new Intl.PluralRules("ar-EG");

const DAY_FORMS: PluralForms = { zero: "أيام", one: "يوم واحد", two: "يومان", few: "أيام", many: "يومًا", other: "يوم" };
const HOUR_FORMS: PluralForms = { zero: "ساعات", one: "ساعة واحدة", two: "ساعتان", few: "ساعات", many: "ساعة", other: "ساعة" };
const MINUTE_FORMS: PluralForms = { zero: "دقائق", one: "دقيقة واحدة", two: "دقيقتان", few: "دقائق", many: "دقيقة", other: "دقيقة" };

// Arabic counts 1 and 2 with the bare/dual noun, no numeral in front.
function arUnit(n: number, forms: PluralForms) {
  const rule = AR_PLURALS.select(n);
  const word = forms[rule];
  return rule === "one" || rule === "two" ? word : `${arDigits(n)} ${word}`;
}

export interface Countdown {
  expired: boolean;
  label: string;
}

/**
 * Live "ends in…" label for a deadline. Null until the shared clock hydrates
 * (or when there is no deadline), so server and client markup never disagree.
 */
export function useCountdown(deadline?: string | null): Countdown | null {
  const now = useSyncExternalStore(subscribeToClock, getClockNow, getServerClockNow);

  if (!deadline || now === 0) return null;

  const target = Date.parse(deadline);
  if (Number.isNaN(target)) return null;

  const minutesLeft = Math.floor((target - now) / 60_000);
  if (minutesLeft <= 0) return { expired: true, label: "" };

  const days = Math.floor(minutesLeft / 1_440);
  const hours = Math.floor((minutesLeft % 1_440) / 60);
  const minutes = minutesLeft % 60;

  let label: string;
  if (days > 0) {
    label = hours > 0 ? `${arUnit(days, DAY_FORMS)} و${arUnit(hours, HOUR_FORMS)}` : arUnit(days, DAY_FORMS);
  } else if (hours > 0) {
    label = minutes > 0 ? `${arUnit(hours, HOUR_FORMS)} و${arUnit(minutes, MINUTE_FORMS)}` : arUnit(hours, HOUR_FORMS);
  } else if (minutes > 1) {
    label = arUnit(minutes, MINUTE_FORMS);
  } else {
    label = "أقل من دقيقة";
  }

  return { expired: false, label };
}

/** Price formatter — Arabic-Indic digits to match the rest of the UI. */
export const formatEgp = (amount: number) => `${arDigits(amount)} ج.م`;
