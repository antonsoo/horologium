import { describe, expect, it } from 'vitest';
import { seasonalReadout } from '../src/app/seasonal.js';
import { solarDayEvents, sunTimes } from '../src/lib/astronomy/sun-moon.js';
import { romanHour } from '../src/lib/roman.js';
import oracle from './fixtures/solar-events.json';

describe('independent JPL solar event controls', () => {
  for (const row of oracle.cases) {
    it(row.name, () => {
      const actual = solarDayEvents(row.jd, row.latitudeDeg, row.longitudeDeg);
      if (['north-short-day', 'south-short-day', 'phantom-daylight'].includes(row.name)) {
        // The independent events include both true short days and no crossing.
        // This low-precision model must withhold both when its extrema graze
        // the horizon instead of claiming to distinguish those outcomes.
        expect(actual.sunriseStatus).toBe('grazing');
        expect(actual.sunsetStatus).toBe('grazing');
        expect(actual.sunriseJD).toBeNull();
        expect(actual.sunsetJD).toBeNull();
        return;
      }
      for (const key of ['sunriseJD', 'sunsetJD'] as const) {
        const expected = row[key];
        const value = actual[key];
        if (expected === null) expect(value).toBeNull();
        else {
          expect(value).not.toBeNull();
          expect(Math.abs((value as number) - expected) * 86400).toBeLessThan(row.toleranceSeconds);
        }
      }
      expect(actual.cycleStartJD).toBeLessThan(actual.transitJD);
      expect(actual.cycleEndJD).toBeGreaterThan(actual.transitJD);
    });
  }
});

it('preserves a single sunrise at the transition to polar day without inventing a sunset', () => {
  const row = oracle.cases.find((c) => c.name === 'first-sunrise');
  if (!row) throw new Error('Missing control');
  const jd = row.jd + 0.5 - row.longitudeDeg / 360;
  const result = seasonalReadout(jd, row.latitudeDeg, row.longitudeDeg);
  expect(result.sunrise).toBe('18:03 UTC (-1 day)');
  expect(result.sunset).toBe('No sunset');
  expect(result.label).toBe('Seasonal hour unavailable');
  expect(romanHour(jd, row.latitudeDeg, row.longitudeDeg).circumpolar).toBe(true);
});

it('retains the legacy numeric shape while making missing boundaries explicit in the new API', () => {
  const row = oracle.cases.find((c) => c.name === 'first-sunset');
  if (!row) throw new Error('Missing control');
  const events = solarDayEvents(row.jd, row.latitudeDeg, row.longitudeDeg);
  const legacy = sunTimes(row.jd, row.latitudeDeg, row.longitudeDeg);
  expect(events.sunriseJD).toBeNull();
  expect(legacy.sunriseJD).toBe(legacy.transitJD);
  expect(legacy.sunsetJD).toBe(events.sunsetJD);
  expect(legacy.circumpolar).toBe(true);
});

it('rejects coordinates that cannot define a solar observer', () => {
  for (const [jd, lat, lon] of [
    [NaN, 0, 0],
    [1e308, 0, 0],
    [2451545, 91, 0],
    [2451545, 0, -181],
  ])
    expect(() => solarDayEvents(jd as number, lat as number, lon as number)).toThrow(RangeError);
});
