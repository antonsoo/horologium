/** Time travel, location, presets, and the URL permalink hash. */
import {
  dateToJD,
  displayYear,
  gregorianToJD,
  type JulianDay,
  jdToGregorian,
  julianToJD,
} from '../lib/core/jd.js';
import { ANCIENT_CITIES } from '../lib/roman.js';

export interface AppState {
  jd: JulianDay;
  live: boolean;
  latDeg: number;
  lonDeg: number;
  locationName: string;
}

export interface Preset {
  label: string;
  jd: JulianDay;
}

// Ancient/medieval dates are given in the Julian calendar, the one
// actually in use at the time (this is what the Roman/Greek tablets are
// keyed on too) - using gregorianToJD here would silently shift these by
// several days relative to the calendar the preset's own name refers to.
export const PRESETS: Preset[] = [
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

function parseHash(): { jd: JulianDay; loc?: string } | null {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const jdStr = params.get('jd');
  if (!jdStr) return null;
  const jd = Number.parseFloat(jdStr);
  if (!Number.isFinite(jd)) return null;
  const loc = params.get('loc');
  return loc === null ? { jd } : { jd, loc };
}

export function writeHash(state: AppState): void {
  const params = new URLSearchParams();
  params.set('jd', state.jd.toFixed(5));
  params.set('loc', state.locationName);
  history.replaceState(null, '', `#${params.toString()}`);
}

export interface ControlsHandles {
  root: HTMLElement;
  onChange: (cb: (state: AppState) => void) => void;
  setState: (partial: Partial<AppState>) => void;
  getState: () => AppState;
}

export function buildControls(): ControlsHandles {
  const fromHash = parseHash();
  const initialCity = ANCIENT_CITIES.find((c) => c.name === fromHash?.loc) ?? ANCIENT_CITIES[0];
  const state: AppState = {
    jd: fromHash?.jd ?? dateToJD(new Date()),
    live: fromHash === null,
    latDeg: initialCity?.latDeg ?? 41.9028,
    lonDeg: initialCity?.lonDeg ?? 12.4964,
    locationName: initialCity?.name ?? 'Rome',
  };

  const listeners: Array<(s: AppState) => void> = [];
  function emit() {
    writeHash(state);
    for (const cb of listeners) cb(state);
  }

  const root = document.createElement('div');
  root.className = 'controls';

  const row1 = document.createElement('div');
  row1.className = 'controls-row';

  // --- Now / live toggle ---
  const nowField = document.createElement('div');
  nowField.className = 'field';
  nowField.appendChild(labelEl('Live'));
  const nowBtn = document.createElement('button');
  nowBtn.type = 'button';
  nowBtn.className = 'btn primary';
  nowBtn.textContent = state.live ? 'Ticking now' : 'Return to now';
  nowBtn.addEventListener('click', () => {
    state.live = true;
    state.jd = dateToJD(new Date());
    nowBtn.textContent = 'Ticking now';
    syncInputs();
    emit();
  });
  nowField.appendChild(nowBtn);
  row1.appendChild(nowField);

  // --- Date/time inputs (BCE-capable) ---
  const dateField = document.createElement('div');
  dateField.className = 'field';
  dateField.appendChild(labelEl('Date (astronomical / proleptic Gregorian)'));
  const dateRow = document.createElement('div');
  dateRow.style.display = 'flex';
  dateRow.style.gap = '0.4rem';
  dateRow.style.flexWrap = 'wrap';

  const yearInput = document.createElement('input');
  yearInput.type = 'number';
  yearInput.style.width = '6.5em';
  yearInput.setAttribute('aria-label', 'Year (use era selector for BCE)');

  const eraSelect = document.createElement('select');
  eraSelect.setAttribute('aria-label', 'Era');
  for (const era of ['CE', 'BCE']) {
    const opt = document.createElement('option');
    opt.value = era;
    opt.textContent = era;
    eraSelect.appendChild(opt);
  }

  const monthSelect = document.createElement('select');
  monthSelect.setAttribute('aria-label', 'Month');
  MONTH_NAMES.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1);
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  const dayInput = document.createElement('input');
  dayInput.type = 'number';
  dayInput.min = '1';
  dayInput.max = '31';
  dayInput.style.width = '4.5em';
  dayInput.setAttribute('aria-label', 'Day');

  dateRow.append(yearInput, eraSelect, monthSelect, dayInput);
  dateField.appendChild(dateRow);
  row1.appendChild(dateField);

  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.className = 'btn';
  goBtn.textContent = 'Go';
  goBtn.addEventListener('click', () => {
    const yearRaw = Number.parseInt(yearInput.value || '1', 10) || 1;
    const astronomicalYear = eraSelect.value === 'BCE' ? 1 - yearRaw : yearRaw;
    const month = Number.parseInt(monthSelect.value, 10);
    const day = Number.parseInt(dayInput.value || '1', 10) || 1;
    state.jd = gregorianToJD(astronomicalYear, month, day) + 0.5;
    state.live = false;
    nowBtn.textContent = 'Return to now';
    emit();
  });
  row1.appendChild(goBtn);

  // --- Step buttons ---
  const stepField = document.createElement('div');
  stepField.className = 'field';
  stepField.appendChild(labelEl('Step'));
  const stepGroup = document.createElement('div');
  stepGroup.className = 'step-group';
  const steps: Array<[string, number]> = [
    ['-1y', -365.25],
    ['-1m', -30.44],
    ['-1d', -1],
    ['+1d', 1],
    ['+1m', 30.44],
    ['+1y', 365.25],
  ];
  for (const [label, delta] of steps) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = label;
    b.addEventListener('click', () => {
      state.jd += delta;
      state.live = false;
      nowBtn.textContent = 'Return to now';
      syncInputs();
      emit();
    });
    stepGroup.appendChild(b);
  }
  stepField.appendChild(stepGroup);
  row1.appendChild(stepField);

  // --- Location ---
  const locField = document.createElement('div');
  locField.className = 'field';
  locField.appendChild(labelEl('Location'));
  const locRow = document.createElement('div');
  locRow.style.display = 'flex';
  locRow.style.gap = '0.4rem';
  const locSelect = document.createElement('select');
  locSelect.setAttribute('aria-label', 'Ancient city');
  for (const city of ANCIENT_CITIES) {
    const opt = document.createElement('option');
    opt.value = city.name;
    opt.textContent = city.name;
    if (city.name === state.locationName) opt.selected = true;
    locSelect.appendChild(opt);
  }
  locSelect.addEventListener('change', () => {
    const city = ANCIENT_CITIES.find((c) => c.name === locSelect.value);
    if (!city) return;
    state.locationName = city.name;
    state.latDeg = city.latDeg;
    state.lonDeg = city.lonDeg;
    emit();
  });
  const geoBtn = document.createElement('button');
  geoBtn.type = 'button';
  geoBtn.className = 'btn';
  geoBtn.textContent = 'Use my location';
  geoBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      state.latDeg = pos.coords.latitude;
      state.lonDeg = pos.coords.longitude;
      state.locationName = 'My location';
      const opt = document.createElement('option');
      opt.value = 'My location';
      opt.textContent = 'My location';
      opt.selected = true;
      locSelect.appendChild(opt);
      emit();
    });
  });
  locRow.append(locSelect, geoBtn);
  locField.appendChild(locRow);
  row1.appendChild(locField);

  root.appendChild(row1);

  // --- Presets ---
  const row2 = document.createElement('div');
  row2.className = 'controls-row';
  const presetField = document.createElement('div');
  presetField.className = 'field';
  presetField.appendChild(labelEl('Presets'));
  const presetGroup = document.createElement('div');
  presetGroup.className = 'preset-group';
  for (const preset of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = preset.label;
    b.addEventListener('click', () => {
      state.jd = preset.jd;
      state.live = false;
      nowBtn.textContent = 'Return to now';
      syncInputs();
      emit();
    });
    presetGroup.appendChild(b);
  }
  presetField.appendChild(presetGroup);
  row2.appendChild(presetField);
  root.appendChild(row2);

  // --- Scrubber ---
  const scrub = document.createElement('div');
  scrub.className = 'scrubber';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '-50';
  range.max = '50';
  range.value = '0';
  range.step = '1';
  range.setAttribute('aria-label', 'Scrub in years around the current date');
  let scrubBaseJD = state.jd;
  range.addEventListener('pointerdown', () => {
    scrubBaseJD = state.jd;
  });
  range.addEventListener('input', () => {
    const years = Number.parseFloat(range.value);
    state.jd = scrubBaseJD + years * 365.25;
    state.live = false;
    nowBtn.textContent = 'Return to now';
    syncInputs();
    emit();
  });
  const scrubLabels = document.createElement('div');
  scrubLabels.className = 'scrubber-labels';
  scrubLabels.innerHTML = '<span>-50 years</span><span>scrub</span><span>+50 years</span>';
  scrub.append(range, scrubLabels);
  root.appendChild(scrub);

  function syncInputs() {
    const g = jdToGregorian(state.jd);
    const astroYear = Math.floor(g.year);
    if (astroYear <= 0) {
      eraSelect.value = 'BCE';
      yearInput.value = String(1 - astroYear);
    } else {
      eraSelect.value = 'CE';
      yearInput.value = String(astroYear);
    }
    monthSelect.value = String(g.month);
    dayInput.value = String(Math.floor(g.day));
    range.value = '0';
    scrubBaseJD = state.jd;
  }
  syncInputs();

  return {
    root,
    onChange(cb) {
      listeners.push(cb);
    },
    setState(partial) {
      Object.assign(state, partial);
      syncInputs();
      emit();
    },
    getState() {
      return state;
    },
  };
}

function labelEl(text: string): HTMLElement {
  const l = document.createElement('label');
  l.textContent = text;
  return l;
}

export function formatDateReadout(jd: JulianDay): { primary: string; secondary: string } {
  const g = jdToGregorian(jd);
  const month = MONTH_NAMES[g.month - 1] ?? '';
  const day = Math.floor(g.day);
  const frac = g.day - day;
  const hours = Math.floor(frac * 24);
  const minutes = Math.floor((frac * 24 - hours) * 60);
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC`;
  return {
    primary: `${day} ${month} ${displayYear(Math.floor(g.year))}`,
    secondary: `${time} · JD ${jd.toFixed(3)}`,
  };
}
