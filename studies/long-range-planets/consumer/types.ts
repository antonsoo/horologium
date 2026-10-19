import { core, planets } from '@antonsoloviev/horologium';

const selected: planets.PlanetModel = planets.planetModel(core.julianToJD(-43, 3, 15));
const result = planets.planetPositions(selected.fromJD);
const names: string[] = result.positions.map((p) => p.name);
const longitude: number = result.positions[0]?.longitudeDeg;
console.log(names, longitude, result.model.inRange);
