import { NextRequest, NextResponse } from "next/server";
import { verifyAuthoritativePrice } from "@/lib/price-verifier";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amount = parseFloat(searchParams.get("amount") || "0");
    const teacherId = searchParams.get("teacherId");
    const planType = searchParams.get("planType");
    const grade = searchParams.get("grade");
    const languageTrack = searchParams.get("languageTrack");
    const courseId = searchParams.get("courseId");
    const folderId = searchParams.get("folderId");
    const planId = searchParams.get("planId");

    const result = await verifyAuthoritativePrice({
      amount: amount > 0 ? amount : 999999, // compute expected
      teacherId,
      planType,
      grade,
      languageTrack,
      courseId,
      folderId,
      planId,
    });

    return NextResponse.json({
      expectedPrice: result.expectedPrice,
      itemName: result.itemName,
      valid: result.valid,
    });
  } catch (error) {
    console.error("Quote API error:", error);
    return NextResponse.json({ error: "فشل استعلام السعر المعتمد" }, { status: 500 });
  }
}
