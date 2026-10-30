import { InMemoryDatabase } from '@/data/datasource/InMemoryDatabase';
import {
  InMemoryAlarmPreferenceRepository, InMemoryAssignmentRepository, InMemoryBoardingRepository, InMemoryBusRepository, InMemoryIncidentRepository,
  InMemoryReviewRepository, InMemoryRouteRepository, InMemoryTripRepository, InMemoryUserRepository,
} from '@/data/repository/InMemoryRepositories';
import { AlarmService } from '@/service/AlarmService';
import { AuthService } from '@/service/AuthService';
import { BoardingService } from '@/service/BoardingService';
import { DriverService } from '@/service/DriverService';
import { IncidentService } from '@/service/IncidentService';
import { PassengerService } from '@/service/PassengerService';
import { PlanningService } from '@/service/PlanningService';
import { ReviewService } from '@/service/ReviewService';
import { RouteCatalogService } from '@/service/RouteCatalogService';
import { TripSimulationService } from '@/service/TripSimulationService';
import { AdminController } from './AdminController';
import { AuthController } from './AuthController';
import { CoordinatorController } from './CoordinatorController';
import { DriverController } from './DriverController';
import { PassengerController } from './PassengerController';

/**
 * RAÍZ DE COMPOSICIÓN: el único lugar donde se decide qué implementación concreta usa cada contrato.
 * Para cambiar a Supabase, reemplaza los InMemory* de aquí abajo por Supabase*.
 */
export function createApp(now: () => number = () => Date.now()) {
  const db = new InMemoryDatabase(now);

  const users = new InMemoryUserRepository(db);
  const routes = new InMemoryRouteRepository(db);
  const buses = new InMemoryBusRepository(db);
  const trips = new InMemoryTripRepository(db);
  const boardings = new InMemoryBoardingRepository(db);
  const incidentsRepo = new InMemoryIncidentRepository(db);
  const reviewsRepo = new InMemoryReviewRepository(db);
  const alarmPrefs = new InMemoryAlarmPreferenceRepository(db);
  const assignments = new InMemoryAssignmentRepository(db);

  const authService = new AuthService(users);
  const boardingService = new BoardingService(boardings, trips, buses, users, now);
  const alarmService = new AlarmService(alarmPrefs);
  const incidentService = new IncidentService(incidentsRepo, now);
  const reviewService = new ReviewService(reviewsRepo, now);
  const passengerService = new PassengerService(users, routes, trips, buses, boardings, reviewsRepo, boardingService, alarmService, now);
  const driverService = new DriverService(trips, routes, buses, boardings, boardingService, now);
  const simulation = new TripSimulationService(trips, routes);
  const routeCatalog = new RouteCatalogService(routes, assignments, users, buses, trips, reviewsRepo, boardingService, now);
  const planning = new PlanningService(assignments, routes, users, buses, routeCatalog, now);

  return {
    db,
    simulation,
    services: { boardingService, passengerService, driverService, incidentService, reviewService, alarmService, routeCatalog, planning },
    auth: new AuthController(authService),
    passenger: new PassengerController(passengerService, boardingService, alarmService, incidentService, reviewService, routeCatalog),
    coordinator: new CoordinatorController(planning),
    driver: new DriverController(driverService, boardingService, incidentService, routeCatalog),
    admin: new AdminController(incidentService, trips, reviewsRepo, boardingService, simulation, passengerService, db),
  };
}

export type App = ReturnType<typeof createApp>;
