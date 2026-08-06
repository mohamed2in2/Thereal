import { prisma } from "./prisma";

/** Platform-wide key/value settings (superadmin-editable). */

const TEACHER_GRACE_KEY = "teacher_delete_grace_days";
export const DEFAULT_TEACHER_GRACE_DAYS = 7;
export const MIN_GRACE_DAYS = 1;
export const MAX_GRACE_DAYS = 365;

export async function getTeacherGraceDays(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: TEACHER_GRACE_KEY } });
    const n = row ? parseInt(row.value, 10) : NaN;
    if (Number.isFinite(n) && n >= MIN_GRACE_DAYS && n <= MAX_GRACE_DAYS) return n;
  } catch { /* table missing / db error → fall back */ }
  return DEFAULT_TEACHER_GRACE_DAYS;
}

export async function setTeacherGraceDays(days: number): Promise<number> {
  const clamped = Math.min(MAX_GRACE_DAYS, Math.max(MIN_GRACE_DAYS, Math.floor(days)));
  await prisma.appSetting.upsert({
    where: { key: TEACHER_GRACE_KEY },
    update: { value: String(clamped) },
    create: { key: TEACHER_GRACE_KEY, value: String(clamped) },
  });
  return clamped;
}

// ── Student device limit (account ↔ devices) ──────────────────────────────────
const STUDENT_MAX_DEVICES_KEY = "student_max_devices";
export const DEFAULT_STUDENT_MAX_DEVICES = 4;
export const MIN_DEVICES = 1;
export const MAX_DEVICES = 10;

export async function getStudentMaxDevices(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: STUDENT_MAX_DEVICES_KEY } });
    const n = row ? parseInt(row.value, 10) : NaN;
    if (Number.isFinite(n) && n >= MIN_DEVICES && n <= MAX_DEVICES) return n;
  } catch { /* fall back */ }
  return DEFAULT_STUDENT_MAX_DEVICES;
}

export async function setStudentMaxDevices(n: number): Promise<number> {
  const clamped = Math.min(MAX_DEVICES, Math.max(MIN_DEVICES, Math.floor(n)));
  await prisma.appSetting.upsert({
    where: { key: STUDENT_MAX_DEVICES_KEY },
    update: { value: String(clamped) },
    create: { key: STUDENT_MAX_DEVICES_KEY, value: String(clamped) },
  });
  return clamped;
}

// ── Maintenance mode (public site frozen behind a friendly screen) ────────────
const MAINTENANCE_KEY = "maintenance_mode";
const MAINTENANCE_MSG_KEY = "maintenance_message";
export const DEFAULT_MAINTENANCE_MESSAGE =
  "نُحضّر لكم تحديثاً جديداً ومميّزاً ✨ سنعود إليكم بعد قليل بحُلّة أفضل.";

export async function getMaintenanceMode(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: MAINTENANCE_KEY } });
    return row?.value === "on";
  } catch {
    return false;
  }
}

export async function setMaintenanceMode(on: boolean): Promise<boolean> {
  await prisma.appSetting.upsert({
    where: { key: MAINTENANCE_KEY },
    update: { value: on ? "on" : "off" },
    create: { key: MAINTENANCE_KEY, value: on ? "on" : "off" },
  });
  return on;
}

export async function getMaintenanceMessage(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: MAINTENANCE_MSG_KEY } });
    return row?.value?.trim() || DEFAULT_MAINTENANCE_MESSAGE;
  } catch {
    return DEFAULT_MAINTENANCE_MESSAGE;
  }
}

export async function setMaintenanceMessage(msg: string): Promise<string> {
  const value = (msg ?? "").trim().slice(0, 280);
  await prisma.appSetting.upsert({
    where: { key: MAINTENANCE_MSG_KEY },
    update: { value },
    create: { key: MAINTENANCE_MSG_KEY, value },
  });
  return value;
}
