import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS } from "@/lib/slug";

// Prisma needs the Node runtime (not edge).
export const runtime = "nodejs";
export const alt = "Code-UP — صفحة المعلم";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cairo (Arabic-capable) bundled as woff in /public/fonts — no runtime network,
// and a real font Satori can parse (Google's css2 only serves woff2/EOT, which
// Satori can't read).
async function loadCairo(weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "fonts", `cairo-${weight}.woff`));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

const isSafe = (s?: string | null) => !!s && (/^https?:\/\//i.test(s) || s.startsWith("data:image/"));

export default async function OgImage({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;

  const profile = RESERVED_SLUGS.has(teacherSlug.toLowerCase())
    ? null
    : await prisma.teacherProfile.findFirst({
        where: { slug: teacherSlug, isPublished: true },
        include: { teacher: { select: { name: true, _count: { select: { courses: true } } } } },
      });

  const name = profile?.displayName ?? profile?.teacher.name ?? "Code-UP";
  const bio = profile?.bio ?? "منصة كورسات الثانوية العامة";
  const accent = profile?.accentColor ?? "#6366f1";
  const photo = isSafe(profile?.photoUrl) ? profile!.photoUrl! : null;

  const [bold, regular] = await Promise.all([loadCairo(700), loadCairo(400)]);
  const fonts = [
    ...(bold ? [{ name: "Cairo", data: bold, weight: 700 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Cairo", data: regular, weight: 400 as const, style: "normal" as const }] : []),
  ];
  const hasFont = fonts.length > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "row-reverse",
          alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b0f19 0%, #131a2c 100%)",
          padding: "70px 80px", direction: "rtl",
        }}
      >
        {/* Text block */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: photo ? 660 : 1040 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, fontWeight: 800 }}>C</div>
            <span style={{ color: "#93c5fd", fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>Code-UP</span>
          </div>
          {hasFont && (
            <div style={{ color: "#f8fafc", fontSize: 64, fontWeight: 800, lineHeight: 1.15, fontFamily: "Cairo" }}>{name}</div>
          )}
          {hasFont && (
            <div style={{ color: "#94a3b8", fontSize: 30, marginTop: 20, lineHeight: 1.5, fontFamily: "Cairo", maxWidth: 640 }}>
              {bio.length > 90 ? bio.slice(0, 90) + "…" : bio}
            </div>
          )}
          <div style={{ marginTop: 34, display: "flex" }}>
            <div style={{ background: accent, color: "#fff", padding: "12px 26px", borderRadius: 14, fontSize: 24, fontWeight: 800, fontFamily: hasFont ? "Cairo" : undefined }}>
              {hasFont ? "شاهد الكورسات" : "View courses"}
            </div>
          </div>
        </div>

        {/* Photo */}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={320} height={320} style={{ width: 320, height: 320, borderRadius: "50%", objectFit: "cover", border: `8px solid ${accent}` }} />
        )}
      </div>
    ),
    { ...size, ...(hasFont ? { fonts } : {}) },
  );
}
