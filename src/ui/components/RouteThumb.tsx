import type { Stop } from '@/domain/model';
import { MAP_H, MAP_W, routeGeometry } from '../lib/routeGeometry';

/** Miniatura del recorrido sobre las calles del mapa esquemático (sin interacción). */
export function RouteThumb({ routeId, stops, busPositionM }: { routeId: string; stops: Stop[]; busPositionM?: number }) {
  const { fullPath, pointAt } = routeGeometry(routeId);
  const bus = busPositionM === undefined ? undefined : pointAt(busPositionM);
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <rect width={MAP_W} height={MAP_H} className="fill-surface-container-low" />
      {[138, 270].map((x) => <line key={x} x1={x} y1="0" x2={x} y2={MAP_H} className="stroke-outline-variant" strokeWidth="14" />)}
      {[85, 175].map((y) => <line key={y} x1="0" y1={y} x2={MAP_W} y2={y} className="stroke-outline-variant" strokeWidth="14" />)}
      <path d={fullPath} fill="none" className="stroke-primary" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      {stops.map((s) => {
        const [x, y] = pointAt(s.distanceFromStartM);
        return <circle key={s.id} cx={x} cy={y} r="9" className="fill-surface-card stroke-primary" strokeWidth="6" />;
      })}
      {bus && <circle cx={bus[0]} cy={bus[1]} r="16" className="fill-secondary stroke-surface-card" strokeWidth="6" />}
    </svg>
  );
}
