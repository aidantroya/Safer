import { weekdayOf, type Bus, type Review, type Route, type User } from '@/domain/model';
import type {
  IAssignmentRepository, IBusRepository, IReviewRepository, IRouteRepository, ITripRepository, IUserRepository,
} from '@/domain/repository';
import type { BoardingService, Occupancy } from './BoardingService';

export interface DriverRating {
  average: number | null;
  count: number;
}

export interface RouteOverview {
  route: Route;
  /** Conductor y unidad que Coordinación asignó a la ruta para hoy. */
  driver?: Pick<User, 'id' | 'name' | 'fullName'>;
  bus?: Bus;
  rating: DriverRating;
  live?: { tripId: string; positionM: number; occupancy: Occupancy };
}

export interface DriverReviewItem {
  review: Review;
  routeName: string;
  busNumber: number;
}

export interface DriverProfile {
  driver: User;
  today?: { route: Route; bus: Bus };
  rating: DriverRating;
  /** Cuántas reseñas tiene cada estrella (índice 0 = 1★ … 4 = 5★). */
  distribution: number[];
  topTags: { id: string; count: number }[];
  reviews: DriverReviewItem[];
}

/** Lo que se sabe de cada ruta hoy: quién la maneja, en qué unidad y qué tan bien lo califican. */
export class RouteCatalogService {
  constructor(
    private routes: IRouteRepository,
    private assignments: IAssignmentRepository,
    private users: IUserRepository,
    private buses: IBusRepository,
    private trips: ITripRepository,
    private reviews: IReviewRepository,
    private boarding: BoardingService,
    private now: () => number = () => Date.now(),
  ) {}

  async listToday(): Promise<RouteOverview[]> {
    const weekday = weekdayOf(this.now());
    const routes = await this.routes.list();
    return Promise.all(
      routes.map(async (route) => {
        const a = await this.assignments.findForRoute(route.id, weekday);
        const driver = a && (await this.users.findById(a.driverId));
        const [trip] = await this.trips.findActiveByRoute(route.id);
        return {
          route,
          driver: driver && { id: driver.id, name: driver.name, fullName: driver.fullName },
          bus: a && (await this.buses.findById(a.busId)),
          rating: driver ? await this.driverRating(driver.id) : { average: null, count: 0 },
          live: trip && { tripId: trip.id, positionM: trip.positionM, occupancy: await this.boarding.occupancy(trip.id) },
        };
      }),
    );
  }

  /** Ruta y unidad asignadas hoy al conductor. */
  async todayFor(driverId: string): Promise<{ route: Route; bus: Bus } | undefined> {
    const a = await this.assignments.findForDriver(driverId, weekdayOf(this.now()));
    if (!a) return undefined;
    const route = await this.routes.findById(a.routeId);
    const bus = await this.buses.findById(a.busId);
    return route && bus ? { route, bus } : undefined;
  }

  async driverRating(driverId: string): Promise<DriverRating> {
    const list = await this.reviewsFor(driverId);
    return {
      average: list.length ? Math.round((list.reduce((a, r) => a + r.rating, 0) / list.length) * 10) / 10 : null,
      count: list.length,
    };
  }

  async driverProfile(driverId: string): Promise<DriverProfile | undefined> {
    const driver = await this.users.findById(driverId);
    if (!driver || driver.role !== 'driver') return undefined;
    const trips = new Map((await this.trips.listByDriver(driverId)).map((t) => [t.id, t]));
    const list = (await this.reviewsFor(driverId)).sort((a, b) => b.createdAt - a.createdAt);

    const distribution = [0, 0, 0, 0, 0];
    const tagCount = new Map<string, number>();
    for (const r of list) {
      distribution[r.rating - 1] += 1;
      r.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1));
    }

    const reviews = await Promise.all(
      list.map(async (review) => {
        const trip = trips.get(review.tripId)!;
        const route = await this.routes.findById(trip.routeId);
        const bus = await this.buses.findById(trip.busId);
        return { review, routeName: route?.name ?? 'Ruta', busNumber: bus?.number ?? 0 };
      }),
    );

    return {
      driver,
      today: await this.todayFor(driverId),
      rating: await this.driverRating(driverId),
      distribution,
      topTags: [...tagCount].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
      reviews,
    };
  }

  /** Reseñas de los viajes que hizo el conductor (en cualquiera de sus unidades). */
  private async reviewsFor(driverId: string): Promise<Review[]> {
    const tripIds = new Set((await this.trips.listByDriver(driverId)).map((t) => t.id));
    return (await this.reviews.listAll()).filter((r) => tripIds.has(r.tripId));
  }
}
