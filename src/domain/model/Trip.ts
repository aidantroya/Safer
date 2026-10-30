export type TripStatus = 'en_curso' | 'finalizado';

/** Un viaje = un bus recorriendo una ruta con un conductor. Es la entidad central. */
export interface Trip {
  id: string;
  routeId: string;
  busId: string;
  driverId: string;
  status: TripStatus;
  startedAt: number;
  endedAt?: number;
  positionM: number;
  speedMps: number;
  /** Promedio móvil de la velocidad en marcha (sin contar paradas). */
  avgSpeedMps: number;
  dwellRemainingS: number;
  nextStopIndex: number;
}
