import { prisma } from "@/lib/prisma";

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  note?: string;
  addedBy: string;
  createdAt: string;
}

export async function getExpensesFromDb(): Promise<ExpenseItem[]> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "platform_expenses" },
    });
    if (!setting || !setting.value) return [];
    return JSON.parse(setting.value) as ExpenseItem[];
  } catch {
    return [];
  }
}

export async function saveExpensesToDb(expenses: ExpenseItem[]): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "platform_expenses" },
    update: { value: JSON.stringify(expenses) },
    create: { key: "platform_expenses", value: JSON.stringify(expenses) },
  });
}

export async function getTeacherPercentagesFromDb(): Promise<{ defaultPct: number; custom: Record<string, number> }> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "teacher_platform_percentages" },
    });
    if (!setting || !setting.value) return { defaultPct: 25, custom: {} };
    const parsed = JSON.parse(setting.value);
    return {
      defaultPct: typeof parsed.defaultPct === "number" ? parsed.defaultPct : 25,
      custom: parsed.custom || {},
    };
  } catch {
    return { defaultPct: 25, custom: {} };
  }
}

export async function saveTeacherPercentagesToDb(data: { defaultPct: number; custom: Record<string, number> }): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "teacher_platform_percentages" },
    update: { value: JSON.stringify(data) },
    create: { key: "teacher_platform_percentages", value: JSON.stringify(data) },
  });
}
