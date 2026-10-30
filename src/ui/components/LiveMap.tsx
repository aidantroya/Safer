import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline as LinePath, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { app } from '@/api';
import { Polyline, RouteReferencer, type LatLng } from '@/domain/geo';
import type { GpsFix, Route, RoutePath } from '@/domain/model';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

interface Props {
  route: Route;
  /** Metros recorridos por el bus (simulación o GPS ya proyectado). */
  busPositionM?: number;
  /** Si el conductor comparte GPS, el bus se dibuja en su posición real. */
  gps?: GpsFix;
  busLabel: string;
  boardIndex: number;
  dropIndex: number;
  onboard: boolean;
  /** Posición del propio dispositivo (conductor con GPS). */
  me?: LatLng;
  /** Camino resaltado: navegación a la próxima parada o regreso a la estación. */
  navPath?: LatLng[];
  heightClass?: string;
  /** Mantener el mapa centrado en el bus. */
  follow?: boolean;
  trafficLabel?: string;
}

/** Teselas estándar de OpenStreetMap (sin clave). En tema oscuro se invierten con CSS (ver .map-dark en index.css). */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const busIcon = (label: string) =>
  L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div class="-translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-full shadow-lg border-2 border-surface-card whitespace-nowrap text-[12px] font-bold"><span class="material-symbols-outlined" style="font-size:16px">directions_bus</span>${label}</div>`,
  });

const meIcon = L.divIcon({
  className: '',
  iconSize: [0, 0],
  html: '<div class="-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-sky-500 border-[3px] border-white shadow-[0_0_0_6px_rgba(14,165,233,0.25)]"></div>',
});

/** Trazado de cada ruta en memoria de la página para no pedirlo en cada render. */
function useRoutePath(routeId: string): RoutePath | undefined {
  const [path, setPath] = useState<RoutePath>();
  useEffect(() => {
    let alive = true;
    setPath(undefined);
    void app.maps.getRoutePath(routeId).then((r) => alive && r.ok && setPath(r.data));
    return () => {
      alive = false;
    };
  }, [routeId]);
  return path;
}

/** Mapa real (Leaflet + OpenStreetMap): trazado por calles, paradas, bus en vivo y navegación. */
export function LiveMap({
  route, busPositionM, gps, busLabel, boardIndex, dropIndex, onboard, me, navPath, heightClass = 'h-[390px]', follow = false, trafficLabel,
}: Props) {
  const { theme } = useTheme();
  const path = useRoutePath(route.id);
  const ref = useMemo(() => (path ? new RouteReferencer(route, new Polyline(path.points)) : undefined), [route, path]);
  const [following, setFollowing] = useState(follow);

  const bus: LatLng | undefined = gps ? [gps.lat, gps.lng] : ref && busPositionM !== undefined ? ref.toLatLng(busPositionM) : undefined;
  const traveled = ref && busPositionM !== undefined ? ref.slice(0, busPositionM) : [];
  const focusIdx = onboard ? dropIndex : boardIndex;

  return (
    <div className={`relative w-full ${heightClass} isolate bg-surface-container-low ${theme === 'dark' ? 'map-dark' : ''}`}>
      <MapContainer
        center={[route.stops[0].lat!, route.stops[0].lng!]}
        zoom={16}
        zoomControl={false}
        attributionControl
        className="w-full h-full"
        aria-label={`Mapa de la ${route.name}`}
      >
        <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
        <FitRoute points={path?.points} routeId={route.id} />
        {following && (me ?? bus) && <Follow to={(me ?? bus)!} />}

        {path && (
          <>
            <LinePath positions={path.points} pathOptions={{ color: theme === 'dark' ? '#1E3A8A' : '#93C5FD', weight: 10, opacity: 0.6 }} />
            <LinePath positions={path.points} pathOptions={{ color: theme === 'dark' ? '#38BDF8' : '#112240', weight: 5 }} />
          </>
        )}
        {traveled.length > 1 && <LinePath positions={traveled} pathOptions={{ color: '#ffffff', weight: 2, dashArray: '4 6', opacity: 0.9 }} />}
        {navPath && navPath.length > 1 && (
          <LinePath positions={navPath} pathOptions={{ color: '#0D9488', weight: 7, opacity: 0.95, lineCap: 'round' }} />
        )}

        {route.stops.map((s, i) => {
          const passed = busPositionM !== undefined && busPositionM > s.distanceFromStartM + 1;
          const focus = i === focusIdx;
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat!, s.lng!]}
              radius={focus ? 9 : 6}
              pathOptions={{
                color: focus ? (theme === 'dark' ? '#38BDF8' : '#112240') : passed ? '#64748b' : '#94a3b8',
                weight: focus ? 4 : 3,
                fillColor: theme === 'dark' ? '#0F1A30' : '#ffffff',
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent={focus} className="!text-[12px] !font-semibold">
                {focus ? (onboard ? `Bajas: ${s.name}` : s.name) : s.name}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {bus && <Marker position={bus} icon={busIcon(busLabel)} zIndexOffset={1000} />}
        {me && <Marker position={me} icon={meIcon} zIndexOffset={1100} />}
      </MapContainer>

      {trafficLabel && (
        <div className="absolute left-4 top-4 z-[500] pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-card/95 backdrop-blur-md border border-outline-variant/30 shadow-level-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-label-sm font-semibold text-on-surface">{trafficLabel}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-pressed={following}
        aria-label={following ? 'Dejar de seguir el bus' : 'Seguir el bus'}
        title={following ? 'Dejar de seguir' : 'Seguir el bus'}
        onClick={() => setFollowing((v) => !v)}
        className={`absolute right-4 bottom-8 z-[500] w-11 h-11 rounded-[12px] shadow-level-2 border flex items-center justify-center active:scale-[0.96] ${
          following ? 'bg-primary text-on-primary border-primary' : 'bg-surface-card text-secondary border-outline-variant/40'
        }`}
      >
        <Icon name={following ? 'navigation' : 'my_location'} fill={following} className="text-[22px]" />
      </button>

      {path && !path.onRoads && (
        <div className="absolute left-3 bottom-8 z-[500] text-[11px] px-2 py-1 rounded-full bg-surface-card/90 text-on-surface-variant border border-outline-variant/30">
          Sin servicio de rutas: trazado aproximado
        </div>
      )}
    </div>
  );
}

/** Encuadra la ruta completa cuando cambia de ruta. */
function FitRoute({ points, routeId }: { points?: LatLng[]; routeId: string }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28] });
  }, [map, points, routeId]);
  return null;
}

/** Mantiene centrado el punto (modo navegación). */
function Follow({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(to, { animate: true });
  }, [map, to[0], to[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
