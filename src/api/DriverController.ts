import type { Bus, Incident, IncidentType, Route, Trip, User } from '@/domain/model';
import type { Occupancy } from '@/service/BoardingService';
import type { BoardingService, ScanOutcome } from '@/service/BoardingService';
import type { DriverPanel, DriverService, TripSummary } from '@/service/DriverService';
import type { IncidentService } from '@/service/IncidentService';
import type { DriverProfile, RouteCatalogService } from '@/service/RouteCatalogService';
import { DomainError } from '@/service/errors';
import { run, type ApiResult } from './ApiResult';

export class DriverController {
  constructor(
    private driver: DriverService,
    private boarding: BoardingService,
    private incidents: IncidentService,
    private catalog: RouteCatalogService,
  ) {}

  getSetupOptions(): Promise<ApiResult<{ buses: Bus[]; routes: Route[] }>> {
    return run(async () => ({ buses: await this.driver.listBuses(), routes: await this.driver.listRoutes() }));
  }
  /** Ruta y unidad que Coordinación le asignó hoy al conductor. */
  getTodayAssignment(driverId: string): Promise<ApiResult<{ route: Route; bus: Bus } | undefined>> {
    return run(() => this.catalog.todayFor(driverId));
  }
  getProfile(driverId: string): Promise<ApiResult<DriverProfile>> {
    return run(async () => {
      const p = await this.catalog.driverProfile(driverId);
      if (!p) throw new DomainError('NOT_DRIVER', 'Conductor no encontrado.');
      return p;
    });
  }
  startTrip(driver: User, busId: string, routeId: string): Promise<ApiResult<Trip>> {
    return run(() => this.driver.startTrip(driver, busId, routeId));
  }
  getPanel(tripId: string): Promise<ApiResult<DriverPanel>> {
    return run(() => this.driver.getPanel(tripId));
  }
  addManual(tripId: string): Promise<ApiResult<Occupancy>> {
    return run(() => this.boarding.addManual(tripId));
  }
  removeManual(tripId: string): Promise<ApiResult<Occupancy>> {
    return run(() => this.boarding.removeManual(tripId));
  }
  scanPassenger(tripId: string, token: string): Promise<ApiResult<ScanOutcome>> {
    return run(() => this.boarding.scanPass(tripId, token));
  }
  finishTrip(tripId: string): Promise<ApiResult<TripSummary>> {
    return run(() => this.driver.finishTrip(tripId));
  }
  reportIncident(input: { driverId: string; tripId?: string; type: IncidentType; description: string; photoDataUrl?: string; photoBytes?: number; locationLabel: string }): Promise<ApiResult<Incident>> {
    return run(() =>
      this.incidents.create({
        reporterId: input.driverId, tripId: input.tripId, type: input.type, description: input.description,
        photoDataUrl: input.photoDataUrl, photoBytes: input.photoBytes, locationLabel: input.locationLabel,
      }),
    );
  }
}
