import { PLANETS, planetLongitude } from '../lib/astronomy/planets.js';
import { moonLongitude, moonPhase, sunLongitude } from '../lib/astronomy/sun-moon.js';
import type { JulianDay } from '../lib/core/jd.js';
/**
 * The front bronze dial: an Antikythera-mechanism-inspired instrument with
 * a zodiac ring, an Egyptian 365-day calendar ring, and pointers for the
 * Sun, Moon (with a phase ball), the five naked-eye planets, and the
 * civil date. Pure SVG DOM construction, no framework.
 */
import { egyptian } from '../lib/index.js';

const CX = 300;
const CY = 300;

const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const ZODIAC_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

function polar(r: number, deg: number): [number, number] {
  // Longitude 0 (Aries) points to 12 o'clock; increases clockwise.
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function ring(g: SVGGElement, rOuter: number, rInner: number, className: string) {
  const path = svgEl('path', {
    d: `M ${CX - rOuter} ${CY} A ${rOuter} ${rOuter} 0 1 0 ${CX + rOuter} ${CY} A ${rOuter} ${rOuter} 0 1 0 ${CX - rOuter} ${CY} Z
        M ${CX - rInner} ${CY} A ${rInner} ${rInner} 0 1 1 ${CX + rInner} ${CY} A ${rInner} ${rInner} 0 1 1 ${CX - rInner} ${CY} Z`,
    class: className,
    'fill-rule': 'evenodd',
  });
  g.appendChild(path);
}

function moonPhasePath(r: number, illuminatedFraction: number, waxing: boolean): string {
  const k = Math.min(1, Math.max(0, illuminatedFraction));
  const rx = r * Math.abs(2 * k - 1);
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = k < 0.5 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 0 ${outerSweep} 0 ${r} A ${rx} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
}

export interface DialHandles {
  svg: SVGSVGElement;
  update: (jd: JulianDay) => void;
}

export function buildDial(): DialHandles {
  const svg = svgEl('svg', {
    viewBox: '0 0 600 600',
    role: 'img',
    'aria-label':
      'Bronze astronomical dial showing the Sun, Moon, planets, zodiac and Egyptian calendar ring',
  });

  const defs = svgEl('defs', {});
  defs.innerHTML = `
    <radialGradient id="bronzeField" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#a9884f" />
      <stop offset="55%" stop-color="#8a6d3b" />
      <stop offset="100%" stop-color="#5c4626" />
    </radialGradient>
    <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8cf7a" />
      <stop offset="45%" stop-color="#8a6d3b" />
      <stop offset="100%" stop-color="#3b2a1a" />
    </linearGradient>
    <radialGradient id="hub" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#f0dd9a" />
      <stop offset="100%" stop-color="#6b512c" />
    </radialGradient>
    <linearGradient id="verdigrisSweep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6fa895" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#2f5c50" stop-opacity="0.25" />
    </linearGradient>
    <radialGradient id="silverBall" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#f4f1e6" />
      <stop offset="100%" stop-color="#b9b4a0" />
    </radialGradient>
  `;
  svg.appendChild(defs);

  // Outer bezel + patinated field
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: 292, fill: 'url(#bezel)' }));
  svg.appendChild(
    svgEl('circle', {
      cx: CX,
      cy: CY,
      r: 284,
      fill: 'url(#bronzeField)',
      stroke: '#2a1e11',
      'stroke-width': 1,
    }),
  );
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: 284, fill: 'url(#verdigrisSweep)' }));

  // Zodiac ring
  const zodiacGroup = svgEl('g', { class: 'zodiac-ring' });
  ring(zodiacGroup, 270, 232, 'ring-face zodiac-face');
  for (let i = 0; i < 12; i++) {
    const deg = i * 30;
    const [x1, y1] = polar(232, deg);
    const [x2, y2] = polar(270, deg);
    zodiacGroup.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'ring-divider' }));
    const [gx, gy] = polar(251, deg + 15);
    const glyph = svgEl('text', {
      x: gx,
      y: gy,
      class: 'zodiac-glyph',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    glyph.textContent = ZODIAC_GLYPHS[i] ?? '';
    glyph.appendChild(svgEl('title', {})).textContent = ZODIAC_NAMES[i] ?? '';
    zodiacGroup.appendChild(glyph);
  }
  svg.appendChild(zodiacGroup);

  // Egyptian 365-day ring
  const egyptGroup = svgEl('g', { class: 'egypt-ring' });
  ring(egyptGroup, 226, 196, 'ring-face egypt-face');
  const EGYPT_MONTHS = egyptian.EGYPTIAN_MONTH_NAMES as readonly string[];
  for (let day = 0; day < 365; day++) {
    const deg = (day / 365) * 360;
    const isMonthStart = day % 30 === 0;
    const rInner = isMonthStart ? 196 : 216;
    const [x1, y1] = polar(rInner, deg);
    const [x2, y2] = polar(226, deg);
    egyptGroup.appendChild(
      svgEl('line', {
        x1,
        y1,
        x2,
        y2,
        class: isMonthStart ? 'egypt-tick-major' : 'egypt-tick-minor',
      }),
    );
  }
  for (let m = 0; m < 12; m++) {
    const deg = m * (360 / 12.1667) + 360 / 24.3; // approx center of each 30-day month band
    const [lx, ly] = polar(211, (m * 30 * 365) / 365 + 15);
    const label = svgEl('text', {
      x: lx,
      y: ly,
      class: 'egypt-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    label.textContent = EGYPT_MONTHS[m] ?? '';
    egyptGroup.appendChild(label);
    void deg;
  }
  svg.appendChild(egyptGroup);

  // Fine degree ring
  const tickGroup = svgEl('g', { class: 'tick-ring' });
  for (let d = 0; d < 360; d += 5) {
    const [x1, y1] = polar(186, d);
    const [x2, y2] = polar(192, d);
    tickGroup.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'fine-tick' }));
  }
  svg.appendChild(tickGroup);
  svg.appendChild(
    svgEl('circle', { cx: CX, cy: CY, r: 184, class: 'inner-face', fill: '#f2e6c2' }),
  );

  // Pointer group (rotated via CSS transform on each pointer's own <g>)
  const pointerLayer = svgEl('g', { class: 'pointer-layer' });

  const datePointer = svgEl('g', { class: 'pointer date-pointer' });
  datePointer.appendChild(
    svgEl('path', {
      d: `M ${CX} ${CY - 210} L ${CX - 5} ${CY - 190} L ${CX + 5} ${CY - 190} Z`,
      class: 'date-arrow',
    }),
  );
  pointerLayer.appendChild(datePointer);

  const planetPointers: Record<string, SVGGElement> = {};
  const planetLengths: Record<string, number> = {
    Mercury: 90,
    Venus: 115,
    Mars: 140,
    Jupiter: 160,
    Saturn: 178,
  };
  const planetGlyphs: Record<string, string> = {
    Mercury: '☿',
    Venus: '♀',
    Mars: '♂',
    Jupiter: '♃',
    Saturn: '♄',
  };
  for (const p of PLANETS) {
    const len = planetLengths[p.name] ?? 120;
    const g = svgEl('g', { class: `pointer planet-pointer planet-${p.name.toLowerCase()}` });
    g.appendChild(
      svgEl('line', {
        x1: CX,
        y1: CY,
        x2: CX,
        y2: CY - len,
        class: 'pointer-needle planet-needle',
      }),
    );
    const tip = svgEl('text', {
      x: CX,
      y: CY - len - 8,
      class: 'planet-glyph',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    });
    tip.textContent = planetGlyphs[p.name] ?? '•';
    tip.appendChild(svgEl('title', {})).textContent = p.name;
    g.appendChild(tip);
    pointerLayer.appendChild(g);
    planetPointers[p.name] = g;
  }

  const sunPointer = svgEl('g', { class: 'pointer sun-pointer' });
  sunPointer.appendChild(
    svgEl('line', { x1: CX, y1: CY, x2: CX, y2: CY - 248, class: 'pointer-needle sun-needle' }),
  );
  sunPointer.appendChild(svgEl('circle', { cx: CX, cy: CY - 248, r: 9, class: 'sun-disc' }));
  pointerLayer.appendChild(sunPointer);

  const moonPointer = svgEl('g', { class: 'pointer moon-pointer' });
  moonPointer.appendChild(
    svgEl('line', { x1: CX, y1: CY, x2: CX, y2: CY - 220, class: 'pointer-needle moon-needle' }),
  );
  const moonBallGroup = svgEl('g', {
    class: 'moon-ball-group',
    transform: `translate(${CX} ${CY - 220})`,
  });
  moonBallGroup.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 10, class: 'moon-dark' }));
  const moonLit = svgEl('path', { d: moonPhasePath(10, 0.5, true), class: 'moon-lit' });
  moonBallGroup.appendChild(moonLit);
  moonPointer.appendChild(moonBallGroup);
  pointerLayer.appendChild(moonPointer);

  svg.appendChild(pointerLayer);
  svg.appendChild(
    svgEl('circle', {
      cx: CX,
      cy: CY,
      r: 22,
      fill: 'url(#hub)',
      stroke: '#2a1e11',
      'stroke-width': 1.5,
    }),
  );
  svg.appendChild(svgEl('circle', { cx: CX, cy: CY, r: 5, fill: '#2a1e11' }));

  function update(jd: JulianDay) {
    const sunLon = sunLongitude(jd);
    sunPointer.style.transform = `rotate(${sunLon}deg)`;

    const moonLon = moonLongitude(jd);
    moonPointer.style.transform = `rotate(${moonLon}deg)`;
    const phase = moonPhase(jd);
    const waxing = phase.elongationDeg < 180;
    moonLit.setAttribute('d', moonPhasePath(10, phase.illuminatedFraction, waxing));
    moonBallGroup.style.transform = `translate(${CX}px, ${CY - 220}px) rotate(${-moonLon}deg)`;

    for (const p of PLANETS) {
      const lon = planetLongitude(p, jd);
      const g = planetPointers[p.name];
      if (g) g.style.transform = `rotate(${lon}deg)`;
    }

    const e = egyptian.fromJD(jd);
    const dayOfYear = (e.month - 1) * 30 + e.day - 1;
    const dateDeg = (dayOfYear / 365) * 360;
    datePointer.style.transform = `rotate(${dateDeg}deg)`;
  }

  return { svg, update };
}
