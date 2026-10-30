import { weekdayOf, type Bus, type Route, type RouteAssignment, type User } from '@/domain/model';
import type { IAssignmentRepository, IBusRepository, IRouteRepository, IUserRepository } from '@/domain/repository';
import { DomainError } from './errors';
import type { DriverRating, RouteCatalogService } from './RouteCatalogService';

export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Una fila del plan: en esa ruta, ese conductor maneja ese bus. */
export type PlanItem = Pick<RouteAssignment, 'routeId' | 'driverId' | 'busId'>;

export interface WeekPlan {
  today: number;
  routes: Route[];
  drivers: (Pick<User, 'id' | 'name' | 'fullName'> & { rating: DriverRating })[];
  buses: Bus[];
  assignments: RouteAssignment[];
}

/**
 * Planificador de Coordinación: decide qué conductor y qué bus cubren cada ruta cada día de la semana.
 * Reglas por día: un conductor y un bus no pueden estar en dos rutas, y el bus tiene que estar en línea.
 */
export class PlanningService {
  constructor(
    private assignments: IAssignmentRepository,
    private routes: IRouteRepository,
    private users: IUserRepository,
    private buses: IBusRepository,
    private catalog: RouteCatalogService,
    private now: () => number = () => Date.now(),
  ) {}

  async getWeek(): Promise<WeekPlan> {
    const drivers = await this.users.listByRole('driver');
    return {
      today: weekdayOf(this.now()),
      routes: await this.routes.list(),
      drivers: await Promise.all(
        drivers.map(async (d) => ({ id: d.id, name: d.name, fullName: d.fullName, rating: await this.catalog.driverRating(d.id) })),
      ),
      buses: await this.buses.list(),
      assignments: await this.assignments.listAll(),
    };
  }

  /** Reemplaza el plan de un día. Las rutas que no vienen en `items` quedan sin asignar ese día. */
  async saveDay(weekday: number, items: PlanItem[]): Promise<void> {
    await this.validateDay(weekday, items);
    await this.assignments.replaceDay(weekday, items.map((i) => ({ ...i, weekday })));
  }

  /** Reemplaza el plan de toda la semana. Valida los 7 días antes de guardar: o se guarda todo o nada. */
  async saveWeek(days: PlanItem[][]): Promise<void> {
    if (days.length !== 7) throw new DomainError('BAD_WEEK', 'El plan semanal debe traer los 7 días.');
    for (let d = 0; d < 7; d++) await this.validateDay(d, days[d]);
    for (let d = 0; d < 7; d++) await this.assignments.replaceDay(d, days[d].map((i) => ({ ...i, weekday: d })));
  }

  private async validateDay(weekday: number, items: PlanItem[]): Promise<void> {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new DomainError('BAD_DAY', 'Día no válido.');
    const day = WEEKDAY_NAMES[weekday];
    const seen = { route: new Set<string>(), driver: new Set<string>(), bus: new Set<string>() };

    for (const item of items) {
      const route = await this.routes.findById(item.routeId);
      if (!route) throw new DomainError('ROUTE_NOT_FOUND', `${day}: la ruta no existe.`);
      const driver = await this.users.findById(item.driverId);
      if (!driver || driver.role !== 'driver') throw new DomainError('NOT_DRIVER', `${day}: elige un conductor para la Ruta ${route.code}.`);
      const bus = await this.buses.findById(item.busId);
      if (!bus) throw new DomainError('BUS_NOT_FOUND', `${day}: elige un bus para la Ruta ${route.code}.`);
      if (!bus.online) throw new DomainError('BUS_OFFLINE', `${day}: el Bus #${bus.number} está fuera de línea.`);

      if (seen.route.has(route.id)) throw new DomainError('DUPLICATE_ROUTE', `${day}: la Ruta ${route.code} aparece dos veces.`);
      if (seen.driver.has(driver.id)) throw new DomainError('DRIVER_TWICE', `${day}: ${driver.fullName} está asignado a dos rutas.`);
      if (seen.bus.has(bus.id)) throw new DomainError('BUS_TWICE', `${day}: el Bus #${bus.number} está asignado a dos rutas.`);
      seen.route.add(route.id);
      seen.driver.add(driver.id);
      seen.bus.add(bus.id);
    }
  }
}
