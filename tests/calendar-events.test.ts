import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  calendarNewMoon,
  calendarSolarCrossing,
  universalToTerrestrial,
} from '../src/lib/astronomy/calendar-events.js';

const events: { newMoons: Array<[number, number]>; principalTerms: Array<[number, number]> } =
  JSON.parse(
    readFileSync(new URL('../studies/chinese-calendar/events.json', import.meta.url), 'utf8'),
  );

describe('calendar event times vs independently computed JPL DE440s events (1900–2100)', () => {
  it('places every new moon within 18 seconds in TT', () => {
    expect(events.newMoons).toHaveLength(2487);
    for (const [k, expectedTT] of events.newMoons) {
      const actualTT = universalToTerrestrial(calendarNewMoon(k));
      expect(Math.abs(actualTT - expectedTT) * 86400, `lunation ${k}`).toBeLessThan(18);
    }
  });

  it('places every principal solar term within 15 minutes in TT', () => {
    expect(events.principalTerms).toHaveLength(2412);
    for (const [longitude, expectedTT] of events.principalTerms) {
      const actualTT = universalToTerrestrial(calendarSolarCrossing(expectedTT - 1, longitude));
      expect(
        Math.abs(actualTT - expectedTT) * 86400,
        `${longitude} degrees, JD ${expectedTT}`,
      ).toBeLessThan(900);
    }
  });
});
