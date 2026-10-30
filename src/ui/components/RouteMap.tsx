import { useEffect, useRef, useState } from 'react';
import type { Stop } from '@/domain/model';
import { MAP_H, MAP_W, routeGeometry } from '../lib/routeGeometry';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

interface Props {
  /** Define el trazado que se dibuja (ver lib/routeGeometry.ts). */
  routeId: string;
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
  controlsPosition?: 'top-right' | 'bottom-right';
  onRecenter?: () => void;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export function RouteMap({
  routeId,
  stops,
  busPositionM,
  busLabel,
  boardIndex,
  dropIndex,
  onboard,
  walkLabel,
  trafficLabel,
  heightClass = 'h-[370px]',
  showControls = true,
  controlsPosition = 'top-right',
  onRecenter,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const touchDistRef = useRef<number | null>(null);

  const { pointAt, pathBetween, isHorizontalAt, fullPath } = routeGeometry(routeId);
  const bus = busPositionM === undefined ? undefined : pointAt(busPositionM);
  const focusIdx = onboard ? dropIndex : boardIndex;
  const focus = stops[focusIdx] ? pointAt(stops[focusIdx].distanceFromStartM) : undefined;

  // Zoom con rueda del ratón
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((z) => Math.min(3.5, Math.max(0.7, +(z + delta).toFixed(2))));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxPan = 350 * zoom;
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panX + dx)),
      y: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      touchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / touchDistRef.current;
      setZoom((z) => Math.min(3.5, Math.max(0.7, +(z * (ratio > 1 ? 1.03 : 0.97)).toFixed(2))));
      touchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  const handleRecenter = () => {
    if (onRecenter) onRecenter();
    if (bus && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const busPctX = bus[0] / MAP_W;
      const busPctY = bus[1] / MAP_H;
      const targetPanX = (0.5 - busPctX) * rect.width;
      const targetPanY = (0.5 - busPctY) * rect.height;
      setPan({ x: Math.round(targetPanX), y: Math.round(targetPanY) });
      setZoom(1.35);
    } else {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(3.5, +(z + 0.3).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.7, +(z - 0.3).toFixed(2)));
  const handleReset = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Colores adaptados al tema (SAFER Navy & Cream vs Dark Night)
  const mapBg = isDark ? '#0A1120' : '#F8F6F0';
  const greenPark = isDark ? '#0D2620' : '#DCFCE7';
  const greenParkAlt = isDark ? '#09211C' : '#D1FAE5';
  const buildingFill = isDark ? '#142038' : '#EDE8DC';
  const buildingStroke = isDark ? '#23355A' : '#D1CABE';
  const streetBase = isDark ? '#1E2D4A' : '#CBD5E1';
  const streetSurface = isDark ? '#0F1A30' : '#FFFFFF';
  const textStreet = isDark ? '#8295B5' : '#64748B';
  const textStop = isDark ? '#E2E8F0' : '#475569';
  const textStroke = isDark ? '#0A1120' : '#FFFFFF';
  const routeBase = isDark ? '#1E3A8A' : '#93C5FD';
  const routeMain = isDark ? '#38BDF8' : '#112240';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${heightClass} bg-surface-container-low overflow-hidden select-none touch-none transition-colors duration-200 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      role="region"
      aria-label="Mapa interactivo y dinámico de la ruta"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Contenedor dinámico (SVG + marcadores) */}
      <div
        className={`w-full h-full origin-center ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width={MAP_W} height={MAP_H} fill={mapBg} />
          {/* áreas verdes */}
          <rect x="18" y="18" width="100" height="85" rx="10" fill={greenPark} />
          <rect x="130" y="18" width="130" height="50" rx="8" fill={greenPark} />
          <rect x="280" y="18" width="105" height="95" rx="12" fill={greenParkAlt} />
          <rect x="18" y="225" width="120" height="105" rx="12" fill={greenPark} />
          <rect x="155" y="255" width="105" height="85" rx="10" fill={greenPark} />
          <rect x="280" y="225" width="105" height="115" rx="12" fill={greenParkAlt} />
          {/* edificios */}
          {[
            [25, 28, 40, 32],
            [72, 28, 38, 30],
            [145, 25, 95, 35],
            [295, 28, 75, 35],
            [295, 70, 65, 32],
            [28, 240, 50, 38],
            [84, 240, 45, 40],
            [28, 288, 90, 32],
            [165, 268, 85, 58],
            [295, 240, 78, 42],
            [295, 292, 78, 40],
          ].map(([x, y, w, h]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="4"
              fill={buildingFill}
              stroke={buildingStroke}
              strokeWidth="1"
            />
          ))}
          {/* calles */}
          <line x1="138" y1="0" x2="138" y2="370" stroke={streetBase} strokeWidth="18" strokeLinecap="round" />
          <line x1="138" y1="0" x2="138" y2="370" stroke={streetSurface} strokeWidth="14" strokeLinecap="round" />
          <line x1="270" y1="0" x2="270" y2="370" stroke={streetBase} strokeWidth="22" strokeLinecap="round" />
          <line x1="270" y1="0" x2="270" y2="370" stroke={streetSurface} strokeWidth="18" strokeLinecap="round" />
          <line x1="0" y1="85" x2="400" y2="85" stroke={streetBase} strokeWidth="14" />
          <line x1="0" y1="85" x2="400" y2="85" stroke={streetSurface} strokeWidth="10" />
          <line x1="0" y1="175" x2="400" y2="175" stroke={streetBase} strokeWidth="24" />
          <line x1="0" y1="175" x2="400" y2="175" stroke={streetSurface} strokeWidth="20" />
          <circle cx="270" cy="175" r="22" fill={streetSurface} stroke={streetBase} strokeWidth="4" />
          <circle cx="270" cy="175" r="12" fill={greenPark} stroke={streetBase} strokeWidth="2" />
          <text x="20" y="171" fill={textStreet} fontFamily="Inter" fontSize="8.5" fontWeight="600" letterSpacing="0.05em">
            AV. UNIVERSITARIA
          </text>
          <text x="285" y="165" fill={textStreet} fontFamily="Inter" fontSize="8.5" fontWeight="600" letterSpacing="0.05em">
            BULEVAR CENTRAL
          </text>
          <text x="132" y="320" fill={textStreet} fontFamily="Inter" fontSize="7.5" fontWeight="600" transform="rotate(-90 132 320)">
            CALLE DE LAS CIENCIAS
          </text>
          <text x="263" y="320" fill={textStreet} fontFamily="Inter" fontSize="8" fontWeight="600" transform="rotate(-90 263 320)">
            AV. LAS PALMERAS
          </text>

          {/* ruta */}
          <path d={fullPath} fill="none" stroke={routeBase} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity={isDark ? 0.4 : 0.55} />
          <path d={fullPath} fill="none" stroke={routeMain} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
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
            const above = isHorizontalAt(s.distanceFromStartM);
            const pinColor = isDark ? '#38BDF8' : '#112240';
            return (
              <g key={s.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={isBoard || isDrop ? 8 : 6}
                  fill={isDark ? '#0F1A30' : '#fff'}
                  stroke={isBoard || isDrop ? pinColor : passed ? '#64748b' : isDark ? '#475569' : '#94a3b8'}
                  strokeWidth={isBoard || isDrop ? 4 : 3}
                />
                {(isBoard || isDrop) && <circle cx={x} cy={y} r="3.5" fill={pinColor} />}
                {!isBoard && !isDrop && (
                  <text
                    x={above ? x : left ? x - 10 : x + 10}
                    y={above ? y - 11 : y + 3}
                    textAnchor={above ? 'middle' : left ? 'end' : 'start'}
                    fill={passed ? '#64748b' : textStop}
                    fontFamily="Inter"
                    fontSize="8.5"
                    fontWeight="600"
                    stroke={textStroke}
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {s.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* pin del bus */}
        {bus && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 transition-all duration-500 ease-linear"
            style={{ left: pct(bus[0], MAP_W), top: pct(bus[1], MAP_H) }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-14 h-14 rounded-full bg-secondary-container/40 animate-ping-slow" />
              <span className="absolute w-9 h-9 rounded-full bg-secondary-container/30" />
              <div className="vehicle-glow relative flex items-center gap-1.5 bg-primary text-on-primary px-2.5 py-1 rounded-full shadow-lg border border-surface-card/90">
                <Icon name="directions_bus" className="text-[16px]" />
                <span className="text-label-sm font-bold tracking-tight whitespace-nowrap">{busLabel}</span>
                <Icon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>
          </div>
        )}

        {/* tooltip de la parada objetivo */}
        {focus && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-20"
            style={{ left: pct(Math.min(Math.max(focus[0], 70), MAP_W - 70), MAP_W), top: `calc(${pct(focus[1], MAP_H)} - 10px)` }}
          >
            <div className="flex flex-col items-center">
              <div className="bg-surface-card text-on-surface px-2.5 py-1 rounded-[12px] shadow-level-1 border border-outline-variant/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-label-md font-bold text-primary whitespace-nowrap">
                  {onboard ? `Bajas: ${stops[dropIndex]?.name ?? ''}` : stops[boardIndex]?.name ?? ''}
                </span>
                {walkLabel && !onboard && <span className="text-body-sm text-secondary font-semibold">{walkLabel}</span>}
              </div>
              <div className="w-2.5 h-2.5 bg-surface-card rotate-45 -mt-1 border-r border-b border-outline-variant/40" />
            </div>
          </div>
        )}
      </div>

      {/* HUD: Etiqueta de tráfico */}
      {trafficLabel && (
        <div className="absolute left-4 top-4 z-20 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-card/95 backdrop-blur-md border border-outline-variant/30 shadow-level-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-label-sm font-semibold text-on-surface">{trafficLabel}</span>
          </div>
        </div>
      )}

      {/* HUD: Controles de navegación dinámica */}
      {showControls && (
        <div
          className={`absolute ${
            controlsPosition === 'bottom-right' ? 'right-4 bottom-4' : 'right-4 top-4'
          } flex flex-col gap-1.5 z-20 pointer-events-auto`}
        >
          <button
            type="button"
            aria-label="Recentrar en bus"
            title="Recentrar en bus"
            onClick={handleRecenter}
            className="w-10 h-10 rounded-[12px] bg-surface-card shadow-level-2 border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.96] transition-all text-secondary"
          >
            <Icon name="my_location" className="text-[20px]" />
          </button>
          <button
            type="button"
            aria-label="Acercar zoom"
            title="Acercar zoom"
            onClick={handleZoomIn}
            className="w-10 h-10 rounded-[12px] bg-surface-card shadow-level-2 border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.96] transition-all text-on-surface"
          >
            <Icon name="add" className="text-[20px]" />
          </button>
          <button
            type="button"
            aria-label="Alejar zoom"
            title="Alejar zoom"
            onClick={handleZoomOut}
            className="w-10 h-10 rounded-[12px] bg-surface-card shadow-level-2 border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.96] transition-all text-on-surface"
          >
            <Icon name="remove" className="text-[20px]" />
          </button>
          <button
            type="button"
            aria-label="Vista completa"
            title="Vista completa"
            onClick={handleReset}
            className="w-10 h-10 rounded-[12px] bg-surface-card shadow-level-2 border border-outline-variant/40 flex items-center justify-center hover:bg-surface-container-low active:scale-[0.96] transition-all text-on-surface-variant"
          >
            <Icon name="crop_free" className="text-[18px]" />
          </button>
        </div>
      )}

      {/* Indicador sutil de interacción */}
      <div className="absolute left-3 bottom-2.5 z-20 pointer-events-none opacity-60">
        <span className="text-[10px] font-medium bg-surface-card/85 backdrop-blur-sm text-on-surface-variant px-2 py-0.5 rounded-full border border-outline-variant/30 flex items-center gap-1 shadow-sm">
          <Icon name="drag_pan" className="text-[12px]" /> Arrastra • Zoom {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
