import type {
  AlarmPreference, Boarding, Bus, Departure, Incident, Review, Route, RouteAssignment, Trip, User,
} from '@/domain/model';
import { createSeed } from './seed';

export interface Credential { email: string; secret: string; userId: string }

/**
 * "Base de datos" en memoria. Vive mientras la pestaña esté abierta.
 * Para pasar a Supabase: crea SupabaseDatabase con los mismos métodos de los repositorios
 * (ver data/datasource/supabaseClient.ts) y cámbialo en api/container.ts.
 */
export class InMemoryDatabase {
  users: User[] = [];
  credentials: Credential[] = [];
  routes: Route[] = [];
  buses: Bus[] = [];
  trips: Trip[] = [];
  boardings: Boarding[] = [];
  incidents: Incident[] = [];
  reviews: Review[] = [];
  alarmPrefs: AlarmPreference[] = [];
  assignments: RouteAssignment[] = [];
  departures: { atMinutes: number; item: Omit<Departure, 'time'> }[] = [];
  private boardingSeq = 0;
  private folioSeq = 8842;

  constructor(private readonly now: () => number = () => Date.now()) {
    this.reset();
  }

  reset(): void {
    const seed = createSeed(this.now());
    this.users = seed.users;
    this.credentials = seed.credentials;
    this.routes = seed.routes;
    this.buses = seed.buses;
    this.trips = seed.trips;
    this.boardings = seed.boardings;
    this.incidents = [];
    this.reviews = seed.reviews;
    this.alarmPrefs = seed.alarmPrefs;
    this.departures = seed.departures;
    this.assignments = seed.assignments;
    this.boardingSeq = this.boardings.length;
    this.folioSeq = 8842;
  }

  nextBoardingId(): string {
    this.boardingSeq += 1;
    return `brd-${this.boardingSeq}`;
  }

  nextFolio(): string {
    this.folioSeq += 1;
    return `#TR-${this.folioSeq}`;
  }
}
