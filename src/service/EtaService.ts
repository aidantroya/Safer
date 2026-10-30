import { segmentBoundaries, segmentIndexAt, type Route, type Trip } from '@/domain/model';

export const STOP_DWELL_S = 30; // segundos que se asume que el bus se detiene en cada parada intermedia
export const MIN_SPEED_MPS = 2; // piso de velocidad para no dividir entre ~0 en un trancón

export interface EtaResult {
  distanceM: number;
  seconds: number;
  intermediateStops: number;
  /** true si el bus ya pasó esa parada */
  passed: boolean;
}

/**
 * ETA del documento de diseño:
 *   velocidad_estimada(tramo) = 0.5 × velocidad_actual + 0.5 × velocidad_histórica(tramo)
 *   ETA = Σ distancia_tramo / velocidad_estimada + 30 s × paradas_intermedias
 * Es una función pura: no toca repositorios, por eso se prueba fácil.
 */
export class EtaService {
  estimate(route: Route, trip: Pick<Trip, 'positionM' | 'avgSpeedMps' | 'dwellRemainingS'>, targetStopIndex: number): EtaResult {
    const target = route.stops[targetStopIndex]?.distanceFromStartM;
    if (target === undefined) throw new Error(`Parada ${targetStopIndex} no existe en ${route.id}`);

    if (trip.positionM > target + 1) return { distanceM: 0, seconds: 0, intermediateStops: 0, passed: true };
    if (target - trip.positionM <= 1) return { distanceM: 0, seconds: 0, intermediateStops: 0, passed: false };

    const bounds = segmentBoundaries(route);
    const current = trip.avgSpeedMps > 0 ? trip.avgSpeedMps : route.historicalSpeedsKmh[0] / 3.6;
    let a = trip.positionM;
    let seconds = 0;
    let intermediate = 0;
    let guard = 0;

    while (a < target - 0.01 && guard++ < 100) {
      const seg = segmentIndexAt(route, a);
      const end = Math.min(target, bounds[seg + 1]);
      const len = end - a;
      if (len <= 0) break;
      const hist = route.historicalSpeedsKmh[seg] / 3.6;
      const v = Math.max(MIN_SPEED_MPS, 0.5 * current + 0.5 * hist);
      seconds += len / v;
      a = end;
      if (a < target - 0.01) intermediate += 1; // llegamos a una parada que NO es la destino
    }

    seconds += intermediate * STOP_DWELL_S + Math.max(0, trip.dwellRemainingS);
    return { distanceM: target - trip.positionM, seconds, intermediateStops: intermediate, passed: false };
  }
}
