# Contributing

This started as a personal project, but issues and pull requests are welcome.

## Setup

```sh
git clone https://github.com/antonsoo/horologium.git
cd horologium
npm install
```

## Workflow

- `npm run dev` — Vite dev server for the web app.
- `npm test` — runs the Vitest suite (`vitest run`).
- `npm run lint` / `npm run lint:fix` — Biome.
- `npm run typecheck` — `tsc --noEmit` for both the app and the library.
- `npm run build` — builds the library (`dist/lib`) and the web app (`dist/app`).

## Adding or changing a calendar

- Calendar modules live in `src/lib/`, are pure TypeScript (no DOM, no I/O),
  and each exports `fromJD`, `toJD` where the calendar is invertible, and a
  `describe(jd)` returning a `CalendarTablet` (see `src/lib/types.ts`).
- Cite your source for any nontrivial rule or epoch (Reingold & Dershowitz
  for calendrical arithmetic, Meeus for astronomy, or a specific paper) in a
  code comment. Don't guess at a specific date or coefficient you're not
  sure of — say so, or verify it against an independent source first (see
  `scripts/generate_fixtures.py` for the oracle-fixture pattern this project
  uses).
- Add tests in `tests/`: at minimum a round-trip property test
  (`toJD(fromJD(jd)) === jd`) across a wide date range, plus any hand- or
  oracle-checked reference dates you can find.
- If your calendar's month/year boundaries depend on astronomical events
  (new moons, solstices, sighting), set `isReconstruction: true` on its
  `CalendarTablet` and say so in `method`.

## Web app

- The app is in `src/app/`, plain TypeScript + hand-built SVG (no framework,
  no UI library). Keep it that way unless there's a strong reason to add a
  dependency.
- Run a visual check after UI changes: `npm run build && npx vite preview`,
  then look at it in light and dark mode at a phone width.
