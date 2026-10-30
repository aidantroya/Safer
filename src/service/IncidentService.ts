import type { Incident, IncidentStatus, IncidentType } from '@/domain/model';
import type { IIncidentRepository } from '@/domain/repository';
import { DomainError } from './errors';

export const INCIDENT_TYPES: IncidentType[] = ['retraso', 'averia', 'conducta', 'accidente'];
export const MAX_DESCRIPTION = 300;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export interface CreateIncidentInput {
  reporterId: string;
  tripId?: string;
  type: IncidentType;
  description: string;
  photoDataUrl?: string;
  photoBytes?: number;
  locationLabel: string;
}

export class IncidentService {
  constructor(private incidents: IIncidentRepository, private now: () => number = () => Date.now()) {}

  async create(input: CreateIncidentInput): Promise<Incident> {
    if (!INCIDENT_TYPES.includes(input.type)) throw new DomainError('BAD_TYPE', 'Elige un tipo de incidencia.');
    const description = input.description.trim();
    if (description.length < 3) throw new DomainError('BAD_DESCRIPTION', 'Cuéntanos brevemente qué ocurrió.');
    if (description.length > MAX_DESCRIPTION) throw new DomainError('BAD_DESCRIPTION', `Máximo ${MAX_DESCRIPTION} caracteres.`);
    if ((input.photoBytes ?? 0) > MAX_PHOTO_BYTES) throw new DomainError('PHOTO_TOO_BIG', 'La foto supera 10 MB.');

    const incident: Incident = {
      id: `inc-${this.now()}`,
      folio: this.incidents.nextFolio(),
      reporterId: input.reporterId,
      tripId: input.tripId,
      type: input.type,
      description,
      photoDataUrl: input.photoDataUrl,
      locationLabel: input.locationLabel,
      status: 'abierta',
      createdAt: this.now(),
    };
    await this.incidents.save(incident);
    return incident;
  }

  listMine(reporterId: string): Promise<Incident[]> {
    return this.incidents.listByReporter(reporterId);
  }

  listAll(): Promise<Incident[]> {
    return this.incidents.listAll();
  }

  async setStatus(id: string, status: IncidentStatus): Promise<void> {
    await this.incidents.updateStatus(id, status);
  }
}
