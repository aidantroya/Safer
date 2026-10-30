import type { Boarding, Trip } from '@/domain/model';
import { isOpen } from '@/domain/model';
import type { IBoardingRepository, IBusRepository, ITripRepository, IUserRepository } from '@/domain/repository';
import { DomainError } from './errors';

export interface Occupancy {
  occupied: number;
  capacity: number;
  qr: number;
  manual: number;
  available: number;
  percent: number;
}

export interface PassToken {
  token: string;
  issuedAt: number;
  expiresAt: number;
}

export interface WeeklySummary {
  /** Lunes..Domingo */
  perDay: number[];
  total: number;
  averagePerWeekday: number;
}

export const PASS_TTL_MS = 60_000;

export type ScanOutcome =
  | { action: 'boarded'; passengerId: string; occupancy: Occupancy }
  | { action: 'alighted'; passengerId: string; occupancy: Occupancy };

/**
 * Aforo y abordajes. Regla de oro: el aforo se CALCULA contando abordajes abiertos
 * (nunca un contador suelto), así un escaneo repetido o un viaje cerrado no lo desajusta.
 */
export class BoardingService {
  private passTokens = new Map<string, { userId: string; expiresAt: number }>();

  constructor(
    private boardings: IBoardingRepository,
    private trips: ITripRepository,
    private buses: IBusRepository,
    private users: IUserRepository,
    private now: () => number = () => Date.now(),
  ) {}

  // ---------- Pase del pasajero (token dinámico) ----------
  async issuePass(userId: string): Promise<PassToken> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('USER_NOT_FOUND', 'Usuario no existe.');
    const issuedAt = this.now();
    const nonce = Math.random().toString(36).slice(2, 10).toUpperCase();
    const token = `BT.${user.studentId ?? user.id}.${nonce}`;
    const expiresAt = issuedAt + PASS_TTL_MS;
    this.passTokens.set(token, { userId, expiresAt });
    return { token, issuedAt, expiresAt };
  }

  /** El conductor escanea el pase de un pasajero: sube si estaba afuera, baja si estaba adentro. */
  async scanPass(tripId: string, token: string): Promise<ScanOutcome> {
    const entry = this.passTokens.get(token);
    if (!entry) throw new DomainError('PASS_INVALID', 'Código no válido.');
    if (entry.expiresAt < this.now()) {
      this.passTokens.delete(token);
      throw new DomainError('PASS_EXPIRED', 'El código expiró. Pide al pasajero que lo regenere.');
    }
    this.passTokens.delete(token); // un solo uso
    return this.toggle(tripId, entry.userId, 'qr_pase');
  }

  /** El pasajero escanea el QR pegado en la unidad (flujo alterno). */
  async scanUnit(userId: string, unitCode: string, opts: { distanceToBusM?: number; maxDistanceM?: number; demoMode?: boolean } = {}): Promise<ScanOutcome> {
    const bus = await this.buses.findByUnitCode(unitCode);
    if (!bus) throw new DomainError('UNIT_INVALID', 'QR no válido: la unidad no existe.');
    const trip = await this.trips.findActiveByBus(bus.id);
    if (!trip) throw new DomainError('NO_TRIP', 'Esa unidad no tiene un viaje en curso.');
    const max = opts.maxDistanceM ?? 80;
    if (!opts.demoMode && opts.distanceToBusM !== undefined && opts.distanceToBusM > max) {
      throw new DomainError('TOO_FAR', `Estás a ${Math.round(opts.distanceToBusM)} m del bus. Acércate a menos de ${max} m.`);
    }
    return this.toggle(trip.id, userId, 'qr_unidad');
  }

  private async toggle(tripId: string, passengerId: string, method: Boarding['method']): Promise<ScanOutcome> {
    const trip = await this.requireActiveTrip(tripId);
    const open = await this.boardings.findOpenByPassenger(passengerId);
    if (open && open.tripId === trip.id) {
      await this.boardings.save({ ...open, alightedAt: this.now(), alightMethod: method });
      return { action: 'alighted', passengerId, occupancy: await this.occupancy(trip.id) };
    }
    if (open) throw new DomainError('ALREADY_ONBOARD', 'Ya tienes un viaje abierto en otra unidad.');
    await this.assertCapacity(trip);
    await this.boardings.save({ id: this.boardings.nextId(), tripId: trip.id, passengerId, method, boardedAt: this.now() });
    return { action: 'boarded', passengerId, occupancy: await this.occupancy(trip.id) };
  }

  // ---------- Conteo manual del conductor ----------
  async addManual(tripId: string): Promise<Occupancy> {
    const trip = await this.requireActiveTrip(tripId);
    await this.assertCapacity(trip);
    await this.boardings.save({ id: this.boardings.nextId(), tripId, passengerId: null, method: 'manual', boardedAt: this.now() });
    return this.occupancy(tripId);
  }

  /** Sólo se pueden restar pasajeros manuales; nunca baja a un pasajero con QR. */
  async removeManual(tripId: string): Promise<Occupancy> {
    await this.requireActiveTrip(tripId);
    const list = await this.boardings.listByTrip(tripId);
    const manual = list.filter((b) => b.method === 'manual' && isOpen(b)).pop();
    if (!manual) throw new DomainError('NO_MANUAL', 'No hay pasajeros manuales para restar.');
    await this.boardings.save({ ...manual, alightedAt: this.now(), alightMethod: 'manual' });
    return this.occupancy(tripId);
  }

  // ---------- Cierres automáticos ----------
  async closeForPassenger(passengerId: string, method: 'llegada' | 'fin_de_viaje'): Promise<void> {
    const open = await this.boardings.findOpenByPassenger(passengerId);
    if (open) await this.boardings.save({ ...open, alightedAt: this.now(), alightMethod: method });
  }

  async closeAllForTrip(tripId: string): Promise<number> {
    const open = (await this.boardings.listByTrip(tripId)).filter(isOpen);
    for (const b of open) await this.boardings.save({ ...b, alightedAt: this.now(), alightMethod: 'fin_de_viaje' });
    return open.length;
  }

  // ---------- Consultas ----------
  async occupancy(tripId: string): Promise<Occupancy> {
    const trip = await this.trips.findById(tripId);
    const bus = trip ? await this.buses.findById(trip.busId) : undefined;
    const capacity = bus?.capacity ?? 40;
    const open = (await this.boardings.listByTrip(tripId)).filter(isOpen);
    const manual = open.filter((b) => b.method === 'manual').length;
    const qr = open.length - manual;
    const occupied = open.length;
    return { occupied, capacity, qr, manual, available: Math.max(0, capacity - occupied), percent: Math.round((occupied * 100) / capacity) };
  }

  async isOnboard(passengerId: string): Promise<Boarding | undefined> {
    return this.boardings.findOpenByPassenger(passengerId);
  }

  async weeklySummary(passengerId: string): Promise<WeeklySummary> {
    const list = await this.boardings.listByPassenger(passengerId);
    const now = new Date(this.now());
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    for (const b of list) {
      const t = b.boardedAt;
      if (t < monday.getTime()) continue;
      const idx = (new Date(t).getDay() + 6) % 7;
      perDay[idx] += 1;
    }
    const total = perDay.reduce((a, b) => a + b, 0);
    const weekdaysElapsed = Math.min(5, ((now.getDay() + 6) % 7) + 1);
    return { perDay, total, averagePerWeekday: total === 0 ? 0 : Math.round(total / weekdaysElapsed) };
  }

  // ---------- helpers ----------
  private async requireActiveTrip(tripId: string): Promise<Trip> {
    const trip = await this.trips.findById(tripId);
    if (!trip || trip.status !== 'en_curso') throw new DomainError('NO_TRIP', 'El viaje no está en curso.');
    return trip;
  }

  private async assertCapacity(trip: Trip): Promise<void> {
    const occ = await this.occupancy(trip.id);
    if (occ.occupied >= occ.capacity) throw new DomainError('FULL', `Capacidad máxima alcanzada (${occ.capacity}).`);
  }
}
