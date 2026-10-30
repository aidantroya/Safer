import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/data/datasource/supabaseClient';
import {
  SupabaseAssignmentRepository, SupabaseBusRepository, SupabaseRouteRepository, SupabaseUserRepository,
} from '@/data/repository/SupabaseRepositories';
import { DomainError } from '@/service/errors';
import { PlanningService } from '@/service/PlanningService';
import { run, type ApiResult } from './ApiResult';
import { CoordinatorController } from './CoordinatorController';
import { app } from './index';

export interface DriverListItem {
  id: string;
  fullName: string;
  email: string;
  /** Bus habitual (tabla bus_drivers), si tiene. */
  busNumber?: number;
}

/** Sección "Conductores" de Coordinación. */
export interface DriversAdmin {
  /** false en modo demo: el alta de conductores necesita la base real. */
  canRegister: boolean;
  list(): Promise<ApiResult<DriverListItem[]>>;
  register(email: string, busNumber: number): Promise<ApiResult<void>>;
}

export interface CoordinatorApi {
  source: 'supabase' | 'demo';
  coordinator: CoordinatorController;
  drivers: DriversAdmin;
}

class SupabaseDriversAdmin implements DriversAdmin {
  canRegister = true;
  constructor(private sb: SupabaseClient, private users: SupabaseUserRepository) {}

  list(): Promise<ApiResult<DriverListItem[]>> {
    return run(async () => {
      const drivers = await this.users.listByRole('driver');
      const links = await this.sb.from('bus_drivers').select('bus_id, driver_id');
      const buses = await this.sb.from('buses').select('id, number');
      const busNumber = new Map((buses.data ?? []).map((b: { id: string; number: number }) => [b.id, b.number]));
      const busOf = new Map((links.data ?? []).map((l: { bus_id: string; driver_id: string }) => [l.driver_id, busNumber.get(l.bus_id)]));
      return drivers.map((d) => ({ id: d.id, fullName: d.fullName, email: d.email, busNumber: busOf.get(d.id) }));
    });
  }

  /** Usa la función de la base assign_driver: da el rol de conductor a esa cuenta y la liga al bus. */
  register(email: string, busNumber: number): Promise<ApiResult<void>> {
    return run(async () => {
      const { error } = await this.sb.rpc('assign_driver', { p_email: email.trim().toLowerCase(), p_bus_number: busNumber });
      if (error) {
        if (error.code === '42501') throw new DomainError('FORBIDDEN', 'Tu cuenta no tiene permiso de Coordinación.');
        throw new DomainError(error.code ?? 'SUPABASE', error.message);
      }
    });
  }
}

const demoDrivers: DriversAdmin = {
  canRegister: false,
  list: () =>
    app.coordinator.getWeekPlan().then((r) =>
      r.ok ? { ok: true as const, data: r.data.drivers.map((d) => ({ id: d.id, fullName: d.fullName, email: '' })) } : r,
    ),
  register: async () => ({ ok: false, error: 'En modo demo no se registran conductores.', code: 'DEMO' }),
};

let remote: CoordinatorApi | undefined;

/** Planificador sobre la base real (con sesión de Supabase) o sobre los datos de demo en memoria. */
export function coordinatorApi(useSupabase: boolean): CoordinatorApi {
  if (useSupabase && supabase) {
    if (!remote) {
      const users = new SupabaseUserRepository(supabase);
      const planning = new PlanningService(
        new SupabaseAssignmentRepository(supabase),
        new SupabaseRouteRepository(supabase),
        users,
        new SupabaseBusRepository(supabase),
        // la base todavía no tiene reseñas; cuando las tenga se calcula igual que en memoria
        { driverRating: async () => ({ average: null, count: 0 }) },
      );
      remote = { source: 'supabase', coordinator: new CoordinatorController(planning), drivers: new SupabaseDriversAdmin(supabase, users) };
    }
    return remote;
  }
  return { source: 'demo', coordinator: app.coordinator, drivers: demoDrivers };
}

/** Al cerrar sesión se descarta lo cargado (otra cuenta puede ver otra cosa). */
export function resetCoordinatorApi(): void {
  remote = undefined;
}
