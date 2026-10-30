import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { Icon } from '../../components/Icon';
import { RouteMap } from '../../components/RouteMap';
import { useToasts } from '../../components/Toasts';
import { fmtClock, fmtEta } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { usePassenger } from './PassengerContext';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Pantalla "Inicio Campus Transit": mapa en vivo + tarjeta de ruta activa + widgets. */
export function HomePage() {
  const { snap, refresh } = usePassenger();
  const { user } = useSession();
  const { toast, history } = useToasts();
  const navigate = useNavigate();
  const [showStops, setShowStops] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!snap || !user) return <p className="p-6 text-text-muted">Cargando…</p>;

  const { route, boardStop, dropStop, state, target, occupancy, bus, trip, weekly, traffic, nextDeparture } = snap;
  const boardIndex = route.stops.findIndex((s) => s.id === boardStop.id);
  const dropIndex = route.stops.findIndex((s) => s.id === dropStop.id);
  const onboard = state === 'a_bordo';
  const eta = target ? fmtEta(target.etaSeconds) : undefined;
  const activeAlarms = Number(snap.alarmPrefs.arrivalEnabled) + Number(snap.alarmPrefs.wakeUpEnabled);
  const maxDay = Math.max(1, ...weekly.perDay);
  const todayIdx = (new Date().getDay() + 6) % 7;

  const statusLabel = { esperando: 'EN RUTA • GPS ACTIVO', a_bordo: 'A BORDO • GPS ACTIVO', bus_paso: 'EL BUS YA PASÓ TU PARADA', sin_servicio: 'SIN UNIDADES EN RUTA' }[state];
  const subtitle = onboard
    ? `Bajas en ${dropStop.name} (a ${target?.stopsAway ?? 0} ${target?.stopsAway === 1 ? 'parada' : 'paradas'})`
    : state === 'esperando'
      ? `Parada ${boardStop.name} (a ${target?.stopsAway ?? 0} ${target?.stopsAway === 1 ? 'parada' : 'paradas'})`
      : state === 'bus_paso'
        ? 'Espera la siguiente unidad (frecuencia ' + route.frequencyMin + ' min)'
        : 'Vuelve a intentarlo en unos minutos';

  const share = async () => {
    haptic.light();
    const text = `Sigo el ${bus ? `Bus #${bus.number}` : 'bus'} de ${route.name}${eta ? ` — llega en ${eta.value} ${eta.unit}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: 'BusTrack', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Copiado', 'Texto del viaje copiado al portapapeles.', 'ok');
      }
    } catch { /* el usuario canceló */ }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-surface-container-lowest">
      <header className="sticky top-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md flex justify-between items-center w-full px-margin h-14 shadow-sm border-b border-outline-variant/30">
        <h1 className="text-[16px] text-primary font-bold tracking-tight">¡Bienvenido, {user.name}!</h1>
        <button type="button" aria-label="Notificaciones" onClick={() => navigate('/pasajero/alertas')} className="relative w-10 h-10 rounded-[12px] hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant active:scale-[0.985] transition-transform">
          <Icon name="notifications" className="text-[22px]" />
          {history.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-alert-coral ring-2 ring-white" />}
        </button>
      </header>

      <section className="px-margin py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-outline-variant/20">
        {(user.favorites ?? []).map((f, i) => (
          <button
            key={f.label} type="button"
            onClick={async () => {
              haptic.light();
              if (!f.stopId) return toast(f.label, 'Este atajo todavía no está conectado a una parada.', 'info');
              const res = await app.passenger.changeStops(user.id, { boardStopId: f.stopId });
              if (!res.ok) toast('No se pudo cambiar', res.error, 'warn');
              else await refresh();
            }}
            className={`px-3 py-1.5 rounded-full text-label-md flex items-center gap-1 shrink-0 active:scale-[0.985] transition-transform ${
              (f.stopId ? f.stopId === boardStop.id : i === 0) ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface border border-outline-variant/30'
            }`}
          >
            <Icon name={f.icon} className="text-[14px]" />
            <span>{f.label}</span>
          </button>
        ))}
      </section>

      <main className="relative flex-1 flex flex-col">
        <RouteMap
          stops={route.stops}
          busPositionM={state === 'sin_servicio' ? undefined : trip?.positionM}
          busLabel={bus ? `Bus #${bus.number}` : 'Bus'}
          boardIndex={boardIndex}
          dropIndex={dropIndex}
          onboard={onboard}
          walkLabel={`(${snap.user.plan!.walkToStopM}m)`}
          trafficLabel={state === 'sin_servicio' ? undefined : `Tráfico ${traffic.level} • ${traffic.speedKmh} km/h`}
          onRecenter={() => toast('GPS', 'Ubicación centrada (demo).', 'info')}
        />

        <div className="px-margin -mt-8 relative z-30">
          <article className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-space-md shadow-level-2 border border-outline-variant/40">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center w-5 h-5">
                  <span className="absolute w-4 h-4 rounded-full bg-alert-coral/30 animate-ping" />
                  <span className="w-2.5 h-2.5 rounded-full bg-alert-coral" />
                </div>
                <span className="text-label-sm text-alert-coral tracking-wider font-bold">{statusLabel}</span>
              </div>
              {bus && occupancy && (
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface text-label-md font-semibold border border-outline-variant/30">
                  Bus #{bus.number} • Cap. {occupancy.percent}%
                </span>
              )}
            </div>

            <div className="pt-3 pb-2 flex items-baseline justify-between">
              <div className="flex-1 pr-2">
                <h2 className="text-headline-sm text-primary font-bold tracking-tight">{route.name}</h2>
                <p className="text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <Icon name="pin_drop" className="text-[15px] text-secondary" />
                  {subtitle}
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0" aria-live="polite">
                {eta && state !== 'bus_paso' && state !== 'sin_servicio' ? (
                  <>
                    <div className="flex items-baseline gap-1 text-primary-container">
                      <span className="text-metric-display tabular tracking-tight font-extrabold">{eta.value}</span>
                      <span className="text-title-md font-bold">{eta.unit}</span>
                    </div>
                    <span className="text-label-sm text-on-surface-variant -mt-1">Llegada: {fmtClock(target!.arrivalAtMs)}</span>
                  </>
                ) : (
                  <span className="text-metric-display text-outline">—</span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center gap-2">
              <button type="button" onClick={() => setShowStops((v) => !v)} aria-expanded={showStops} className="flex-1 min-h-[44px] px-4 py-2.5 bg-primary text-white rounded-[12px] text-label-lg flex items-center justify-center gap-2 shadow-sm active:scale-[0.985] transition-transform">
                <Icon name="route" className="text-[18px]" />
                <span>{showStops ? 'Ocultar recorrido' : 'Ver recorrido completo'}</span>
              </button>
              <button type="button" aria-label="Compartir viaje" onClick={share} className="min-h-[44px] min-w-[44px] px-3 bg-white text-primary border border-outline-variant/50 rounded-[12px] flex items-center justify-center hover:bg-surface-container-low active:scale-[0.985] transition-transform">
                <Icon name="share" className="text-[20px]" />
              </button>
            </div>

            {showStops && (
              <ol className="mt-3 flex flex-col">
                {route.stops.map((s, i) => {
                  const passed = trip ? trip.positionM > s.distanceFromStartM + 1 : false;
                  const tag = i === boardIndex ? 'Tu subida' : i === dropIndex ? 'Tu bajada' : passed ? 'Pasó' : trip && i === trip.nextStopIndex ? 'Próxima' : '';
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-1.5">
                      <span className={`w-3 h-3 rounded-full border-2 ${i === boardIndex || i === dropIndex ? 'border-primary-container bg-primary-container' : passed ? 'border-outline bg-outline' : 'border-outline-variant bg-white'}`} />
                      <span className={`text-body-md flex-1 ${passed ? 'text-text-muted' : 'text-text-main font-medium'}`}>{s.name}</span>
                      {tag && <span className="text-label-sm text-primary font-semibold">{tag}</span>}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-on-surface-variant">
              <Icon name="bolt" className="text-[14px] text-secondary" />
              <span className="text-label-sm">ETA actualizado en tiempo real</span>
            </div>
          </article>
        </div>

        <section className="px-margin mt-space-lg flex flex-col gap-space-md">
          <div className="grid grid-cols-2 gap-space-md">
            <button type="button" onClick={() => navigate('/pasajero/alertas')} className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 rounded-2xl shadow-level-1 border border-outline-variant/40 flex flex-col justify-between items-start text-left min-h-[148px] active:scale-[0.98] transition-all hover:shadow-md group">
              <div className="flex items-center justify-between w-full">
                <div className="w-11 h-11 rounded-[12px] bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Icon name="notifications_active" className="text-[24px]" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-label-sm font-bold border border-outline-variant/30">{activeAlarms} activas</span>
              </div>
              <div className="mt-3">
                <span className="text-title-md font-bold text-primary block leading-tight">Alarmas</span>
                <span className="text-body-sm text-on-surface-variant block mt-0.5">Avisos de llegada</span>
              </div>
              <div className="w-full mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-secondary">
                <span className="text-label-sm font-semibold">Gestionar</span><Icon name="arrow_forward" className="text-[16px]" />
              </div>
            </button>

            <button type="button" onClick={() => setEditing(true)} className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 rounded-2xl shadow-level-1 border border-outline-variant/40 flex flex-col justify-between items-start text-left min-h-[148px] active:scale-[0.98] transition-all hover:shadow-md group">
              <div className="flex items-center justify-between w-full">
                <div className="w-11 h-11 rounded-[12px] bg-primary text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Icon name="add_road" className="text-[24px]" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-label-sm font-bold border border-emerald-300 flex items-center gap-0.5"><Icon name="add" className="text-[12px]" /> Nueva</span>
              </div>
              <div className="mt-3">
                <span className="text-title-md font-bold text-primary block leading-tight">Añadir Ruta</span>
                <span className="text-body-sm text-on-surface-variant block mt-0.5">Mis paradas</span>
              </div>
              <div className="w-full mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-secondary">
                <span className="text-label-sm font-semibold">Cambiar paradas</span><Icon name="arrow_forward" className="text-[16px]" />
              </div>
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-level-1 border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-label-sm text-on-surface-variant block capitalize">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <h3 className="text-headline-sm text-primary font-bold">Tu actividad semanal</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant text-label-sm font-semibold border border-outline-variant/30 flex items-center gap-1">
                <Icon name="insights" className="text-[14px] text-secondary" /> Resumen
              </span>
            </div>
            <div className="bg-surface-container-low/70 rounded-[12px] p-4 border border-outline-variant/20">
              <div className="flex items-center justify-between text-on-surface-variant">
                <div className="flex items-center gap-2"><Icon name="commute" className="text-[20px] text-secondary" /><span className="text-label-md font-semibold text-primary">Esta semana</span></div>
                <span className="text-label-sm">Promedio: {weekly.averagePerWeekday} / día</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-headline-lg font-bold text-primary leading-none">{weekly.total}</div>
                <span className="text-body-sm text-on-surface-variant">viajes completados</span>
              </div>
              <div className="flex items-end gap-1.5 h-14 mt-3 pt-1 border-t border-outline-variant/20">
                {weekly.perDay.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <span className={`w-full rounded-sm ${n > 0 ? (i === todayIdx ? 'bg-primary-container' : 'bg-secondary') : 'bg-outline-variant/60'}`} style={{ height: n > 0 ? `${Math.max(14, (n / maxDay) * 100)}%` : '8%' }} title={`${n} viajes`} />
                    <span className="text-[10px] text-on-surface-variant font-semibold">{DAYS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {nextDeparture && (
            <div className="bg-surface-container-low rounded-2xl p-3.5 border border-outline-variant/30 flex items-center justify-between gap-3 shadow-level-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-surface-container-lowest text-on-surface-variant flex items-center justify-center border border-outline-variant/30 shrink-0"><Icon name="schedule" className="text-[20px]" /></div>
                <div>
                  <span className="text-label-md font-bold text-primary block">Próxima Salida: {nextDeparture.time}</span>
                  <span className="text-body-sm text-on-surface-variant block">{nextDeparture.detail}</span>
                </div>
              </div>
              <button type="button" onClick={() => toast('Horarios', 'La pantalla de horarios completos aún no está hecha.', 'info')} className="min-h-[44px] px-3 rounded-[12px] bg-surface-container-lowest text-primary text-label-md font-semibold border border-outline-variant/40 hover:bg-surface-container flex items-center gap-1 active:scale-[0.985] shrink-0">
                Horarios <Icon name="chevron_right" className="text-[16px]" />
              </button>
            </div>
          )}
        </section>
      </main>

      {editing && <StopsDialog onClose={() => setEditing(false)} />}
    </div>
  );
}

function StopsDialog({ onClose }: { onClose: () => void }) {
  const { snap, refresh } = usePassenger();
  const { user } = useSession();
  const { toast } = useToasts();
  const stops = snap!.route.stops;
  const [board, setBoard] = useState(snap!.boardStop.id);
  const [drop, setDrop] = useState(snap!.dropStop.id);

  const save = async () => {
    const res = await app.passenger.changeStops(user!.id, { boardStopId: board, dropStopId: drop });
    if (!res.ok) return toast('Revisa tus paradas', res.error, 'warn');
    await refresh();
    toast('Recorrido actualizado', `${stops.find((s) => s.id === board)!.name} → ${stops.find((s) => s.id === drop)!.name}`, 'ok');
    onClose();
  };

  const sel = 'w-full min-h-[48px] rounded-2xl border border-outline-variant bg-white px-4 text-body-md';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Elegir paradas" className="animate-slideup relative w-full max-w-md bg-white rounded-t-[28px] p-5 pb-8">
        <h2 className="text-headline-sm font-bold mb-1">Mi recorrido</h2>
        <p className="text-body-sm text-text-muted mb-4">{snap!.route.name}. Hoy hay una sola ruta cargada.</p>
        <label className="text-label-md font-semibold text-text-muted" htmlFor="sel-board">Subo en</label>
        <select id="sel-board" value={board} onChange={(e) => setBoard(e.target.value)} className={`${sel} mt-1 mb-3`}>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.order}. {s.name}</option>)}
        </select>
        <label className="text-label-md font-semibold text-text-muted" htmlFor="sel-drop">Bajo en</label>
        <select id="sel-drop" value={drop} onChange={(e) => setDrop(e.target.value)} className={`${sel} mt-1 mb-5`}>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.order}. {s.name}</option>)}
        </select>
        <button type="button" onClick={save} className="w-full h-12 rounded-full bg-primary-container text-white text-label-lg active:scale-[0.985]">Guardar</button>
      </div>
    </div>
  );
}
