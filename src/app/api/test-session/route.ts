import { NextResponse } from "next/server";
import { signToken, verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const secretExists = !!process.env.JWT_SECRET;
  const secretLength = process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0;
  
  try {
    // 1. Test signing
    const testPayload = { id: "test-id", name: "Test User", role: "superadmin", email: "test@example.com" };
    const token = await signToken(testPayload);
    
    // 2. Test verifying
    const verified = await verifyToken(token);
    
    // 3. Test cookie reading
    const cookieStore = await cookies();
    const currentCookie = cookieStore.get("auth_token")?.value;
    
    return NextResponse.json({
      success: true,
      env: {
        secretExists,
        secretLength,
        nodeEnv: process.env.NODE_ENV
      },
      tokenVerification: {
        matches: verified ? verified.id === testPayload.id : false,
        verifiedPayload: verified
      },
      cookies: {
        authTokenCookiePresent: !!currentCookie,
        authTokenLength: currentCookie ? currentCookie.length : 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || String(error)
    });
  }
}
