"use client";
import React from "react";
import { useState, useCallback } from "react";


import { VideoWatermark } from "./VideoWatermark";
import { YouTubeSecurePlayer } from "./YouTubeSecurePlayer";
import { useFullscreen } from "./useFullscreen";

/**
 * Watermark-safe player. The iframe is a cross-origin embed (Bunny/VdoCipher) —
 * a DOM overlay can't be injected into the iframe's OWN native fullscreen, so a
 * sibling watermark vanishes when it goes fullscreen. Fix: the iframe carries no
 * fullscreen permission (its internal FS button is inert) and our own button
 * fullscreens THIS WRAPPER, which contains the watermark.
 *
 * For YouTube we delegate to YouTubeSecurePlayer — native controls off + a full
 * click-shield so the brand/title/link is never clickable.
 */
export function SecurePlayer({
  embedUrl,
  title,
  watermark,
  provider,
  onEnded,
  startSeconds = 0,
  onProgress,
  onPause,
  onPlay,
  className = "",
  paused = false,
  children,
}: {
  embedUrl: string;
  title: string;
  watermark: string;
  provider?: string;
  onEnded?: () => void;
  /** Resume position in seconds. Currently honored on YouTube (the only provider
   *  whose cross-origin embed exposes seek/currentTime safely; signed
   *  Bunny/VdoCipher URLs must not be mutated with extra params). */
  startSeconds?: number;
  /** Reports current position (throttled) for saving. YouTube only — see above. */
  onProgress?: (seconds: number) => void;
  /** Fired when playback pauses. */
  onPause?: () => void;
  /** Fired when playback resumes. */
  onPlay?: () => void;
  className?: string;
  paused?: boolean;
  children?: React.ReactNode;
}) {
  const { ref: wrapRef, isFs, cssFs, toggle: toggleFs } = useFullscreen<HTMLDivElement>();



  // YouTube → hardened API player (no clickable YouTube chrome).
  if (provider === "youtube") {
    const id = embedUrl.match(/\/embed\/([^?/]+)/)?.[1] ?? "";
    if (id)
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

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const vdoPlayerRef = React.useRef<any>(null);

  // Resume playback for Bunny & VdoCipher
  React.useEffect(() => {
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
        if (iframeRef.current && (window as any).VdoPlayer) {
          const player = new (window as any).VdoPlayer({ iframe: iframeRef.current });
          vdoPlayerRef.current = player;
          
          player.video.addEventListener("loadedmetadata", () => {
            if (startSeconds > 0) {
               // The API wrapper or standard HTMLMediaElement behavior
               if (typeof player.seek === "function") {
                 player.seek(startSeconds);
               } else {
                 player.video.currentTime = startSeconds;
               }
            }
          });

          player.video.addEventListener("timeupdate", () => {
            if (player.video.currentTime) {
              onProgress?.(player.video.currentTime);
            }
          });

          player.video.addEventListener("pause", () => {
            onPause?.();
          });

          player.video.addEventListener("play", () => {
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

  // Handle paused prop changes for Bunny & VdoCipher
  React.useEffect(() => {
    if (provider === "bunny" && iframeRef.current) {
      const method = paused ? "pause" : "play";
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ method }),
        "*"
      );
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

  const isDirectVideo = embedUrl.startsWith("/api/") || embedUrl.includes(".mp4") || embedUrl.includes(".webm") || embedUrl.includes(".mov");

  const [screenCaptured, setScreenCaptured] = useState(false);

  // PC Anti-Screenshot & Anti-Screen-Recording Protection Engine
  React.useEffect(() => {
    const triggerBlackout = () => {
      setScreenCaptured(true);
      if (typeof onPause === "function") {
        onPause();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      const lowerK = k.toLowerCase();

      // PrintScreen (PrtScn) / Alt+PrtScn / Win+PrtScn
      const isPrtScn = k === "PrintScreen" || e.code === "PrintScreen";
      
      const isMeta = e.metaKey || (typeof e.getModifierState === "function" && (e.getModifierState("Meta") || e.getModifierState("OS")));

      // Windows Snipping Tool (Win + Shift + S) or Xbox Game Bar (Win + G)
      const isWinSnipping = isMeta && e.shiftKey && (lowerK === "s");
      const isWinGameBar = isMeta && (lowerK === "g");

      // Mac Screenshot Shortcuts: Cmd + Shift + 3, Cmd + Shift + 4, Cmd + Shift + 5
      const isMacScreenshot = isMeta && e.shiftKey && ["3", "4", "5", "#", "$", "%"].includes(k);

      // Browser Screenshot (Ctrl + Shift + S)
      const isBrowserScreenshot = e.ctrlKey && e.shiftKey && lowerK === "s";

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
      const isDevTools =
        k === "F12" ||
        (e.ctrlKey && e.shiftKey && (lowerK === "i" || lowerK === "j" || lowerK === "c")) ||
        (e.ctrlKey && lowerK === "u");

      if (isPrtScn || isWinSnipping || isWinGameBar || isMacScreenshot || isBrowserScreenshot || isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout();

        // Clear clipboard if screenshot attempted
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        triggerBlackout();
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    const handleBlur = () => {
      // Blackout when user clicks outside, opens Snipping Tool overlay, or switches apps/tabs
      triggerBlackout();
    };

    const handleFocus = () => {
      setScreenCaptured(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerBlackout();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onPause]);

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
      {/* Screen capture / loss-of-focus protection black screen overlay */}
      {screenCaptured && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center text-white backdrop-blur-3xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-base font-bold mb-1 text-white">🔒 محتوى محمي ضد تسجيل والتقاط الشاشة</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            تم إيقاف عرض الفيديو مؤقتاً لحماية حقوق النشر والملكية الفكرية. يُرجى العودة للنافذة لمتابعة المشاهدة.
          </p>
        </div>
      )}
      {isDirectVideo ? (
        <video
          src={embedUrl}
          controls
          controlsList="nodownload noplaybackrate"
          className="absolute inset-0 w-full h-full object-contain"
          onContextMenu={(e) => e.preventDefault()}
          onPlay={() => onPlay?.()}
          onPause={() => onPause?.()}
          onEnded={() => onEnded?.()}
          onTimeUpdate={(e) => onProgress?.((e.target as HTMLVideoElement).currentTime)}
        />
      ) : (
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
      )}

      <VideoWatermark label={watermark} />

      {/* Interactive overlays & modals */}
      {children}

      {/* Our fullscreen control sits at the bottom-RIGHT, directly over the
          VdoCipher/Bunny iframe's own (inert — no allowfullscreen) fullscreen
          button. Being a higher-stacked sibling (z-20) it captures the click
          there, so the spot users instinctively tap triggers OUR wrapper
          fullscreen — which keeps the watermark on screen. */}
      <button
        type="button"
        onClick={toggleFs}
        aria-label={isFs ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
        className="absolute bottom-2.5 right-2.5 z-20 w-10 h-10 rounded-lg bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
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
