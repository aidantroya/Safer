import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bus, Departure, Route, RouteAssignment, User } from '@/domain/model';
import type { IAssignmentRepository, IBusRepository, IRouteRepository, IUserRepository } from '@/domain/repository';
import { DomainError } from '@/service/errors';
import { parsePoint } from '../remote/postgis';

/**
 * Repositorios contra la base real de Supabase (tablas routes, stops, buses, profiles, user_roles,
 * route_departures y route_assignments). Cumplen los mismos contratos que los de memoria.
 * Requieren sesión iniciada: las políticas de RLS sólo dejan leer a `authenticated`.
 */

/** Ids de rol que cuentan como conductor / coordinación en la tabla `roles`. */
export const DRIVER_ROLE_IDS = ['driver', 'conductor'];
export const COORDINATOR_ROLE_IDS = ['admin', 'coordinator', 'coordinador'];

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new DomainError(res.error.code ?? 'SUPABASE', `No se pudo leer ${what}: ${res.error.message}`);
  return res.data as T;
}

interface RouteRow {
  id: string;
  code: string | number | null;
  name: string;
  short_name: string | null;
  length_m: number | null;
  frequency_min: number | null;
  active: boolean | null;
  historical_speeds_kmh: number[] | null;
}
interface StopRow {
  id: string;
  route_id: string;
  name: string;
  stop_order: number;
  distance_from_start_m: number | null;
  location: unknown;
}

export class SupabaseRouteRepository implements IRouteRepository {
  private cache?: Promise<Route[]>;

  constructor(private sb: SupabaseClient) {}

  list(): Promise<Route[]> {
    this.cache ??= this.load().catch((e) => {
      this.cache = undefined;
      throw e;
    });
    return this.cache;
  }

  async findById(id: string): Promise<Route | undefined> {
    return (await this.list()).find((r) => r.id === id);
  }

  async nextDeparture(nowMs: number): Promise<Departure | undefined> {
    const rows = check(
      await this.sb.from('route_departures').select('route_id, departs_at').order('departs_at'),
      'los horarios',
    ) as { route_id: string; departs_at: string }[];
    const d = new Date(nowMs);
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const next = rows.find((r) => r.departs_at.slice(0, 5) > hhmm);
    if (!next) return undefined;
    const route = await this.findById(next.route_id);
    return { routeLabel: `Ruta ${route?.code ?? ''}`, detail: route?.name ?? 'Ruta', time: next.departs_at.slice(0, 5) };
  }

  private async load(): Promise<Route[]> {
    const routes = check(
      await this.sb.from('routes').select('id, code, name, short_name, length_m, frequency_min, active, historical_speeds_kmh').order('code'),
      'las rutas',
    ) as RouteRow[];
    const stops = check(
      await this.sb.from('stops').select('id, route_id, name, stop_order, distance_from_start_m, location').order('stop_order'),
      'las paradas',
    ) as StopRow[];

    return routes
      .filter((r) => r.active !== false)
      .map((r) => {
        const own = stops.filter((s) => s.route_id === r.id).sort((a, b) => a.stop_order - b.stop_order);
        const lengthM = r.length_m ?? Math.max(1000, ...own.map((s) => s.distance_from_start_m ?? 0));
        const code = r.code === null ? '—' : Number.isNaN(Number(r.code)) ? String(r.code) : Number(r.code);
        return {
          id: r.id,
          code,
          name: r.name,
          shortName: r.short_name ?? r.name,
          lengthM,
          frequencyMin: r.frequency_min ?? 15,
          stops: own.map((s, i) => {
            const p = parsePoint(s.location);
            return {
              id: s.id,
              name: s.name,
              order: s.stop_order ?? i + 1,
              distanceFromStartM: s.distance_from_start_m ?? ((i + 1) * lengthM) / (own.length + 1),
              ...(p ? { lat: p[0], lng: p[1] } : {}),
            };
          }),
          historicalSpeedsKmh: r.historical_speeds_kmh?.length === own.length + 1 ? r.historical_speeds_kmh : Array(own.length + 1).fill(20),
        } satisfies Route;
      });
  }
}

export class SupabaseBusRepository implements IBusRepository {
  constructor(private sb: SupabaseClient) {}

  async list(): Promise<Bus[]> {
    const rows = check(
      await this.sb.from('buses').select('id, number, plate, capacity, online, unit_code').order('number'),
      'los buses',
    ) as { id: string; number: number; plate: string | null; capacity: number | null; online: boolean | null; unit_code: string | null }[];
    return rows.map((b) => ({
      id: b.id,
      number: b.number,
      plate: b.plate ?? '',
      capacity: b.capacity ?? 40,
      online: b.online !== false,
      unitCode: b.unit_code ?? '',
    }));
  }
  async findById(id: string): Promise<Bus | undefined> {
    return (await this.list()).find((b) => b.id === id);
  }
  async findByUnitCode(code: string): Promise<Bus | undefined> {
    return (await this.list()).find((b) => b.unitCode === code);
  }
}

/** Conductores = perfiles con rol de conductor en user_roles. Sólo lectura desde la app. */
export class SupabaseUserRepository implements IUserRepository {
  constructor(private sb: SupabaseClient) {}

  async listByRole(role: User['role']): Promise<User[]> {
    if (role !== 'driver') return [];
    const links = check(
      await this.sb.from('user_roles').select('user_id, role_id').in('role_id', DRIVER_ROLE_IDS),
      'los roles',
    ) as { user_id: string }[];
    const ids = [...new Set(links.map((l) => l.user_id))];
    if (!ids.length) return [];
    const profiles = check(
      await this.sb.from('profiles').select('id, full_name, name, email').in('id', ids),
      'los conductores',
    ) as { id: string; full_name: string | null; name: string | null; email: string | null }[];
    return profiles
      .map((p) => {
        const fullName = p.full_name ?? p.name ?? p.email ?? 'Conductor';
        return { id: p.id, name: p.name ?? fullName.split(' ')[0], fullName, email: p.email ?? '', role: 'driver' as const };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async findById(id: string): Promise<User | undefined> {
    return (await this.listByRole('driver')).find((u) => u.id === id);
  }

  async findByCredentials(): Promise<User | undefined> {
    throw new DomainError('USE_AUTH', 'Con la base real se entra con Supabase Auth.');
  }
  async save(): Promise<void> {
    throw new DomainError('READ_ONLY', 'Los perfiles se editan desde Supabase.');
  }
}

interface AssignmentRow {
  route_id: string;
  weekday: number;
  driver_id: string;
  bus_id: string;
}

export class SupabaseAssignmentRepository implements IAssignmentRepository {
  constructor(private sb: SupabaseClient) {}

  async listAll(): Promise<RouteAssignment[]> {
    const res = await this.sb.from('route_assignments').select('route_id, weekday, driver_id, bus_id');
    if (res.error?.code === 'PGRST205') {
      throw new DomainError('MISSING_TABLE', 'Falta crear la tabla route_assignments: corre la migración de supabase/migrations en el SQL Editor.');
    }
    return (check(res, 'la planificación') as AssignmentRow[]).map((a) => ({
      routeId: a.route_id, weekday: a.weekday, driverId: a.driver_id, busId: a.bus_id,
    }));
  }
  async listForDay(weekday: number): Promise<RouteAssignment[]> {
    return (await this.listAll()).filter((a) => a.weekday === weekday);
  }
  async findForRoute(routeId: string, weekday: number): Promise<RouteAssignment | undefined> {
    return (await this.listAll()).find((a) => a.routeId === routeId && a.weekday === weekday);
  }
  async findForDriver(driverId: string, weekday: number): Promise<RouteAssignment | undefined> {
    return (await this.listAll()).find((a) => a.driverId === driverId && a.weekday === weekday);
  }
  replaceDay(weekday: number, items: RouteAssignment[]): Promise<void> {
    return this.replaceDays([{ weekday, items }]);
  }
  /** Una sola llamada a save_route_plan: la base guarda todos los días en una transacción. */
  async replaceDays(days: { weekday: number; items: RouteAssignment[] }[]): Promise<void> {
    const { error } = await this.sb.rpc('save_route_plan', {
      p_days: days.map((d) => ({
        weekday: d.weekday,
        items: d.items.map((i) => ({ route_id: i.routeId, driver_id: i.driverId, bus_id: i.busId })),
      })),
    });
    if (!error) return;
    if (error.code === '42501') throw new DomainError('FORBIDDEN', 'Tu cuenta no tiene permiso de Coordinación para guardar el plan.');
    if (error.code === '23505') throw new DomainError('DUPLICATE', 'Un conductor o un bus quedó repetido el mismo día.');
    if (error.code === 'PGRST202') {
      throw new DomainError('MISSING_FN', 'Falta la función save_route_plan: corre la migración de supabase/migrations en el SQL Editor.');
    }
    throw new DomainError(error.code ?? 'SUPABASE', `No se pudo guardar el plan: ${error.message}`);
  }
}
