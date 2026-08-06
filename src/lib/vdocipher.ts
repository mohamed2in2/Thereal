/**
 * VdoCipher API integration for secure video playback.
 */

const VDOCIPHER_API_SECRET = process.env.VDOCIPHER_API_SECRET || "";

export interface VdoCipherOtpResponse {
  otp: string;
  playbackInfo: string;
  embedUrl: string;
}

export async function getVdoCipherOtp(vdoCipherId: string): Promise<VdoCipherOtpResponse> {
  // Testable API fallback if no secret is provided or secret is "test"
  if (!VDOCIPHER_API_SECRET || VDOCIPHER_API_SECRET === "test") {
    console.warn(`[VdoCipher] Using mock OTP for video ${vdoCipherId} because VDOCIPHER_API_SECRET is missing or set to 'test'`);
    
    // Return dummy tokens. The VdoCipher player will load but show "Invalid OTP" 
    // which proves the iframe integration works correctly.
    const mockOtp = "mock-otp-12345";
    const mockPlaybackInfo = "mock-playback-info-12345";
    
    return {
      otp: mockOtp,
      playbackInfo: mockPlaybackInfo,
      embedUrl: `https://player.vdocipher.com/v2/?otp=${mockOtp}&playbackInfo=${mockPlaybackInfo}`
    };
  }

  try {
    const response = await fetch(`https://dev.vdocipher.com/api/videos/${vdoCipherId}/otp`, {
      method: "POST",
      headers: {
        "Authorization": `Apisecret ${VDOCIPHER_API_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ttl: 3600 // 1 hour token expiration
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VdoCipher API Error] ${response.status}: ${errorText}`);
      throw new Error(`VdoCipher API Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      otp: data.otp,
      playbackInfo: data.playbackInfo,
      embedUrl: `https://player.vdocipher.com/v2/?otp=${data.otp}&playbackInfo=${data.playbackInfo}`
    };
  } catch (error) {
    console.error("[VdoCipher] Failed to generate OTP:", error);
    throw error;
  }
}
