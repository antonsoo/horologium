/**
 * horologium: calendars of the ancient world, keyed on Julian Day.
 *
 * Every calendar is a namespace so you can `import { maya } from 'horologium'`
 * and call `maya.fromJD(jd)` / `maya.describe(jd)` without name collisions
 * between calendars that both have a `fromJD`. `core` and `astronomy` are the
 * shared foundation everything else is built on.
 */
export * as core from './core/jd.js';
export * as astronomy from './astronomy/sun-moon.js';

export * as roman from './roman.js';
export * as byzantine from './byzantine.js';
export * as islamic from './islamic.js';
export * as coptic from './coptic.js';
export * as ethiopian from './coptic.js';
export * as hebrew from './hebrew.js';
export * as egyptian from './egyptian.js';
export * as maya from './maya.js';
export * as chinese from './chinese.js';

export type { CalendarTablet } from './types.js';
