import type { AlarmPreference, Bus, Departure, GpsFix, PassengerPlan, Route, Stop, Trip, User } from '@/domain/model';
import type {
  IBoardingRepository, IBusRepository, IReviewRepository, IRouteRepository, ITripRepository, IUserRepository,
} from '@/domain/repository';
import { isLeadReached } from './AlarmEvaluator';
import type { AlarmService } from './AlarmService';
import type { BoardingService, Occupancy, WeeklySummary } from './BoardingService';
import { EtaResult, EtaService } from './EtaService';
import { DomainError } from './errors';

export type PassengerState = 'esperando' | 'a_bordo' | 'bus_paso' | 'sin_servicio';

export type PassengerEvent =
  | { key: string; type: 'bus_approaching'; stopName: string; minutes: number; busNumber: number }
  | { key: string; type: 'wake_up'; stopName: string; minutes: number }
  | { key: string; type: 'arrived'; stopName: string };

export interface PendingReview {
  tripId: string;
  routeName: string;
  busNumber: number;
  driverName: string;
  minutes: number;
}

export interface PassengerSnapshot {
  user: User;
  route: Route;
  boardStop: Stop;
  dropStop: Stop;
  state: PassengerState;
  trip?: { id: string; positionM: number; speedKmh: number; nextStopIndex: number; gps?: GpsFix };
  bus?: Bus;
  occupancy?: Occupancy;
  target?: { stop: Stop; etaSeconds: number; distanceM: number; arrivalAtMs: number; stopsAway: number };
  traffic: { level: 'fluido' | 'moderado' | 'denso'; speedKmh: number };
  weekly: WeeklySummary;
  nextDeparture?: Departure;
  alarmPrefs: AlarmPreference;
  events: PassengerEvent[];
  pendingReview?: PendingReview;
}

const REVIEW_WINDOW_MS = 15 * 60_000;

/** Orquesta lo que ve el pasajero: viaje a seguir, ETA, aforo, alarmas y la reseña pendiente. */
export class PassengerService {
  private eta = new EtaService();
  private fired = new Set<string>();
  private dismissedReviews = new Set<string>();

  constructor(
    private users: IUserRepository,
    private routes: IRouteRepository,
    private trips: ITripRepository,
    private buses: IBusRepository,
    private boardingRepo: IBoardingRepository,
    private reviews: IReviewRepository,
    private boarding: BoardingService,
    private alarms: AlarmService,
    private now: () => number = () => Date.now(),
  ) {}

  resetState(): void {
    this.fired.clear();
    this.dismissedReviews.clear();
  }

  /** Foto completa del estado del pasajero. La UI la consulta cada ~½ s. */
  async snapshot(userId: string): Promise<PassengerSnapshot> {
    const user = await this.requirePassenger(userId);
    const plan = user.plan!;
    const route = (await this.routes.findById(plan.routeId))!;
    const boardIdx = route.stops.findIndex((s) => s.id === plan.boardStopId);
    const dropIdx = route.stops.findIndex((s) => s.id === plan.dropStopId);
    const prefs = await this.alarms.get(userId);
    const events: PassengerEvent[] = [];

    const open = await this.boardingRepo.findOpenByPassenger(userId);
    const active = await this.trips.findActiveByRoute(route.id);
    let trip: Trip | undefined;
    let state: PassengerState;
    let targetIdx = boardIdx;
    let etaRes: EtaResult | undefined;

    const onboardTrip = open ? active.find((t) => t.id === open.tripId) : undefined;
    if (onboardTrip) {
      trip = onboardTrip;
      state = 'a_bordo';
      targetIdx = dropIdx;
      etaRes = this.eta.estimate(route, trip, dropIdx);
      if (etaRes.passed || etaRes.distanceM <= 1) {
        await this.boarding.closeForPassenger(userId, 'llegada');
        this.pushOnce(events, { key: `arrived:${trip.id}:${userId}`, type: 'arrived', stopName: route.stops[dropIdx].name });
        state = 'esperando';
      } else if (prefs.wakeUpEnabled) {
        const stopsBefore = Math.max(0, dropIdx - trip.nextStopIndex);
        if (isLeadReached(prefs.wakeUpLead, { seconds: etaRes.seconds, distanceM: etaRes.distanceM, stopsBefore })) {
          this.pushOnce(events, {
            key: `wake:${trip.id}:${userId}`, type: 'wake_up', stopName: route.stops[dropIdx].name,
            minutes: Math.max(1, Math.round(etaRes.seconds / 60)),
          });
        }
      }
    } else {
      state = 'sin_servicio';
      // el bus que llegará primero a mi parada (los que ya pasaron quedan al final)
      const scored = active
        .map((t) => ({ t, e: this.eta.estimate(route, t, boardIdx) }))
        .sort((a, b) => Number(a.e.passed) - Number(b.e.passed) || a.e.seconds - b.e.seconds);
      if (scored.length) {
        trip = scored[0].t;
        etaRes = scored[0].e;
        state = etaRes.passed ? 'bus_paso' : 'esperando';
        if (!etaRes.passed && prefs.arrivalEnabled) {
          const stopsBefore = Math.max(0, boardIdx - trip.nextStopIndex);
          if (isLeadReached(prefs.arrivalLead, { seconds: etaRes.seconds, distanceM: etaRes.distanceM, stopsBefore })) {
            const bus = await this.buses.findById(trip.busId);
            this.pushOnce(events, {
              key: `approach:${trip.id}:${userId}`, type: 'bus_approaching', stopName: route.stops[boardIdx].name,
              minutes: Math.max(1, Math.round(etaRes.seconds / 60)), busNumber: bus?.number ?? 0,
            });
          }
        }
      }
    }

    const bus = trip ? await this.buses.findById(trip.busId) : undefined;
    const occupancy = trip ? await this.boarding.occupancy(trip.id) : undefined;
    const speedMps = trip ? (trip.speedMps > 0 ? trip.speedMps : trip.avgSpeedMps) : 0;
    const speedKmh = Math.round(speedMps * 3.6);

    return {
      user, route, boardStop: route.stops[boardIdx], dropStop: route.stops[dropIdx], state,
      trip: trip && { id: trip.id, positionM: trip.positionM, speedKmh: Math.round(trip.speedMps * 3.6), nextStopIndex: trip.nextStopIndex, gps: trip.gps },
      bus, occupancy,
      target: trip && etaRes && {
        stop: route.stops[targetIdx],
        etaSeconds: etaRes.seconds,
        distanceM: etaRes.distanceM,
        arrivalAtMs: this.now() + etaRes.seconds * 1000,
        stopsAway: Math.max(0, targetIdx - trip.nextStopIndex + 1),
      },
      traffic: { level: speedKmh >= 18 ? 'fluido' : speedKmh >= 10 ? 'moderado' : 'denso', speedKmh },
      weekly: await this.boarding.weeklySummary(userId),
      nextDeparture: await this.routes.nextDeparture(this.now()),
      alarmPrefs: prefs,
      events,
      pendingReview: await this.findPendingReview(userId),
    };
  }

  async updatePlan(userId: string, change: Partial<Pick<PassengerPlan, 'boardStopId' | 'dropStopId'>>): Promise<void> {
    const user = await this.requirePassenger(userId);
    const route = (await this.routes.findById(user.plan!.routeId))!;
    const next = { ...user.plan!, ...change };
    const b = route.stops.findIndex((s) => s.id === next.boardStopId);
    const d = route.stops.findIndex((s) => s.id === next.dropStopId);
    if (b < 0 || d < 0) throw new DomainError('BAD_STOP', 'Parada no válida.');
    if (d <= b) throw new DomainError('BAD_STOP', 'Tu bajada debe estar después de tu subida.');
    await this.users.save({ ...user, plan: next });
  }

  /** El estudiante registra la ruta que usa: desde ahí el mapa en vivo y los avisos siguen esa ruta. */
  async selectRoute(userId: string, routeId: string, stops?: Pick<PassengerPlan, 'boardStopId' | 'dropStopId'>): Promise<void> {
    const user = await this.requirePassenger(userId);
    const route = await this.routes.findById(routeId);
    if (!route) throw new DomainError('ROUTE_NOT_FOUND', 'La ruta no existe.');
    if (await this.boardingRepo.findOpenByPassenger(userId)) {
      throw new DomainError('ON_BOARD', 'Estás a bordo de un bus. Cambia de ruta cuando bajes.');
    }
    const boardStopId = stops?.boardStopId ?? route.stops[0].id;
    const dropStopId = stops?.dropStopId ?? route.stops[route.stops.length - 1].id;
    const b = route.stops.findIndex((s) => s.id === boardStopId);
    const d = route.stops.findIndex((s) => s.id === dropStopId);
    if (b < 0 || d < 0) throw new DomainError('BAD_STOP', 'Parada no válida.');
    if (d <= b) throw new DomainError('BAD_STOP', 'Tu bajada debe estar después de tu subida.');
    await this.users.save({ ...user, plan: { ...user.plan!, routeId, boardStopId, dropStopId } });
  }

  dismissReview(tripId: string, userId: string): void {
    this.dismissedReviews.add(`${tripId}:${userId}`);
  }

  /** Texto para el reporte: dónde está el pasajero ahora. */
  async locationLabel(userId: string): Promise<{ label: string; tripId?: string }> {
    const user = await this.requirePassenger(userId);
    const open = await this.boardingRepo.findOpenByPassenger(userId);
    if (open) {
      const trip = await this.trips.findById(open.tripId);
      const bus = trip && (await this.buses.findById(trip.busId));
      const route = trip && (await this.routes.findById(trip.routeId));
      if (trip && bus && route) {
        const i = Math.min(trip.nextStopIndex, route.stops.length - 1);
        return { label: `Bus #${bus.number} • rumbo a ${route.stops[i].name}`, tripId: trip.id };
      }
    }
    return { label: user.plan!.areaLabel };
  }

  // ---------- helpers ----------
  private pushOnce(events: PassengerEvent[], e: PassengerEvent): void {
    if (this.fired.has(e.key)) return;
    this.fired.add(e.key);
    events.push(e);
  }

  private async findPendingReview(userId: string): Promise<PendingReview | undefined> {
    const list = await this.boardingRepo.listByPassenger(userId);
    const closed = list
      .filter((b) => b.alightedAt !== undefined && this.now() - b.alightedAt! < REVIEW_WINDOW_MS)
      .sort((a, b) => b.alightedAt! - a.alightedAt!);
    for (const b of closed) {
      if (this.dismissedReviews.has(`${b.tripId}:${userId}`)) continue;
      if (await this.reviews.findByTripAndPassenger(b.tripId, userId)) continue;
      const trip = await this.trips.findById(b.tripId);
      if (!trip) continue;
      const route = await this.routes.findById(trip.routeId);
      const bus = await this.buses.findById(trip.busId);
      const driver = await this.users.findById(trip.driverId);
      if (!route || !bus) continue;
      return {
        tripId: trip.id,
        routeName: `Ruta ESPOL - ${route.shortName}`,
        busNumber: bus.number,
        driverName: driver ? `${driver.name} ${driver.fullName.split(' ')[1]?.[0] ?? ''}.`.trim() : 'Conductor',
        minutes: Math.max(1, Math.round((b.alightedAt! - b.boardedAt) / 60_000)),
      };
    }
    return undefined;
  }

  private async requirePassenger(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'passenger' || !user.plan) throw new DomainError('NOT_PASSENGER', 'Usuario no es pasajero.');
    return user;
  }
}
