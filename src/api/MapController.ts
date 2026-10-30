import type { LatLng } from '@/domain/geo';
import type { RoutePath } from '@/domain/model';
import type { IRouteRepository } from '@/domain/repository';
import { DomainError } from '@/service/errors';
import type { NavigationService } from '@/service/NavigationService';
import { run, type ApiResult } from './ApiResult';

/** Lo que necesita el mapa real: el trazado de cada ruta y los caminos de navegación. */
export class MapController {
  constructor(private navigation: NavigationService, private routes: IRouteRepository) {}

  /** Trazado por calles de la ruta (pasa por todas sus paradas). */
  getRoutePath(routeId: string): Promise<ApiResult<RoutePath>> {
    return run(async () => (await this.navigation.routeLine(await this.requireRoute(routeId))).path);
  }
  /** Navegación del conductor: desde su posición hasta la parada indicada. */
  getPathToStop(from: LatLng, routeId: string, stopIndex: number): Promise<ApiResult<RoutePath>> {
    return run(async () => this.navigation.pathTo(from, await this.requireRoute(routeId), stopIndex));
  }
  /** Al finalizar: camino de regreso a la estación inicial de la ruta. */
  getPathBackToStation(from: LatLng, routeId: string): Promise<ApiResult<RoutePath>> {
    return run(async () => this.navigation.backToStation(from, await this.requireRoute(routeId)));
  }

  private async requireRoute(routeId: string) {
    const route = await this.routes.findById(routeId);
    if (!route) throw new DomainError('ROUTE_NOT_FOUND', 'La ruta no existe.');
    return route;
  }
}
