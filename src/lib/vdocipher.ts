/**
 * VdoCipher API integration for secure video playback.
 * Supports multi-account dynamic OTP generation, custom player IDs, and dynamic watermark annotations.
 */

import { generateAccountOtp } from "./vdocipher-accounts";

const VDOCIPHER_API_SECRET = process.env.VDOCIPHER_API_SECRET || "";

export interface VdoCipherOtpResponse {
  otp: string;
  playbackInfo: string;
  embedUrl: string;
}

export interface GetVdoCipherOtpOptions {
  apiKey?: string;
  playerId?: string | null;
  userId?: string;
  watermarkText?: string;
  ttl?: number;
}

export async function getVdoCipherOtp(
  vdoCipherId: string,
  options?: GetVdoCipherOtpOptions
): Promise<VdoCipherOtpResponse> {
  const apiKey = options?.apiKey || VDOCIPHER_API_SECRET;
  const playerId = options?.playerId;
  const userId = options?.userId;
  const watermarkText = options?.watermarkText;
  const ttl = options?.ttl || Number(process.env.VDOCIPHER_OTP_TTL) || 120;

  return generateAccountOtp({
    apiKey,
    playerId,
    vdoCipherVideoId: vdoCipherId,
    userId,
    watermarkText,
    ttl,
  });
}
