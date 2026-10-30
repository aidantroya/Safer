import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { Icon } from '../../components/Icon';
import { RouteMap } from '../../components/RouteMap';
import { useToasts } from '../../components/Toasts';
import { fmtClock, fmtEta } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { usePassenger } from './PassengerContext';

/** Pantalla "Inicio Pasajero (SAFER)": enfocado únicamente en el mapa en vivo y la tarjeta de ruta activa. */
export function HomePage() {
  const { snap, refresh } = usePassenger();
  const { user } = useSession();
  const { toast, history } = useToasts();
  const navigate = useNavigate();
  const [showStops, setShowStops] = useState(false);

  if (!snap || !user) return <p className="p-6 text-on-surface-variant">Cargando…</p>;

  const { route, boardStop, dropStop, state, target, occupancy, bus, trip, traffic } = snap;
  const boardIndex = route.stops.findIndex((s) => s.id === boardStop.id);
  const dropIndex = route.stops.findIndex((s) => s.id === dropStop.id);
  const onboard = state === 'a_bordo';
  const eta = target ? fmtEta(target.etaSeconds) : undefined;

  const statusLabel = {
    esperando: 'EN RUTA • GPS ACTIVO',
    a_bordo: 'A BORDO • GPS ACTIVO',
    bus_paso: 'EL BUS YA PASÓ TU PARADA',
    sin_servicio: 'SIN UNIDADES EN RUTA',
  }[state];

  const subtitle = onboard
    ? `Bajas en ${dropStop.name} (a ${target?.stopsAway ?? 0} ${target?.stopsAway === 1 ? 'parada' : 'paradas'})`
    : state === 'esperando'
      ? `Parada ${boardStop.name} (a ${target?.stopsAway ?? 0} ${target?.stopsAway === 1 ? 'parada' : 'paradas'})`
      : state === 'bus_paso'
        ? 'Espera la siguiente unidad (frecuencia ' + route.frequencyMin + ' min)'
        : 'Vuelve a intentarlo en unos minutos';

  const share = async () => {
    haptic.light();
    const text = `Sigo el ${bus ? `Bus #${bus.number}` : 'bus'} de ${route.name}${
      eta ? ` — llega en ${eta.value} ${eta.unit}` : ''
    }`;
    try {
      if (navigator.share) await navigator.share({ title: 'SAFER Transit', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Copiado', 'Texto del viaje copiado al portapapeles.', 'ok');
      }
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-surface-bg transition-colors duration-200">
      {/* Encabezado con logo SAFER, saludo y toggle de tema */}
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md flex justify-between items-center w-full px-margin h-14 shadow-xs border-b border-outline-variant/30">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-safer-icon.jpg"
            alt="Logo SAFER"
            className="w-8 h-8 rounded-xl object-contain border border-outline-variant/30 shadow-xs"
          />
          <div>
            <span className="text-[10px] font-extrabold text-primary tracking-widest uppercase block">SAFER</span>
            <h1 className="text-[15px] text-on-surface font-extrabold tracking-tight leading-none">
              ¡Bienvenido, {user.name}!
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notificaciones"
            onClick={() => navigate('/pasajero/alertas')}
            className="relative w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-[0.96] transition-transform border border-outline-variant/30"
          >
            <Icon name="notifications" className="text-[20px]" />
            {history.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-alert-coral ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      {/* Selector de atajos y paradas favoritas */}
      <section className="px-margin py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-outline-variant/20 bg-surface-card/60">
        {(user.favorites ?? []).map((f, i) => (
          <button
            key={f.label}
            type="button"
            onClick={async () => {
              haptic.light();
              if (!f.stopId) return toast(f.label, 'Este atajo todavía no está conectado a una parada.', 'info');
              const res = await app.passenger.changeStops(user.id, { boardStopId: f.stopId });
              if (!res.ok) toast('No se pudo cambiar', res.error, 'warn');
              else await refresh();
            }}
            className={`px-3 py-1.5 rounded-full text-label-md flex items-center gap-1.5 shrink-0 active:scale-[0.985] transition-all ${
              (f.stopId ? f.stopId === boardStop.id : i === 0)
                ? 'bg-primary text-white shadow-sm font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/30 font-medium'
            }`}
          >
            <Icon name={f.icon} className="text-[15px]" />
            <span>{f.label}</span>
          </button>
        ))}
      </section>

      {/* Área enfocada únicamente en el mapa interactivo y tarjeta de ruta */}
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
          heightClass="h-[390px]"
          showControls={true}
          controlsPosition="top-right"
          onRecenter={() => toast('GPS', 'Centrado en el bus.', 'info')}
        />

        <div className="px-margin -mt-8 relative z-30 pb-4">
          <article className="bg-surface-card/95 backdrop-blur-md rounded-2xl p-space-md shadow-level-2 border border-outline-variant/40 transition-colors duration-200">
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
                    <div className="flex items-baseline gap-1 text-primary">
                      <span className="text-metric-display tabular tracking-tight font-extrabold">{eta.value}</span>
                      <span className="text-title-md font-bold">{eta.unit}</span>
                    </div>
                    <span className="text-label-sm text-on-surface-variant -mt-1">
                      Llegada: {fmtClock(target!.arrivalAtMs)}
                    </span>
                  </>
                ) : (
                  <span className="text-metric-display text-outline">—</span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStops((v) => !v)}
                aria-expanded={showStops}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-primary text-white rounded-[12px] text-label-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.985] transition-transform hover:opacity-95"
              >
                <Icon name="route" className="text-[18px]" />
                <span>{showStops ? 'Ocultar recorrido' : 'Ver recorrido completo'}</span>
              </button>
              <button
                type="button"
                aria-label="Compartir viaje"
                onClick={share}
                className="min-h-[44px] min-w-[44px] px-3 bg-surface-card text-primary border border-outline-variant/50 rounded-[12px] flex items-center justify-center hover:bg-surface-container-low active:scale-[0.985] transition-transform"
              >
                <Icon name="share" className="text-[20px]" />
              </button>
            </div>

            {showStops && (
              <ol className="mt-3 flex flex-col divide-y divide-outline-variant/20">
                {route.stops.map((s, i) => {
                  const passed = trip ? trip.positionM > s.distanceFromStartM + 1 : false;
                  const tag =
                    i === boardIndex
                      ? 'Tu subida'
                      : i === dropIndex
                        ? 'Tu bajada'
                        : passed
                          ? 'Pasó'
                          : trip && i === trip.nextStopIndex
                            ? 'Próxima'
                            : '';
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2">
                      <span
                        className={`w-3 h-3 rounded-full border-2 ${
                          i === boardIndex || i === dropIndex
                            ? 'border-primary bg-primary'
                            : passed
                              ? 'border-outline bg-outline'
                              : 'border-outline-variant bg-surface-card'
                        }`}
                      />
                      <span className={`text-body-md flex-1 ${passed ? 'text-on-surface-variant/60' : 'text-on-surface font-semibold'}`}>
                        {s.name}
                      </span>
                      {tag && (
                        <span className="text-label-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                          {tag}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-on-surface-variant">
              <Icon name="bolt" className="text-[14px] text-secondary" />
              <span className="text-label-sm font-medium">ETA actualizado en tiempo real</span>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
