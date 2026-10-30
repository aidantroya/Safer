export interface Stop {
  id: string;
  name: string;
  order: number;
  /** Metros recorridos desde el inicio de la ruta hasta esta parada. */
  distanceFromStartM: number;
  /** Coordenadas reales; si todas las paradas las tienen, se usa el mapa real. */
  lat?: number;
  lng?: number;
}

export interface Route {
  id: string;
  /** Número o código visible de la ruta ("4", "R-12"…). */
  code: number | string;
  name: string; // "Ruta 4: Expreso Campus Norte"
  shortName: string; // "Expreso Campus Norte"
  lengthM: number;
  frequencyMin: number;
  stops: Stop[];
  /**
   * Velocidad histórica (km/h) por tramo. Largo = stops.length + 1.
   * Tramo i va de límites[i] a límites[i+1]; ver segmentBoundaries().
   */
  historicalSpeedsKmh: number[];
}

export interface Departure {
  routeLabel: string;
  detail: string;
  /** Hora local "HH:MM" */
  time: string;
}

/** [0, parada1, parada2, ..., paradaN, largoRuta] */
export function segmentBoundaries(route: Route): number[] {
  return [0, ...route.stops.map((s) => s.distanceFromStartM), route.lengthM];
}

export function segmentIndexAt(route: Route, positionM: number): number {
  const b = segmentBoundaries(route);
  for (let i = b.length - 2; i >= 0; i--) {
    if (positionM >= b[i]) return i;
  }
  return 0;
}

/** Índice de la primera parada que todavía no se alcanzó (stops.length si ya pasó todas). */
export function nextStopIndexAt(route: Route, positionM: number): number {
  const i = route.stops.findIndex((s) => s.distanceFromStartM > positionM + 0.5);
  return i === -1 ? route.stops.length : i;
}
