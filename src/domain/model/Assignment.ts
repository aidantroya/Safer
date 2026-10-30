/** Programación de Coordinación: qué conductor y qué unidad cubren una ruta un día de la semana. */
export interface RouteAssignment {
  routeId: string;
  /** 0 = lunes … 6 = domingo */
  weekday: number;
  driverId: string;
  busId: string;
}

export const weekdayOf = (ms: number): number => (new Date(ms).getDay() + 6) % 7;
