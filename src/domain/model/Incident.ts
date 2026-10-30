export type IncidentType = 'retraso' | 'averia' | 'conducta' | 'accidente';
export type IncidentStatus = 'abierta' | 'en_proceso' | 'resuelta';

export interface Incident {
  id: string;
  folio: string; // "#TR-8842"
  reporterId: string;
  tripId?: string;
  type: IncidentType;
  description: string;
  photoDataUrl?: string;
  locationLabel: string;
  status: IncidentStatus;
  createdAt: number;
}
