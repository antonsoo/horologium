/** Time travel, location, presets, and recoverable URL permalinks. */
import { dateToJD, displayYear, gregorianToJD, jdToGregorian, julianToJD } from '../lib/core/jd.js';
import { ANCIENT_CITIES } from '../lib/roman.js';
import { LOCATE_FAILURE_TEXT, locate } from './locate.js';
import {
  type CivilUnit,
  type ClockTime,
  DATE_LIMIT_TEXT,
  MAX_YEAR,
  MIN_YEAR,
  PRIVATE_LOCATION,
  parseDateEntry,
  permalinkHash,
  readPermalink,
  stepCivil,
  supportedJD,
} from './time-state.js';

export interface AppState extends ClockTime {
  latDeg: number;
  lonDeg: number;
}
export const PRESETS = [
  // Historical dates were Julian; the editor always shows proleptic Gregorian.
  { label: 'Ides of March, 44 BCE', jd: julianToJD(-43, 3, 15) },
  { label: 'Fall of Constantinople, 1453', jd: julianToJD(1453, 5, 29) },
  { label: 'Maya 13.0.0.0.0', jd: gregorianToJD(2012, 12, 21) },
  { label: 'First Olympiad, 776 BCE', jd: julianToJD(-775, 7, 1) },
];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export interface ControlsHandles {
  root: HTMLElement;
  onChange: (cb: (state: AppState) => void) => void;
  tick: (jd: number) => void;
  travel: (jd: number) => void;
  getState: () => AppState;
}
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text: string, className = 'btn'): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}
export function buildControls(): ControlsHandles {
  const initial = readPermalink(location.hash, dateToJD(new Date()));
  const time =
    initial.kind === 'valid'
      ? initial.time
      : { jd: dateToJD(new Date()), live: true, locationName: 'Rome' };
  const city = ANCIENT_CITIES.find((entry) => entry.name === time.locationName);
  const state: AppState = {
    ...time,
    latDeg: city?.latDeg ?? 41.9028,
    lonDeg: city?.lonDeg ?? 12.4964,
  };
  const listeners: Array<(state: AppState) => void> = [];
  const root = element('div', 'controls');
  const linkNote = element('p', 'control-status');
  linkNote.setAttribute('role', 'status');
  const showLinkNote = (text: string): void => {
    linkNote.textContent = text;
    linkNote.hidden = text === '';
  };
  showLinkNote(
    initial.kind === 'invalid' ? initial.error : initial.kind === 'valid' ? initial.note : '',
  );
  const row = element('div', 'controls-row');
  const nowField = element('div', 'field');
  nowField.append(element('span', 'field-label', 'Live'));
  const nowBtn = button('', 'btn primary');
  nowField.append(nowBtn);
  row.append(nowField);

  const dateField = element('form', 'field date-field');
  dateField.setAttribute('aria-label', 'Travel to a date');
  dateField.noValidate = true;
  dateField.append(element('span', 'field-label', 'Date · proleptic Gregorian'));
  const dateRow = element('div', 'date-row');
  const yearInput = element('input', 'year-input');
  yearInput.type = 'number';
  yearInput.min = '1';
  yearInput.step = '1';
  yearInput.setAttribute('aria-label', 'Year (use era selector for BCE)');
  const eraSelect = element('select', '');
  eraSelect.setAttribute('aria-label', 'Era');
  for (const era of ['CE', 'BCE']) eraSelect.append(new Option(era, era));
  const monthSelect = element('select', '');
  monthSelect.setAttribute('aria-label', 'Month');
  MONTH_NAMES.forEach((name, i) => {
    monthSelect.append(new Option(name, String(i + 1)));
  });
  const dayInput = element('input', 'day-input');
  dayInput.type = 'number';
  dayInput.min = '1';
  dayInput.max = '31';
  dayInput.step = '1';
  dayInput.setAttribute('aria-label', 'Day');
  const dateInputs = [yearInput, eraSelect, monthSelect, dayInput];
  for (const input of dateInputs) input.setAttribute('aria-describedby', 'date-help date-error');
  const goBtn = button('Go');
  goBtn.type = 'submit';
  dateRow.append(...dateInputs, goBtn);
  const dateHelp = element('p', 'field-note', 'At noon UTC · 5001 BCE–5000 CE');
  dateHelp.id = 'date-help';
  const dateError = element('p', 'field-error');
  dateError.id = 'date-error';
  dateError.setAttribute('role', 'alert');
  dateError.hidden = true;
  let dateDraft = false;
  const clearDateError = (): void => {
    dateError.hidden = true;
    dateError.textContent = '';
    for (const input of dateInputs) input.removeAttribute('aria-invalid');
  };
  for (const input of dateInputs)
    input.addEventListener('input', () => {
      dateDraft = true;
      clearDateError();
    });
  eraSelect.addEventListener('change', () => {
    yearInput.max = eraSelect.value === 'BCE' ? '5001' : '5000';
  });
  dateField.append(dateRow, dateHelp, dateError);
  dateField.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = parseDateEntry(
      yearInput.value,
      eraSelect.value,
      Number(monthSelect.value),
      dayInput.value,
    );
    if (result.error !== undefined) {
      dateError.textContent = result.error;
      dateError.hidden = false;
      for (const input of dateInputs) input.setAttribute('aria-invalid', 'true');
      return;
    }
    travel(result.jd);
  });
  row.append(dateField);

  const stepField = element('div', 'field');
  stepField.append(element('span', 'field-label', 'Step · calendar units'));
  const stepGroup = element('div', 'step-group');
  const stepButtons: Array<{ node: HTMLButtonElement; unit: CivilUnit; amount: number }> = [];
  for (const [unit, short] of [
    ['year', 'y'],
    ['month', 'm'],
    ['day', 'd'],
  ] as const) {
    for (const amount of [-1, 1]) {
      const node = button(`${amount > 0 ? '+' : '-'}1${short}`);
      node.setAttribute('aria-label', `${amount > 0 ? 'Forward' : 'Back'} one ${unit}`);
      node.addEventListener('click', () => {
        const jd = stepCivil(state.jd, unit, amount);
        if (jd !== null) travel(jd);
      });
      stepButtons.push({ node, unit, amount });
    }
  }
  for (const index of [0, 2, 4, 5, 3, 1]) {
    const step = stepButtons[index];
    if (step) stepGroup.append(step.node);
  }
  stepField.append(stepGroup);
  row.append(stepField);

  const locField = element('div', 'field location-field');
  locField.append(element('span', 'field-label', 'Location · seasonal hours'));
  const locRow = element('div', 'date-row');
  const locSelect = element('select', '');
  locSelect.setAttribute('aria-label', 'Ancient city');
  for (const entry of ANCIENT_CITIES) locSelect.append(new Option(entry.name, entry.name));
  locSelect.value = state.locationName;
  let myLocation: { latDeg: number; lonDeg: number } | null = null;
  const geoBtn = button('Use my location');
  const cancelBtn = button('Cancel location');
  cancelBtn.hidden = true;
  const locNote = element('p', 'field-note');
  locNote.setAttribute('role', 'status');
  locNote.hidden = true;
  const privacyNote = element(
    'p',
    'field-note',
    'Coordinates stay in this tab. Shared links use Rome.',
  );
  privacyNote.hidden = true;
  let cancelLocate: (() => void) | undefined;
  const ready = (): void => {
    geoBtn.textContent = 'Use my location';
    geoBtn.disabled = false;
    cancelBtn.hidden = true;
  };
  const stopLocate = (): void => {
    cancelLocate?.();
    cancelLocate = undefined;
    ready();
  };
  const locationNote = (text: string): void => {
    locNote.textContent = text;
    locNote.hidden = text === '';
  };
  cancelBtn.addEventListener('click', () => {
    stopLocate();
    locationNote('Location request cancelled. Pick a city or try again.');
  });
  locSelect.addEventListener('change', () => {
    stopLocate();
    const place =
      locSelect.value === PRIVATE_LOCATION
        ? myLocation
        : ANCIENT_CITIES.find((entry) => entry.name === locSelect.value);
    if (!place) return;
    state.latDeg = place.latDeg;
    state.lonDeg = place.lonDeg;
    state.locationName = locSelect.value;
    locationNote('');
    privacyNote.hidden = state.locationName !== PRIVATE_LOCATION;
    emit();
  });
  geoBtn.addEventListener('click', () => {
    stopLocate();
    locationNote('');
    geoBtn.textContent = 'Locating...';
    geoBtn.disabled = true;
    cancelBtn.hidden = false;
    cancelLocate = locate('geolocation' in navigator ? navigator.geolocation : undefined, {
      position(latDeg, lonDeg) {
        ready();
        locationNote('');
        myLocation = { latDeg, lonDeg };
        Object.assign(state, myLocation, { locationName: PRIVATE_LOCATION });
        if (!Array.from(locSelect.options).some((option) => option.value === PRIVATE_LOCATION))
          locSelect.append(new Option(PRIVATE_LOCATION, PRIVATE_LOCATION));
        locSelect.value = PRIVATE_LOCATION;
        privacyNote.hidden = false;
        emit();
      },
      failed(reason) {
        ready();
        locationNote(LOCATE_FAILURE_TEXT[reason]);
      },
    });
  });
  locRow.append(locSelect, geoBtn, cancelBtn);
  locField.append(locRow, locNote, privacyNote);
  row.append(locField);
  root.append(linkNote, row);

  const presetField = element('div', 'field preset-field');
  presetField.append(element('span', 'field-label', 'Presets · historical calendar dates'));
  const presetGroup = element('div', 'preset-group');
  for (const preset of PRESETS) {
    const node = button(preset.label);
    node.addEventListener('click', () => travel(preset.jd));
    presetGroup.append(node);
  }
  presetField.append(presetGroup);
  root.append(presetField);

  const scrub = element('div', 'scrubber');
  const range = element('input', '');
  range.type = 'range';
  range.step = '1';
  range.setAttribute('aria-label', 'Scrub in years around the current date');
  let scrubBaseJD = state.jd;
  let scrubbing: 'pointer' | 'keyboard' | null = null;
  const minLabel = element('span', '');
  const maxLabel = element('span', '');
  function beginScrub(mode: 'pointer' | 'keyboard') {
    if (!scrubbing) scrubBaseJD = state.jd;
    scrubbing = mode;
  }
  function resetScrub() {
    scrubbing = null;
    scrubBaseJD = state.jd;
    const year = jdToGregorian(scrubBaseJD).year;
    range.min = String(Math.max(-50, MIN_YEAR - year));
    range.max = String(Math.min(50, MAX_YEAR - year));
    range.value = '0';
    minLabel.textContent = `${range.min} years`;
    maxLabel.textContent = `+${range.max} years`;
    range.setAttribute('aria-valuetext', 'Current date');
  }
  range.addEventListener('pointerdown', () => beginScrub('pointer'));
  range.addEventListener('keydown', (event) => {
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ].includes(event.key)
    )
      beginScrub('keyboard');
  });
  range.addEventListener('input', () => {
    if (!scrubbing) beginScrub('keyboard');
    const years = Number(range.value);
    const jd = stepCivil(scrubBaseJD, 'year', years);
    if (jd === null) {
      showLinkNote(DATE_LIMIT_TEXT);
      return;
    }
    state.jd = jd;
    state.live = false;
    dateDraft = false;
    clearDateError();
    syncInputs();
    range.setAttribute(
      'aria-valuetext',
      `${years > 0 ? '+' : ''}${years} calendar years from the starting date`,
    );
    emit();
  });
  window.addEventListener('pointerup', () => {
    // Firefox commits the native range's final value after pointerup handlers.
    // Recenter after that commit so the last input still uses the same anchor.
    requestAnimationFrame(() => {
      if (scrubbing === 'pointer') resetScrub();
    });
  });
  window.addEventListener('pointercancel', () => {
    if (scrubbing === 'pointer') resetScrub();
  });
  range.addEventListener('blur', resetScrub);
  const scrubLabels = element('div', 'scrubber-labels');
  scrubLabels.append(minLabel, element('span', '', 'scrub · whole calendar years'), maxLabel);
  scrub.append(range, scrubLabels);
  root.append(scrub);

  function syncInputs() {
    if (!dateDraft) {
      const g = jdToGregorian(state.jd);
      eraSelect.value = g.year <= 0 ? 'BCE' : 'CE';
      yearInput.value = String(g.year <= 0 ? 1 - g.year : g.year);
      yearInput.max = eraSelect.value === 'BCE' ? '5001' : '5000';
      monthSelect.value = String(g.month);
      dayInput.value = String(Math.floor(g.day));
    }
    nowBtn.textContent = state.live ? 'Ticking now' : 'Return to now';
    for (const { node, unit, amount } of stepButtons)
      node.disabled = stepCivil(state.jd, unit, amount) === null;
    if (!scrubbing) resetScrub();
  }
  function emit(updateLink = true) {
    if (updateLink) {
      showLinkNote('');
      history.replaceState(null, '', permalinkHash(state));
    }
    for (const listener of listeners) listener({ ...state });
  }
  function travel(jd: number) {
    if (!supportedJD(jd)) {
      showLinkNote(DATE_LIMIT_TEXT);
      return;
    }
    state.jd = jd;
    state.live = false;
    dateDraft = false;
    clearDateError();
    resetScrub();
    syncInputs();
    emit();
  }
  nowBtn.addEventListener('click', () => {
    state.jd = dateToJD(new Date());
    state.live = true;
    dateDraft = false;
    clearDateError();
    resetScrub();
    syncInputs();
    emit();
  });
  window.addEventListener('hashchange', () => {
    const link = readPermalink(location.hash, dateToJD(new Date()));
    if (link.kind === 'anchor') return;
    if (link.kind === 'invalid') {
      showLinkNote(link.error);
      return;
    }
    stopLocate();
    const place = ANCIENT_CITIES.find((entry) => entry.name === link.time.locationName);
    if (!place) return;
    Object.assign(state, link.time, { latDeg: place.latDeg, lonDeg: place.lonDeg });
    locSelect.value = place.name;
    privacyNote.hidden = true;
    locationNote('');
    dateDraft = false;
    clearDateError();
    resetScrub();
    syncInputs();
    showLinkNote(link.note);
    emit(false);
  });
  syncInputs();
  return {
    root,
    onChange: (callback) => listeners.push(callback),
    getState: () => ({ ...state }),
    travel,
    tick(jd) {
      if (!state.live) return;
      state.jd = jd;
      syncInputs();
      emit(false);
    },
  };
}
export function formatDateReadout(jd: number): { primary: string; secondary: string } {
  const g = jdToGregorian(jd);
  const day = Math.floor(g.day);
  // A JD has only tens of microseconds of precision here. Do not display an
  // exact minute one minute early because its fractional day rounded down.
  const precision = Number.EPSILON * Math.abs(jd) * 1440;
  const minutes = Math.min(
    1439,
    Math.floor((jd - gregorianToJD(g.year, g.month, day)) * 1440 + precision),
  );
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} UTC`;
  return {
    primary: `${day} ${MONTH_NAMES[g.month - 1] ?? ''} ${displayYear(g.year)}`,
    secondary: `${time} · JD ${jd.toFixed(3)}`,
  };
}
