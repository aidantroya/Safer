/**
 * Geometría del mapa esquemático (viewBox 400×370). Más adelante se reemplaza por Leaflet + OpenStreetMap:
 * lo único que hay que cambiar es este archivo y components/RouteMap.tsx.
 */
export const MAP_W = 400;
export const MAP_H = 370;
const METERS_PER_UNIT = 10;

/** Recorrido: sube por Calle de las Ciencias, gira en Av. Universitaria y sigue al norte por Av. Las Palmeras. */
const PTS: [number, number][] = [
  [138, 370],
  [138, 175],
  [270, 175],
  [270, 0],
];

const CUM = PTS.reduce<number[]>((acc, p, i) => {
  if (i === 0) return [0];
  const [x0, y0] = PTS[i - 1];
  return [...acc, acc[i - 1] + Math.hypot(p[0] - x0, p[1] - y0)];
}, []);

export const ROUTE_UNITS = CUM[CUM.length - 1];

export function pointAt(meters: number): [number, number] {
  const d = Math.min(Math.max(meters / METERS_PER_UNIT, 0), ROUTE_UNITS);
  for (let i = 1; i < PTS.length; i++) {
    if (d <= CUM[i]) {
      const t = (d - CUM[i - 1]) / (CUM[i] - CUM[i - 1]);
      const [x0, y0] = PTS[i - 1];
      const [x1, y1] = PTS[i];
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
  }
  return PTS[PTS.length - 1];
}

/** Path SVG del tramo entre dos distancias (en metros) respetando las esquinas. */
export function pathBetween(fromM: number, toM: number): string {
  const a = Math.max(0, fromM) / METERS_PER_UNIT;
  const b = Math.min(toM / METERS_PER_UNIT, ROUTE_UNITS);
  if (b - a < 0.5) return '';
  const start = pointAt(a * METERS_PER_UNIT);
  let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 1; i < PTS.length - 1; i++) if (CUM[i] > a && CUM[i] < b) d += ` L ${PTS[i][0]} ${PTS[i][1]}`;
  const end = pointAt(b * METERS_PER_UNIT);
  return `${d} L ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
}

export const FULL_ROUTE_PATH = pathBetween(0, ROUTE_UNITS * METERS_PER_UNIT);
