import { weekdayOf, type AlarmPreference, type Boarding, type Bus, type Review, type Route, type RouteAssignment, type Trip, type User } from '@/domain/model';
import type { Credential } from './InMemoryDatabase';

/**
 * Datos de ejemplo alineados con las pantallas:
 * Ruta 4 "Expreso Campus Norte", 6 paradas, Bus #12 (40 asientos), aforo 23/40 (18 QR + 5 manuales).
 * Rutas 2 y 7 con sus propios buses y conductores.
 * Coordenadas de ejemplo: edificios reales del campus ESPOL (OpenStreetMap). Con ellas se dibuja el mapa real
 * (Leaflet + OSRM); se reemplazan por las de Supabase al conectar la base.
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
      { id: 'stop-sur', name: 'FADCOM', order: 1, distanceFromStartM: 150, lat: -2.14359, lng: -79.96214 },
      { id: 'stop-ciencias', name: 'Coliseo Viejo', order: 2, distanceFromStartM: 1300, lat: -2.14508, lng: -79.96416 },
      { id: 'stop-rotonda', name: 'Rectorado', order: 3, distanceFromStartM: 3270, lat: -2.14765, lng: -79.96446 },
      { id: 'stop-biblio', name: 'Biblioteca Central', order: 4, distanceFromStartM: 3870, lat: -2.14731, lng: -79.9661 },
      { id: 'stop-tecno', name: 'FCSH', order: 5, distanceFromStartM: 4270, lat: -2.14717, lng: -79.96785 },
      { id: 'stop-norte', name: 'FIEC', order: 6, distanceFromStartM: 4670, lat: -2.14453, lng: -79.96803 },
    ],
    // km/h por tramo: inicio→Sur, Sur→Ciencias, Ciencias→Rotonda, Rotonda→Biblio, Biblio→Tecno, Tecno→Norte, Norte→fin
    historicalSpeedsKmh: [30, 26, 22, 16, 20, 24, 18],
  };

  const route2: Route = {
    id: 'route-2',
    code: 2,
    name: 'Ruta 2: Conexión Campus Sur',
    shortName: 'Conexión Campus Sur',
    lengthM: 3950,
    frequencyMin: 20,
    stops: [
      { id: 'r2-fcsh', name: 'FCSH', order: 1, distanceFromStartM: 100, lat: -2.14717, lng: -79.96785 },
      { id: 'r2-biblio', name: 'Biblioteca Central', order: 2, distanceFromStartM: 1110, lat: -2.14731, lng: -79.9661 },
      { id: 'r2-fict', name: 'FICT', order: 3, distanceFromStartM: 2810, lat: -2.14574, lng: -79.96494 },
      { id: 'r2-fimcp', name: 'FIMCP', order: 4, distanceFromStartM: 3300, lat: -2.14463, lng: -79.96527 },
      { id: 'r2-coliseo', name: 'Coliseo Viejo', order: 5, distanceFromStartM: 3450, lat: -2.14508, lng: -79.96416 },
      { id: 'r2-fadcom', name: 'FADCOM', order: 6, distanceFromStartM: 3840, lat: -2.14359, lng: -79.96214 },
    ],
    historicalSpeedsKmh: [28, 24, 20, 22, 18, 24, 20],
  };

  const route7: Route = {
    id: 'route-7',
    code: 7,
    name: 'Ruta 7: Circuito Facultades',
    shortName: 'Circuito Facultades',
    lengthM: 5450,
    frequencyMin: 12,
    stops: [
      { id: 'r7-coliseo-nuevo', name: 'Coliseo Nuevo', order: 1, distanceFromStartM: 100, lat: -2.14198, lng: -79.96722 },
      { id: 'r7-fiec', name: 'FIEC', order: 2, distanceFromStartM: 917, lat: -2.14453, lng: -79.96803 },
      { id: 'r7-fcsh', name: 'FCSH', order: 3, distanceFromStartM: 1507, lat: -2.14717, lng: -79.96785 },
      { id: 'r7-biblio', name: 'Biblioteca Central', order: 4, distanceFromStartM: 2695, lat: -2.14731, lng: -79.9661 },
      { id: 'r7-rectorado', name: 'Rectorado', order: 5, distanceFromStartM: 3599, lat: -2.14765, lng: -79.96446 },
      { id: 'r7-coliseo-viejo', name: 'Coliseo Viejo', order: 6, distanceFromStartM: 5345, lat: -2.14508, lng: -79.96416 },
    ],
    historicalSpeedsKmh: [26, 22, 18, 20, 24, 26, 20],
  };

  const buses: Bus[] = [
    { id: 'bus-12', number: 12, plate: 'ABC-123', capacity: 40, online: true, unitCode: 'BT-UNIT-9f3c1a72' },
    { id: 'bus-18', number: 18, plate: 'GYE-4521', capacity: 40, online: true, unitCode: 'BT-UNIT-27be90d4' },
    { id: 'bus-7', number: 7, plate: 'PBD-0987', capacity: 32, online: false, unitCode: 'BT-UNIT-c41d77aa' },
    { id: 'bus-21', number: 21, plate: 'GSE-7310', capacity: 36, online: true, unitCode: 'BT-UNIT-5a0e3b19' },
    { id: 'bus-25', number: 25, plate: 'GYE-1188', capacity: 40, online: true, unitCode: 'BT-UNIT-8d2f64c0' },
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
    { id: 'user-ana', name: 'Ana', fullName: 'Ana Torres', email: 'ana.torres@bustrack.edu', role: 'driver' },
    { id: 'user-luis', name: 'Luis', fullName: 'Luis Paredes', email: 'luis.paredes@bustrack.edu', role: 'driver' },
    { id: 'user-jorge', name: 'Jorge', fullName: 'Jorge Salazar', email: 'jorge.salazar@bustrack.edu', role: 'driver' },
    { id: 'user-coord', name: 'Coordinación', fullName: 'Coordinación de Transporte', email: 'coordinacion@bustrack.edu', role: 'coordinator' },
    { id: 'user-admin', name: 'Admin', fullName: 'Central Operativa', email: 'admin@bustrack.edu', role: 'admin' },
  ];

  const credentials: Credential[] = [
    { email: 'diego@espol.edu.ec', secret: 'demo1234', userId: 'user-diego' },
    { email: 'carlos.mendoza@bustrack.edu', secret: 'conductor2026', userId: 'user-carlos' },
    { email: 'ana.torres@bustrack.edu', secret: 'conductor2026', userId: 'user-ana' },
    { email: 'luis.paredes@bustrack.edu', secret: 'conductor2026', userId: 'user-luis' },
    { email: 'jorge.salazar@bustrack.edu', secret: 'conductor2026', userId: 'user-jorge' },
    { email: 'coordinacion@bustrack.edu', secret: 'coordinacion2026', userId: 'user-coord' },
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
    {
      id: 'trip-2', routeId: route2.id, busId: 'bus-18', driverId: 'user-ana', status: 'en_curso',
      startedAt: now - 8 * 60_000, positionM: 600, speedMps: 6, avgSpeedMps: 6, dwellRemainingS: 0, nextStopIndex: 1,
    },
    {
      id: 'trip-3', routeId: route7.id, busId: 'bus-21', driverId: 'user-luis', status: 'en_curso',
      startedAt: now - 15 * 60_000, positionM: 2100, speedMps: 6, avgSpeedMps: 6, dwellRemainingS: 0, nextStopIndex: 3,
    },
  ];

  // Programación semanal inicial (la edita Coordinación): los conductores rotan de ruta cada día;
  // hoy coincide con los viajes en curso. Jorge y el Bus #25 quedan de reserva.
  const today = weekdayOf(now);
  const crew = [
    { routeId: route.id, busId: 'bus-12' },
    { routeId: route2.id, busId: 'bus-18' },
    { routeId: route7.id, busId: 'bus-21' },
  ];
  const drivers = ['user-carlos', 'user-ana', 'user-luis'];
  const assignments: RouteAssignment[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const shift = (((weekday - today) % drivers.length) + drivers.length) % drivers.length;
    crew.forEach((c, i) => assignments.push({ ...c, weekday, driverId: drivers[(i + shift) % drivers.length] }));
  }

  // Viajes ya cerrados de días anteriores, con las reseñas que dejaron los estudiantes.
  const pastReviews: [driverId: string, busId: string, routeId: string, rating: number, tags: string[], comment: string][] = [
    ['user-carlos', 'bus-12', route.id, 5, ['puntualidad', 'conduccion'], 'Llegó justo a tiempo y manejó muy tranquilo.'],
    ['user-carlos', 'bus-12', route.id, 5, ['aire', 'limpia'], 'Bus limpio y con buen aire acondicionado.'],
    ['user-carlos', 'bus-12', route.id, 4, ['puntualidad'], ''],
    ['user-carlos', 'bus-12', route.id, 4, ['lleno'], 'Iba bastante lleno en hora pico.'],
    ['user-carlos', 'bus-12', route.id, 5, ['conduccion', 'puntualidad'], 'Excelente servicio, muy amable.'],
    ['user-ana', 'bus-18', route2.id, 4, ['limpia'], 'Unidad impecable.'],
    ['user-ana', 'bus-18', route2.id, 5, ['puntualidad', 'aire'], 'Siempre a la hora.'],
    ['user-ana', 'bus-18', route2.id, 3, ['retraso'], 'Se demoró unos 10 minutos.'],
    ['user-ana', 'bus-18', route2.id, 4, ['conduccion'], ''],
    ['user-luis', 'bus-21', route7.id, 4, ['puntualidad'], 'Buen recorrido.'],
    ['user-luis', 'bus-21', route7.id, 3, ['brusca'], 'Frenó fuerte un par de veces.'],
    ['user-luis', 'bus-21', route7.id, 4, ['aire'], ''],
  ];
  const reviews: Review[] = [];
  pastReviews.forEach(([driverId, busId, routeId, rating, tags, comment], i) => {
    const startedAt = now - ((i % 5) + 1) * 86_400_000 - (i + 1) * 47 * 60_000;
    const tripId = `trip-past-${i + 1}`;
    trips.push({
      id: tripId, routeId, busId, driverId, status: 'finalizado', startedAt, endedAt: startedAt + 25 * 60_000,
      positionM: 0, speedMps: 0, avgSpeedMps: 6, dwellRemainingS: 0, nextStopIndex: 0,
    });
    reviews.push({ id: `rev-seed-${i + 1}`, tripId, passengerId: `seed-student-${i + 1}`, rating, tags, comment, createdAt: startedAt + 30 * 60_000 });
  });

  // Aforo inicial 23/40 = 18 por QR + 5 manuales.
  const boardings: Boarding[] = [];
  for (let i = 1; i <= 18; i++) {
    boardings.push({ id: `seed-qr-${i}`, tripId: 'trip-1', passengerId: `seed-student-${i}`, method: 'qr_pase', boardedAt: now - 10 * 60_000 });
  }
  for (let i = 1; i <= 5; i++) {
    boardings.push({ id: `seed-man-${i}`, tripId: 'trip-1', passengerId: null, method: 'manual', boardedAt: now - 9 * 60_000 });
  }
  // Rutas 2 y 7: 14/40 y 29/36.
  for (let i = 1; i <= 14; i++) {
    boardings.push({ id: `seed-r2-${i}`, tripId: 'trip-2', passengerId: `seed-student-r2-${i}`, method: 'qr_pase', boardedAt: now - 6 * 60_000 });
  }
  for (let i = 1; i <= 29; i++) {
    boardings.push({ id: `seed-r7-${i}`, tripId: 'trip-3', passengerId: `seed-student-r7-${i}`, method: 'qr_pase', boardedAt: now - 12 * 60_000 });
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

  return { users, credentials, routes: [route, route2, route7], buses, trips, boardings, alarmPrefs, departures, assignments, reviews };
}
