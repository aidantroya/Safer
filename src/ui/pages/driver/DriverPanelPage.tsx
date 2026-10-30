import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { DriverPanel, TripSummary } from '@/service/DriverService';
import { DevPanel } from '../../components/DevPanel';
import { Icon } from '../../components/Icon';
import { RouteMap } from '../../components/RouteMap';
import { useToasts } from '../../components/Toasts';
import { fmtDistance } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { usePolling } from '../../lib/usePolling';
import { TRIP_KEY, useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { ReportIncidentPage } from '../passenger/ReportIncidentPage';

const HOLD_MS = 2000;

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

  usePolling(async () => {
    if (!tripId || summary) return;
    const r = await app.driver.getPanel(tripId);
    if (r.ok) setPanel(r.data);
  }, 500, !!tripId && !summary);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg p-5">
        <div className="bg-surface-card rounded-3xl p-6 max-w-sm w-full shadow-level-2 border border-outline-variant/30 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center"><Icon name="flag" fill className="text-[34px]" /></div>
          <h1 className="text-headline-md font-bold text-on-surface">Viaje finalizado</h1>
          <dl className="grid grid-cols-2 gap-3 w-full text-left">
            {[['Distancia', `${summary.kmTraveled} km`], ['Duración', `${summary.durationMin} min`], ['Pasajeros con QR', summary.qrCount], ['Manuales', summary.manualCount]].map(([k, v]) => (
              <div key={String(k)} className="bg-surface-container-low rounded-2xl p-3 border border-outline-variant/20"><dt className="text-label-sm text-on-surface-variant font-medium">{k}</dt><dd className="text-title-md font-bold text-primary">{v}</dd></div>
            ))}
          </dl>
          <button type="button" onClick={() => { logout(); navigate('/'); }} className="mt-2 w-full min-h-[48px] rounded-full bg-primary text-white text-label-lg font-bold active:scale-[0.985]">Volver al inicio</button>
        </div>
      </div>
    );
  }

  const p = panel!;
  const { occupancy: o, route, trip, bus } = p;
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

      <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto overflow-hidden">
        <div className="relative">
          <RouteMap
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
          <div className="absolute top-3 left-4 right-4 z-30">
            <div className="bg-surface-card/95 backdrop-blur-md rounded-[20px] p-3.5 shadow-level-1 border border-outline-variant/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/40 border border-secondary-container text-on-secondary-container">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[11px] font-bold tracking-wide">EN RUTA • GPS ACTIVO</span>
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
            </div>
          </div>
        </div>

        <div className="flex-1 bg-surface-card rounded-t-[32px] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] z-20 px-5 pt-4 pb-6 flex flex-col justify-between -mt-4 border-t border-outline-variant/30">
          <div>
            <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Icon name="airline_seat_recline_normal" className="text-primary text-[20px]" /><h3 className="text-headline-sm text-on-surface font-bold">Aforo y pasajeros manuales</h3></div>
              <span className="text-label-sm bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full font-medium border border-outline-variant/30">Sin QR</span>
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
              <button type="button" aria-label="Agregar pasajero manual" onClick={() => press('add')} className="w-[68px] h-[68px] rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 hover:opacity-95 transition-all">
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
      <DevPanel routeId={route.id} onChanged={() => undefined} />
    </div>
  );
}
