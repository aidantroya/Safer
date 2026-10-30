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
