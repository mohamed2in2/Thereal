import { NextRequest, NextResponse } from "next/server";
import { verifyAlaslyWebhookSignature } from "@/lib/alasly";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-alasly-signature") ||
      req.headers.get("X-Alasly-Signature") ||
      req.headers.get("x-signature");

    const isValid = verifyAlaslyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[Alasly Webhook] Unauthorized request with invalid signature.");
      return NextResponse.json({ error: "توقيع غير صالح" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { event, videoId, assetId, status, duration } = payload;

    if (event === "video.ready" && (videoId || assetId)) {
      const matchCriteria = [];
      if (videoId) {
        matchCriteria.push({ providerVideoId: videoId }, { vdoCipherId: videoId });
      }
      if (assetId) {
        matchCriteria.push({ providerVideoId: assetId }, { vdoCipherId: assetId });
      }

      const videos = await prisma.video.findMany({
        where: {
          videoProvider: "alasly",
          OR: matchCriteria,
        },
      });

      if (videos.length > 0 && typeof duration === "number" && duration > 0) {
        const durationMinutes = Math.max(1, Math.round(duration / 60));
        await prisma.video.updateMany({
          where: {
            id: { in: videos.map((v) => v.id) },
          },
          data: {
            durationMinutes,
          },
        });
      }
    }

    return NextResponse.json({
      received: true,
      event: event || "processed",
      status: "ok",
    });
  } catch (error: any) {
    console.error("[Alasly Webhook Error]:", error);
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 }
    );
  }
}
