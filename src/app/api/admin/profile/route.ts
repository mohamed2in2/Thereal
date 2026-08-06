import { logAdminAction } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify, isValidSlug } from "@/lib/slug";

async function uniqueSlug(name: string, teacherId: string): Promise<string> {
  let base = slugify(name);
  if (!isValidSlug(base)) base = "teacher";
  let candidate = base;
  let n = 2;
  // Find a free slug (ignore the teacher's own row).
  while (true) {
    const taken = await prisma.teacherProfile.findFirst({
      where: { slug: candidate, NOT: { teacherId } },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${base}-${n++}`;
  }
}

const EDITABLE = ["displayName", "bio", "photoUrl", "bannerUrl", "navColor", "accentColor", "socials", "featuredCourseId", "priceMonthly", "priceTermly", "priceYearly", "discountMonthly", "discountTermly", "discountYearly", "courseStartDate", "bookingContactUrl", "priceLanguagesMonthly", "paymentNotes"] as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    let profile = await prisma.teacherProfile.findUnique({ where: { teacherId: session.id } });
    if (!profile) {
      profile = await prisma.teacherProfile.create({
        data: { teacherId: session.id, slug: await uniqueSlug(session.name, session.id), displayName: session.name },
      });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();

    if (session && session.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: session.id,
          adminName: session.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    for (const k of EDITABLE) {
      if (k in body) data[k] = body[k];
    }
    if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;

    if (typeof body.slug === "string" && body.slug.trim()) {
      const s = slugify(body.slug);
      if (!isValidSlug(s)) {
        return NextResponse.json({ error: "الرابط غير صالح أو محجوز" }, { status: 400 });
      }
      const taken = await prisma.teacherProfile.findFirst({
        where: { slug: s, NOT: { teacherId: session.id } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "الرابط مستخدم بالفعل" }, { status: 409 });
      data.slug = s;
    }

    // Ensure a row exists (create-on-write).
    const existing = await prisma.teacherProfile.findUnique({ where: { teacherId: session.id } });
    const profile = existing
      ? await prisma.teacherProfile.update({ where: { teacherId: session.id }, data })
      : await prisma.teacherProfile.create({
          data: { teacherId: session.id, slug: (data.slug as string) || (await uniqueSlug(session.name, session.id)), ...data },
        });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: "حدث خطأ داخلي" }, { status: 500 });
  }
}
