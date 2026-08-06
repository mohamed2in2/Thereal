import { NextResponse } from "next/server";

export async function GET() {

      try {
      const enabled = Boolean(process.env.AI_PRIMARY_API_KEY || process.env.AI_BACKUP_API_KEY);
      return NextResponse.json({ enabled });
    } catch (error) {
        console.error("[ai/status] error:", error);
        return NextResponse.json(
          { error: "حدث خطأ داخلي" },
          { status: 500 }
        );
      }
}
