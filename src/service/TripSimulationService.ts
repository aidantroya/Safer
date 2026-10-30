import { segmentIndexAt, type Route, type Trip } from '@/domain/model';
import type { IRouteRepository, ITripRepository } from '@/domain/repository';
import { STOP_DWELL_S } from './EtaService';

/**
 * Simula el GPS de los buses para la demo. En producción esto desaparece:
 * la posición llega desde la app del conductor (expo-location → Supabase Realtime)
 * y este servicio se reemplaza por "recibirPosicion(tripId, lat, lng, speed)".
 */
export class TripSimulationService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private simClock = 0;
  speedMultiplier = 10;

  constructor(private trips: ITripRepository, private routes: IRouteRepository) {}

  start(intervalMs = 500): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.speedMultiplier > 0) void this.tick((intervalMs / 1000) * this.speedMultiplier);
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0, multiplier);
  }

  /** Avanza `dtSeconds` de tiempo simulado. Se llama directo en los tests. */
  async tick(dtSeconds: number): Promise<void> {
    const active = await this.trips.listActive();
    for (const trip of active) {
      if (trip.gps) continue; // con GPS real manda el conductor
      const route = await this.routes.findById(trip.routeId);
      if (!route) continue;
      let remaining = dtSeconds;
      while (remaining > 0) {
        const step = Math.min(1, remaining);
        this.simClock += step;
        this.stepTrip(route, trip, step);
        remaining -= step;
      }
      await this.trips.save(trip);
    }
  }

  private stepTrip(route: Route, trip: Trip, dt: number): void {
    if (trip.dwellRemainingS > 0) {
      trip.speedMps = 0;
      trip.dwellRemainingS = Math.max(0, trip.dwellRemainingS - dt);
      return;
    }
    if (trip.nextStopIndex >= route.stops.length) {
      trip.speedMps = 0; // en terminal esperando que el conductor finalice
      return;
    }
    const seg = segmentIndexAt(route, trip.positionM);
    const phase = trip.id.length * 1.7;
    const v = (route.historicalSpeedsKmh[seg] / 3.6) * (0.92 + 0.16 * Math.sin(this.simClock / 55 + phase));
    const target = route.stops[trip.nextStopIndex].distanceFromStartM;
    trip.speedMps = v;
    trip.avgSpeedMps += (1 - Math.exp(-dt / 120)) * (v - trip.avgSpeedMps);
    const next = trip.positionM + v * dt;
    if (next >= target) {
      trip.positionM = target;
      trip.nextStopIndex += 1;
      trip.dwellRemainingS = STOP_DWELL_S;
    } else {
      trip.positionM = next;
    }
  }
}
