/**
 * Shared vocabulary for the "calendar tablet" the web app renders: one card
 * per calendar system, each produced by that calendar module's `describe`
 * function so the UI never needs calendar-specific formatting logic.
 */
export interface CalendarTablet {
  /** Machine-readable id, e.g. "hebrew", "maya-long-count". */
  id: string;
  /** Display name, e.g. "Hebrew Calendar". */
  name: string;
  /** Date rendered in the calendar's native script (may equal transliteration if none). */
  native: string;
  /** Latin-alphabet transliteration or, for already-Latin calendars, the same as native. */
  transliteration: string;
  /** One-line plain-English statement of the date, e.g. "5 Nisan 5785". */
  summary: string;
  /** Short "how this is computed" disclosure: epoch, method, and its limits. */
  method: string;
  /** True if this system is a modern scholarly reconstruction rather than a historically attested algorithm. */
  isReconstruction: boolean;
}
