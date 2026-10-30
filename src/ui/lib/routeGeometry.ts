/**
 * Geometría del mapa esquemático (viewBox 400×370). Más adelante se reemplaza por Leaflet + OpenStreetMap:
 * lo único que hay que cambiar es este archivo y components/RouteMap.tsx.
 *
 * Calles del mapa: verticales en x=138 (Calle de las Ciencias) y x=270 (Av. Las Palmeras),
 * horizontales en y=85 y y=175 (Av. Universitaria). Cada ruta va sobre esas calles.
 */
export const MAP_W = 400;
export const MAP_H = 370;
const METERS_PER_UNIT = 10;

/** Recorrido de cada ruta, por id. El largo del trazado × 10 m debe coincidir con route.lengthM del seed. */
const ROUTE_POINTS: Record<string, [number, number][]> = {
  // Sube por Calle de las Ciencias, gira en Av. Universitaria y sigue al norte por Av. Las Palmeras.
  'route-4': [[138, 370], [138, 175], [270, 175], [270, 0]],
  // Entra por el oeste en Av. Universitaria, pasa la Rotonda y baja por Av. Las Palmeras.
  'route-2': [[0, 175], [270, 175], [270, 370]],
  // Cruza el norte de este a oeste y baja por Calle de las Ciencias.
  'route-7': [[400, 85], [138, 85], [138, 370]],
};

export interface RouteGeometry {
  pointAt(meters: number): [number, number];
  /** Path SVG del tramo entre dos distancias (en metros) respetando las esquinas. */
  pathBetween(fromM: number, toM: number): string;
  /** true si en esa distancia la ruta va en horizontal (para ubicar la etiqueta arriba y no encima de la línea). */
  isHorizontalAt(meters: number): boolean;
  fullPath: string;
}

function build(pts: [number, number][]): RouteGeometry {
  const cum = pts.reduce<number[]>((acc, p, i) => {
    if (i === 0) return [0];
    const [x0, y0] = pts[i - 1];
    return [...acc, acc[i - 1] + Math.hypot(p[0] - x0, p[1] - y0)];
  }, []);
  const units = cum[cum.length - 1];

  const segmentAt = (d: number) => {
    for (let i = 1; i < pts.length; i++) if (d <= cum[i]) return i;
    return pts.length - 1;
  };

  const pointAt = (meters: number): [number, number] => {
    const d = Math.min(Math.max(meters / METERS_PER_UNIT, 0), units);
    const i = segmentAt(d);
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };

  const pathBetween = (fromM: number, toM: number): string => {
    const a = Math.max(0, fromM) / METERS_PER_UNIT;
    const b = Math.min(toM / METERS_PER_UNIT, units);
    if (b - a < 0.5) return '';
    const start = pointAt(a * METERS_PER_UNIT);
    let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) if (cum[i] > a && cum[i] < b) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    const end = pointAt(b * METERS_PER_UNIT);
    return `${d} L ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  };

  const isHorizontalAt = (meters: number) => {
    const i = segmentAt(Math.min(Math.max(meters / METERS_PER_UNIT, 0), units));
    return pts[i - 1][1] === pts[i][1];
  };

  return { pointAt, pathBetween, isHorizontalAt, fullPath: pathBetween(0, units * METERS_PER_UNIT) };
}

const cache = new Map<string, RouteGeometry>();

export function routeGeometry(routeId: string): RouteGeometry {
  let g = cache.get(routeId);
  if (!g) {
    g = build(ROUTE_POINTS[routeId] ?? ROUTE_POINTS['route-4']);
    cache.set(routeId, g);
  }
  return g;
}
