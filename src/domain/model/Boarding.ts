/**
 * qr_pase  : el conductor escanea el pase del pasajero (flujo anterior; la app ya no lo usa)
 * qr_unidad: el pasajero escanea el QR pegado en el bus (pantalla "Escanear")
 * manual   : el conductor suma +1 sin QR
 * llegada  : se cerró solo porque el bus llegó a la parada de bajada o terminó el viaje
 */
export type BoardingMethod = 'qr_pase' | 'qr_unidad' | 'manual';
export type AlightMethod = BoardingMethod | 'llegada' | 'fin_de_viaje';

export interface Boarding {
  id: string;
  tripId: string;
  /** null cuando es un pasajero manual (sin identidad). */
  passengerId: string | null;
  method: BoardingMethod;
  boardedAt: number;
  alightedAt?: number;
  alightMethod?: AlightMethod;
}

/** El aforo SIEMPRE se calcula contando abordajes abiertos, nunca con un contador suelto. */
export const isOpen = (b: Boarding): boolean => b.alightedAt === undefined;
