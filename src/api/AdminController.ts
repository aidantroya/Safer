import type { Incident, IncidentStatus } from '@/domain/model';
import type { IReviewRepository, ITripRepository } from '@/domain/repository';
import type { InMemoryDatabase } from '@/data/datasource/InMemoryDatabase';
import type { IncidentService } from '@/service/IncidentService';
import type { PassengerService } from '@/service/PassengerService';
import type { TripSimulationService } from '@/service/TripSimulationService';
import type { BoardingService } from '@/service/BoardingService';
import { run, type ApiResult } from './ApiResult';

export interface AdminMetrics {
  activeTrips: number;
  openIncidents: number;
  averageRating: number | null;
  reviewCount: number;
  occupancyByTrip: { tripId: string; occupied: number; capacity: number }[];
}

/**
 * Endpoints del panel web de administración (todavía sin pantalla) + controles de la demo.
 * Los métodos `demo*` existen sólo para poder presentar sin buses reales.
 */
export class AdminController {
  constructor(
    private incidents: IncidentService,
    private trips: ITripRepository,
    private reviews: IReviewRepository,
    private boarding: BoardingService,
    private sim: TripSimulationService,
    private passenger: PassengerService,
    private db: InMemoryDatabase,
  ) {}

  listIncidents(): Promise<ApiResult<Incident[]>> {
    return run(() => this.incidents.listAll());
  }
  setIncidentStatus(id: string, status: IncidentStatus): Promise<ApiResult<void>> {
    return run(() => this.incidents.setStatus(id, status));
  }
  getMetrics(): Promise<ApiResult<AdminMetrics>> {
    return run(async () => {
      const active = await this.trips.listActive();
      const reviews = await this.reviews.listAll();
      const incidents = await this.incidents.listAll();
      return {
        activeTrips: active.length,
        openIncidents: incidents.filter((i) => i.status !== 'resuelta').length,
        averageRating: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null,
        reviewCount: reviews.length,
        occupancyByTrip: await Promise.all(
          active.map(async (t) => {
            const o = await this.boarding.occupancy(t.id);
            return { tripId: t.id, occupied: o.occupied, capacity: o.capacity };
          }),
        ),
      };
    });
  }

  // ---- Controles de demo ----
  getSimulationSpeed(): number {
    return this.sim.speedMultiplier;
  }
  demoSetSpeed(multiplier: number): void {
    this.sim.setSpeed(multiplier);
  }
  /** Mueve el viaje activo a `metersBefore` metros antes de la parada indicada. */
  async demoMoveTripNearStop(routeId: string, stopIndex: number, metersBefore: number): Promise<void> {
    const [trip] = await this.trips.findActiveByRoute(routeId);
    const route = this.db.routes.find((r) => r.id === routeId);
    if (!trip || !route) return;
    const target = route.stops[stopIndex].distanceFromStartM;
    trip.positionM = Math.max(0, target - metersBefore);
    trip.nextStopIndex = route.stops.findIndex((s) => s.distanceFromStartM > trip.positionM + 0.5);
    if (trip.nextStopIndex < 0) trip.nextStopIndex = route.stops.length;
    trip.dwellRemainingS = 0;
    await this.trips.save(trip);
  }
  async demoFillBus(routeId: string, freeSeats: number): Promise<void> {
    const [trip] = await this.trips.findActiveByRoute(routeId);
    if (!trip) return;
    let occ = await this.boarding.occupancy(trip.id);
    while (occ.available > freeSeats) occ = await this.boarding.addManual(trip.id);
  }
  demoReset(): void {
    this.db.reset();
    this.passenger.resetState();
  }
}
