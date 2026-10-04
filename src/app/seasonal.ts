import { sunTimes } from '../lib/astronomy/sun-moon.js';
import { romanHour } from '../lib/roman.js';

function utcTime(eventJD: number, referenceJD: number): string {
  const dayStart = Math.floor(eventJD + 0.5) - 0.5;
  const minutes = Math.round((eventJD - dayStart) * 1440);
  const offset = Math.floor(referenceJD + 0.5);
  const dayOffset = Math.floor(eventJD + 0.5) - offset + Math.floor(minutes / 1440);
  const time = `${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} UTC`;
  return `${time}${dayOffset ? ` (${dayOffset > 0 ? '+' : ''}${dayOffset} day)` : ''}`;
}

export function seasonalReadout(jd: number, latDeg: number, lonDeg: number) {
  const days = [-1, 0, 1].map((offset) => sunTimes(jd + offset, latDeg, lonDeg));
  const times = days.reduce((nearest, day) =>
    Math.abs(day.transitJD - jd) < Math.abs(nearest.transitJD - jd) ? day : nearest,
  );
  const hour = romanHour(jd, latDeg, lonDeg);
  return {
    label: hour.circumpolar ? 'Seasonal hour unavailable' : hour.label,
    phase: hour.circumpolar
      ? 'Sunrise or sunset is absent near this instant.'
      : hour.isDaytime
        ? `Daylight hour ${hour.index} of 12`
        : `Night watch ${hour.index} of 4`,
    sunrise: times.circumpolar ? 'No sunrise' : utcTime(times.sunriseJD, jd),
    sunset: times.circumpolar ? 'No sunset' : utcTime(times.sunsetJD, jd),
    duration: times.circumpolar
      ? 'Daylight hours cannot be divided here.'
      : `One daylight hour ≈ ${Math.round(((times.sunsetJD - times.sunriseJD) * 1440) / 12)} minutes`,
  };
}

export function buildSeasonalReadout() {
  const root = document.createElement('section');
  root.className = 'seasonal-panel';
  root.setAttribute('aria-labelledby', 'seasonal-heading');
  root.innerHTML = `
    <div class="seasonal-hour">
      <h2 id="seasonal-heading"></h2>
      <p class="seasonal-latin"></p>
      <p class="seasonal-phase"></p>
    </div>
    <dl class="seasonal-times">
      <div><dt>Sunrise</dt><dd class="seasonal-sunrise"></dd></div>
      <div><dt>Sunset</dt><dd class="seasonal-sunset"></dd></div>
    </dl>
    <p class="seasonal-duration"></p>
    <details><summary>About seasonal hours</summary>
      <p>Romans divided daylight into twelve seasonal hours whose length changes with the season and night into four watches.
      These approximate times use the solar day nearest this instant. All times are UTC;
      day offsets are relative to the date above. Elevation, varying refraction and Delta-T are
      not modeled; ancient boundaries have unquantified drift.</p>
    </details>`;
  const node = (selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`Missing seasonal readout ${selector}`);
    return found;
  };
  const heading = node('h2');
  const label = node('.seasonal-latin');
  const phase = node('.seasonal-phase');
  const sunrise = node('.seasonal-sunrise');
  const sunset = node('.seasonal-sunset');
  const duration = node('.seasonal-duration');
  return {
    root,
    update(jd: number, latDeg: number, lonDeg: number, locationName: string) {
      const result = seasonalReadout(jd, latDeg, lonDeg);
      heading.textContent = `${locationName} · seasonal hours`;
      label.textContent = result.label;
      phase.textContent = result.phase;
      sunrise.textContent = result.sunrise;
      sunset.textContent = result.sunset;
      duration.textContent = result.duration;
    },
  };
}
