/**
 * Back dial: the Metonic (235 synodic months / 19 years) and Saros (223
 * synodic months) spirals, each with a marker for the current position -
 * a simplified stand-in for the Antikythera mechanism's five-turn and
 * four-turn back-dial spirals.
 */
import { METONIC_MONTHS, SAROS_DAYS, cycleProgress } from '../lib/astronomy/sun-moon.js';
import type { JulianDay } from '../lib/core/jd.js';

const SYNODIC_MONTH = 29.530588861;
const METONIC_DAYS = METONIC_MONTHS * SYNODIC_MONTH;
// A convenient recent epoch for both cycles' turn counters (any epoch works; this one is JD-round).
const EPOCH = 2451550.0;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function spiralPath(cx: number, cy: number, rMin: number, rMax: number, turns: number): string {
  const steps = turns * 90;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const angle = f * turns * 2 * Math.PI - Math.PI / 2;
    const r = rMin + (rMax - rMin) * f;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d;
}

function spiralPoint(cx: number, cy: number, rMin: number, rMax: number, turns: number, f: number) {
  const angle = f * turns * 2 * Math.PI - Math.PI / 2;
  const r = rMin + (rMax - rMin) * f;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export interface BackDialHandles {
  svg: SVGSVGElement;
  update: (jd: JulianDay) => void;
}

export function buildBackDial(): BackDialHandles {
  const svg = svgEl('svg', {
    viewBox: '0 0 480 260',
    role: 'img',
    'aria-label': 'Back dial showing the Metonic and Saros cycle spirals',
  });
  svg.appendChild(
    svgEl('rect', { x: 0, y: 0, width: 480, height: 260, rx: 16, class: 'backdial-field' }),
  );

  const meton = { cx: 130, cy: 130, rMin: 18, rMax: 108, turns: 5 };
  const saros = { cx: 350, cy: 130, rMin: 14, rMax: 108, turns: 4 };

  svg.appendChild(
    svgEl('path', {
      d: spiralPath(meton.cx, meton.cy, meton.rMin, meton.rMax, meton.turns),
      class: 'spiral-track',
    }),
  );
  svg.appendChild(
    svgEl('path', {
      d: spiralPath(saros.cx, saros.cy, saros.rMin, saros.rMax, saros.turns),
      class: 'spiral-track',
    }),
  );

  svg.appendChild(
    svgEl('text', { x: meton.cx, y: 250, class: 'backdial-label', 'text-anchor': 'middle' }),
  ).textContent = 'Metonic — 235 months / 19 years';
  svg.appendChild(
    svgEl('text', { x: saros.cx, y: 250, class: 'backdial-label', 'text-anchor': 'middle' }),
  ).textContent = 'Saros — 223 months';

  const metonMarker = svgEl('circle', { r: 4.5, class: 'spiral-marker' });
  const sarosMarker = svgEl('circle', { r: 4.5, class: 'spiral-marker' });
  svg.appendChild(metonMarker);
  svg.appendChild(sarosMarker);

  function update(jd: JulianDay) {
    const metonF = cycleProgress(jd, EPOCH, METONIC_DAYS).fraction;
    const sarosF = cycleProgress(jd, EPOCH, SAROS_DAYS).fraction;
    const mp = spiralPoint(meton.cx, meton.cy, meton.rMin, meton.rMax, meton.turns, metonF);
    const sp = spiralPoint(saros.cx, saros.cy, saros.rMin, saros.rMax, saros.turns, sarosF);
    metonMarker.setAttribute('cx', String(mp.x));
    metonMarker.setAttribute('cy', String(mp.y));
    sarosMarker.setAttribute('cx', String(sp.x));
    sarosMarker.setAttribute('cy', String(sp.y));
  }

  return { svg, update };
}
