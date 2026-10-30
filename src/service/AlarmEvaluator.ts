import type { LeadTime } from '@/domain/model';

export interface Proximity {
  seconds: number;
  distanceM: number;
  /** Cuántas paradas faltan ANTES de la parada objetivo (0 = la próxima parada es la objetivo). */
  stopsBefore: number;
}

/** ¿Ya se cumplió la anticipación elegida por el usuario? */
export function isLeadReached(lead: LeadTime, p: Proximity): boolean {
  switch (lead.kind) {
    case 'minutes':
      return p.seconds <= lead.value * 60;
    case 'meters':
      return p.distanceM <= lead.value;
    case 'stops':
      // "1 parada antes" = cuando el bus ya llegó a la parada anterior a la tuya
      return p.stopsBefore <= lead.value - 1;
  }
}

export function leadLabel(lead: LeadTime): string {
  if (lead.kind === 'minutes') return `${lead.value} min antes`;
  if (lead.kind === 'meters') return `A ${lead.value} metros`;
  return lead.value === 1 ? '1 parada antes' : `${lead.value} paradas antes`;
}
