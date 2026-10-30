export type UserRole = 'passenger' | 'driver' | 'admin';

/** Lo que el pasajero eligió seguir: ruta, dónde sube y dónde baja. */
export interface PassengerPlan {
  routeId: string;
  boardStopId: string;
  dropStopId: string;
  /** Distancia caminando desde el pasajero hasta su parada (para la etiqueta "(150m)"). */
  walkToStopM: number;
  /** Zona donde está el pasajero, se adjunta a los reportes. */
  areaLabel: string;
}

export interface FavoriteShortcut {
  label: string;
  icon: string;
  /** Si apunta a una parada de la ruta, tocarlo cambia la parada de subida. */
  stopId?: string;
}

export interface User {
  id: string;
  name: string; // nombre corto: "Diego"
  fullName: string;
  email: string;
  role: UserRole;
  studentId?: string;
  program?: string;
  institution?: string;
  plan?: PassengerPlan;
  favorites?: FavoriteShortcut[];
}
