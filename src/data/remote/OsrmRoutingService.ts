import { haversineM, type LatLng } from '@/domain/geo';
import type { NavStep, RoutePath } from '@/domain/model';
import type { IRoutingService } from '@/domain/repository';

/**
 * Caminos sobre calles reales con OSRM (OpenStreetMap). Gratis y sin clave; el servidor público no garantiza
 * disponibilidad, así que para producción conviene uno propio (VITE_OSRM_URL). Sin conexión devuelve una
 * línea recta entre los puntos para que el mapa siga funcionando.
 */
export class OsrmRoutingService implements IRoutingService {
  private cache = new Map<string, Promise<RoutePath>>();

  constructor(
    private baseUrl = (import.meta.env?.VITE_OSRM_URL as string | undefined) ?? 'https://router.project-osrm.org',
    private fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  route(waypoints: LatLng[]): Promise<RoutePath> {
    const key = waypoints.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(';');
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.fetchRoute(waypoints).catch(() => straightLine(waypoints));
      this.cache.set(key, hit);
      if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    }
    return hit;
  }

  private async fetchRoute(waypoints: LatLng[]): Promise<RoutePath> {
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await this.fetchFn(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      const r = data.routes?.[0];
      if (data.code !== 'Ok' || !r) throw new Error(`OSRM ${data.code}`);
      const steps: NavStep[] = r.legs.flatMap((leg: { steps: OsrmStep[] }) =>
        leg.steps.map((s) => ({
          instruction: instruction(s),
          distanceM: s.distance,
          location: [s.maneuver.location[1], s.maneuver.location[0]] as LatLng,
        })),
      );
      return {
        points: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLng),
        distanceM: r.distance,
        durationS: r.duration,
        steps,
        onRoads: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function straightLine(waypoints: LatLng[]): RoutePath {
  const distanceM = waypoints.slice(1).reduce((acc, p, i) => acc + haversineM(waypoints[i], p), 0);
  return { points: waypoints, distanceM, durationS: distanceM / 6, steps: [], onRoads: false };
}

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] };
}

const MODIFIER: Record<string, string> = {
  left: 'a la izquierda',
  right: 'a la derecha',
  'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha',
  'sharp left': 'cerrado a la izquierda',
  'sharp right': 'cerrado a la derecha',
  uturn: 'en U',
  straight: 'recto',
};

/** Indicación en español a partir de la maniobra de OSRM. */
export function instruction({ name, maneuver: { type, modifier, exit } }: OsrmStep): string {
  const on = name ? ` por ${name}` : '';
  const mod = modifier ? MODIFIER[modifier] ?? '' : '';
  switch (type) {
    case 'depart':
      return `Inicia el recorrido${on}`;
    case 'arrive':
      return 'Llegaste a la parada';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return `En la rotonda, toma la ${exit ? `${exit}.ª ` : ''}salida${name ? ` hacia ${name}` : ''}`;
    case 'continue':
    case 'new name':
      return modifier === 'straight' || !mod ? `Continúa${on}` : `Mantente ${mod}${on}`;
    default:
      if (modifier === 'straight') return `Sigue recto${on}`;
      if (modifier === 'uturn') return `Da la vuelta en U${on}`;
      return `Gira ${mod}${name ? ` en ${name}` : ''}`.trim();
  }
}
