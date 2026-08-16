import os from "os";
import { prisma } from "./prisma";

// Database AppSetting keys
const OVERLOAD_MODE_KEY = "overload_protection_mode"; // "auto" | "on" | "off"
const OVERLOAD_RAM_THRESHOLD_KEY = "overload_ram_threshold_pct"; // default 85
const OVERLOAD_COOLDOWN_UNTIL_KEY = "overload_cooldown_until"; // ISO Timestamp string
const OVERLOAD_MSG_KEY = "overload_custom_message";

export const DEFAULT_OVERLOAD_MESSAGE =
  "المنصة تشهد إقبالاً كثيفاً جداً الآن ⚡ تم تفعيل نظام تنظيم المرور لتخفيف الضغط وحماية السيرفر. يرجى الانتظار القليل والدخول مجدداً.";

export interface SystemMemoryStatus {
  totalMemMb: number;
  freeMemMb: number;
  usedMemMb: number;
  usedMemPct: number;
  processRssMb: number;
  processHeapMb: number;
}

export function getSystemMemoryStatus(): SystemMemoryStatus {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMemPct = Math.round((usedMem / totalMem) * 100);

    const memUsage = process.memoryUsage();

    return {
      totalMemMb: Math.round(totalMem / (1024 * 1024)),
      freeMemMb: Math.round(freeMem / (1024 * 1024)),
      usedMemMb: Math.round(usedMem / (1024 * 1024)),
      usedMemPct,
      processRssMb: Math.round(memUsage.rss / (1024 * 1024)),
      processHeapMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
    };
  } catch {
    return {
      totalMemMb: 4096,
      freeMemMb: 2048,
      usedMemMb: 2048,
      usedMemPct: 50,
      processRssMb: 200,
      processHeapMb: 120,
    };
  }
}

export interface OverloadProtectionState {
  mode: "auto" | "on" | "off";
  ramThresholdPct: number;
  cooldownUntil: string | null;
  message: string;
  isTriggered: boolean;
  remainingMinutes: number;
  memory: SystemMemoryStatus;
}

// ── 30-second in-memory cache for DB settings ──
let cachedDbSettings: {
  mode: "auto" | "on" | "off";
  ramThresholdPct: number;
  cooldownUntil: string | null;
  message: string;
  fetchedAt: number;
} | null = null;
const OVERLOAD_CACHE_TTL_MS = 30_000;

export function invalidateOverloadCache() {
  cachedDbSettings = null;
}

export async function getOverloadProtectionState(): Promise<OverloadProtectionState> {
  const memory = getSystemMemoryStatus();

  let mode: "auto" | "on" | "off" = "auto";
  let ramThresholdPct = 85;
  let cooldownUntil: string | null = null;
  let message = DEFAULT_OVERLOAD_MESSAGE;

  const now = Date.now();
  if (cachedDbSettings && now - cachedDbSettings.fetchedAt < OVERLOAD_CACHE_TTL_MS) {
    mode = cachedDbSettings.mode;
    ramThresholdPct = cachedDbSettings.ramThresholdPct;
    cooldownUntil = cachedDbSettings.cooldownUntil;
    message = cachedDbSettings.message;
  } else {
    try {
      const rows = await prisma.appSetting.findMany({
        where: {
          key: {
            in: [
              OVERLOAD_MODE_KEY,
              OVERLOAD_RAM_THRESHOLD_KEY,
              OVERLOAD_COOLDOWN_UNTIL_KEY,
              OVERLOAD_MSG_KEY,
            ],
          },
        },
      });

      const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));

      const modeVal = map.get(OVERLOAD_MODE_KEY);
      if (modeVal === "on" || modeVal === "off" || modeVal === "auto") {
        mode = modeVal;
      }

      const threshVal = parseInt(map.get(OVERLOAD_RAM_THRESHOLD_KEY) || "", 10);
      if (Number.isFinite(threshVal) && threshVal >= 50 && threshVal <= 98) {
        ramThresholdPct = threshVal;
      }

      const cdVal = map.get(OVERLOAD_COOLDOWN_UNTIL_KEY);
      if (cdVal && cdVal !== "0") {
        cooldownUntil = cdVal;
      }

      const msgVal = map.get(OVERLOAD_MSG_KEY);
      if (msgVal && msgVal.trim()) {
        message = msgVal.trim();
      }

      cachedDbSettings = {
        mode,
        ramThresholdPct,
        cooldownUntil,
        message,
        fetchedAt: now,
      };
    } catch {
      // Fail open if database query fails
    }
  }

  // Calculate if cooldown timer is currently active
  let isCooldownActive = false;
  let remainingMinutes = 0;

  if (cooldownUntil) {
    const untilMs = new Date(cooldownUntil).getTime();
    const nowMs = Date.now();
    if (untilMs > nowMs) {
      isCooldownActive = true;
      remainingMinutes = Math.ceil((untilMs - nowMs) / (1000 * 60));
    }
  }

  // Evaluate final protection trigger state
  let isTriggered = false;

  if (mode === "on") {
    isTriggered = true;
  } else if (mode === "off") {
    isTriggered = false;
  } else {
    // Mode is "auto"
    if (isCooldownActive) {
      isTriggered = true;
    } else if (memory.usedMemPct >= ramThresholdPct) {
      // Auto-trigger 15-minute cooldown lock when RAM hits threshold!
      isTriggered = true;
      const autoUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      remainingMinutes = 15;
      void setOverloadCooldownTime(autoUntil);
    }
  }

  return {
    mode,
    ramThresholdPct,
    cooldownUntil,
    message,
    isTriggered,
    remainingMinutes,
    memory,
  };
}

export async function setOverloadMode(mode: "auto" | "on" | "off"): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: OVERLOAD_MODE_KEY },
    update: { value: mode },
    create: { key: OVERLOAD_MODE_KEY, value: mode },
  });
  invalidateOverloadCache();
}

export async function setOverloadRamThreshold(pct: number): Promise<void> {
  const clamped = Math.min(98, Math.max(50, Math.floor(pct)));
  await prisma.appSetting.upsert({
    where: { key: OVERLOAD_RAM_THRESHOLD_KEY },
    update: { value: String(clamped) },
    create: { key: OVERLOAD_RAM_THRESHOLD_KEY, value: String(clamped) },
  });
  invalidateOverloadCache();
}

export async function setOverloadCooldownTime(isoUntil: string | null): Promise<void> {
  const val = isoUntil ?? "0";
  await prisma.appSetting.upsert({
    where: { key: OVERLOAD_COOLDOWN_UNTIL_KEY },
    update: { value: val },
    create: { key: OVERLOAD_COOLDOWN_UNTIL_KEY, value: val },
  });
  invalidateOverloadCache();
}

export async function addOverloadCooldownMinutes(additionalMinutes: number): Promise<string> {
  const state = await getOverloadProtectionState();
  let baseTimeMs = Date.now();
  if (state.cooldownUntil && new Date(state.cooldownUntil).getTime() > Date.now()) {
    baseTimeMs = new Date(state.cooldownUntil).getTime();
  }
  const newUntil = new Date(baseTimeMs + additionalMinutes * 60 * 1000).toISOString();
  await setOverloadCooldownTime(newUntil);
  return newUntil;
}

export async function setOverloadMessage(msg: string): Promise<string> {
  const value = (msg ?? "").trim().slice(0, 300);
  await prisma.appSetting.upsert({
    where: { key: OVERLOAD_MSG_KEY },
    update: { value },
    create: { key: OVERLOAD_MSG_KEY, value },
  });
  return value;
}
