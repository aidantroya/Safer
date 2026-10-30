import type {
  IAlarmPreferenceRepository, IBoardingRepository, IBusRepository, IIncidentRepository,
  IReviewRepository, IRouteRepository, ITripRepository, IUserRepository,
} from '@/domain/repository';
import type {
  AlarmPreference, Boarding, Bus, Departure, Incident, IncidentStatus, Review, Route, Trip, User,
} from '@/domain/model';
import type { InMemoryDatabase } from '../datasource/InMemoryDatabase';

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item);
  else list[i] = item;
};

export class InMemoryUserRepository implements IUserRepository {
  constructor(private db: InMemoryDatabase) {}
  async findById(id: string): Promise<User | undefined> {
    return this.db.users.find((u) => u.id === id);
  }
  async findByCredentials(email: string, secret: string): Promise<User | undefined> {
    const c = this.db.credentials.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.secret === secret);
    return c ? this.db.users.find((u) => u.id === c.userId) : undefined;
  }
  async save(user: User): Promise<void> {
    upsert(this.db.users, user);
  }
}

export class InMemoryRouteRepository implements IRouteRepository {
  constructor(private db: InMemoryDatabase) {}
  async findById(id: string): Promise<Route | undefined> {
    return this.db.routes.find((r) => r.id === id);
  }
  async list(): Promise<Route[]> {
    return [...this.db.routes];
  }
  async nextDeparture(nowMs: number): Promise<Departure | undefined> {
    const d = new Date(nowMs);
    const minutes = d.getHours() * 60 + d.getMinutes();
    const next = [...this.db.departures].sort((a, b) => a.atMinutes - b.atMinutes).find((x) => x.atMinutes > minutes);
    if (!next) return undefined;
    const hh = String(Math.floor(next.atMinutes / 60)).padStart(2, '0');
    const mm = String(next.atMinutes % 60).padStart(2, '0');
    return { ...next.item, time: `${hh}:${mm}` };
  }
}

export class InMemoryBusRepository implements IBusRepository {
  constructor(private db: InMemoryDatabase) {}
  async findById(id: string): Promise<Bus | undefined> {
    return this.db.buses.find((b) => b.id === id);
  }
  async findByUnitCode(code: string): Promise<Bus | undefined> {
    return this.db.buses.find((b) => b.unitCode === code);
  }
  async list(): Promise<Bus[]> {
    return [...this.db.buses];
  }
}

export class InMemoryTripRepository implements ITripRepository {
  constructor(private db: InMemoryDatabase) {}
  async findById(id: string): Promise<Trip | undefined> {
    return this.db.trips.find((t) => t.id === id);
  }
  async findActiveByRoute(routeId: string): Promise<Trip[]> {
    return this.db.trips.filter((t) => t.routeId === routeId && t.status === 'en_curso');
  }
  async findActiveByBus(busId: string): Promise<Trip | undefined> {
    return this.db.trips.find((t) => t.busId === busId && t.status === 'en_curso');
  }
  async listActive(): Promise<Trip[]> {
    return this.db.trips.filter((t) => t.status === 'en_curso');
  }
  async save(trip: Trip): Promise<void> {
    upsert(this.db.trips, trip);
  }
}

export class InMemoryBoardingRepository implements IBoardingRepository {
  constructor(private db: InMemoryDatabase) {}
  async listByTrip(tripId: string): Promise<Boarding[]> {
    return this.db.boardings.filter((b) => b.tripId === tripId);
  }
  async findOpenByPassenger(passengerId: string): Promise<Boarding | undefined> {
    return this.db.boardings.find((b) => b.passengerId === passengerId && b.alightedAt === undefined);
  }
  async listByPassenger(passengerId: string): Promise<Boarding[]> {
    return this.db.boardings.filter((b) => b.passengerId === passengerId);
  }
  async save(boarding: Boarding): Promise<void> {
    upsert(this.db.boardings, boarding);
  }
  nextId(): string {
    return this.db.nextBoardingId();
  }
}

export class InMemoryIncidentRepository implements IIncidentRepository {
  constructor(private db: InMemoryDatabase) {}
  async save(incident: Incident): Promise<void> {
    upsert(this.db.incidents, incident);
  }
  async listByReporter(reporterId: string): Promise<Incident[]> {
    return this.db.incidents.filter((i) => i.reporterId === reporterId).sort((a, b) => b.createdAt - a.createdAt);
  }
  async listAll(): Promise<Incident[]> {
    return [...this.db.incidents].sort((a, b) => b.createdAt - a.createdAt);
  }
  async updateStatus(id: string, status: IncidentStatus): Promise<void> {
    const i = this.db.incidents.find((x) => x.id === id);
    if (i) i.status = status;
  }
  nextFolio(): string {
    return this.db.nextFolio();
  }
}

export class InMemoryReviewRepository implements IReviewRepository {
  constructor(private db: InMemoryDatabase) {}
  async save(review: Review): Promise<void> {
    upsert(this.db.reviews, review);
  }
  async findByTripAndPassenger(tripId: string, passengerId: string): Promise<Review | undefined> {
    return this.db.reviews.find((r) => r.tripId === tripId && r.passengerId === passengerId);
  }
  async listByPassenger(passengerId: string): Promise<Review[]> {
    return this.db.reviews.filter((r) => r.passengerId === passengerId);
  }
  async listAll(): Promise<Review[]> {
    return [...this.db.reviews];
  }
}

export class InMemoryAlarmPreferenceRepository implements IAlarmPreferenceRepository {
  constructor(private db: InMemoryDatabase) {}
  async get(userId: string): Promise<AlarmPreference | undefined> {
    return this.db.alarmPrefs.find((p) => p.userId === userId);
  }
  async save(pref: AlarmPreference): Promise<void> {
    const i = this.db.alarmPrefs.findIndex((p) => p.userId === pref.userId);
    if (i === -1) this.db.alarmPrefs.push(pref);
    else this.db.alarmPrefs[i] = pref;
  }
}
