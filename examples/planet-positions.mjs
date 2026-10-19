// Current source: npm run build:lib && node examples/planet-positions.mjs
import { core, planets } from '../dist/lib/index.js';

const jd = core.julianToJD(-43, 3, 15); // Ides of March, 44 BCE (Julian calendar)
const { model, positions } = planets.planetPositions(jd);
console.log(JSON.stringify({ jd, model, positions }, null, 2));
