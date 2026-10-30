import type { Bus, Route, Trip, User } from '@/domain/model';
import type { IBoardingRepository, IBusRepository, IRouteRepository, ITripRepository } from '@/domain/repository';
import type { BoardingService, Occupancy } from './BoardingService';
import { EtaService } from './EtaService';
import { DomainError } from './errors';

export interface DriverPanel {
  trip: Trip;
  route: Route;
  bus: Bus;
  occupancy: Occupancy;
  speedKmh: number;
  nextStop?: { name: string; seconds: number; distanceM: number };
  atTerminal: boolean;
}

export interface TripSummary {
  kmTraveled: number;
  qrCount: number;
  manualCount: number;
  durationMin: number;
}

export class DriverService {
  private eta = new EtaService();

  constructor(
    private trips: ITripRepository,
    private routes: IRouteRepository,
    private buses: IBusRepository,
    private boardingRepo: IBoardingRepository,
    private boarding: BoardingService,
    private now: () => number = () => Date.now(),
  ) {}

  listBuses(): Promise<Bus[]> {
    return this.buses.list();
  }

  listRoutes(): Promise<Route[]> {
    return this.routes.list();
  }

  /** Inicia el viaje o retoma el que ya estaba en curso con esa unidad. */
  async startTrip(driver: User, busId: string, routeId: string): Promise<Trip> {
    const bus = await this.buses.findById(busId);
    if (!bus) throw new DomainError('BUS_NOT_FOUND', 'La unidad no existe.');
    if (!bus.online) throw new DomainError('BUS_OFFLINE', `El Bus #${bus.number} está fuera de línea.`);
    const route = await this.routes.findById(routeId);
    if (!route) throw new DomainError('ROUTE_NOT_FOUND', 'La ruta no existe.');

    const existing = await this.trips.findActiveByBus(busId);
    if (existing) {
      if (existing.driverId !== driver.id) throw new DomainError('BUS_IN_USE', 'Esa unidad la está usando otro conductor.');
      return existing;
    }
    const trip: Trip = {
      id: `trip-${this.now()}`,
      routeId, busId, driverId: driver.id, status: 'en_curso', startedAt: this.now(),
      positionM: 0, speedMps: 0, avgSpeedMps: route.historicalSpeedsKmh[0] / 3.6, dwellRemainingS: 0, nextStopIndex: 0,
    };
    await this.trips.save(trip);
    return trip;
  }

  async getPanel(tripId: string): Promise<DriverPanel> {
    const trip = await this.trips.findById(tripId);
    if (!trip) throw new DomainError('NO_TRIP', 'Viaje no encontrado.');
    const route = (await this.routes.findById(trip.routeId))!;
    const bus = (await this.buses.findById(trip.busId))!;
    const occupancy = await this.boarding.occupancy(trip.id);
    const atTerminal = trip.nextStopIndex >= route.stops.length;
    let nextStop: DriverPanel['nextStop'];
    if (!atTerminal) {
      const stop = route.stops[trip.nextStopIndex];
      const e = this.eta.estimate(route, trip, trip.nextStopIndex);
      nextStop = { name: stop.name, seconds: e.seconds, distanceM: e.distanceM };
    }
    return { trip, route, bus, occupancy, speedKmh: Math.round(trip.speedMps * 3.6), nextStop, atTerminal };
  }

  /** Cierra el viaje y todos los abordajes que hayan quedado abiertos. */
  async finishTrip(tripId: string): Promise<TripSummary> {
    const trip = await this.trips.findById(tripId);
    if (!trip || trip.status !== 'en_curso') throw new DomainError('NO_TRIP', 'El viaje ya no está en curso.');
    const all = await this.boardingRepo.listByTrip(tripId);
    const qrCount = all.filter((b) => b.method !== 'manual').length;
    const manualCount = all.filter((b) => b.method === 'manual').length;
    await this.boarding.closeAllForTrip(tripId);
    trip.status = 'finalizado';
    trip.endedAt = this.now();
    trip.speedMps = 0;
    await this.trips.save(trip);
    return {
      kmTraveled: Math.round((trip.positionM / 1000) * 10) / 10,
      qrCount,
      manualCount,
      durationMin: Math.max(1, Math.round((trip.endedAt - trip.startedAt) / 60_000)),
    };
  }
}
