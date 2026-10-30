import type {
  AlarmPreference, Boarding, Bus, Departure, Incident, IncidentStatus, Review, Route, RouteAssignment, Trip, User,
} from '../model';

/** Contratos. El dominio sólo conoce estas interfaces; no sabe si detrás hay memoria o Supabase. */

export interface IUserRepository {
  findById(id: string): Promise<User | undefined>;
  findByCredentials(email: string, secret: string): Promise<User | undefined>;
  save(user: User): Promise<void>;
}

export interface IRouteRepository {
  findById(id: string): Promise<Route | undefined>;
  list(): Promise<Route[]>;
  nextDeparture(nowMs: number): Promise<Departure | undefined>;
}

export interface IBusRepository {
  findById(id: string): Promise<Bus | undefined>;
  findByUnitCode(code: string): Promise<Bus | undefined>;
  list(): Promise<Bus[]>;
}

export interface ITripRepository {
  findById(id: string): Promise<Trip | undefined>;
  findActiveByRoute(routeId: string): Promise<Trip[]>;
  findActiveByBus(busId: string): Promise<Trip | undefined>;
  listByDriver(driverId: string): Promise<Trip[]>;
  listActive(): Promise<Trip[]>;
  save(trip: Trip): Promise<void>;
}

export interface IBoardingRepository {
  listByTrip(tripId: string): Promise<Boarding[]>;
  findOpenByPassenger(passengerId: string): Promise<Boarding | undefined>;
  listByPassenger(passengerId: string): Promise<Boarding[]>;
  save(boarding: Boarding): Promise<void>;
  nextId(): string;
}

export interface IIncidentRepository {
  save(incident: Incident): Promise<void>;
  listByReporter(reporterId: string): Promise<Incident[]>;
  listAll(): Promise<Incident[]>;
  updateStatus(id: string, status: IncidentStatus): Promise<void>;
  nextFolio(): string;
}

export interface IReviewRepository {
  save(review: Review): Promise<void>;
  findByTripAndPassenger(tripId: string, passengerId: string): Promise<Review | undefined>;
  listByPassenger(passengerId: string): Promise<Review[]>;
  listAll(): Promise<Review[]>;
}

export interface IAlarmPreferenceRepository {
  get(userId: string): Promise<AlarmPreference | undefined>;
  save(pref: AlarmPreference): Promise<void>;
}

export interface IAssignmentRepository {
  listForDay(weekday: number): Promise<RouteAssignment[]>;
  findForRoute(routeId: string, weekday: number): Promise<RouteAssignment | undefined>;
  findForDriver(driverId: string, weekday: number): Promise<RouteAssignment | undefined>;
}
