/**
 * scales.ts — pure geometry for the chart primitives.
 *
 * No JSX, no React, no DOM. Every export is a deterministic function of its inputs and is
 * unit-testable in isolation. SVG path strings are produced here; the components only feed
 * these coordinates into elements.
 *
 * Coordinate convention: SVG user space, y increases downward. Angles (arcPath) are in
 * radians, measured clockwise from 12 o'clock, matching how a donut reads.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Rounds to 3 decimals and stringifies — keeps emitted path data compact and stable. */
function n(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

/* ----------------------------------------------------------------------------------------
 * Linear scale
 * -------------------------------------------------------------------------------------- */

export type ScaleFn = (value: number) => number;

/**
 * Maps a numeric domain onto a pixel range. Returns a plain function so callers can name it
 * `x`/`y`. A zero-width domain collapses to the range start rather than dividing by zero.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): ScaleFn {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value: number): number => {
    if (span === 0) return r0;
    return r0 + ((value - d0) / span) * (r1 - r0);
  };
}

/* ----------------------------------------------------------------------------------------
 * Band scale (categorical positioning for bars)
 * -------------------------------------------------------------------------------------- */

export interface BandScale {
  /** Width of a single band's drawable area. */
  readonly bandwidth: number;
  /** Distance between the left edges of adjacent bands. */
  readonly step: number;
  /** Left edge of the band for a label (NaN if the label is unknown). */
  position(label: string): number;
  /** Horizontal centre of the band for a label. */
  center(label: string): number;
}

/**
 * Even categorical bands across `range`. `padding` (0..1) is the fraction of each step left
 * as gap; outer padding is half the inner gap on each edge so the row reads balanced.
 */
export function bandScale(
  domain: readonly string[],
  range: readonly [number, number],
  padding = 0.2,
): BandScale {
  const [r0, r1] = range;
  const width = r1 - r0;
  const count = Math.max(domain.length, 1);
  const step = width / count;
  const bandwidth = step * (1 - padding);
  const inset = (step - bandwidth) / 2;
  const index = new Map<string, number>();
  domain.forEach((label, i) => index.set(label, i));

  const position = (label: string): number => {
    const i = index.get(label);
    if (i === undefined) return Number.NaN;
    return r0 + i * step + inset;
  };

  return {
    bandwidth,
    step,
    position,
    center: (label: string): number => {
      const left = position(label);
      return Number.isNaN(left) ? Number.NaN : left + bandwidth / 2;
    },
  };
}

/* ----------------------------------------------------------------------------------------
 * Nice ticks
 * -------------------------------------------------------------------------------------- */

/**
 * Produces roughly `count` evenly spaced, human-friendly tick values that fully cover
 * [min, max]. Steps snap to 1/2/5 × 10ⁿ. The returned array's ends are the nice-rounded
 * bounds, so callers can use `ticks[0]` / `ticks.at(-1)` as the axis domain.
 */
export function niceTicks(min: number, max: number, count = 5): readonly number[] {
  const safeCount = Math.max(count, 1);
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    // Degenerate domain: open a symmetric window so an axis can still render.
    hi = lo === 0 ? 1 : lo + Math.abs(lo);
    lo = Math.min(lo, 0);
  }

  const rawStep = (hi - lo) / safeCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let stepMultiplier: number;
  if (normalized < 1.5) stepMultiplier = 1;
  else if (normalized < 3) stepMultiplier = 2;
  else if (normalized < 7) stepMultiplier = 5;
  else stepMultiplier = 10;
  const step = stepMultiplier * magnitude;

  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  // toFixed(10) then Number() strips binary-float dust (0.30000000000000004 → 0.3).
  for (let v = niceMin; v <= niceMax + step * 1e-6; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/* ----------------------------------------------------------------------------------------
 * Path builders
 * -------------------------------------------------------------------------------------- */

/** Polyline through the points as an SVG path (`M … L …`). Empty input → empty string. */
export function buildLinePath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)} ${n(p.y)}`).join(' ');
}

/** Filled area between the polyline and a horizontal baseline. */
export function buildAreaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return '';
  const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)} ${n(p.y)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return `${top} L${n(last.x)} ${n(baselineY)} L${n(first.x)} ${n(baselineY)} Z`;
}

function polar(cx: number, cy: number, radius: number, angle: number): Point {
  // 0 rad points up; positive angle sweeps clockwise.
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}

/**
 * Annular sector (donut slice) from `startAngle` to `endAngle`. When `r0 === 0` the slice
 * closes through the centre, giving a solid pie wedge.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  r0: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = polar(cx, cy, r, startAngle);
  const outerEnd = polar(cx, cy, r, endAngle);

  if (r0 <= 0) {
    return [
      `M${n(cx)} ${n(cy)}`,
      `L${n(outerStart.x)} ${n(outerStart.y)}`,
      `A${n(r)} ${n(r)} 0 ${largeArc} 1 ${n(outerEnd.x)} ${n(outerEnd.y)}`,
      'Z',
    ].join(' ');
  }

  const innerEnd = polar(cx, cy, r0, endAngle);
  const innerStart = polar(cx, cy, r0, startAngle);
  return [
    `M${n(outerStart.x)} ${n(outerStart.y)}`,
    `A${n(r)} ${n(r)} 0 ${largeArc} 1 ${n(outerEnd.x)} ${n(outerEnd.y)}`,
    `L${n(innerEnd.x)} ${n(innerEnd.y)}`,
    `A${n(r0)} ${n(r0)} 0 ${largeArc} 0 ${n(innerStart.x)} ${n(innerStart.y)}`,
    'Z',
  ].join(' ');
}

/* ----------------------------------------------------------------------------------------
 * Rounded rectangle (bar) path — per-corner radii
 * -------------------------------------------------------------------------------------- */

export interface CornerRadii {
  readonly tl?: number;
  readonly tr?: number;
  readonly br?: number;
  readonly bl?: number;
}

/**
 * Rectangle with independently rounded corners. This is how bars get "4px rounded
 * data-ends anchored square to the baseline": a vertical bar rounds `tl`/`tr` only, a
 * horizontal bar rounds `tr`/`br` only. Radii are clamped so they never exceed half the
 * shorter side.
 */
export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  corners: CornerRadii = {},
): string {
  const w = Math.max(width, 0);
  const h = Math.max(height, 0);
  const cap = Math.min(w, h) / 2;
  const clamp = (r: number | undefined): number => Math.max(0, Math.min(r ?? 0, cap));
  const tl = clamp(corners.tl);
  const tr = clamp(corners.tr);
  const br = clamp(corners.br);
  const bl = clamp(corners.bl);

  return [
    `M${n(x + tl)} ${n(y)}`,
    `H${n(x + w - tr)}`,
    tr > 0 ? `A${n(tr)} ${n(tr)} 0 0 1 ${n(x + w)} ${n(y + tr)}` : '',
    `V${n(y + h - br)}`,
    br > 0 ? `A${n(br)} ${n(br)} 0 0 1 ${n(x + w - br)} ${n(y + h)}` : '',
    `H${n(x + bl)}`,
    bl > 0 ? `A${n(bl)} ${n(bl)} 0 0 1 ${n(x)} ${n(y + h - bl)}` : '',
    `V${n(y + tl)}`,
    tl > 0 ? `A${n(tl)} ${n(tl)} 0 0 1 ${n(x + tl)} ${n(y)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}
