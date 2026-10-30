import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { hasGeo, haversineM, type LatLng } from '@/domain/geo';
import type { RoutePath } from '@/domain/model';
import type { DriverPanel, TripSummary } from '@/service/DriverService';
import { BottomNav, driverNavItems } from '../../components/BottomNav';
import { BusQrDialog } from '../../components/BusQrDialog';
import { DevPanel } from '../../components/DevPanel';
import { Icon } from '../../components/Icon';
import { LiveMap } from '../../components/LiveMap';
import { RouteMap } from '../../components/RouteMap';
import { useToasts } from '../../components/Toasts';
import { fmtDistance } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { usePolling } from '../../lib/usePolling';
import { useGeolocation } from '../../lib/useGeolocation';
import { TRIP_KEY, useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { ReportIncidentPage } from '../passenger/ReportIncidentPage';

const HOLD_MS = 2000;
/** Cada cuánto se manda la posición al servidor y cuánto hay que moverse para recalcular el camino. */
const REPORT_EVERY_MS = 3000;
const REROUTE_AFTER_M = 30;
const TRACKING_KEY = 'bustrack.driver.tracking';

/** 'pendiente' hasta que el conductor active la ubicación; 'demo' si elige la simulación. */
type Tracking = 'pendiente' | 'gps' | 'demo';

/** Pantalla "Panel de control de viaje (conductor)". */
export function DriverPanelPage({ reporting = false }: { reporting?: boolean }) {
  const { user, ready, logout } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<DriverPanel>();
  const [summary, setSummary] = useState<TripSummary>();
  const [hold, setHold] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval>>();
  const tripId = sessionStorage.getItem(TRIP_KEY) ?? undefined;
  const [tracking, setTrackingState] = useState<Tracking>(() => {
    const saved = sessionStorage.getItem(TRACKING_KEY);
    return saved && saved.startsWith(`${tripId}:`) ? (saved.split(':')[1] as Tracking) : 'pendiente';
  });
  const setTracking = (t: Tracking) => {
    sessionStorage.setItem(TRACKING_KEY, `${tripId}:${t}`);
    setTrackingState(t);
  };
  const geo = useGeolocation(tracking === 'gps' && !summary);
  const me: LatLng | undefined = geo.fix && [geo.fix.lat, geo.fix.lng];
  const [navPath, setNavPath] = useState<RoutePath>();
  const [returnPath, setReturnPath] = useState<RoutePath>();
  const [showQr, setShowQr] = useState(false);
  const lastReport = useRef(0);
  const lastRoute = useRef<{ at: LatLng; stop: number }>();

  usePolling(async () => {
    if (!tripId || summary) return;
    const r = await app.driver.getPanel(tripId);
    if (r.ok) setPanel(r.data);
  }, 500, !!tripId && !summary);

  // Comparte la posición real (cada ~3 s) mientras dura la ruta.
  useEffect(() => {
    if (!geo.fix || !tripId || summary || Date.now() - lastReport.current < REPORT_EVERY_MS) return;
    lastReport.current = Date.now();
    void app.driver.reportPosition(tripId, { lat: geo.fix.lat, lng: geo.fix.lng, accuracyM: geo.fix.accuracyM, speedMps: geo.fix.speedMps });
  }, [geo.fix, tripId, summary]);

  // Navegación: camino por calles hasta la próxima parada; se recalcula al moverse o al pasar una parada.
  const nextIdx = panel?.trip.nextStopIndex;
  useEffect(() => {
    if (!me || !panel || panel.atTerminal || !hasGeo(panel.route) || summary) return;
    const prev = lastRoute.current;
    if (prev && prev.stop === nextIdx && haversineM(prev.at, me) < REROUTE_AFTER_M) return;
    lastRoute.current = { at: me, stop: nextIdx! };
    void app.maps.getPathToStop(me, panel.route.id, nextIdx!).then((r) => r.ok && setNavPath(r.data));
  }, [me?.[0], me?.[1], nextIdx, panel?.atTerminal, summary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al finalizar: camino de regreso a la estación inicial desde donde quedó el bus.
  useEffect(() => {
    if (!summary || !panel || !hasGeo(panel.route)) return;
    // sin GPS (modo demo) se asume que el bus quedó en la última parada
    const last = panel.route.stops[panel.route.stops.length - 1];
    const from = summary.lastPosition ?? me ?? ([last.lat!, last.lng!] as LatLng);
    void app.maps.getPathBackToStation(from, panel.route.id).then((r) => r.ok && setReturnPath(r.data));
  }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ready && (!user || user.role !== 'driver' || !tripId)) return <Navigate to="/conductor" replace />;
  if (!user) return null;
  if (reporting) return <ReportIncidentPage role="driver" driverTripId={tripId} />;
  if (!panel && !summary) return <p className="p-6 text-text-muted">Cargando viaje…</p>;

  const stopHold = () => {
    clearInterval(holdTimer.current);
    holdTimer.current = undefined;
    setHold(0);
  };
  const startHold = () => {
    if (holdTimer.current || !panel) return;
    haptic.light();
    const t0 = Date.now();
    holdTimer.current = setInterval(async () => {
      const f = Math.min(1, (Date.now() - t0) / HOLD_MS);
      setHold(f);
      if (f >= 1) {
        stopHold();
        const res = await app.driver.finishTrip(panel.trip.id);
        if (!res.ok) return toast('No se pudo finalizar', res.error, 'warn');
        haptic.success();
        setSummary(res.data);
      }
    }, 40);
  };

  const press = async (kind: 'add' | 'sub') => {
    if (!panel) return;
    const res = kind === 'add' ? await app.driver.addManual(panel.trip.id) : await app.driver.removeManual(panel.trip.id);
    if (!res.ok) { haptic.light(); return toast(res.error, undefined, 'warn'); }
    haptic.heavy();
    toast(kind === 'add' ? '+1 pasajero manual registrado' : '-1 pasajero manual retirado', undefined, 'ok');
    const r = await app.driver.getPanel(panel.trip.id);
    if (r.ok) setPanel(r.data);
  };

  if (summary) {
    const station = panel?.route.stops[0];
    return (
      <div className="min-h-screen flex flex-col items-center bg-surface-bg pb-24">
        {panel && hasGeo(panel.route) && (
          <div className="w-full max-w-md">
            <LiveMap
              route={panel.route}
              busLabel={`Bus #${panel.bus.number}`}
              boardIndex={0}
              dropIndex={panel.route.stops.length - 1}
              onboard={false}
              me={me ?? summary.lastPosition ?? returnPath?.points[0]}
              navPath={returnPath?.points}
              heightClass="h-[300px]"
            />
          </div>
        )}
        <div className="bg-surface-card rounded-3xl p-6 max-w-sm w-[calc(100%-32px)] shadow-level-2 border border-outline-variant/30 text-center flex flex-col items-center gap-3 -mt-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center"><Icon name="flag" fill className="text-[34px]" /></div>
          <h1 className="text-headline-md font-bold text-on-surface">Viaje finalizado</h1>
          <p className="text-body-sm text-on-surface-variant flex items-center gap-1.5"><Icon name="location_off" className="text-[18px]" />Tu ubicación dejó de compartirse para la Ruta {panel?.route.code}.</p>
          {station && (
            <div className="w-full text-left rounded-2xl p-3 bg-secondary-container text-on-secondary-container border border-secondary/30 flex items-center gap-3">
              <Icon name="home_pin" className="text-[26px]" />
              <div className="min-w-0">
                <p className="text-label-lg font-bold">Regresa a la estación inicial: {station.name}</p>
                <p className="text-label-sm">{returnPath ? `${fmtDistance(returnPath.distanceM)} • ~${Math.max(1, Math.round(returnPath.durationS / 60))} min` : 'Calculando camino…'}</p>
              </div>
            </div>
          )}
          <p className="w-full text-left text-body-sm text-on-surface-variant rounded-2xl p-3 bg-surface-container-low border border-outline-variant/20">
            No tienes más rutas asignadas hoy. El Bus #{panel?.bus.number} queda fuera de servicio.
          </p>
          <dl className="grid grid-cols-2 gap-3 w-full text-left">
            {[['Distancia', `${summary.kmTraveled} km`], ['Duración', `${summary.durationMin} min`], ['Pasajeros con QR', summary.qrCount], ['Manuales', summary.manualCount]].map(([k, v]) => (
              <div key={String(k)} className="bg-surface-container-low rounded-2xl p-3 border border-outline-variant/20"><dt className="text-label-sm text-on-surface-variant font-medium">{k}</dt><dd className="text-title-md font-bold text-primary">{v}</dd></div>
            ))}
          </dl>
          <button type="button" onClick={() => { logout(); navigate('/'); }} className="mt-2 w-full min-h-[48px] rounded-full bg-primary text-on-primary text-label-lg font-bold active:scale-[0.985]">Volver al inicio</button>
          <button type="button" onClick={() => navigate('/conductor/perfil')} className="w-full min-h-[48px] rounded-full border border-outline-variant/50 text-primary text-label-lg font-bold active:scale-[0.985] flex items-center justify-center gap-2"><Icon name="reviews" className="text-[20px]" />Ver mis reseñas</button>
        </div>
      </div>
    );
  }

  const p = panel!;
  const { occupancy: o, route, trip, bus } = p;
  const trackingLabel =
    tracking === 'demo' ? 'EN RUTA • SIMULACIÓN'
      : tracking === 'pendiente' ? 'ESPERANDO UBICACIÓN'
        : geo.status === 'activa' ? (trip.gps?.offRouteM && trip.gps.offRouteM > 250 ? 'GPS • FUERA DE RUTA' : 'EN RUTA • GPS ACTIVO')
          : geo.status === 'pidiendo' ? 'BUSCANDO GPS…' : 'GPS NO DISPONIBLE';
  const step = tracking === 'gps' && !p.atTerminal ? nextManeuver(navPath, me, p.nextStop?.name) : undefined;
  const holdLabel = hold > 0 ? 'Mantén presionado…' : 'Mantén presionado 2s para finalizar';
  const nearlyFull = o.percent >= 90;

  return (
    <div className="bg-surface-bg min-h-screen flex flex-col select-none overflow-x-hidden transition-colors duration-200">
      <header className="bg-surface-card text-primary border-b border-outline-variant/30 shadow-xs flex justify-between items-center w-full px-margin h-14 z-30 shrink-0 max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
          <span className="text-headline-sm text-primary font-extrabold tracking-tight">SAFER</span>
          <span className="text-label-sm font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full border border-outline-variant/30">Conductor</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={() => { haptic.heavy(); navigate('/conductor/incidencia'); }} className="flex items-center gap-1 bg-surface-container-low text-alert-coral text-label-md px-2.5 py-1.5 rounded-full hover:bg-surface-container active:scale-[0.985] border border-alert-coral/30">
            <Icon name="warning" className="text-[17px]" /><span className="font-semibold text-xs">Incidencia</span>
          </button>
          <button type="button" aria-label="Cerrar sesión" onClick={() => { logout(); navigate('/'); }} className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-full"><Icon name="logout" className="text-[20px]" /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto overflow-hidden pb-[68px]">
        <div className="relative">
          {hasGeo(route) ? (
            <LiveMap
              route={route}
              busPositionM={trip.positionM}
              gps={trip.gps}
              busLabel={`Bus #${bus.number}`}
              boardIndex={trip.nextStopIndex < route.stops.length ? trip.nextStopIndex : route.stops.length - 1}
              dropIndex={route.stops.length - 1}
              onboard={false}
              me={me}
              navPath={tracking === 'gps' ? navPath?.points : undefined}
              follow={tracking === 'gps'}
              heightClass="h-[335px]"
            />
          ) : (
            <RouteMap
              routeId={route.id}
              stops={route.stops}
              busPositionM={trip.positionM}
              busLabel={`Bus #${bus.number}`}
              boardIndex={trip.nextStopIndex < route.stops.length ? trip.nextStopIndex : route.stops.length - 1}
              dropIndex={route.stops.length - 1}
              onboard={false}
              heightClass="h-[335px]"
              showControls={true}
              controlsPosition="bottom-right"
            />
          )}
          <div className="absolute top-3 left-4 right-4 z-[600]">
            <div className="bg-surface-card/95 backdrop-blur-md rounded-[20px] p-3.5 shadow-level-1 border border-outline-variant/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/40 border border-secondary-container text-on-secondary-container">
                  <span className={`w-2 h-2 rounded-full ${tracking === 'gps' && geo.status === 'activa' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} /><span className="text-[11px] font-bold tracking-wide">{trackingLabel}</span>
                </div>
                <span className="text-label-sm text-on-surface-variant font-semibold">Unidad #{String(bus.number).padStart(3, '0')}</span>
              </div>
              <h2 className="text-headline-sm text-on-surface font-bold leading-tight">Ruta {route.code} en curso</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Icon name="near_me" className="text-[18px] text-primary" />
                <p className="text-[13px] font-semibold text-on-surface">
                  {p.atTerminal ? <>Llegaste a <span className="text-primary font-bold">{route.stops[route.stops.length - 1].name}</span></> : <>Próxima: <span className="text-primary font-bold">{p.nextStop!.name}</span>
                    <span className="text-on-surface-variant font-normal text-xs ml-1">({Math.max(1, Math.round(p.nextStop!.seconds / 60))} min • {fmtDistance(p.nextStop!.distanceM)})</span></>}
                </p>
              </div>
              {step && (
                <div className="mt-2 pt-2 border-t border-outline-variant/30 flex items-center gap-2" aria-live="polite">
                  <div className="w-9 h-9 rounded-xl bg-secondary text-surface-card flex items-center justify-center shrink-0">
                    <Icon name={step.icon} className="text-[22px]" />
                  </div>
                  <p className="text-label-lg font-bold text-on-surface leading-tight">
                    {step.inM !== undefined && <span className="text-secondary">{step.inM < 50 ? 'Ahora' : `En ${fmtDistance(step.inM)}`} • </span>}
                    {step.text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {tracking === 'pendiente' && (
            <div className="absolute inset-0 z-[700] bg-slate-950/55 backdrop-blur-[2px] flex items-end p-4">
              <div role="dialog" aria-labelledby="gps-title" className="w-full bg-surface-card rounded-3xl p-5 shadow-level-3 border border-outline-variant/30 animate-slideup">
                <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center mb-3"><Icon name="share_location" className="text-[28px]" /></div>
                <h2 id="gps-title" className="text-headline-sm font-bold text-on-surface">Activa tu ubicación para iniciar la ruta</h2>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Los estudiantes verán el bus en el mapa en tiempo real y te guiaremos parada por parada.
                  Se comparte solo mientras dure esta ruta.
                </p>
                <button type="button" onClick={() => { haptic.medium(); setTracking('gps'); }} className="mt-4 w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold flex items-center justify-center gap-2 active:scale-[0.985]">
                  <Icon name="my_location" className="text-[20px]" /> Activar ubicación
                </button>
                <button type="button" onClick={() => setTracking('demo')} className="mt-2 w-full h-11 rounded-full text-on-surface-variant text-label-md font-semibold hover:bg-surface-container-low">
                  Usar simulación (demo sin GPS)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 bg-surface-card rounded-t-[32px] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] z-20 px-5 pt-4 pb-6 flex flex-col justify-between -mt-4 border-t border-outline-variant/30">
          <div>
            <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon name="airline_seat_recline_normal" className="text-primary text-[20px]" /><h3 className="text-headline-sm text-on-surface font-bold">Aforo y pasajeros manuales</h3></div>
              <button type="button" onClick={() => setShowQr(true)} className="text-label-sm bg-surface-container-low text-primary px-2.5 py-1 rounded-full font-bold border border-outline-variant/30 flex items-center gap-1 active:scale-95">
                <Icon name="qr_code_2" className="text-[16px]" /> QR del bus
              </button>
            </div>
          </div>

          <div className="bg-surface-container-low/70 rounded-[24px] p-4 my-2 border border-outline-variant/30 flex flex-col items-center">
            <div className="w-full flex items-center justify-between gap-3">
              <button type="button" aria-label="Restar pasajero manual" onClick={() => press('sub')} className="w-[68px] h-[68px] rounded-full bg-surface-card text-on-surface flex items-center justify-center border-2 border-outline-variant/60 shadow-xs active:scale-90 hover:bg-surface-container-low transition-all">
                <Icon name="remove" className="text-[34px]" />
              </button>
              <div className="flex-1 flex flex-col items-center justify-center" aria-live="polite">
                <div className="flex items-baseline gap-1"><span className="text-display-eta text-primary tracking-tight tabular font-extrabold">{o.occupied}</span><span className="text-headline-md text-on-surface-variant font-bold">/ {o.capacity}</span></div>
                <p className="text-label-sm text-secondary font-semibold flex items-center gap-1 mt-0.5"><span className="w-2 h-2 rounded-full bg-secondary" />Asientos ocupados ({o.percent}%)</p>
              </div>
              <button type="button" aria-label="Agregar pasajero manual" onClick={() => press('add')} className="w-[68px] h-[68px] rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-90 hover:opacity-95 transition-all">
                <Icon name="add" className="text-[36px]" />
              </button>
            </div>
            <div className="w-full mt-3.5">
              <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden p-0.5">
                <div className={`h-full rounded-full transition-all duration-300 ${nearlyFull ? 'bg-alert-coral' : 'bg-gradient-to-r from-secondary-container via-primary to-primary-container'}`} style={{ width: `${Math.min(o.percent, 100)}%` }} />
              </div>
              <div className="flex justify-between items-center text-[11px] text-on-surface-variant mt-1 px-1 font-medium">
                <span>0 vacantes</span><span className="text-on-surface font-semibold">{o.available} asientos disponibles</span><span>{o.capacity} máx</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center my-1">
            <div className="bg-surface-container-low p-2.5 rounded-[16px] border border-outline-variant/30"><span className="text-[11px] text-on-surface-variant block">QR escaneados</span><div className="flex items-center justify-center gap-1 mt-0.5"><Icon name="qr_code_scanner" className="text-[16px] text-primary" /><span className="text-headline-sm font-bold text-on-surface tabular">{o.qr}</span></div></div>
            <div className="bg-surface-container-low p-2.5 rounded-[16px] border border-outline-variant/30"><span className="text-[11px] text-on-surface-variant block">Manuales</span><div className="flex items-center justify-center gap-1 mt-0.5"><Icon name="group" className="text-[16px] text-secondary" /><span className="text-headline-sm font-bold text-on-surface tabular">{o.manual}</span></div></div>
            <div className="bg-surface-container-low p-2.5 rounded-[16px] border border-outline-variant/30"><span className="text-[11px] text-on-surface-variant block">Velocidad</span><div className="flex items-center justify-center gap-1 mt-0.5"><Icon name="speed" className="text-[16px] text-primary" /><span className="text-headline-sm font-bold text-on-surface tabular">{p.speedKmh} <span className="text-xs font-normal text-on-surface-variant">km/h</span></span></div></div>
          </div>

          <div className="mt-2">
            <div className="relative w-full overflow-hidden rounded-[20px] border-2 border-alert-coral/70 bg-surface-card">
              <div className="absolute top-0 left-0 bottom-0 bg-alert-coral/15 pointer-events-none" style={{ width: `${hold * 100}%` }} />
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); startHold(); }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') startHold(); }} onKeyUp={stopHold}
                className="w-full py-4 px-4 flex items-center justify-center gap-2 relative z-10 text-alert-coral text-headline-sm font-bold active:bg-alert-coral/5 transition-colors touch-none"
              >
                <Icon name="flag" className="text-[24px] text-alert-coral" /><span>{holdLabel}</span>
              </button>
            </div>
            <p className="text-center text-[11px] text-on-surface-variant mt-1.5">Protección antitoques accidentales durante la marcha</p>
          </div>
        </div>
      </main>
      {showQr && <BusQrDialog bus={bus} onClose={() => setShowQr(false)} />}
      <BottomNav items={driverNavItems} />
      <DevPanel routeId={route.id} onChanged={() => undefined} />
    </div>
  );
}

/** Próxima indicación a mostrar: la primera maniobra del camino a la parada (después de "inicia el recorrido"). */
function nextManeuver(path: RoutePath | undefined, me: LatLng | undefined, stopName?: string): { text: string; icon: string; inM?: number } | undefined {
  if (!path || !me) return undefined;
  if (!path.onRoads || path.steps.length < 2) return { text: `Dirígete a ${stopName ?? 'la próxima parada'}`, icon: 'straight', inM: path.distanceM };
  const step = path.steps[1];
  const arrive = step.instruction.startsWith('Llegaste');
  return {
    text: arrive ? `Llegas a ${stopName ?? 'la parada'}` : step.instruction,
    icon: arrive ? 'flag' : /izquierda/.test(step.instruction) ? 'turn_left' : /derecha/.test(step.instruction) ? 'turn_right' : /rotonda/.test(step.instruction) ? 'roundabout_right' : /U/.test(step.instruction) ? 'u_turn_left' : 'straight',
    inM: haversineM(me, step.location),
  };
}
