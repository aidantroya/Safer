import type { LatLng } from '../geo';

/** Una indicación de navegación ("Gira a la derecha en Av. Principal"). */
export interface NavStep {
  instruction: string;
  distanceM: number;
  location: LatLng;
}

/** Camino calculado sobre calles reales. */
export interface RoutePath {
  points: LatLng[];
  distanceM: number;
  durationS: number;
  steps: NavStep[];
  /** false si no hubo servicio de rutas y es una línea recta entre los puntos. */
  onRoads: boolean;
}

/** Última posición GPS que compartió el conductor. */
export interface GpsFix {
  lat: number;
  lng: number;
  at: number;
  accuracyM?: number;
  /** Cuántos metros está fuera del trazado de la ruta. */
  offRouteM?: number;
}
