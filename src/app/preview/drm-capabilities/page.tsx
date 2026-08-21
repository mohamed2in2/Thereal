"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * DRM capability probe.
 *
 * Answers the question the capture-protection work actually depends on: which
 * security level does THIS browser on THIS machine really negotiate? A device
 * that only offers software robustness can never produce a black frame for a
 * screen recorder, because nothing ever enters the OS protected media path.
 *
 * Probing only inspects the local browser. It sends nothing anywhere, needs no
 * account, and reveals nothing about the content library.
 */

interface Probe {
  label: string;
  keySystem: string;
  videoRobustness: string;
  audioRobustness: string;
  /** True when this configuration engages a hardware-backed protected path. */
  hardware: boolean;
  note: string;
}

const PROBES: Probe[] = [
  {
    label: "Widevine L1 (hardware)",
    keySystem: "com.widevine.alpha",
    videoRobustness: "HW_SECURE_ALL",
    audioRobustness: "HW_SECURE_CRYPTO",
    hardware: true,
    note: "Typical on Android. Rare on desktop.",
  },
  {
    label: "Widevine L3 (software)",
    keySystem: "com.widevine.alpha",
    videoRobustness: "SW_SECURE_DECODE",
    audioRobustness: "SW_SECURE_CRYPTO",
    hardware: false,
    note: "Desktop Chrome default. Screen recording succeeds.",
  },
  {
    label: "PlayReady SL3000 (hardware)",
    keySystem: "com.microsoft.playready.recommendation.3000",
    videoRobustness: "3000",
    audioRobustness: "3000",
    hardware: true,
    note: "Windows Edge on capable hardware. This is the black-frame path.",
  },
  {
    label: "PlayReady SL2000 (software)",
    keySystem: "com.microsoft.playready",
    videoRobustness: "2000",
    audioRobustness: "2000",
    hardware: false,
    note: "Software PlayReady. No protected media path.",
  },
  {
    label: "FairPlay",
    keySystem: "com.apple.fps.1_0",
    videoRobustness: "",
    audioRobustness: "",
    hardware: true,
    note: "Safari on macOS / iOS.",
  },
];

type Status = "checking" | "yes" | "no";

async function probe(entry: Probe): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.requestMediaKeySystemAccess) return false;
  try {
    await navigator.requestMediaKeySystemAccess(entry.keySystem, [
      {
        initDataTypes: ["cenc", "sinf", "skd"],
        videoCapabilities: [
          {
            contentType: 'video/mp4; codecs="avc1.42E01E"',
            ...(entry.videoRobustness ? { robustness: entry.videoRobustness } : {}),
          },
        ],
        audioCapabilities: [
          {
            contentType: 'audio/mp4; codecs="mp4a.40.2"',
            ...(entry.audioRobustness ? { robustness: entry.audioRobustness } : {}),
          },
        ],
      },
    ]);
    return true;
  } catch {
    return false;
  }
}

export default function DrmCapabilitiesPage() {
  const [results, setResults] = useState<Record<string, Status>>({});
  const [secureContext, setSecureContext] = useState<boolean | null>(null);

  const run = useCallback(async () => {
    // Read here rather than in the effect: EME is unavailable outside a secure
    // context, and that explains a table of failures better than the probes do.
    setSecureContext(typeof window !== "undefined" ? window.isSecureContext : null);
    setResults(Object.fromEntries(PROBES.map((p) => [p.label, "checking" as Status])));
    for (const entry of PROBES) {
      const ok = await probe(entry);
      setResults((prev) => ({ ...prev, [entry.label]: ok ? "yes" : "no" }));
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so the first paint shows the empty table rather than
    // cascading a re-render from inside the effect.
    const id = setTimeout(() => void run(), 0);
    return () => clearTimeout(id);
  }, [run]);

  const hardwareAvailable = PROBES.some((p) => p.hardware && results[p.label] === "yes");
  const anyAvailable = PROBES.some((p) => results[p.label] === "yes");
  const settled = PROBES.every((p) => results[p.label] && results[p.label] !== "checking");

  return (
    <div dir="ltr" className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">DRM capability probe</h1>
          <p className="text-sm text-slate-400">
            What this browser and machine actually negotiate. Run it on every device you
            care about — the answer differs per browser, per GPU and per OS.
          </p>
        </header>

        {secureContext === false && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Not a secure context. EME requires HTTPS (or localhost); every probe below will
            fail for that reason alone, not because the hardware lacks support.
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left">
              <tr>
                <th className="p-3 font-semibold">Configuration</th>
                <th className="p-3 font-semibold">Supported</th>
                <th className="p-3 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {PROBES.map((entry) => {
                const status = results[entry.label] ?? "checking";
                return (
                  <tr key={entry.label} className="border-t border-white/10">
                    <td className="p-3">
                      <div className="font-medium">{entry.label}</div>
                      <div className="font-mono text-[11px] text-slate-500">{entry.keySystem}</div>
                    </td>
                    <td className="p-3">
                      {status === "checking" && <span className="text-slate-400">checking…</span>}
                      {status === "yes" && (
                        <span className={entry.hardware ? "text-emerald-400" : "text-amber-400"}>
                          yes
                        </span>
                      )}
                      {status === "no" && <span className="text-slate-500">no</span>}
                    </td>
                    <td className="p-3 text-slate-400">{entry.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {settled && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              hardwareAvailable
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-200"
            }`}
          >
            {hardwareAvailable ? (
              <>
                <strong>Hardware DRM available.</strong> Protected playback can enter the OS
                protected media path here, so a screen recorder should capture a black frame.
                Confirm it with an actual recorder — this probe reports capability, not outcome.
              </>
            ) : anyAvailable ? (
              <>
                <strong>Software DRM only.</strong> Content stays encrypted in transit and at
                rest, but decoded frames are composited normally, so screen recording will
                capture the video. No player configuration changes this. On Windows, try Edge.
              </>
            ) : (
              <>
                <strong>No DRM available.</strong> Protected lessons cannot play in this
                browser at all.
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void run()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500"
          >
            Re-run probe
          </button>
          <Link
            href="/preview/drm?assetId=axinom_demo&title=Axinom+Widevine+Test"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            Play DRM test vector
          </Link>
          <Link
            href="/preview/drm?assetId=axinom_clear&title=Clear+DASH+Control"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            Play unencrypted control
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Acceptance test: play both clips and record the screen. The unencrypted control
          proves your recorder works. If the DRM clip records identically, this device has no
          protected path regardless of what the DRM configuration requests.
        </p>
      </div>
    </div>
  );
}
