import { haversineM, hasGeo, Polyline, RouteReferencer, type LatLng } from '@/domain/geo';
import type { Route, RoutePath } from '@/domain/model';
import type { IRoutingService } from '@/domain/repository';
import { DomainError } from './errors';

/** Sin servicio de rutas: líneas rectas entre los puntos (tests y modo sin conexión). */
export class StraightLineRoutingService implements IRoutingService {
  async route(waypoints: LatLng[]): Promise<RoutePath> {
    const distanceM = waypoints.slice(1).reduce((acc, p, i) => acc + haversineM(waypoints[i], p), 0);
    return { points: waypoints, distanceM, durationS: distanceM / 6, steps: [], onRoads: false };
  }
}

export interface RouteLine {
  path: RoutePath;
  ref: RouteReferencer;
}

/** Trazado real de cada ruta y caminos de navegación para el conductor. */
export class NavigationService {
  private lines = new Map<string, Promise<RouteLine>>();

  constructor(private routing: IRoutingService) {}

  /** Trazado de la ruta por calles, pasando por sus paradas en orden. */
  routeLine(route: Route): Promise<RouteLine> {
    if (!hasGeo(route)) throw new DomainError('NO_GEO', `La ${route.name} no tiene coordenadas.`);
    const key = `${route.id}:${route.stops.map((s) => `${s.lat},${s.lng}`).join(';')}`;
    let hit = this.lines.get(key);
    if (!hit) {
      hit = this.routing.route(route.stops.map((s) => [s.lat!, s.lng!] as LatLng)).then((path) => ({
        path,
        ref: new RouteReferencer(route, new Polyline(path.points)),
      }));
      this.lines.set(key, hit);
    }
    return hit;
  }

  /** Camino desde donde está el conductor hasta una parada (navegación paso a paso). */
  pathTo(from: LatLng, route: Route, stopIndex: number): Promise<RoutePath> {
    const s = route.stops[Math.min(stopIndex, route.stops.length - 1)];
    return this.routing.route([from, [s.lat!, s.lng!]]);
  }

  /** Al terminar: camino de regreso a la estación inicial (primera parada de la ruta). */
  backToStation(from: LatLng, route: Route): Promise<RoutePath> {
    return this.pathTo(from, route, 0);
  }
}
