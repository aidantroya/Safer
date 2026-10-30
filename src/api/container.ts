import { InMemoryDatabase } from '@/data/datasource/InMemoryDatabase';
import {
  InMemoryAlarmPreferenceRepository, InMemoryBoardingRepository, InMemoryBusRepository, InMemoryIncidentRepository,
  InMemoryReviewRepository, InMemoryRouteRepository, InMemoryTripRepository, InMemoryUserRepository,
} from '@/data/repository/InMemoryRepositories';
import { AlarmService } from '@/service/AlarmService';
import { AuthService } from '@/service/AuthService';
import { BoardingService } from '@/service/BoardingService';
import { DriverService } from '@/service/DriverService';
import { IncidentService } from '@/service/IncidentService';
import { PassengerService } from '@/service/PassengerService';
import { ReviewService } from '@/service/ReviewService';
import { TripSimulationService } from '@/service/TripSimulationService';
import { AdminController } from './AdminController';
import { AuthController } from './AuthController';
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

  const authService = new AuthService(users);
  const boardingService = new BoardingService(boardings, trips, buses, users, now);
  const alarmService = new AlarmService(alarmPrefs);
  const incidentService = new IncidentService(incidentsRepo, now);
  const reviewService = new ReviewService(reviewsRepo, now);
  const passengerService = new PassengerService(users, routes, trips, buses, boardings, reviewsRepo, boardingService, alarmService, now);
  const driverService = new DriverService(trips, routes, buses, boardings, boardingService, now);
  const simulation = new TripSimulationService(trips, routes);

  return {
    db,
    simulation,
    services: { boardingService, passengerService, driverService, incidentService, reviewService, alarmService },
    auth: new AuthController(authService),
    passenger: new PassengerController(passengerService, boardingService, alarmService, incidentService, reviewService),
    driver: new DriverController(driverService, boardingService, incidentService),
    admin: new AdminController(incidentService, trips, reviewsRepo, boardingService, simulation, passengerService, db),
  };
}

export type App = ReturnType<typeof createApp>;
