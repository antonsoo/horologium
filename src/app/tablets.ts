import * as byzantine from '../lib/byzantine.js';
import * as chinese from '../lib/chinese.js';
import * as coptic from '../lib/coptic.js';
/** Builds the grid of calendar "tablets", one card per calendar system. */
import type { JulianDay } from '../lib/core/jd.js';
import * as egyptian from '../lib/egyptian.js';
import * as hebrew from '../lib/hebrew.js';
import * as islamic from '../lib/islamic.js';
import * as maya from '../lib/maya.js';
import * as roman from '../lib/roman.js';
import type { CalendarTablet } from '../lib/types.js';

function collect(jd: JulianDay): CalendarTablet[] {
  return [
    roman.describe(jd),
    { ...egyptian.describe(jd) },
    hebrew.describe(jd),
    islamic.describe(jd),
    maya.describe(jd),
    chinese.describe(jd),
    coptic.describeCoptic(jd),
    coptic.describeEthiopian(jd),
    byzantine.describe(jd),
  ];
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function buildTablets(container: HTMLElement, jd: JulianDay): void {
  container.innerHTML = '';
  for (const t of collect(jd)) {
    const card = el('article', 'tablet');
    card.setAttribute('aria-label', t.name);

    const heading = el('div', 'tablet-name');
    const nameSpan = el('span', '', t.name);
    heading.appendChild(nameSpan);
    if (t.isReconstruction) {
      heading.appendChild(el('span', 'tablet-badge', 'reconstruction'));
    }
    card.appendChild(heading);

    card.appendChild(el('div', 'tablet-native', t.native));
    if (t.transliteration && t.transliteration !== t.native) {
      card.appendChild(el('div', 'tablet-translit', t.transliteration));
    }
    card.appendChild(el('p', 'tablet-summary', t.summary));

    const details = document.createElement('details');
    const summary = el('summary', '', 'How this is computed');
    details.appendChild(summary);
    details.appendChild(el('p', 'method', t.method));
    card.appendChild(details);

    container.appendChild(card);
  }
}
