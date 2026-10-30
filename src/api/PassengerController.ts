import type { AlarmPreference, Incident, IncidentType, PassengerPlan, Review } from '@/domain/model';
import type { AlarmService } from '@/service/AlarmService';
import type { BoardingService, PassToken, ScanOutcome } from '@/service/BoardingService';
import type { IncidentService } from '@/service/IncidentService';
import type { PassengerService, PassengerSnapshot } from '@/service/PassengerService';
import type { ReviewService } from '@/service/ReviewService';
import type { RouteCatalogService, RouteOverview } from '@/service/RouteCatalogService';
import { run, type ApiResult } from './ApiResult';

/** Todo lo que la app del pasajero puede pedirle al sistema. */
export class PassengerController {
  constructor(
    private passenger: PassengerService,
    private boarding: BoardingService,
    private alarms: AlarmService,
    private incidents: IncidentService,
    private reviews: ReviewService,
    private catalog: RouteCatalogService,
  ) {}

  getSnapshot(userId: string): Promise<ApiResult<PassengerSnapshot>> {
    return run(() => this.passenger.snapshot(userId));
  }

  // Rutas
  listRoutes(): Promise<ApiResult<RouteOverview[]>> {
    return run(() => this.catalog.listToday());
  }
  selectRoute(userId: string, routeId: string, stops?: Pick<PassengerPlan, 'boardStopId' | 'dropStopId'>): Promise<ApiResult<void>> {
    return run(() => this.passenger.selectRoute(userId, routeId, stops));
  }

  changeStops(userId: string, change: Partial<Pick<PassengerPlan, 'boardStopId' | 'dropStopId'>>): Promise<ApiResult<void>> {
    return run(() => this.passenger.updatePlan(userId, change));
  }

  // Pase QR
  issuePass(userId: string): Promise<ApiResult<PassToken>> {
    return run(() => this.boarding.issuePass(userId));
  }
  /** Flujo alterno: el pasajero escanea el QR pegado en el bus. */
  scanUnitQr(userId: string, unitCode: string, opts?: { distanceToBusM?: number; demoMode?: boolean }): Promise<ApiResult<ScanOutcome>> {
    return run(() => this.boarding.scanUnit(userId, unitCode, opts));
  }

  // Alarmas
  getAlarmPreferences(userId: string): Promise<ApiResult<AlarmPreference>> {
    return run(() => this.alarms.get(userId));
  }
  saveAlarmPreferences(pref: AlarmPreference): Promise<ApiResult<AlarmPreference>> {
    return run(() => this.alarms.save(pref));
  }

  // Incidencias
  async reportIncident(input: { userId: string; type: IncidentType; description: string; photoDataUrl?: string; photoBytes?: number }): Promise<ApiResult<Incident>> {
    return run(async () => {
      const loc = await this.passenger.locationLabel(input.userId);
      return this.incidents.create({
        reporterId: input.userId, tripId: loc.tripId, type: input.type, description: input.description,
        photoDataUrl: input.photoDataUrl, photoBytes: input.photoBytes, locationLabel: loc.label,
      });
    });
  }
  getLocationLabel(userId: string): Promise<ApiResult<{ label: string; tripId?: string }>> {
    return run(() => this.passenger.locationLabel(userId));
  }

  // Reseñas
  submitReview(input: { tripId: string; passengerId: string; rating: number; tags: string[]; comment: string }): Promise<ApiResult<Review>> {
    return run(() => this.reviews.submit(input));
  }
  skipReview(tripId: string, userId: string): void {
    this.passenger.dismissReview(tripId, userId);
  }
}
