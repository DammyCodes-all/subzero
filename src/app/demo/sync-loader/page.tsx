"use client";

import { useEffect, useState } from "react";
import { BlackHoleScan } from "@/components/BlackHoleScan";
import { Button } from "@/components/ui/button";

export default function SyncLoaderDemoPage() {
  const [isScanning, setIsScanning] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [heroSize, setHeroSize] = useState(360);
  useEffect(() => {
    const upd = () =>
      setHeroSize(Math.min(400, Math.max(280, window.innerWidth - 80)));
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      {/* Header */}
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Demo — sync-loader
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          Sync Loader — Black Hole Mail Scan
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Your own version. Canvas 2D +{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
            requestAnimationFrame
          </code>{" "}
          — Kepler-like accretion disk, envelope spaghettification, cheap
          barrel-distortion lensing. Colors from Subzero tokens (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> --primary
          </span>{" "}
          / --foreground / --background). Respects{" "}
          <code className="font-mono text-xs">prefers-reduced-motion</code>.
        </p>
      </div>

      {/* Primary interactive demo — YOUR VERSION */}
      <section className="rounded-xl bg-card p-6 sm:p-8 border border-white/[0.06] shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Your version — <span className="text-foreground">BlackHoleScan</span>{" "}
            / SyncLoader
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ${
              isScanning
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${isScanning ? "bg-primary-foreground animate-pulse" : "bg-muted-foreground"}`}
            />
            {isScanning ? "scanning" : "idle"}
          </span>
        </div>

        <div className="mt-6 flex flex-col items-center gap-6">
          <BlackHoleScan
            size={heroSize}
            isScanning={isScanning}
            progress={progress}
            label={
              isScanning
                ? progress !== null
                  ? "Scanning your Gmail…"
                  : "Scanning your Gmail…"
                : "Scan paused"
            }
            sublabel="you@gmail.com"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant={isScanning ? "secondary" : "default"}
            onClick={() => setIsScanning((v) => !v)}
          >
            {isScanning ? "Pause" : "Resume"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setProgress((p) => (p === null ? 0.42 : null))}
          >
            {progress === null ? "Bind progress" : "Indeterminate"}
          </Button>
          {progress !== null && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="h-1 w-32 accent-[var(--primary)]"
              aria-label="progress"
            />
          )}
        </div>
        {progress !== null && (
          <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
            isScanning={String(isScanning)} · progress={progress.toFixed(2)}
          </p>
        )}
        {progress === null && isScanning && (
          <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
            indeterminate loop — integrates with real scan duration via{" "}
            <code className="rounded bg-secondary px-1 py-0.5">progress</code>{" "}
            0→1
          </p>
        )}
      </section>

      {/* Responsive sizes */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { size: 96, label: "Widget", sub: "96px" },
          { size: 140, label: "Card", sub: "140px" },
          { size: 180, label: "Dashboard hero", sub: "180px" },
        ].map((s) => (
          <div
            key={s.size}
            className="rounded-xl bg-card p-6 flex flex-col items-center gap-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.label} · {s.sub}
            </p>
            <BlackHoleScan
              size={s.size}
              isScanning={isScanning}
              progress={null}
            />
            <p className="font-mono text-[11px] text-muted-foreground">
              holds at any size
            </p>
          </div>
        ))}
      </section>

      {/* Idle / reduced-motion */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-card p-8 flex flex-col items-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Idle (isScanning=false) — seamless loop paused
          </p>
          <div className="mt-6">
            <BlackHoleScan
              size={140}
              isScanning={false}
              label="Scan paused"
              sublabel="respects prefers-reduced-motion"
            />
          </div>
          <p className="mt-4 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            Static fallback: disk and envelopes frozen mid-orbit. Switch your OS
            to “Reduce motion” and the live scan above also snaps to this
            frame — no RAF, no layout thrash.
          </p>
        </div>
        <div className="rounded-xl bg-card p-8 flex flex-col items-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Bounded progress — completion flash
          </p>
          <div className="mt-6">
            <BlackHoleScan
              size={140}
              isScanning={true}
              progress={1}
              label="Finishing…"
              sublabel="you@gmail.com"
            />
          </div>
          <p className="mt-4 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            Pass <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">progress 0→1</code> from your
            scan job. Outer ring fills with --primary; at 1.0 the singularity
            pulses. Unbind for indeterminate loop.
          </p>
        </div>
      </section>

      <p className="text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
        GPU-friendly: one canvas, <code className="font-mono">transform</code>/
        <code className="font-mono">opacity</code> only,{" "}
        <code className="font-mono">lighter</code> compositing for glows,
        capped dt, DPR ≤2. Delete this route before ship.
      </p>
    </div>
  );
}
