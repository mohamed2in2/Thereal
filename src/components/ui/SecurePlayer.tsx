"use client";

import React, { useState, useRef, useEffect } from "react";
import { VideoWatermark } from "./VideoWatermark";
import { YouTubeSecurePlayer } from "./YouTubeSecurePlayer";
import { DrmPlayer } from "./DrmPlayer";
import { useFullscreen } from "./useFullscreen";
import { extractYouTubeVideoId } from "@/lib/youtube";

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  if (url.includes("gdrive_")) {
    const parts = url.split("gdrive_")[1];
    return parts?.split("?")[0]?.split("/")[0] || null;
  }
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

interface VdoPlayerInstance {
  video?: HTMLVideoElement;
  seek?: (seconds: number) => void;
  pause?: () => void;
  play?: () => void;
}

declare global {
  interface Window {
    VdoPlayer?: new (options: { iframe: HTMLIFrameElement }) => VdoPlayerInstance;
  }
}

interface CommonEmbedProps {
  embedUrl: string;
  title: string;
  watermark: string;
  startSeconds?: number;
  onEnded?: () => void;
  onProgress?: (seconds: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  paused?: boolean;
}

/**
 * VdoCipher & Bunny Iframe Secure Embed.
 * Handles SDK / postMessage synchronization and iframe lifecycle without hook order issues.
 */
function IframeSecureEmbed({
  embedUrl,
  title,
  provider,
  startSeconds = 0,
  onProgress,
  onPause,
  onPlay,
  paused = false,
}: CommonEmbedProps & { provider?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const vdoPlayerRef = useRef<VdoPlayerInstance | null>(null);

  // Resume playback for Bunny & VdoCipher
  useEffect(() => {
    if (provider === "bunny") {
      const handleMessage = (e: MessageEvent) => {
        try {
          const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          if (data?.event === "ready" && startSeconds > 0) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ method: "seek", value: startSeconds }),
              "*"
            );
          }
          if (data?.event === "timeupdate" && typeof data.time === "number") {
            onProgress?.(data.time);
          }
          if (data?.event === "pause") {
            onPause?.();
          }
          if (data?.event === "play" || data?.event === "playing") {
            onPlay?.();
          }
        } catch {
          // ignore parse errors
        }
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }

    if (provider === "vdocipher") {
      const script = document.createElement("script");
      script.src = "https://player.vdocipher.com/v2/api.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (iframeRef.current && window.VdoPlayer) {
          const player = new window.VdoPlayer({ iframe: iframeRef.current });
          vdoPlayerRef.current = player;

          player.video?.addEventListener("loadedmetadata", () => {
            if (startSeconds > 0) {
              if (typeof player.seek === "function") {
                player.seek(startSeconds);
              } else if (player.video) {
                player.video.currentTime = startSeconds;
              }
            }
          });

          player.video?.addEventListener("timeupdate", () => {
            if (player.video?.currentTime) {
              onProgress?.(player.video.currentTime);
            }
          });

          player.video?.addEventListener("pause", () => {
            onPause?.();
          });

          player.video?.addEventListener("play", () => {
            onPlay?.();
          });
        }
      };

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
        vdoPlayerRef.current = null;
      };
    }
  }, [provider, startSeconds, onProgress, onPause, onPlay]);

  // Handle paused prop changes
  useEffect(() => {
    if (provider === "bunny" && iframeRef.current) {
      const method = paused ? "pause" : "play";
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({ method }), "*");
    } else if (provider === "vdocipher" && vdoPlayerRef.current) {
      try {
        if (paused) {
          if (typeof vdoPlayerRef.current.pause === "function") {
            vdoPlayerRef.current.pause();
          } else {
            vdoPlayerRef.current.video?.pause();
          }
        } else {
          if (typeof vdoPlayerRef.current.play === "function") {
            vdoPlayerRef.current.play();
          } else {
            vdoPlayerRef.current.video?.play();
          }
        }
      } catch (e) {
        console.error("Failed to play/pause VdoCipher player:", e);
      }
    }
  }, [paused, provider]);

  return (
    <iframe
      ref={iframeRef}
      src={embedUrl}
      title={title}
      className="absolute inset-0 w-full h-full"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin"
      style={{ border: "none" }}
      draggable={false}
    />
  );
}

/**
 * Direct Video Player (MP4 / WebM / local streaming endpoint).
 */
function DirectVideoEmbed({
  embedUrl,
  onPlay,
  onPause,
  onEnded,
  onProgress,
  onError,
}: {
  embedUrl: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onProgress?: (seconds: number) => void;
  onError?: () => void;
}) {
  return (
    <video
      src={embedUrl}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      playsInline
      className="absolute inset-0 w-full h-full object-contain"
      onPlay={() => onPlay?.()}
      onPause={() => onPause?.()}
      onEnded={() => onEnded?.()}
      onError={onError}
      onTimeUpdate={(e) => onProgress?.((e.target as HTMLVideoElement).currentTime)}
    />
  );
}

export interface SecurePlayerProps {
  embedUrl: string;
  title: string;
  watermark: string;
  provider?: string;
  drm?: {
    token?: string;
    licenseServers?: {
      widevine?: string;
      playready?: string;
      fairplay?: string;
      fairplayCertUrl?: string;
    };
    clearKeys?: Record<string, string>;
  } | null;
  onEnded?: () => void;
  startSeconds?: number;
  onProgress?: (seconds: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  className?: string;
  paused?: boolean;
  noNativeSecurity?: boolean;
  children?: React.ReactNode;
}

/**
 * SecurePlayer — Top-level dispatcher for all protected video streams.
 * Handles fullscreen wrapper, anti-screenshot security events, and forensic watermarking.
 */
export function SecurePlayer({
  embedUrl,
  title,
  watermark,
  provider,
  drm,
  onEnded,
  startSeconds = 0,
  onProgress,
  onPause,
  onPlay,
  className = "",
  paused = false,
  noNativeSecurity = false,
  children,
}: SecurePlayerProps) {
  const driveFileId = extractDriveFileId(embedUrl);
  const [useDriveDirect, setUseDriveDirect] = useState(noNativeSecurity);
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const { ref: wrapRef, isFs, cssFs, toggle: toggleFs } = useFullscreen<HTMLDivElement>();

  // Visibility and security guards
  useEffect(() => {
    if (noNativeSecurity || useDriveDirect) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      const lowerK = k.toLowerCase();
      const isPrtScn = k === "PrintScreen" || e.code === "PrintScreen";
      const isMeta =
        e.metaKey ||
        (typeof e.getModifierState === "function" &&
          (e.getModifierState("Meta") || e.getModifierState("OS")));

      const isWinSnipping = isMeta && e.shiftKey && lowerK === "s";
      const isWinGameBar = isMeta && lowerK === "g";
      const isMacScreenshot = isMeta && e.shiftKey && ["3", "4", "5", "#", "$", "%"].includes(k);
      const isBrowserScreenshot = e.ctrlKey && e.shiftKey && lowerK === "s";
      const isDevTools =
        k === "F12" ||
        (e.ctrlKey && e.shiftKey && (lowerK === "i" || lowerK === "j" || lowerK === "c")) ||
        (e.ctrlKey && lowerK === "u");

      if (isPrtScn || isWinSnipping || isWinGameBar || isMacScreenshot || isBrowserScreenshot || isDevTools) {
        if (isPrtScn || isWinSnipping || isMacScreenshot) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    const handleVisibilityChange = () => {
      setIsBlackoutActive(document.hidden);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [noNativeSecurity, useDriveDirect]);

  // 1. Axinom Hardware Multi-DRM Player
  if (provider === "axinom") {
    return (
      <DrmPlayer
        manifestUrl={embedUrl}
        drmToken={drm?.token}
        licenseServers={drm?.licenseServers}
        clearKeys={drm?.clearKeys}
        initialPosition={startSeconds}
        watermark={watermark}
        title={title}
        onTimeUpdate={onProgress}
        onEnded={onEnded}
        onPause={onPause}
        onPlay={onPlay}
        paused={paused}
      />
    );
  }

  // 2. YouTube Hardened Embed
  if (provider === "youtube") {
    const id = extractYouTubeVideoId(embedUrl) || embedUrl.match(/\/embed\/([^?/]+)/)?.[1] || "";
    if (id) {
      return (
        <YouTubeSecurePlayer
          videoId={id}
          title={title}
          watermark={watermark}
          onEnded={onEnded}
          startSeconds={startSeconds}
          onProgress={onProgress}
          onPause={onPause}
          onPlay={onPlay}
          paused={paused}
        >
          {children}
        </YouTubeSecurePlayer>
      );
    }
  }

  const isDirectVideo =
    embedUrl.startsWith("/api/") ||
    embedUrl.includes(".mp4") ||
    embedUrl.includes(".webm") ||
    embedUrl.includes(".mov");

  return (
    <div
      ref={wrapRef}
      className={`relative bg-black w-full select-none ${className}`}
      style={
        cssFs
          ? { position: "fixed", inset: 0, width: "100vw", height: "100dvh", zIndex: 2147483647 }
          : isFs
          ? { height: "100%" }
          : { paddingTop: "56.25%" }
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Video / Iframe Surface ── */}
      {driveFileId && useDriveDirect ? (
        <iframe
          src={`https://drive.google.com/file/d/${driveFileId}/preview`}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : isDirectVideo ? (
        <DirectVideoEmbed
          embedUrl={embedUrl}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onProgress={onProgress}
          onError={() => {
            if (driveFileId) {
              setUseDriveDirect(true);
            }
          }}
        />
      ) : (
        <IframeSecureEmbed
          embedUrl={embedUrl}
          title={title}
          provider={provider}
          startSeconds={startSeconds}
          onProgress={onProgress}
          onPause={onPause}
          onPlay={onPlay}
          paused={paused}
          watermark={watermark}
        />
      )}

      {/* ── Active Anti-Screenshot / Blur Blackout Barrier (Sibling overlay) ── */}
      {isBlackoutActive && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3 select-none pointer-events-auto">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 animate-pulse text-xl">
            🛡️
          </div>
          <p className="text-sm font-bold text-white tracking-wide">تم تعتيم الشاشة لحماية المحتوى</p>
          <p className="text-xs text-slate-400 font-mono">Screen Capture Protected</p>
        </div>
      )}

      {/* ── Unified Forensic Watermark ── */}
      <VideoWatermark label={watermark} />

      {/* Interactive overlays & modals */}
      {children}

      {/* ── Fullscreen Toggle Button ── */}
      <button
        type="button"
        onClick={toggleFs}
        aria-label={isFs ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
        className="absolute bottom-2.5 right-2.5 z-20 w-10 h-10 rounded-lg bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
      >
        {isFs ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default SecurePlayer;
