/** A lunar-year ledger: civil boundaries, principal terms, and the leap rule. */
import {
  type ChineseMonth,
  type ChineseYear,
  chineseFromJD,
  chineseNewYear,
  inspectChineseYear,
  monthLabel,
} from '../lib/chinese.js';
import { displayYear, jdToDate, jdToGregorian } from '../lib/core/jd.js';
import { supportedJD } from './time-state.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function civilDate(jd: number): string {
  const d = jdToGregorian(jd + 1 / 3);
  return `${Math.floor(d.day)} ${MONTHS[d.month - 1]} ${displayYear(d.year)}`;
}

function eventTime(jd: number): string {
  const local = jdToDate(jd + 1 / 3);
  return `${civilDate(jd)}, ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

const RULE_TEXT: Record<ChineseMonth['rule'], string> = {
  'solstice-month': 'Contains the winter-solstice day: month 11.',
  'leap-month':
    'First month without a principal term in a 13-month cycle: repeats the preceding number.',
  'has-principal-term': 'Contains a principal solar term: regular month.',
  'twelve-month-cycle': 'This month-11 cycle has only 12 months, so this month stays regular.',
  'leap-already-assigned':
    'The leap month was assigned earlier in this cycle; this month stays regular.',
};

export function buildChineseYear(travel: (jd: number) => void) {
  const root = element('details', 'chinese-year');
  root.id = 'chinese-year';
  const summary = element('summary', 'chinese-year-toggle', 'Inspect the Chinese lunar year');
  const content = element('div', 'chinese-year-content');
  const heading = element('h2');
  const introduction = element(
    'p',
    'chinese-year-intro',
    'Month 11 contains the winter solstice. Count from one month 11 to the next: only a 13-month cycle gets a leap month, at its first month without a principal solar term.',
  );
  const navigation = element('div', 'chinese-year-actions');
  const previous = element('button', 'btn', 'Previous lunar year');
  const next = element('button', 'btn', 'Next lunar year');
  const example = element('button', 'btn', 'Visit leap month 11, 2033');
  const download = element('button', 'btn', 'Download lunar year (JSON)');
  for (const button of [previous, next, example, download]) button.type = 'button';
  navigation.append(previous, next, example, download);
  const selected = element('p', 'chinese-year-selected');
  selected.setAttribute('aria-live', 'polite');
  const note = element('p', 'chinese-year-note');
  const table = element('table', 'chinese-months');
  const caption = element(
    'caption',
    '',
    'Civil days begin at midnight in UTC+8. Select a month to move the clock to its first day.',
  );
  const thead = element('thead');
  const labels = element('tr');
  for (const label of ['Lunar month', 'Starts in UTC+8', 'Principal terms (approx.)']) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    labels.append(cell);
  }
  thead.append(labels);
  const tbody = element('tbody');
  table.append(caption, thead, tbody);
  const timing = element(
    'p',
    'chinese-year-note',
    'Event times are approximate. The clock uses civil days, not the instant of conjunction. A boundary or term within 15 minutes of midnight is flagged for review; this threshold is not a guaranteed error bound.',
  );
  const sources = element('p', 'chinese-year-sources');
  const status = element('p', 'chinese-year-status');
  status.setAttribute('role', 'status');
  content.append(heading, introduction, navigation, selected, note, table, timing, sources, status);
  root.append(summary, content);

  let currentJD = 0;
  let currentYear = 2000;
  let rendered: ChineseYear | undefined;
  const rows = new Map<number, HTMLTableRowElement>();

  function addMonth(month: ChineseMonth) {
    const row = element('tr', month.isLeapMonth ? 'leap-month' : '');
    const identity = element('th');
    identity.scope = 'row';
    const jump = element(
      'button',
      'month-jump',
      `${month.isLeapMonth ? 'Leap ' : ''}${month.month}`,
    );
    jump.type = 'button';
    jump.setAttribute(
      'aria-label',
      `Go to ${month.isLeapMonth ? 'leap ' : ''}month ${month.month}, ${displayYear(currentYear)}`,
    );
    // Local noon leaves the selected civil day unambiguous in the clock's
    // UTC editor while retaining the exact midnight in the exported record.
    jump.disabled = !supportedJD(month.startJD + 0.5);
    jump.addEventListener('click', () => travel(month.startJD + 0.5));
    const native = element('span', 'month-native', monthLabel(month.month, month.isLeapMonth));
    native.lang = 'zh-Hans';
    identity.append(jump, native, element('span', 'month-length', `${month.days} days`));
    const starts = element('td');
    starts.append(element('span', 'month-start', civilDate(month.startJD)));
    const events = element('details', 'month-events');
    events.append(element('summary', '', 'Event times'));
    events.append(element('p', '', `New moon: about ${eventTime(month.newMoonJD)} (UTC+8).`));
    for (const term of month.principalTerms) {
      events.append(element('p', '', `${term.name}: about ${eventTime(term.jd)} (UTC+8).`));
    }
    events.append(
      element('p', '', `Following new moon: about ${eventTime(month.nextNewMoonJD)} (UTC+8).`),
    );
    if (month.nearMidnight.length) {
      starts.append(element('span', 'midnight-flag', 'Near midnight'));
      events.append(
        element(
          'p',
          '',
          'A boundary or solar term is within 15 minutes of local midnight. Small timing changes can change its civil date.',
        ),
      );
    }
    starts.append(events);
    const evidence = element('td');
    if (!month.principalTerms.length)
      evidence.append(element('strong', 'term-absent', 'No principal term'));
    for (const term of month.principalTerms) {
      evidence.append(element('span', 'principal-term', `${term.name} · ${civilDate(term.jd)}`));
    }
    if (month.rule !== 'has-principal-term') {
      evidence.append(element('p', 'month-rule', RULE_TEXT[month.rule]));
      evidence.append(
        element(
          'span',
          'month-cycle',
          `Month-11 cycle from ${displayYear(month.solsticeYear)}: ${month.monthsInSolsticeCycle} months`,
        ),
      );
    }
    row.append(identity, starts, evidence);
    rows.set(month.startJD, row);
    tbody.append(row);
  }

  function render() {
    if (!root.open) return;
    if (rendered?.yearNumber !== currentYear) {
      rendered = inspectChineseYear(currentYear);
      heading.textContent = `Lunar year beginning in ${displayYear(currentYear)}`;
      note.textContent = rendered.note;
      tbody.replaceChildren();
      rows.clear();
      for (const month of rendered.months) addMonth(month);
      sources.replaceChildren(element('span', '', 'Compare with Hong Kong Observatory: '));
      let linked = false;
      for (const year of [currentYear, currentYear + 1]) {
        if (year < 1901 || year > 2100) continue;
        if (linked) sources.append(' · ');
        const link = element('a', '', `${year} conversion table`);
        link.href = `https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/${year}e.pdf`;
        link.target = '_blank';
        link.rel = 'noopener';
        sources.append(link);
        linked = true;
      }
      sources.hidden = !linked;
      previous.disabled = currentYear <= -5000;
      next.disabled = currentYear >= 5000;
      status.textContent = '';
    }
    const date = chineseFromJD(currentJD);
    selected.textContent = `Selected: ${civilDate(currentJD)} in UTC+8 · ${date.isLeapMonth ? 'leap ' : ''}month ${date.month}, day ${date.day} · ${date.dayGanzhi.han} (${date.dayGanzhi.pinyin}) day.`;
    for (const month of rendered.months) {
      const row = rows.get(month.startJD);
      if (!row) continue;
      if (currentJD >= month.startJD && currentJD < month.endJD)
        row.setAttribute('aria-current', 'date');
      else row.removeAttribute('aria-current');
    }
  }

  previous.addEventListener('click', () => travel(chineseNewYear(currentYear - 1) + 0.5));
  next.addEventListener('click', () => travel(chineseNewYear(currentYear + 1) + 0.5));
  example.addEventListener('click', () => {
    const leap = inspectChineseYear(2033).months.find((month) => month.isLeapMonth);
    if (leap) travel(leap.startJD + 0.5);
  });
  download.addEventListener('click', () => {
    if (!rendered) return;
    try {
      const blob = new Blob([`${JSON.stringify(rendered, null, 2)}\n`], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = element('a');
      link.href = url;
      link.download = `horologium-chinese-year-${currentYear}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent =
        'Downloaded the lunar year, civil boundaries and approximate event times.';
    } catch {
      status.textContent = 'The download could not be created. Try the download again.';
    }
  });
  root.addEventListener('toggle', render);
  return {
    root,
    update(jd: number) {
      currentJD = jd;
      currentYear = chineseFromJD(jd).yearNumber;
      summary.textContent = `Inspect the Chinese lunar year · ${displayYear(currentYear)}`;
      render();
    },
    open() {
      root.open = true;
      render();
      summary.focus();
      root.scrollIntoView({ block: 'start' });
    },
  };
}
