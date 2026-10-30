import type { Stop } from '@/domain/model';
import { FULL_ROUTE_PATH, MAP_H, MAP_W, pathBetween, pointAt } from '../lib/routeGeometry';
import { Icon } from './Icon';

interface Props {
  stops: Stop[];
  busPositionM: number | undefined;
  busLabel: string;
  /** índice de la parada de subida (pin azul) */
  boardIndex: number;
  dropIndex: number;
  onboard: boolean;
  /** "(150m)" junto al pin del pasajero */
  walkLabel?: string;
  trafficLabel?: string;
  heightClass?: string;
  showControls?: boolean;
  onRecenter?: () => void;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Mapa esquemático en SVG. Se reemplaza por Leaflet + OSM sin tocar el resto de la UI. */
export function RouteMap({
  stops, busPositionM, busLabel, boardIndex, dropIndex, onboard, walkLabel, trafficLabel,
  heightClass = 'h-[370px]', showControls = true, onRecenter,
}: Props) {
  const bus = busPositionM === undefined ? undefined : pointAt(busPositionM);
  const focusIdx = onboard ? dropIndex : boardIndex;
  const focus = pointAt(stops[focusIdx].distanceFromStartM);

  return (
    <div className={`relative w-full ${heightClass} bg-slate-100 overflow-hidden`} role="img" aria-label="Mapa de la ruta con la posición del bus">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${MAP_W} ${MAP_H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={MAP_W} height={MAP_H} fill="#f1f5f3" />
        {/* áreas verdes */}
        <rect x="18" y="18" width="100" height="85" rx="10" fill="#dcfce7" />
        <rect x="130" y="18" width="130" height="50" rx="8" fill="#dcfce7" />
        <rect x="280" y="18" width="105" height="95" rx="12" fill="#d1fae5" />
        <rect x="18" y="225" width="120" height="105" rx="12" fill="#dcfce7" />
        <rect x="155" y="255" width="105" height="85" rx="10" fill="#dcfce7" />
        <rect x="280" y="225" width="105" height="115" rx="12" fill="#d1fae5" />
        {/* edificios */}
        {[
          [25, 28, 40, 32], [72, 28, 38, 30], [145, 25, 95, 35], [295, 28, 75, 35], [295, 70, 65, 32],
          [28, 240, 50, 38], [84, 240, 45, 40], [28, 288, 90, 32], [165, 268, 85, 58], [295, 240, 78, 42], [295, 292, 78, 40],
        ].map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
        ))}
        {/* calles */}
        <line x1="138" y1="0" x2="138" y2="370" stroke="#cbd5e1" strokeWidth="18" strokeLinecap="round" />
        <line x1="138" y1="0" x2="138" y2="370" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
        <line x1="270" y1="0" x2="270" y2="370" stroke="#cbd5e1" strokeWidth="22" strokeLinecap="round" />
        <line x1="270" y1="0" x2="270" y2="370" stroke="#fff" strokeWidth="18" strokeLinecap="round" />
        <line x1="0" y1="85" x2="400" y2="85" stroke="#cbd5e1" strokeWidth="14" />
        <line x1="0" y1="85" x2="400" y2="85" stroke="#fff" strokeWidth="10" />
        <line x1="0" y1="175" x2="400" y2="175" stroke="#cbd5e1" strokeWidth="24" />
        <line x1="0" y1="175" x2="400" y2="175" stroke="#fff" strokeWidth="20" />
        <circle cx="270" cy="175" r="22" fill="#fff" stroke="#cbd5e1" strokeWidth="4" />
        <circle cx="270" cy="175" r="12" fill="#dcfce7" stroke="#cbd5e1" strokeWidth="2" />
        <text x="20" y="171" fill="#64748b" fontFamily="Inter" fontSize="8.5" fontWeight="600" letterSpacing="0.05em">AV. UNIVERSITARIA</text>
        <text x="285" y="165" fill="#64748b" fontFamily="Inter" fontSize="8.5" fontWeight="600" letterSpacing="0.05em">BULEVAR CENTRAL</text>
        <text x="132" y="320" fill="#94a3b8" fontFamily="Inter" fontSize="7.5" fontWeight="600" transform="rotate(-90 132 320)">CALLE DE LAS CIENCIAS</text>
        <text x="263" y="320" fill="#94a3b8" fontFamily="Inter" fontSize="8" fontWeight="600" transform="rotate(-90 263 320)">AV. LAS PALMERAS</text>

        {/* ruta */}
        <path d={FULL_ROUTE_PATH} fill="none" stroke="#93c5fd" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        <path d={FULL_ROUTE_PATH} fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {busPositionM !== undefined && (
          <path d={pathBetween(0, busPositionM)} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4,5" strokeLinecap="round" />
        )}

        {/* paradas */}
        {stops.map((s, i) => {
          const [x, y] = pointAt(s.distanceFromStartM);
          const passed = busPositionM !== undefined && busPositionM > s.distanceFromStartM + 1;
          const isBoard = i === boardIndex && !onboard;
          const isDrop = i === dropIndex && onboard;
          const left = x < 200;
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={isBoard || isDrop ? 8 : 6} fill="#fff" stroke={isBoard || isDrop ? '#2563eb' : passed ? '#64748b' : '#94a3b8'} strokeWidth={isBoard || isDrop ? 4 : 3} />
              {(isBoard || isDrop) && <circle cx={x} cy={y} r="3.5" fill="#2563eb" />}
              {!isBoard && !isDrop && (
                <text x={left ? x - 10 : x + 10} y={y + 3} textAnchor={left ? 'end' : 'start'} fill={passed ? '#64748b' : '#475569'} fontFamily="Inter" fontSize="8.5" fontWeight="600" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                  {s.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* pin del bus */}
      {bus && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 transition-all duration-500 ease-linear" style={{ left: pct(bus[0], MAP_W), top: pct(bus[1], MAP_H) }}>
          <div className="relative flex items-center justify-center">
            <span className="absolute w-14 h-14 rounded-full bg-secondary-container/30 animate-ping-slow" />
            <span className="absolute w-9 h-9 rounded-full bg-secondary-container/20" />
            <div className="vehicle-glow relative flex items-center gap-1.5 bg-primary text-white px-2.5 py-1 rounded-full shadow-lg border border-white/90">
              <Icon name="directions_bus" className="text-[16px] text-secondary-container" />
              <span className="text-label-sm font-bold tracking-tight whitespace-nowrap">{busLabel}</span>
              <Icon name="arrow_forward" className="text-[14px]" />
            </div>
          </div>
        </div>
      )}

      {/* tooltip de la parada objetivo */}
      <div className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-20" style={{ left: pct(focus[0], MAP_W), top: `calc(${pct(focus[1], MAP_H)} - 10px)` }}>
        <div className="flex flex-col items-center">
          <div className="bg-white text-on-surface px-2.5 py-1 rounded-[12px] shadow-level-1 border border-outline-variant/40 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-label-md font-bold text-primary whitespace-nowrap">{onboard ? `Bajas: ${stops[dropIndex].name}` : stops[boardIndex].name}</span>
            {walkLabel && !onboard && <span className="text-body-sm text-secondary font-semibold">{walkLabel}</span>}
          </div>
          <div className="w-2.5 h-2.5 bg-white rotate-45 -mt-1 border-r border-b border-outline-variant/40" />
        </div>
      </div>

      {trafficLabel && (
        <div className="absolute left-4 top-4 z-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-outline-variant/30 shadow-level-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-label-sm font-semibold text-on-surface">{trafficLabel}</span>
          </div>
        </div>
      )}

      {showControls && (
        <div className="absolute right-4 top-4 flex flex-col gap-2.5 z-20">
          <button type="button" aria-label="Recentrar GPS" onClick={onRecenter} className="w-11 h-11 rounded-[12px] bg-white shadow-level-2 border border-outline-variant/30 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.985] transition-all">
            <Icon name="my_location" className="text-[22px] text-secondary" />
          </button>
          <button type="button" aria-label="Capas del mapa (próximamente)" className="w-11 h-11 rounded-[12px] bg-white shadow-level-2 border border-outline-variant/30 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.985] transition-all">
            <Icon name="layers" className="text-[22px] text-on-surface-variant" />
          </button>
        </div>
      )}
    </div>
  );
}
