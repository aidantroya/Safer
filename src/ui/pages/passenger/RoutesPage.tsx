import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { RouteOverview } from '@/service/RouteCatalogService';
import { Icon } from '../../components/Icon';
import { RouteThumb } from '../../components/RouteThumb';
import { Stars } from '../../components/Stars';
import { useToasts } from '../../components/Toasts';
import { initials } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { usePolling } from '../../lib/usePolling';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { usePassenger } from './PassengerContext';

/** Pantalla "Rutas": el estudiante registra la ruta que usa y ve quién la maneja hoy y cómo lo califican. */
export function RoutesPage() {
  const { snap } = usePassenger();
  const [routes, setRoutes] = useState<RouteOverview[]>();
  const [registering, setRegistering] = useState<RouteOverview>();

  const load = useCallback(async () => {
    const res = await app.passenger.listRoutes();
    if (res.ok) setRoutes(res.data);
  }, []);
  usePolling(load, 2000);

  const currentId = snap?.route.id;
  const mine = routes?.find((r) => r.route.id === currentId);
  const others = routes?.filter((r) => r.route.id !== currentId) ?? [];
  const weekday = new Date().toLocaleDateString('es', { weekday: 'long' });

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md flex items-center justify-between px-margin h-14 border-b border-outline-variant/30 shadow-xs">
        <div className="flex items-center gap-2">
          <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
          <h1 className="text-headline-sm text-primary font-bold tracking-tight">Rutas</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-margin pt-4 flex flex-col gap-space-md">
        {!routes || !snap ? (
          <p className="text-on-surface-variant text-body-md py-6 text-center">Cargando rutas…</p>
        ) : (
          <>
            {mine && (
              <section aria-labelledby="mi-ruta">
                <h2 id="mi-ruta" className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">Tu ruta registrada</h2>
                <RouteCard
                  item={mine}
                  weekday={weekday}
                  highlight
                  detail={`Subes en ${snap.boardStop.name} • Bajas en ${snap.dropStop.name}`}
                  action={<MapButton />}
                />
              </section>
            )}

            <section aria-labelledby="otras-rutas" className="flex flex-col gap-3">
              <h2 id="otras-rutas" className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Rutas disponibles</h2>
              {others.map((item) => (
                <RouteCard
                  key={item.route.id}
                  item={item}
                  weekday={weekday}
                  action={
                    <button
                      type="button"
                      onClick={() => { haptic.light(); setRegistering(item); }}
                      className="min-h-[44px] px-4 rounded-[12px] bg-primary text-on-primary text-label-lg font-bold flex items-center gap-1.5 active:scale-[0.985] shadow-sm"
                    >
                      <Icon name="add_location_alt" className="text-[18px]" /> Registrar ruta
                    </button>
                  }
                />
              ))}
            </section>
          </>
        )}
      </main>

      {registering && <RegisterSheet item={registering} onClose={() => setRegistering(undefined)} />}
    </div>
  );
}

function MapButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/pasajero')}
      className="min-h-[44px] px-4 rounded-[12px] bg-primary text-on-primary text-label-lg font-bold flex items-center gap-1.5 active:scale-[0.985] shadow-sm"
    >
      <Icon name="map" className="text-[18px]" /> Ver en vivo
    </button>
  );
}

function RouteCard({
  item, weekday, highlight = false, detail, action,
}: { item: RouteOverview; weekday: string; highlight?: boolean; detail?: string; action: ReactNode }) {
  const { route, driver, bus, rating, live } = item;
  return (
    <article className={`bg-surface-card rounded-2xl shadow-level-1 overflow-hidden border ${highlight ? 'border-primary/50 ring-1 ring-primary/30' : 'border-outline-variant/30'}`}>
      <div className="flex gap-3 p-3.5">
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-outline-variant/30 shrink-0">
          <RouteThumb routeId={route.id} stops={route.stops} busPositionM={live?.positionM} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-primary text-on-primary text-label-sm font-extrabold tabular">R{route.code}</span>
            {live ? (
              <span className="inline-flex items-center gap-1 text-label-sm font-semibold text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> En ruta
              </span>
            ) : (
              <span className="text-label-sm font-semibold text-on-surface-variant">Sin unidad en ruta</span>
            )}
          </div>
          <h3 className="text-title-md font-bold text-on-surface mt-1 leading-tight">{route.shortName}</h3>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            {detail ?? `${route.stops[0].name} → ${route.stops[route.stops.length - 1].name}`}
          </p>
          <p className="text-label-sm text-on-surface-variant mt-0.5">
            {route.stops.length} paradas • {(route.lengthM / 1000).toFixed(1).replace('.', ',')} km • cada {route.frequencyMin} min
          </p>
        </div>
      </div>

      <div className="mx-3.5 mb-3.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-3">
        {driver ? (
          <>
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-lg font-bold shrink-0">
              {initials(driver.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-on-surface-variant font-medium block capitalize">Conductor de hoy ({weekday})</span>
              <span className="text-label-lg font-bold text-on-surface block truncate">{driver.fullName}</span>
              <span className="flex items-center gap-1.5">
                {rating.average !== null ? (
                  <>
                    <Stars value={rating.average} size={14} />
                    <span className="text-label-sm font-bold text-on-surface tabular">{rating.average.toFixed(1)}</span>
                    <span className="text-label-sm text-on-surface-variant">({rating.count} reseñas)</span>
                  </>
                ) : (
                  <span className="text-label-sm text-on-surface-variant">Sin reseñas todavía</span>
                )}
              </span>
            </div>
            {bus && (
              <div className="text-right shrink-0">
                <span className="text-[11px] text-on-surface-variant block">Unidad</span>
                <span className="text-label-lg font-bold text-primary">Bus #{bus.number}</span>
                {live && <span className="text-[11px] text-on-surface-variant block tabular">{live.occupancy.occupied}/{live.occupancy.capacity} a bordo</span>}
              </div>
            )}
          </>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Sin conductor asignado para hoy.</span>
        )}
      </div>

      <div className="px-3.5 pb-3.5 flex justify-end">{action}</div>
    </article>
  );
}

function RegisterSheet({ item, onClose }: { item: RouteOverview; onClose: () => void }) {
  const { user } = useSession();
  const { refresh } = usePassenger();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const stops = item.route.stops;
  // Por defecto sube en la primera parada a la que el bus de hoy todavía no llega (si no, en la primera).
  const ahead = item.live ? stops.findIndex((s) => s.distanceFromStartM > item.live!.positionM + 200) : 0;
  const [board, setBoard] = useState(stops[ahead >= 0 && ahead < stops.length - 1 ? ahead : 0].id);
  const [drop, setDrop] = useState(stops[stops.length - 1].id);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await app.passenger.selectRoute(user!.id, item.route.id, { boardStopId: board, dropStopId: drop });
    setBusy(false);
    if (!res.ok) return toast('No se pudo registrar la ruta', res.error, 'warn');
    haptic.success();
    await refresh();
    toast('Ruta registrada', `${item.route.name}. Ahora la sigues en el mapa en vivo.`, 'ok');
    onClose();
    navigate('/pasajero');
  };

  const sel = 'w-full min-h-[48px] rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface px-4 text-body-md focus:bg-surface-card outline-none';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Registrar ${item.route.name}`} className="animate-slideup relative w-full max-w-md bg-surface-card rounded-t-[28px] p-5 pb-8 shadow-2xl border-t border-outline-variant/30">
        <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-3" />
        <h2 className="text-headline-sm font-bold mb-1 text-primary">Registrar ruta</h2>
        <p className="text-body-sm text-on-surface-variant mb-4">{item.route.name}</p>
        <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="reg-board">Subo en</label>
        <select id="reg-board" value={board} onChange={(e) => setBoard(e.target.value)} className={`${sel} mt-1 mb-3`}>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.order}. {s.name}</option>)}
        </select>
        <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="reg-drop">Bajo en</label>
        <select id="reg-drop" value={drop} onChange={(e) => setDrop(e.target.value)} className={`${sel} mt-1 mb-5`}>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.order}. {s.name}</option>)}
        </select>
        <button type="button" onClick={save} disabled={busy} className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-md active:scale-[0.985] disabled:opacity-50">
          {busy ? 'Registrando…' : 'Registrar y ver en vivo'}
        </button>
      </div>
    </div>
  );
}
