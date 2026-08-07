"use client";

import { useEffect, useRef, useState } from "react";
import { VideoWatermark } from "./VideoWatermark";
import { useFullscreen } from "./useFullscreen";

/**
 * Hardened YouTube player. Native controls are OFF and a full-surface click
 * shield swallows every pointer event, so NONE of YouTube's chrome — the title,
 * logo, share, or "Watch on YouTube" link — is ever clickable. Playback is
 * driven entirely by our own controls through the IFrame API. Combined with the
 * drifting watermark and wrapper-only fullscreen, this is the strongest practical
 * deterrent for a YouTube embed (the video ID still lives in the DOM — only
 * VdoCipher/Bunny can hide that).
 */

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiLoading?: boolean;
  }
}

function loadYTApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!window.__ytApiLoading) {
      window.__ytApiLoading = true;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    // Safety poll in case the global callback was already consumed.
    const iv = setInterval(() => {
      if (window.YT?.Player) { clearInterval(iv); resolve(window.YT); }
    }, 200);
  });
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export function YouTubeSecurePlayer({
  videoId, title, watermark, onEnded, startSeconds = 0, onProgress, onTimeUpdate, onPause, onPlay, paused = false, children,
}: {
  videoId: string;
  title: string;
  watermark: string;
  onEnded?: () => void;
  /** Resume position in seconds — seeked once on ready. */
  startSeconds?: number;
  /** Reports the current position (throttled to ~5s) for saving. */
  onProgress?: (seconds: number) => void;
  /** High-frequency time updates (~333ms) for watched-ranges tracking. */
  onTimeUpdate?: (seconds: number) => void;
  /** Fired when playback pauses. */
  onPause?: () => void;
  /** Fired when playback resumes. */
  onPlay?: () => void;
  paused?: boolean;
  children?: React.ReactNode;
}) {
  const { ref: wrapRef, isFs, cssFs, toggle: toggleFs } = useFullscreen<HTMLDivElement>();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const startRef = useRef(startSeconds);
  startRef.current = startSeconds;
  const seekedRef = useRef(false);
  const lastReportRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  // Play/pause programmatic control
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    try {
      if (paused) {
        p.pauseVideo();
      } else {
        p.playVideo();
      }
    } catch (e) {
      console.error("Failed to play/pause YouTube player:", e);
    }
  }, [paused, ready]);

  useEffect(() => {
    let disposed = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    loadYTApi().then((YT) => {
      if (disposed || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3,
          disablekb: 1, fs: 0, playsinline: 1, autoplay: 0,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            if (disposed) return;
            setReady(true);
            const d = playerRef.current?.getDuration() ?? 0;
            setDur(d);
            setMuted(playerRef.current?.isMuted() ?? false);
            // Resume once: only if the saved position is meaningfully into the
            // video and not within the last 5s (avoids landing on the end card).
            const start = startRef.current;
            if (!seekedRef.current && start > 3 && (!d || start < d - 5)) {
              seekedRef.current = true;
              try { playerRef.current?.seekTo(start, true); setCur(start); } catch { /* noop */ }
            }
          },
          onStateChange: (e: { data: number }) => {
            const YTns = window.YT;
            if (!YTns) return;
            if (e.data === YTns.PlayerState.PLAYING) { setPlaying(true); onPlayRef.current?.(); }
            else if (e.data === YTns.PlayerState.PAUSED) { setPlaying(false); onPauseRef.current?.(); }
            else if (e.data === YTns.PlayerState.ENDED) { setPlaying(false); onEndedRef.current?.(); }
          },
        },
      });
    });

    poll = setInterval(() => {
      const p = playerRef.current;
      if (p && typeof p.getCurrentTime === "function") {
        const t = p.getCurrentTime() || 0;
        setCur(t);
        const d = p.getDuration() || 0;
        if (d) setDur(d);
        // High-frequency update for watched-ranges tracking
        if (onTimeUpdateRef.current && t > 0) {
          onTimeUpdateRef.current(t);
        }
        // High-frequency position update for progress saver & timed questions (called every ~333ms)
        if (onProgressRef.current && t > 0) {
          onProgressRef.current(t);
        }
      }
    }, 333);

    return () => {
      disposed = true;
      if (poll) clearInterval(poll);
      // Flush the final position so leaving mid-video saves where you stopped.
      try {
        const t = playerRef.current?.getCurrentTime?.() ?? 0;
        if (onProgressRef.current && t > 0) onProgressRef.current(Math.floor(t));
      } catch { /* noop */ }
      try { playerRef.current?.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [videoId]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };
  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); }
  };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = playerRef.current;
    if (!p || !dur) return;
    const t = (Number(e.target.value) / 100) * dur;
    p.seekTo(t, true);
    setCur(t);
  };

  const [seekBadge, setSeekBadge] = useState<string | null>(null);

  // Keyboard controls for seeking (+5s/-5s), play/pause, fullscreen, mute
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const p = playerRef.current;
      if (!p) return;

      const key = e.key;
      const lowerKey = key.toLowerCase();

      if (key === "ArrowRight" || lowerKey === "l") {
        e.preventDefault();
        const d = p.getDuration?.() || 0;
        const c = p.getCurrentTime?.() || 0;
        const n = Math.min(d > 0 ? d : c + 5, c + 5);
        p.seekTo(n, true);
        setCur(n);
        setSeekBadge("⏩ +5ث");
        clearTimeout(timer);
        timer = setTimeout(() => setSeekBadge(null), 800);
      } else if (key === "ArrowLeft" || lowerKey === "j") {
        e.preventDefault();
        const c = p.getCurrentTime?.() || 0;
        const n = Math.max(0, c - 5);
        p.seekTo(n, true);
        setCur(n);
        setSeekBadge("⏪ -5ث");
        clearTimeout(timer);
        timer = setTimeout(() => setSeekBadge(null), 800);
      } else if (key === " " || lowerKey === "k") {
        e.preventDefault();
        if (playerRef.current) {
          try {
            const isP = playerRef.current.getPlayerState?.() === 1;
            if (isP) playerRef.current.pauseVideo();
            else playerRef.current.playVideo();
          } catch {
            /* noop */
          }
        }
      } else if (lowerKey === "f") {
        e.preventDefault();
        toggleFs();
      } else if (lowerKey === "m") {
        e.preventDefault();
        if (playerRef.current) {
          try {
            if (playerRef.current.isMuted()) {
              playerRef.current.unMute();
              setMuted(false);
            } else {
              playerRef.current.mute();
              setMuted(true);
            }
          } catch {
            /* noop */
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFs]);

  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      className="relative bg-black w-full select-none overflow-hidden"
      style={
        cssFs
          ? { position: "fixed", inset: 0, width: "100vw", height: "100dvh", zIndex: 2147483647 }
          : isFs
          ? { height: "100%" }
          : { paddingTop: "56.25%" }
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* The YT API replaces this node with its iframe */}
      <div className="absolute inset-0 w-full h-full">
        <div ref={hostRef} className="w-full h-full" />
      </div>

      {/* Full-surface click shield: swallows every click so no YouTube chrome is
          reachable; tapping toggles play/pause through our API instead. */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
        className="absolute inset-0 z-10 w-full h-full cursor-pointer bg-transparent"
      />

      {/* Center play affordance when paused */}
      {ready && !playing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
      )}

      {/* Forensic watermark — child of the fullscreen element */}
      <VideoWatermark label={watermark} />

      {/* Seek badge overlay */}
      {seekBadge && (
        <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md text-white font-bold text-sm shadow-2xl animate-fade-in border border-white/10" dir="ltr">
            {seekBadge}
          </span>
        </div>
      )}

      {/* Interactive modals & overlays */}
      {children}

      {/* Loading shimmer */}
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {/* Custom control bar (above the shield) */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-3 py-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center gap-3">
        <button type="button" onClick={togglePlay} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} className="shrink-0 text-white hover:text-sky-300 transition-colors">
          {playing ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <span className="shrink-0 text-[11px] font-mono text-white/85 tabular-nums" dir="ltr">{fmt(cur)}</span>

        <input
          type="range" min={0} max={100} step={0.1} value={pct}
          onChange={seek}
          aria-label="شريط التقدم"
          className="flex-1 h-1 accent-sky-400 cursor-pointer"
          dir="ltr"
        />

        <span className="shrink-0 text-[11px] font-mono text-white/85 tabular-nums" dir="ltr">{fmt(dur)}</span>

        <button type="button" onClick={toggleMute} aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"} className="shrink-0 text-white hover:text-sky-300 transition-colors">
          {muted ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" /></svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" /></svg>
          )}
        </button>

        <button type="button" onClick={toggleFs} aria-label={isFs ? "إنهاء ملء الشاشة" : "ملء الشاشة"} className="shrink-0 text-white hover:text-sky-300 transition-colors" title={title}>
          {isFs ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" /></svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
