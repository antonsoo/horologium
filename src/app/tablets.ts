import * as babylonian from '../lib/babylonian.js';
import * as byzantine from '../lib/byzantine.js';
import * as chinese from '../lib/chinese.js';
import * as coptic from '../lib/coptic.js';
/** Builds the grid of calendar "tablets", one card per calendar system. */
import type { JulianDay } from '../lib/core/jd.js';
import * as egyptian from '../lib/egyptian.js';
import * as greek from '../lib/greek.js';
import * as hebrew from '../lib/hebrew.js';
import * as islamic from '../lib/islamic.js';
import * as maya from '../lib/maya.js';
import * as roman from '../lib/roman.js';
import type { CalendarTablet } from '../lib/types.js';
import * as zoroastrian from '../lib/zoroastrian.js';

function collect(jd: JulianDay): CalendarTablet[] {
  return [
    roman.describe(jd),
    { ...egyptian.describe(jd) },
    hebrew.describe(jd),
    islamic.describe(jd),
    maya.describe(jd),
    chinese.describe(jd),
    greek.describe(jd),
    babylonian.describe(jd),
    coptic.describeCoptic(jd),
    coptic.describeEthiopian(jd),
    byzantine.describe(jd),
    zoroastrian.describe(jd),
  ];
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface TabletNodes {
  card: HTMLElement;
  name: HTMLElement;
  reconstruction: HTMLElement;
  prolepticBadge: HTMLElement;
  native: HTMLElement;
  translit: HTMLElement;
  summary: HTMLElement;
  proleptic: HTMLElement;
  method: HTMLElement;
}

const grids = new WeakMap<HTMLElement, Map<string, TabletNodes>>();
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function createTablet(t: CalendarTablet): TabletNodes {
  const card = el('article', 'tablet');
  card.dataset.calendar = t.id;
  const heading = el('h3', 'tablet-name');
  const name = el('span', '', t.name);
  const badges = el('span', 'tablet-badges');
  const reconstruction = el('span', 'tablet-badge', 'reconstruction');
  const prolepticBadge = el('span', 'tablet-badge', 'proleptic');
  badges.append(reconstruction, prolepticBadge);
  heading.append(name, badges);
  const native = el('div', 'tablet-native');
  if (t.id === 'hebrew') {
    native.dir = 'rtl';
    native.lang = 'he';
  }
  const translit = el('div', 'tablet-translit');
  const summary = el('p', 'tablet-summary');
  const proleptic = el('p', 'tablet-proleptic');
  const details = document.createElement('details');
  const method = el('p', 'method');
  details.append(el('summary', '', 'How this is computed'), method);
  card.append(heading, native, translit, summary, proleptic, details);
  if (t.id === 'chinese') {
    native.lang = 'zh-Hans';
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'tablet-inspect';
    inspect.textContent = 'Inspect months and leap rule';
    inspect.addEventListener('click', () => {
      card.dispatchEvent(new CustomEvent('inspect-chinese-year', { bubbles: true }));
    });
    card.append(inspect);
  }
  return {
    card,
    name,
    reconstruction,
    prolepticBadge,
    native,
    translit,
    summary,
    proleptic,
    method,
  };
}

/** Update text in place: live ticks retain disclosure state, focus and selection. */
export function buildTablets(container: HTMLElement, jd: JulianDay): void {
  const tablets = collect(jd);
  let nodes = grids.get(container);
  if (!nodes) {
    nodes = new Map();
    grids.set(container, nodes);
  }
  for (const t of tablets) {
    let n = nodes.get(t.id);
    if (!n) {
      n = createTablet(t);
      nodes.set(t.id, n);
      container.append(n.card);
    }
    n.card.setAttribute('aria-label', t.name);
    setText(n.name, t.name);
    n.reconstruction.hidden = !t.isReconstruction;
    n.prolepticBadge.hidden = !t.proleptic;
    setText(n.native, t.native);
    n.translit.hidden = !t.transliteration || t.transliteration === t.native;
    setText(n.translit, t.transliteration);
    setText(n.summary, t.summary);
    n.proleptic.hidden = !t.proleptic;
    setText(n.proleptic, t.proleptic ?? '');
    setText(n.method, t.method);
  }
}
