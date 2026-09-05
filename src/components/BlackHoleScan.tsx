"use client";

import { useEffect, useRef } from "react";

/**
 * BlackHoleScan — your own version of the Subzero mail-scanning black hole.
 *
 * Approach: Canvas 2D + requestAnimationFrame (no new deps). Chosen over
 * WebGL/Three because the project has no WebGL stack yet and Canvas2D
 * already hits 60fps with additive blending and a cheap barrel-distortion
 * for gravitational lensing. Framer Motion isn't needed for the particle
 * loop — kept for page chrome only. Colors read from Subzero tokens
 * (--primary / --foreground / --background) and tints derived via alpha.
 *
 * Motion: 3 accretion layers with Kepler-like v ∝ r^-0.5 (w ∝ r^-1.5),
 * envelopes spawn at frame edges, spiral inward with quadratic infall
 * and angular shear, stretch radially near the horizon (spaghettification),
 * burst on absorption. Background grid is pre-warped near the photon ring.
 * Progress drives the outer ring + burst cadence; isScanning toggles RAF.
 */

interface BlackHoleScanProps {
  size?: number;
  isScanning?: boolean;
  progress?: number | null; // 0..1 or null for indeterminate
  className?: string;
  label?: string;
  sublabel?: string;
}

const STAGE = 260;
const C = STAGE / 2;
const CX = STAGE / 2;
const CY = STAGE / 2 + 16;
const HORIZON = 16;
const TILT = 0.42;
const MAIL_COUNT = 5;

const LAYERS = [
  { r0: 24, r1: 34, n: 38, w: 2.35 },
  { r0: 36, r1: 50, n: 30, w: 1.35 },
  { r0: 54, r1: 72, n: 22, w: 0.7 },
] as const;

interface Theme {
  primary: string;
  cream: string;
  bg: string;
}

interface DiskP {
  r: number;
  a: number;
  px: number;
  py: number;
  size: number;
  alpha: number;
  w: number;
}
interface Mail {
  r: number;
  a: number;
  respawnIn: number;
}
interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}
interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}
interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}
interface Scene {
  disk: DiskP[];
  mails: Mail[];
  bursts: Burst[];
  embers: Ember[];
  dust: Dust[];
  emberIn: number;
  time: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const _rgbCache = new Map<string, { r: number; g: number; b: number }>();
function hexAlpha(hex: string, a: number): string {
  let rgb = _rgbCache.get(hex);
  if (!rgb) {
    const h = hex.replace("#", "");
    rgb = {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
    _rgbCache.set(hex, rgb);
  }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function tiltPos(r: number, a: number) {
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) * TILT };
}

function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const pick = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    primary: pick("--primary", "#e6ff2b"),
    cream: pick("--foreground", "#f9f7f2"),
    bg: pick("--background", "#0b1310"),
  };
}

function createScene(staticFrame: boolean): Scene {
  const disk: DiskP[] = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.n; i++) {
      const r = rand(layer.r0, layer.r1);
      const a = staticFrame ? i * 2.39996 : rand(0, Math.PI * 2);
      const p = tiltPos(r, a);
      disk.push({
        r,
        a,
        px: p.x,
        py: p.y,
        size: rand(0.9, 1.9),
        alpha: rand(0.2, 0.52),
        w: layer.w,
      });
    }
  }
  const staticRadii = [102, 76, 54, 34, 26];
  const staticAngles = [0.7, 2.1, 3.9, 5.6, 1.1];
  const mails: Mail[] = Array.from({ length: MAIL_COUNT }, (_, i) => ({
    r: staticFrame ? staticRadii[i % staticRadii.length] : rand(38, 126),
    a: staticFrame
      ? staticAngles[i % staticAngles.length]
      : rand(0, Math.PI * 2),
    respawnIn: 0,
  }));
  const dust: Dust[] = Array.from({ length: 28 }, () => ({
    x: rand(0, STAGE),
    y: rand(0, STAGE),
    vx: rand(-3.5, 3.5),
    vy: rand(-2.8, 2.8),
    size: rand(0.55, 1.35),
    alpha: rand(0.035, 0.095),
  }));
  return {
    disk,
    mails,
    bursts: [],
    embers: [],
    dust,
    emberIn: 1.8,
    time: staticFrame ? 1.1 : 0,
  };
}

function absorb(scene: Scene, x: number, y: number) {
  for (let i = 0; i < 11; i++) {
    const ang = rand(0, Math.PI * 2);
    const sp = rand(20, 74);
    const life = rand(0.38, 0.72);
    scene.bursts.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life,
      maxLife: life,
    });
  }
}

function stepScene(scene: Scene, dt: number, isScanning: boolean) {
  scene.time += dt;
  for (const p of scene.disk) {
    p.px = CX + p.r * Math.cos(p.a);
    p.py = CY + p.r * Math.sin(p.a) * TILT;
    // Kepler-like: w ∝ r^-1.5  (inner orbits faster)
    const speed = isScanning ? 1 : 0.22;
    p.a += p.w * (32 / p.r) ** 1.5 * dt * speed;
    // gravity: slow inward drift, stronger closer — disk is accreting, not static
    const pull = isScanning ? 0.11 * (30 / p.r) ** 1.9 : 0.018 * (30 / p.r) ** 1.2;
    p.r -= pull * dt;
    if (p.r < HORIZON + 3.5) {
      p.r = rand(58, 72);
      p.a = rand(0, Math.PI * 2);
      const np = tiltPos(p.r, p.a);
      p.px = np.x;
      p.py = np.y;
    } else if (Math.sin(p.a) < -0.25) {
      // lensing: light from behind the hole is bent over the top
      const lens = 3.2 * Math.exp(-Math.pow((p.r - 26) / 9, 2));
      p.py -= lens * 0.6;
    }
  }
  if (!isScanning) {
    // slow drift only when idle
    for (const d of scene.dust) {
      d.x += d.vx * dt * 0.35;
      d.y += d.vy * dt * 0.35;
      if (d.x < -4) d.x = STAGE + 4;
      if (d.x > STAGE + 4) d.x = -4;
      if (d.y < -4) d.y = STAGE + 4;
      if (d.y > STAGE + 4) d.y = -4;
    }
    return;
  }
  for (const m of scene.mails) {
    if (m.respawnIn > 0) {
      m.respawnIn -= dt;
      if (m.respawnIn <= 0) {
        m.r = rand(112, 126);
        m.a = rand(0, Math.PI * 2);
      }
      continue;
    }
    const fall = 1 - m.r / 128;
    m.r -= (10 + 52 * fall * fall) * dt;
    m.a += 2.55 * (36 / Math.max(m.r, 14)) ** 1.18 * dt;
    if (m.r <= HORIZON + 0.6) {
      const pos = tiltPos(HORIZON, m.a);
      absorb(scene, pos.x, pos.y);
      m.respawnIn = rand(0.35, 1.65);
    }
  }
  scene.bursts = scene.bursts.filter((b) => {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += 18 * dt; // slight gravity on sparks
    return b.life > 0;
  });
  scene.emberIn -= dt;
  if (scene.emberIn <= 0) {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(27, 36);
      const sp = rand(58, 112);
      const life = rand(0.62, 0.92);
      const p = tiltPos(r, a);
      scene.embers.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.58,
        life,
        maxLife: life,
      });
    }
    scene.emberIn = rand(2.0, 4.2);
  }
  scene.embers = scene.embers.filter((e) => {
    e.life -= dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return e.life > 0;
  });
  for (const d of scene.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x < -4) d.x = STAGE + 4;
    if (d.x > STAGE + 4) d.x = -4;
    if (d.y < -4) d.y = STAGE + 4;
    if (d.y > STAGE + 4) d.y = -4;
  }
}

function drawMail(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  m: Mail,
) {
  if (m.respawnIn > 0) return;
  const heat = clamp01((38 - m.r) / (38 - HORIZON));
  const alpha = m.r > 23 ? 1 : (m.r - HORIZON) / (23 - HORIZON);
  if (alpha <= 0) return;
  const { x, y } = tiltPos(m.r, m.a);
  // Cheap lensing: nudge y when behind the hole (a near pi)
  const behind = Math.cos(m.a);
  const lensY = y + behind * -2.5 * Math.exp(-Math.pow((m.r - 24) / 9, 2));
  const warpedY = behind < -0.3 ? lensY : y;
  const ahead = tiltPos(m.r - 3.2, m.a + 0.065);
  const ang = Math.atan2(ahead.y - warpedY, ahead.x - x);

  ctx.save();
  ctx.translate(x, warpedY);
  ctx.rotate(ang);
  const s = 1 - 0.52 * heat;
  // spaghettification: stretch radially, thin tangentially
  ctx.scale(s * (1 + 1.45 * heat), s * (1 - 0.48 * heat));
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = theme.primary;
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1.15;
  ctx.shadowColor = theme.primary;
  ctx.shadowBlur = 5 + heat * 4;
  // card/envelope silhouette — uniformly rounded
  ctx.beginPath();
  const rr = 2;
  const w = 11.5;
  const h = 8.8;
  ctx.roundRect(-w / 2, -h / 2, w, h, rr);
  ctx.fill();
  ctx.stroke();
  // flap
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 1, -h / 2 + 1.1);
  ctx.lineTo(0, 0.9);
  ctx.lineTo(w / 2 - 1, -h / 2 + 1.1);
  ctx.stroke();
  // inner line hint for card
  ctx.globalAlpha = alpha * 0.5;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2.2, 1.9);
  ctx.lineTo(w / 2 - 2.2, 1.9);
  ctx.moveTo(-w / 2 + 2.2, 3.1);
  ctx.lineTo(w / 2 - 4.5, 3.1);
  ctx.stroke();
  ctx.restore();
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement,
  theme: Theme,
  scene: Scene,
  progress: number | null,
) {
  const t = scene.time;
  ctx.clearRect(0, 0, STAGE, STAGE);
  ctx.drawImage(bg, 0, 0, STAGE, STAGE);

  // Ambient dust (subtle cream)
  for (const d of scene.dust) {
    const dx = d.x - CX;
    const r = Math.hypot(dx, (d.y - CY) / TILT);
    const warp = 7 * Math.exp(-Math.pow((r - 23) / 10, 2));
    const behind = dx < 0 ? 1 : 0;
    const fy = warp && behind ? d.y - warp * 0.12 : d.y;
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = theme.cream;
    ctx.beginPath();
    ctx.arc(d.x, fy, d.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Lensing arcs — light bent over/under horizon
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = 0.34;
  ctx.beginPath();
  ctx.ellipse(CX, CY, 26.5, 11.5, 0, Math.PI * 1.07, Math.PI * 1.93);
  ctx.stroke();
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(CX, CY, 26.5, 11.5, 0, Math.PI * 0.07, Math.PI * 0.93);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // --- back half of disk (behind hole) — clipped by hole sphere
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, STAGE, CY);
  ctx.arc(CX, CY, HORIZON + 7, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  ctx.globalCompositeOperation = "lighter";
  for (const layer of LAYERS) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(1, TILT);
    const grad = ctx.createRadialGradient(0, 0, layer.r0, 0, 0, layer.r1);
    grad.addColorStop(0, hexAlpha(theme.primary, 0));
    grad.addColorStop(0.28, hexAlpha(theme.primary, 0.06));
    grad.addColorStop(0.42, hexAlpha(theme.primary, 0.28));
    grad.addColorStop(0.58, hexAlpha(theme.primary, 0.1));
    grad.addColorStop(1, hexAlpha(theme.primary, 0));
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, layer.r1, 0, Math.PI * 2);
    ctx.arc(0, 0, layer.r0, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
  // back particle streaks (sin < 0 → behind)
  for (const p of scene.disk) {
    if (Math.sin(p.a) >= 0) continue;
    const pos = tiltPos(p.r, p.a);
    const frontBoost = 0.85 + 0.3 * Math.sin(p.a);
    ctx.globalAlpha = p.alpha * frontBoost * 0.88;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  // back mails (behind hole)
  for (const m of scene.mails) {
    if (Math.sin(m.a) >= 0) continue;
    drawMail(ctx, theme, m);
  }

  // Singularity — soft near-black disc, no hard edge, fades into horizon
  const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, HORIZON + 7);
  core.addColorStop(0, "rgba(0,0,0,1)");
  core.addColorStop(0.68, "rgba(0,0,0,1)");
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(CX, CY, HORIZON + 7, 0, Math.PI * 2);
  ctx.fill();

  // Event horizon — subtle flicker, not faceted geometry
  const flicker = 0.62 + 0.16 * Math.sin(t * 6.9) * Math.sin(t * 2.4 + 1.2);
  ctx.strokeStyle = theme.primary;
  ctx.globalAlpha = flicker;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = theme.primary;
  ctx.shadowBlur = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  const N = 72;
  const pts: Array<{ x: number; y: number }> = [];
  for (let k = 0; k < N; k++) {
    const ang = (k / N) * Math.PI * 2;
    const rr =
      HORIZON +
      0.55 * Math.sin(5 * ang + t * 1.7) +
      0.32 * Math.sin(7 * ang - t * 2.25) +
      0.18 * Math.sin(9 * ang + t * 0.9);
    pts.push({ x: CX + rr * Math.cos(ang), y: CY + rr * Math.sin(ang) });
  }
  // smooth closed spline — quadraticCurveTo through midpoints avoids lineTo facets
  ctx.moveTo((pts[0].x + pts[N - 1].x) / 2, (pts[0].y + pts[N - 1].y) / 2);
  for (let i = 0; i < N; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % N];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // --- front half of disk (in front of hole) —
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CY, STAGE, STAGE - CY);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  for (const layer of LAYERS) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(1, TILT);
    const grad = ctx.createRadialGradient(0, 0, layer.r0, 0, 0, layer.r1);
    grad.addColorStop(0, hexAlpha(theme.primary, 0));
    grad.addColorStop(0.28, hexAlpha(theme.primary, 0.06));
    grad.addColorStop(0.42, hexAlpha(theme.primary, 0.30));
    grad.addColorStop(0.58, hexAlpha(theme.primary, 0.12));
    grad.addColorStop(1, hexAlpha(theme.primary, 0));
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, layer.r1, 0, Math.PI * 2);
    ctx.arc(0, 0, layer.r0, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
  // front particle streaks
  for (const p of scene.disk) {
    if (Math.sin(p.a) < 0) continue;
    const pos = tiltPos(p.r, p.a);
    const frontBoost = 0.85 + 0.3 * Math.sin(p.a);
    ctx.globalAlpha = p.alpha * frontBoost;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  // front mails (in front of hole)
  for (const m of scene.mails) {
    if (Math.sin(m.a) < 0) continue;
    drawMail(ctx, theme, m);
  }
  // embers / bursts — always in front (ejected)
  for (const e of scene.embers) {
    ctx.globalAlpha = (e.life / e.maxLife) * 0.78;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(e.x - e.vx * 0.048, e.y - e.vy * 0.048);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }
  for (const b of scene.bursts) {
    ctx.globalAlpha = (b.life / b.maxLife) * 0.92;
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Progress ring (if bounded) — thin chartreuse arc outside dust
  if (progress !== null) {
    const p = clamp01(progress);
    ctx.strokeStyle = theme.primary;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(CX, CY, 118, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(CX, CY, 118, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
    // completion flash
    if (p >= 0.999) {
      ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 12);
      ctx.fillStyle = theme.primary;
      ctx.beginPath();
      ctx.arc(CX, CY, HORIZON + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function paintBackground(_theme: Theme, scale: number): HTMLCanvasElement {
  const px = Math.round(STAGE * scale);
  const bg = document.createElement("canvas");
  bg.width = px;
  bg.height = px;
  // background grid removed — keep only green accretion / horizon
  // (was concentric rings + spokes at 0.05/0.04 alpha)
  return bg;
}

export function BlackHoleScan({
  size = 140,
  isScanning = true,
  progress = null,
  className,
  label,
  sublabel,
}: BlackHoleScanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<number | null>(progress);
  progressRef.current = progress;
  const bgCacheRef = useRef<{ bg: HTMLCanvasElement; key: string } | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const theme = readTheme();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    // cache background — unchanged across frames, avoid regenerating on progress ticks
    const cacheKey = `${theme.cream}-${theme.primary}-2`;
    let bg = bgCacheRef.current?.bg;
    if (!bg || bgCacheRef.current?.key !== cacheKey) {
      bg = paintBackground(theme, 2);
      bgCacheRef.current = { bg, key: cacheKey };
    }

    const draw = (scene: Scene) => {
      ctx.setTransform((size * dpr) / STAGE, 0, 0, (size * dpr) / STAGE, 0, 0);
      renderScene(ctx, bg, theme, scene, progressRef.current);
    };

    if (reduced) {
      const scene = createScene(true);
      draw(scene);
      const onChange = (e: MediaQueryListEvent) => {
        reduced = e.matches;
        if (reduced) {
          const s = createScene(true);
          draw(s);
        }
      };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    // non-reduced: always animate — slow drift when idle (15fps), full scan 60fps
    const scene = createScene(isScanning ? false : true);
    if (isScanning) {
      for (const m of scene.mails) m.r = rand(32, 120);
    }
    let raf = 0;
    let last = performance.now();
    let hidden = document.hidden;
    const onVis = () => {
      hidden = document.hidden;
      if (!hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onReducedChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelAnimationFrame(raf);
        const s = createScene(true);
        draw(s);
      }
    };
    mq.addEventListener("change", onReducedChange);

    const frame = (now: number) => {
      if (hidden) return;
      const targetFps = isScanning ? 60 : 15;
      if (now - last < 1000 / targetFps - 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepScene(scene, dt, isScanning);
      draw(scene);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onReducedChange);
    };
  }, [isScanning, size]);

  // Reduced-motion: primary effect draws one static frame and never loops,
  // so progress changes would otherwise be invisible. Redraw static frame
  // on progress/size change regardless of isScanning.
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const theme = readTheme();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let bg = bgCacheRef.current?.bg;
    const cacheKey = `${theme.cream}-${theme.primary}-2`;
    if (!bg || bgCacheRef.current?.key !== cacheKey) {
      bg = paintBackground(theme, 2);
      bgCacheRef.current = { bg, key: cacheKey };
    }
    const scene = createScene(true);
    ctx.setTransform((size * dpr) / STAGE, 0, 0, (size * dpr) / STAGE, 0, 0);
    renderScene(ctx, bg, theme, scene, progress);
  }, [progress, size]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Scanning mail"}
      className={`flex flex-col items-center gap-4 ${className ?? ""}`}
    >
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ width: size, height: size }}
        />
      </div>

      {(label || sublabel || progress !== null) && (
        <div className="text-center">
          {label ? (
            <p className="text-sm font-medium tracking-tight text-foreground">
              {label}
            </p>
          ) : null}
          {sublabel ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {sublabel}
            </p>
          ) : null}
          {progress !== null ? (
            <p className="mt-1 font-mono text-xs font-medium text-primary">
              {Math.round(clamp01(progress) * 100)}%
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Alias for the sync-loader route label — same component, semantic name.
export const SyncLoader = BlackHoleScan;
