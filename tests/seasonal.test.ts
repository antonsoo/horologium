import { describe, expect, it } from 'vitest';
import { seasonalReadout } from '../src/app/seasonal.js';
import { sunTimes } from '../src/lib/astronomy/sun-moon.js';
import { gregorianToJD } from '../src/lib/core/jd.js';
import { romanHour } from '../src/lib/roman.js';

const midnight = gregorianToJD(2026, 6, 21);
describe('seasonal hours across UTC dates', () => {
  it.each([
    [108.9398, 34.3416, 23, 1],
    [-170, 35, 2, -1],
  ] as const)('recognizes adjacent-day daylight at longitude %s', (lon, lat, hour, dayOffset) => {
    const jd = midnight + hour / 24;
    const times = sunTimes(jd + dayOffset, lat, lon);
    expect(jd).toBeGreaterThan(times.sunriseJD);
    expect(jd).toBeLessThan(times.sunsetJD);
    const result = romanHour(jd, lat, lon);
    expect(result.isDaytime).toBe(true);
    expect(result.circumpolar).toBe(false);
    expect(result.index).toBe(
      Math.floor(((jd - times.sunriseJD) / (times.sunsetJD - times.sunriseJD)) * 12) + 1,
    );
  });
  it('uses the sunset and next sunrise that bracket a night watch', () => {
    for (const lon of [-179, -90, 0, 90, 179]) {
      const today = sunTimes(midnight, 35, lon);
      const tomorrow = sunTimes(midnight + 1, 35, lon);
      for (let watch = 0; watch < 4; watch++) {
        const jd = today.sunsetJD + ((tomorrow.sunriseJD - today.sunsetJD) * (watch + 0.5)) / 4;
        expect(romanHour(jd, 35, lon)).toEqual({
          isDaytime: false,
          index: watch + 1,
          label: ['vigilia prima', 'vigilia secunda', 'vigilia tertia', 'vigilia quarta'][watch],
          circumpolar: false,
        });
      }
    }
  });
  it('changes from the final night watch to hora prima at sunrise and to watch one at sunset', () => {
    const times = sunTimes(midnight, 41.9028, 12.4964);
    expect(romanHour(times.sunriseJD - 1e-6, 41.9028, 12.4964).label).toBe('vigilia quarta');
    expect(romanHour(times.sunriseJD, 41.9028, 12.4964).label).toBe('hora prima');
    expect(romanHour(times.sunsetJD - 1e-6, 41.9028, 12.4964).label).toBe('hora duodecima');
    expect(romanHour(times.sunsetJD, 41.9028, 12.4964).label).toBe('vigilia prima');
  });
  it('renders polar days/nights as unavailable, never fabricated first hours', () => {
    for (const lat of [-90, -80, 80, 90]) {
      const result = seasonalReadout(midnight + 0.5, lat, 0);
      expect(result.label).toBe('Seasonal hour unavailable');
      expect(result.sunrise).toBe('No sunrise');
      expect(result.sunset).toBe('No sunset');
    }
  });
  it('labels the neighboring UTC day and responds to a different city', () => {
    const east = seasonalReadout(midnight + 23 / 24, 34.3416, 108.9398);
    const west = seasonalReadout(midnight + 2 / 24, 35, -170);
    expect(east.sunset).toContain('(+1 day)');
    expect(west.sunrise).toContain('(-1 day)');
    expect(east.sunrise).not.toBe(seasonalReadout(midnight + 23 / 24, 41.9028, 12.4964).sunrise);
  });
});
