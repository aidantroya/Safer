export interface Bus {
  id: string;
  number: number; // "Bus #12"
  plate: string;
  capacity: number;
  online: boolean;
  /** Código que va impreso en el QR de la unidad (flujo "el pasajero escanea el bus"). */
  unitCode: string;
}
