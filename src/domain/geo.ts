import type { Route } from './model';

/** [lat, lng] en grados. */
export type LatLng = [number, number];

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Polilínea con distancias acumuladas para ubicar puntos "a X metros del inicio". */
export class Polyline {
  readonly cum: number[];
  readonly lengthM: number;

  constructor(readonly points: LatLng[]) {
    if (points.length < 2) throw new Error('La polilínea necesita al menos 2 puntos');
    this.cum = [0];
    for (let i = 1; i < points.length; i++) this.cum.push(this.cum[i - 1] + haversineM(points[i - 1], points[i]));
    this.lengthM = this.cum[this.cum.length - 1];
  }

  pointAt(m: number): LatLng {
    const d = Math.min(Math.max(m, 0), this.lengthM);
    let i = 1;
    while (i < this.points.length - 1 && this.cum[i] < d) i++;
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (d - this.cum[i - 1]) / seg;
    const [a, b] = [this.points[i - 1], this.points[i]];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /** Proyecta un punto sobre la línea: a cuántos metros del inicio cae y qué tan lejos está de ella. */
  project(p: LatLng, minM = 0): { alongM: number; offM: number } {
    // Aproximación plana local (equirectangular): sobra precisión para distancias de una ciudad.
    const k = Math.cos(rad(p[0]));
    const toXY = (q: LatLng) => [rad(q[1]) * k * R, rad(q[0]) * R];
    const [px, py] = toXY(p);
    let best = { alongM: 0, offM: Infinity };
    for (let i = 1; i < this.points.length; i++) {
      if (this.cum[i] < minM) continue;
      const [ax, ay] = toXY(this.points[i - 1]);
      const [bx, by] = toXY(this.points[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
      const off = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      if (off < best.offM) best = { alongM: this.cum[i - 1] + (this.cum[i] - this.cum[i - 1]) * t, offM: off };
    }
    return best;
  }

  /** Tramo de la polilínea entre dos distancias. */
  slice(fromM: number, toM: number): LatLng[] {
    const a = Math.max(0, fromM);
    const b = Math.min(this.lengthM, toM);
    if (b <= a) return [];
    const inner = this.points.filter((_, i) => this.cum[i] > a && this.cum[i] < b);
    return [this.pointAt(a), ...inner, this.pointAt(b)];
  }
}

/**
 * Referenciación lineal entre la ruta del dominio (metros desde el inicio, con sus paradas) y el trazado real.
 * Cada parada se ancla a su punto sobre la polilínea; entre paradas se interpola. Así el bus pasa justo por
 * la parada cuando el dominio dice que llegó, aunque las distancias del catálogo no coincidan al metro.
 */
export class RouteReferencer {
  private routeKnots: number[];
  private lineKnots: number[];

  constructor(route: Route, readonly line: Polyline) {
    const anchors = route.stops.map((s) =>
      s.lat !== undefined && s.lng !== undefined ? line.project([s.lat, s.lng]).alongM : (s.distanceFromStartM / route.lengthM) * line.lengthM,
    );
    // nunca hacia atrás: si dos anclas se cruzan, se respeta el orden de las paradas
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1]);
    this.routeKnots = [0, ...route.stops.map((s) => s.distanceFromStartM), route.lengthM];
    this.lineKnots = [0, ...anchors, line.lengthM];
  }

  private static map(x: number, from: number[], to: number[]): number {
    if (x <= from[0]) return to[0];
    for (let i = 1; i < from.length; i++) {
      if (x <= from[i]) {
        const span = from[i] - from[i - 1];
        const t = span > 0 ? (x - from[i - 1]) / span : 1;
        return to[i - 1] + (to[i] - to[i - 1]) * t;
      }
    }
    return to[to.length - 1];
  }

  /** Metros de la ruta → punto del mapa. */
  toLatLng(routeM: number): LatLng {
    return this.line.pointAt(RouteReferencer.map(routeM, this.routeKnots, this.lineKnots));
  }

  /** Punto del GPS → metros de la ruta (y qué tan lejos del trazado está). */
  toRouteM(p: LatLng, minRouteM = 0): { routeM: number; offM: number } {
    const minLine = RouteReferencer.map(minRouteM, this.routeKnots, this.lineKnots);
    const { alongM, offM } = this.line.project(p, minLine);
    return { routeM: RouteReferencer.map(alongM, this.lineKnots, this.routeKnots), offM };
  }

  /** Tramo del trazado real entre dos distancias de la ruta. */
  slice(fromRouteM: number, toRouteM: number): LatLng[] {
    return this.line.slice(
      RouteReferencer.map(fromRouteM, this.routeKnots, this.lineKnots),
      RouteReferencer.map(toRouteM, this.routeKnots, this.lineKnots),
    );
  }
}

/** true si todas las paradas tienen coordenadas reales (si no, se usa el mapa esquemático). */
export const hasGeo = (route: Route): boolean => route.stops.every((s) => s.lat !== undefined && s.lng !== undefined);
