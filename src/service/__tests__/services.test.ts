import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/container';
import { EtaService } from '@/service/EtaService';
import { isLeadReached } from '@/service/AlarmEvaluator';

const T0 = new Date('2026-10-28T09:00:00').getTime(); // miércoles

describe('EtaService (fórmula del documento)', () => {
  const { db } = createApp(() => T0);
  const route = db.routes[0];
  const eta = new EtaService();

  it('con velocidad actual = histórica el ETA es distancia/velocidad + 30 s por parada intermedia', () => {
    // bus justo en la parada 1 (1300 m) hacia parada 3 (3870 m): una parada intermedia (Rotonda)
    const r = eta.estimate(route, { positionM: 1300, avgSpeedMps: 22 / 3.6, dwellRemainingS: 0 }, 3);
    expect(r.intermediateStops).toBe(1);
    expect(r.distanceM).toBe(2570);
    expect(r.seconds).toBeGreaterThan(30);
    // sin la parada intermedia debería ser menor
    const direct = eta.estimate(route, { positionM: 3270, avgSpeedMps: 5, dwellRemainingS: 0 }, 3);
    expect(direct.intermediateStops).toBe(0);
  });

  it('detecta que el bus ya pasó la parada', () => {
    expect(eta.estimate(route, { positionM: 4000, avgSpeedMps: 5, dwellRemainingS: 0 }, 3).passed).toBe(true);
  });

  it('no explota con velocidad 0 (piso de velocidad)', () => {
    const r = eta.estimate(route, { positionM: 0, avgSpeedMps: 0.01, dwellRemainingS: 0 }, 5);
    expect(Number.isFinite(r.seconds)).toBe(true);
  });

  it('el estado inicial del seed da ~8 min a Biblioteca Central', async () => {
    const app = createApp(() => T0);
    const snap = await app.services.passengerService.snapshot('user-diego');
    expect(snap.state).toBe('esperando');
    expect(Math.round(snap.target!.etaSeconds / 60)).toBe(8);
    expect(snap.target!.stopsAway).toBe(2);
  });
});

describe('AlarmEvaluator', () => {
  const p = { seconds: 170, distanceM: 400, stopsBefore: 0 };
  it('minutos', () => {
    expect(isLeadReached({ kind: 'minutes', value: 3 }, p)).toBe(true);
    expect(isLeadReached({ kind: 'minutes', value: 2 }, p)).toBe(false);
  });
  it('metros', () => {
    expect(isLeadReached({ kind: 'meters', value: 500 }, p)).toBe(true);
    expect(isLeadReached({ kind: 'meters', value: 300 }, p)).toBe(false);
  });
  it('1 parada antes = ya estoy en la parada anterior', () => {
    expect(isLeadReached({ kind: 'stops', value: 1 }, { ...p, stopsBefore: 1 })).toBe(false);
    expect(isLeadReached({ kind: 'stops', value: 1 }, { ...p, stopsBefore: 0 })).toBe(true);
  });
});

describe('Aforo y abordajes', () => {
  it('arranca en 23/40 (18 QR + 5 manuales)', async () => {
    const app = createApp(() => T0);
    const occ = await app.services.boardingService.occupancy('trip-1');
    expect(occ).toMatchObject({ occupied: 23, capacity: 40, qr: 18, manual: 5, available: 17, percent: 58 });
  });

  it('pase: sube y luego baja con el mismo flujo; el token es de un solo uso', async () => {
    const app = createApp(() => T0);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error('no pass');
    const up = await app.driver.scanPassenger('trip-1', pass.data.token);
    expect(up.ok && up.data.action).toBe('boarded');
    expect((await app.services.boardingService.occupancy('trip-1')).occupied).toBe(24);

    const reuse = await app.driver.scanPassenger('trip-1', pass.data.token);
    expect(reuse.ok).toBe(false);

    const pass2 = await app.passenger.issuePass('user-diego');
    if (!pass2.ok) throw new Error('no pass');
    const down = await app.driver.scanPassenger('trip-1', pass2.data.token);
    expect(down.ok && down.data.action).toBe('alighted');
    expect((await app.services.boardingService.occupancy('trip-1')).occupied).toBe(23);
  });

  it('el token expira a los 60 s', async () => {
    let t = T0;
    const app = createApp(() => t);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error('no pass');
    t += 61_000;
    const r = await app.driver.scanPassenger('trip-1', pass.data.token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PASS_EXPIRED');
  });

  it('no deja pasar de la capacidad y no resta pasajeros QR', async () => {
    const app = createApp(() => T0);
    for (let i = 0; i < 17; i++) expect((await app.driver.addManual('trip-1')).ok).toBe(true);
    const full = await app.driver.addManual('trip-1');
    expect(full.ok).toBe(false);
    // quitar los 22 manuales posibles (5 + 17) y comprobar que se detiene en 18 QR
    for (let i = 0; i < 22; i++) await app.driver.removeManual('trip-1');
    const last = await app.driver.removeManual('trip-1');
    expect(last.ok).toBe(false);
    expect((await app.services.boardingService.occupancy('trip-1')).occupied).toBe(18);
  });

  it('QR de la unidad: valida unidad y modo demo salta la distancia', async () => {
    const app = createApp(() => T0);
    expect((await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-xxxx')).ok).toBe(false);
    const far = await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-9f3c1a72', { distanceToBusM: 900 });
    expect(far.ok).toBe(false);
    const demo = await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-9f3c1a72', { distanceToBusM: 900, demoMode: true });
    expect(demo.ok).toBe(true);
  });
});

describe('Viaje completo del pasajero', () => {
  it('sube, suena la alarma, llega al destino, se cierra solo y pide reseña', async () => {
    const app = createApp(() => T0);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error();
    await app.driver.scanPassenger('trip-1', pass.data.token);

    const kinds = new Set<string>();
    let pending = false;
    for (let i = 0; i < 400 && !pending; i++) {
      await app.simulation.tick(10);
      const s = await app.passenger.getSnapshot('user-diego');
      if (!s.ok) throw new Error(s.error);
      s.data.events.forEach((e) => kinds.add(e.type));
      pending = !!s.data.pendingReview;
    }
    expect(kinds.has('wake_up')).toBe(true);
    expect(kinds.has('arrived')).toBe(true);
    expect(pending).toBe(true);
    expect(await app.services.boardingService.isOnboard('user-diego')).toBeUndefined();

    const rev = await app.passenger.submitReview({ tripId: 'trip-1', passengerId: 'user-diego', rating: 5, tags: ['puntualidad'], comment: '' });
    expect(rev.ok).toBe(true);
    const again = await app.passenger.submitReview({ tripId: 'trip-1', passengerId: 'user-diego', rating: 4, tags: [], comment: '' });
    expect(again.ok).toBe(false);
  });

  it('si el conductor finaliza el viaje, el pasajero a bordo queda cerrado y con reseña pendiente', async () => {
    const app = createApp(() => T0);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error();
    await app.driver.scanPassenger('trip-1', pass.data.token);
    const done = await app.driver.finishTrip('trip-1');
    expect(done.ok).toBe(true);
    const s = await app.passenger.getSnapshot('user-diego');
    expect(s.ok && s.data.pendingReview?.tripId).toBe('trip-1');
  });

  it('el reporte guarda folio y ubicación; valida descripción', async () => {
    const app = createApp(() => T0);
    const bad = await app.passenger.reportIncident({ userId: 'user-diego', type: 'retraso', description: ' ' });
    expect(bad.ok).toBe(false);
    const ok = await app.passenger.reportIncident({ userId: 'user-diego', type: 'retraso', description: 'Bus detenido' });
    expect(ok.ok && ok.data.folio).toBe('#TR-8843');
    expect(ok.ok && ok.data.locationLabel).toBe('Campus Norte - Av. Principal');
  });
});

describe('Rutas y perfil del conductor', () => {
  it('el conductor entra con correo y contraseña (ya no con PIN)', async () => {
    const app = createApp(() => T0);
    expect((await app.auth.loginDriver('carlos.mendoza@bustrack.edu', 'conductor123')).ok).toBe(true);
    expect((await app.auth.loginDriver('carlos.mendoza@bustrack.edu', '4821')).ok).toBe(false);
  });

  it('cada ruta muestra el conductor asignado hoy y su calificación', async () => {
    const app = createApp(() => T0);
    const res = await app.passenger.listRoutes();
    if (!res.ok) throw new Error(res.error);
    expect(res.data.map((r) => r.route.id)).toEqual(['route-4', 'route-2', 'route-7']);
    const r4 = res.data[0];
    expect(r4.driver?.id).toBe('user-carlos');
    expect(r4.bus?.number).toBe(12);
    expect(r4.rating).toEqual({ average: 4.6, count: 5 });
    expect(r4.live?.occupancy.occupied).toBe(23);
  });

  it('registrar otra ruta cambia lo que sigue el mapa en vivo', async () => {
    const app = createApp(() => T0);
    const ok = await app.passenger.selectRoute('user-diego', 'route-7', { boardStopId: 'r7-fiec', dropStopId: 'r7-rectorado' });
    expect(ok.ok).toBe(true);
    const s = await app.passenger.getSnapshot('user-diego');
    if (!s.ok) throw new Error(s.error);
    expect(s.data.route.id).toBe('route-7');
    expect(s.data.boardStop.id).toBe('r7-fiec');
    expect(s.data.bus?.number).toBe(21);

    const bad = await app.passenger.selectRoute('user-diego', 'route-2', { boardStopId: 'r2-fadcom', dropStopId: 'r2-fcsh' });
    expect(bad.ok).toBe(false);
  });

  it('no se puede cambiar de ruta estando a bordo', async () => {
    const app = createApp(() => T0);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error();
    await app.driver.scanPassenger('trip-1', pass.data.token);
    expect((await app.passenger.selectRoute('user-diego', 'route-2')).ok).toBe(false);
  });

  it('el perfil del conductor junta las reseñas de su bus, incluida una nueva', async () => {
    const app = createApp(() => T0);
    const pass = await app.passenger.issuePass('user-diego');
    if (!pass.ok) throw new Error();
    await app.driver.scanPassenger('trip-1', pass.data.token);
    await app.driver.finishTrip('trip-1');
    await app.passenger.submitReview({ tripId: 'trip-1', passengerId: 'user-diego', rating: 2, tags: ['brusca'], comment: 'Frenazos' });

    const p = await app.driver.getProfile('user-carlos');
    if (!p.ok) throw new Error(p.error);
    expect(p.data.rating.count).toBe(6);
    expect(p.data.reviews[0].review.comment).toBe('Frenazos');
    expect(p.data.reviews[0].busNumber).toBe(12);
    expect(p.data.today?.route.id).toBe('route-4');
    expect(p.data.distribution).toEqual([0, 1, 0, 2, 3]);
  });
});

describe('Planificador de Coordinación', () => {
  // T0 es miércoles → weekday 2
  const WED = 2;

  it('el coordinador entra con su correo y contraseña', async () => {
    const app = createApp(() => T0);
    expect((await app.auth.loginCoordinator('coordinacion@bustrack.edu', 'coord123')).ok).toBe(true);
    expect((await app.auth.loginCoordinator('carlos.mendoza@bustrack.edu', 'conductor123')).ok).toBe(false);
  });

  it('el plan trae conductores, buses y la programación de los 7 días', async () => {
    const app = createApp(() => T0);
    const res = await app.coordinator.getWeekPlan();
    if (!res.ok) throw new Error(res.error);
    expect(res.data.today).toBe(WED);
    expect(res.data.drivers.map((d) => d.id)).toEqual(['user-carlos', 'user-ana', 'user-luis', 'user-jorge']);
    expect(res.data.assignments).toHaveLength(21);
  });

  it('reasignar el día cambia la ruta y el bus que recibe el conductor y lo que ve el pasajero', async () => {
    const app = createApp(() => T0);
    const ok = await app.coordinator.saveDay(WED, [
      { routeId: 'route-4', driverId: 'user-jorge', busId: 'bus-25' },
      { routeId: 'route-2', driverId: 'user-carlos', busId: 'bus-21' },
    ]);
    expect(ok.ok).toBe(true);

    const carlos = await app.driver.getTodayAssignment('user-carlos');
    expect(carlos.ok && carlos.data?.route.id).toBe('route-2');
    expect(carlos.ok && carlos.data?.bus.number).toBe(21);
    const luis = await app.driver.getTodayAssignment('user-luis');
    expect(luis.ok && luis.data).toBeUndefined();

    const routes = await app.passenger.listRoutes();
    if (!routes.ok) throw new Error(routes.error);
    expect(routes.data.find((r) => r.route.id === 'route-4')?.driver?.id).toBe('user-jorge');
    expect(routes.data.find((r) => r.route.id === 'route-7')?.driver).toBeUndefined();
  });

  it('no permite el mismo conductor o el mismo bus en dos rutas, ni buses fuera de línea', async () => {
    const app = createApp(() => T0);
    const twiceDriver = await app.coordinator.saveDay(WED, [
      { routeId: 'route-4', driverId: 'user-ana', busId: 'bus-12' },
      { routeId: 'route-2', driverId: 'user-ana', busId: 'bus-18' },
    ]);
    expect(twiceDriver.ok).toBe(false);
    const twiceBus = await app.coordinator.saveDay(WED, [
      { routeId: 'route-4', driverId: 'user-ana', busId: 'bus-12' },
      { routeId: 'route-2', driverId: 'user-luis', busId: 'bus-12' },
    ]);
    expect(twiceBus.ok).toBe(false);
    const offline = await app.coordinator.saveDay(WED, [{ routeId: 'route-4', driverId: 'user-ana', busId: 'bus-7' }]);
    expect(offline.ok).toBe(false);
    // nada de lo anterior se guardó
    const carlos = await app.driver.getTodayAssignment('user-carlos');
    expect(carlos.ok && carlos.data?.route.id).toBe('route-4');
  });

  it('guardar la semana es todo o nada', async () => {
    const app = createApp(() => T0);
    const day = [{ routeId: 'route-4', driverId: 'user-jorge', busId: 'bus-25' }];
    const week = Array.from({ length: 7 }, () => day);
    expect((await app.coordinator.saveWeek(week)).ok).toBe(true);
    const plan = await app.coordinator.getWeekPlan();
    expect(plan.ok && plan.data.assignments.every((a) => a.driverId === 'user-jorge')).toBe(true);
    expect(plan.ok && plan.data.assignments).toHaveLength(7);

    const broken = week.map((d, i) => (i === 4 ? [...d, { routeId: 'route-2', driverId: 'user-jorge', busId: 'bus-18' }] : d));
    expect((await app.coordinator.saveWeek(broken)).ok).toBe(false);
    const after = await app.coordinator.getWeekPlan();
    expect(after.ok && after.data.assignments).toHaveLength(7);
  });
});

describe('Resumen de reseñas (palabras clave + puntaje)', () => {
  it('sin IA usa las etiquetas más repetidas y el promedio', async () => {
    const app = createApp(() => T0);
    const res = await app.driver.getInsight('user-carlos');
    if (!res.ok || !res.data) throw new Error('sin resumen');
    expect(res.data.source).toBe('local');
    expect(res.data.score).toBe(4.6);
    expect(res.data.keywords[0]).toBe('Puntualidad');
    expect(res.data.reviewCount).toBe(5);
  });

  it('usa la IA cuando responde, no la vuelve a llamar sin reseñas nuevas y cae al cálculo local si falla', async () => {
    let calls = 0;
    const ok = createApp(() => T0, {
      summarizer: { summarize: async () => { calls++; return { keywords: ['puntual'], score: 4.8, summary: 'Muy bien.' }; } },
    });
    const a = await ok.driver.getInsight('user-ana');
    await ok.driver.getInsight('user-ana');
    expect(a.ok && a.data?.source).toBe('gemini');
    expect(a.ok && a.data?.keywords).toEqual(['puntual']);
    expect(calls).toBe(1);

    const failing = createApp(() => T0, { summarizer: { summarize: async () => { throw new Error('sin red'); } } });
    const b = await failing.driver.getInsight('user-ana');
    expect(b.ok && b.data?.source).toBe('local');
    expect(b.ok && b.data?.score).toBe(4);
  });

  it('un conductor sin reseñas no tiene resumen', async () => {
    const app = createApp(() => T0);
    const res = await app.coordinator.getDriverInsight('user-jorge');
    expect(res.ok && res.data).toBeUndefined();
  });
});

describe('Mapa real y GPS del conductor', () => {
  it('la polilínea ubica puntos por distancia y proyecta de vuelta', async () => {
    const { Polyline } = await import('@/domain/geo');
    const line = new Polyline([[-2.145, -79.965], [-2.145, -79.960], [-2.140, -79.960]]);
    expect(line.lengthM).toBeGreaterThan(1000);
    const p = line.pointAt(400);
    expect(Math.round(line.project(p).alongM)).toBe(400);
    expect(line.project(p).offM).toBeLessThan(1);
  });

  it('el referenciador hace pasar el bus justo por cada parada', async () => {
    const { Polyline, RouteReferencer, haversineM } = await import('@/domain/geo');
    const { db } = createApp(() => T0);
    const route = db.routes[0];
    const ref = new RouteReferencer(route, new Polyline(route.stops.map((s) => [s.lat!, s.lng!])));
    for (const s of route.stops) expect(haversineM(ref.toLatLng(s.distanceFromStartM), [s.lat!, s.lng!])).toBeLessThan(1);
  });

  it('el GPS del conductor avanza el viaje, no lo hace retroceder y se borra al finalizar', async () => {
    const app = createApp(() => T0);
    const biblio = app.db.routes[0].stops[3];
    const moved = await app.driver.reportPosition('trip-1', { lat: biblio.lat!, lng: biblio.lng!, speedMps: 5 });
    if (!moved.ok) throw new Error(moved.error);
    expect(Math.abs(moved.data.positionM - biblio.distanceFromStartM)).toBeLessThan(5);
    expect(moved.data.nextStopIndex).toBe(4);

    // un punto anterior de la ruta no lo regresa
    const s0 = app.db.routes[0].stops[0];
    const back = await app.driver.reportPosition('trip-1', { lat: s0.lat!, lng: s0.lng! });
    expect(back.ok && back.data.positionM).toBeCloseTo(moved.data.positionM, 0);

    // con GPS activo la simulación no lo mueve
    const before = (await app.services.passengerService.snapshot('user-diego')).trip!.positionM;
    await app.simulation.tick(60);
    expect((await app.services.passengerService.snapshot('user-diego')).trip!.positionM).toBe(before);
    expect((await app.services.passengerService.snapshot('user-diego')).trip!.gps?.lat).toBe(s0.lat);

    const done = await app.driver.finishTrip('trip-1');
    expect(done.ok && done.data.lastPosition).toEqual([s0.lat, s0.lng]);
    expect(app.db.trips.find((t) => t.id === 'trip-1')!.gps).toBeUndefined();
  });

  it('un GPS lejos del trazado no mueve el bus', async () => {
    const app = createApp(() => T0);
    const res = await app.driver.reportPosition('trip-1', { lat: -2.19, lng: -79.88 });
    expect(res.ok && res.data.positionM).toBe(1400);
    expect(res.ok && res.data.gps!.offRouteM).toBeGreaterThan(250);
  });
});

describe('Base real de Supabase (sin red: cliente falso)', () => {
  it('lee puntos PostGIS en GeoJSON y en EWKB', async () => {
    const { parsePoint } = await import('@/data/remote/postgis');
    expect(parsePoint({ type: 'Point', coordinates: [-79.9661, -2.14731] })).toEqual([-2.14731, -79.9661]);
    const [lat, lng] = parsePoint('0101000020e6100000992a1895d4fd53c076fd82ddb02d01c0')!;
    expect(lat).toBeCloseTo(-2.14731, 5);
    expect(lng).toBeCloseTo(-79.9661, 4);
    expect(parsePoint(null)).toBeUndefined();
  });

  it('convierte las filas de routes y stops al modelo de la app y oculta las inactivas', async () => {
    const { SupabaseRouteRepository } = await import('@/data/repository/SupabaseRepositories');
    const tables: Record<string, unknown[]> = {
      routes: [
        { id: 'r1', code: '4', name: 'Ruta 4: Norte', short_name: 'Norte', length_m: 3000, frequency_min: 10, active: true, historical_speeds_kmh: null },
        { id: 'r2', code: 'X', name: 'Vieja', short_name: null, length_m: null, frequency_min: null, active: false, historical_speeds_kmh: null },
      ],
      stops: [
        { id: 's2', route_id: 'r1', name: 'B', stop_order: 2, distance_from_start_m: 2000, location: { type: 'Point', coordinates: [-79.96, -2.14] } },
        { id: 's1', route_id: 'r1', name: 'A', stop_order: 1, distance_from_start_m: 500, location: null },
      ],
    };
    const fake = { from: (t: string) => ({ select: () => ({ order: async () => ({ data: tables[t], error: null }) }) }) };
    const repo = new SupabaseRouteRepository(fake as never);
    const routes = await repo.list();
    expect(routes.map((r) => r.id)).toEqual(['r1']);
    expect(routes[0].code).toBe(4);
    expect(routes[0].stops.map((s) => s.name)).toEqual(['A', 'B']);
    expect(routes[0].stops[1]).toMatchObject({ lat: -2.14, lng: -79.96 });
    expect(routes[0].historicalSpeedsKmh).toHaveLength(3);
  });
});

describe('El estudiante escanea el QR del bus', () => {
  it('el primer escaneo lo sube (+1 aforo) y el segundo, en el mismo bus, lo baja', async () => {
    const app = createApp(() => T0);
    const subir = await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-9f3c1a72');
    expect(subir.ok && subir.data.action).toBe('boarded');
    expect(subir.ok && subir.data.occupancy.occupied).toBe(24);
    expect((await app.services.passengerService.snapshot('user-diego')).state).toBe('a_bordo');

    // otro bus mientras está a bordo: rechazado
    expect((await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-27be90d4')).ok).toBe(false);

    const bajar = await app.passenger.scanUnitQr('user-diego', 'BT-UNIT-9f3c1a72');
    expect(bajar.ok && bajar.data.action).toBe('alighted');
    expect(bajar.ok && bajar.data.occupancy.occupied).toBe(23);
  });
});
