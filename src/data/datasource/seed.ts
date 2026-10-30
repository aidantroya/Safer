import type { AlarmPreference, Boarding, Bus, Route, Trip, User } from '@/domain/model';
import type { Credential } from './InMemoryDatabase';

/**
 * Datos de ejemplo alineados con las pantallas:
 * Ruta 4 "Expreso Campus Norte", 6 paradas, Bus #12 (40 asientos), aforo 23/40 (18 QR + 5 manuales).
 * Escala del mapa: 10 m por unidad del SVG del home.
 */
export function createSeed(now: number) {
  const route: Route = {
    id: 'route-4',
    code: 4,
    name: 'Ruta 4: Expreso Campus Norte',
    shortName: 'Expreso Campus Norte',
    lengthM: 5020,
    frequencyMin: 15,
    stops: [
      { id: 'stop-sur', name: 'Terminal Sur', order: 1, distanceFromStartM: 150 },
      { id: 'stop-ciencias', name: 'Fac. Ciencias', order: 2, distanceFromStartM: 1300 },
      { id: 'stop-rotonda', name: 'Rotonda Central', order: 3, distanceFromStartM: 3270 },
      { id: 'stop-biblio', name: 'Biblioteca Central', order: 4, distanceFromStartM: 3870 },
      { id: 'stop-tecno', name: 'Parada Tecnológica', order: 5, distanceFromStartM: 4270 },
      { id: 'stop-norte', name: 'Terminal Norte', order: 6, distanceFromStartM: 4670 },
    ],
    // km/h por tramo: inicio→Sur, Sur→Ciencias, Ciencias→Rotonda, Rotonda→Biblio, Biblio→Tecno, Tecno→Norte, Norte→fin
    historicalSpeedsKmh: [30, 26, 22, 16, 20, 24, 18],
  };

  const buses: Bus[] = [
    { id: 'bus-12', number: 12, plate: 'ABC-123', capacity: 40, online: true, unitCode: 'BT-UNIT-9f3c1a72' },
    { id: 'bus-18', number: 18, plate: 'GYE-4521', capacity: 40, online: true, unitCode: 'BT-UNIT-27be90d4' },
    { id: 'bus-7', number: 7, plate: 'PBD-0987', capacity: 32, online: false, unitCode: 'BT-UNIT-c41d77aa' },
  ];

  const users: User[] = [
    {
      id: 'user-diego',
      name: 'Diego',
      fullName: 'Diego M. Villavicencio',
      email: 'diego@espol.edu.ec',
      role: 'passenger',
      studentId: '2021-08492',
      program: 'Pregrado ESPOL',
      institution: 'ESPOL',
      plan: {
        routeId: route.id,
        boardStopId: 'stop-biblio',
        dropStopId: 'stop-norte',
        walkToStopM: 150,
        areaLabel: 'Campus Norte - Av. Principal',
      },
      favorites: [
        { label: 'Campus Norte', icon: 'school' },
        { label: 'Biblio. Central', icon: 'bookmark', stopId: 'stop-biblio' },
        { label: 'Complejo Dep.', icon: 'fitness_center' },
      ],
    },
    { id: 'user-carlos', name: 'Carlos', fullName: 'Carlos Mendoza', email: 'carlos.mendoza@bustrack.edu', role: 'driver' },
    { id: 'user-admin', name: 'Admin', fullName: 'Central Operativa', email: 'admin@bustrack.edu', role: 'admin' },
  ];

  const credentials: Credential[] = [
    { email: 'diego@espol.edu.ec', secret: 'demo1234', userId: 'user-diego' },
    { email: 'carlos.mendoza@bustrack.edu', secret: '4821', userId: 'user-carlos' },
    { email: 'admin@bustrack.edu', secret: 'admin', userId: 'user-admin' },
  ];

  // Viaje en curso: Bus #12 va entre Fac. Ciencias y Rotonda (a 2 paradas de Biblioteca Central → ~8 min).
  const trips: Trip[] = [
    {
      id: 'trip-1',
      routeId: route.id,
      busId: 'bus-12',
      driverId: 'user-carlos',
      status: 'en_curso',
      startedAt: now - 12 * 60_000,
      positionM: 1400,
      speedMps: 6,
      avgSpeedMps: 6,
      dwellRemainingS: 0,
      nextStopIndex: 2,
    },
  ];

  // Aforo inicial 23/40 = 18 por QR + 5 manuales.
  const boardings: Boarding[] = [];
  for (let i = 1; i <= 18; i++) {
    boardings.push({ id: `seed-qr-${i}`, tripId: 'trip-1', passengerId: `seed-student-${i}`, method: 'qr_pase', boardedAt: now - 10 * 60_000 });
  }
  for (let i = 1; i <= 5; i++) {
    boardings.push({ id: `seed-man-${i}`, tripId: 'trip-1', passengerId: null, method: 'manual', boardedAt: now - 9 * 60_000 });
  }

  // Historial de Diego en la semana actual (para el resumen semanal): L M X J V
  const perDay = [5, 6, 7, 8, 4];
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7; // 0 = lunes
  monday.setDate(monday.getDate() - dow);
  monday.setHours(7, 30, 0, 0);
  perDay.forEach((count, d) => {
    const base = new Date(monday);
    base.setDate(base.getDate() + d);
    for (let k = 0; k < count; k++) {
      const boardedAt = base.getTime() + k * 40 * 60_000;
      if (boardedAt > now - 3_600_000) continue; // no inventar viajes del futuro ni de la última hora
      boardings.push({
        id: `seed-hist-${d}-${k}`, tripId: 'trip-hist', passengerId: 'user-diego', method: 'qr_pase',
        boardedAt, alightedAt: boardedAt + 18 * 60_000, alightMethod: 'llegada',
      });
    }
  });

  const alarmPrefs: AlarmPreference[] = [
    {
      userId: 'user-diego',
      arrivalEnabled: true,
      arrivalLead: { kind: 'minutes', value: 5 },
      wakeUpEnabled: true,
      wakeUpLead: { kind: 'minutes', value: 3 },
    },
  ];

  const departures = [
    { atMinutes: 8 * 60, item: { routeLabel: 'Ruta 2', detail: 'Ruta 2 • Conexión Campus Sur' } },
    { atMinutes: 12 * 60 + 30, item: { routeLabel: 'Ruta 4', detail: 'Ruta 4 • Expreso Campus Norte' } },
    { atMinutes: 17 * 60, item: { routeLabel: 'Ruta 2', detail: 'Ruta 2 • Conexión Campus Sur' } },
  ];

  return { users, credentials, routes: [route], buses, trips, boardings, alarmPrefs, departures };
}
