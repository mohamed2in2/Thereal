import { NextResponse } from "next/server";
import { getSiteText } from "@/lib/site-text";

/** Public: the live site copy (defaults + superadmin overrides). */
export async function GET() {
  const text = await getSiteText();
  return NextResponse.json(
    { text },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } }
  );
}
