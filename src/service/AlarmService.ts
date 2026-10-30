import type { AlarmPreference } from '@/domain/model';
import type { IAlarmPreferenceRepository } from '@/domain/repository';
import { DomainError } from './errors';

export function defaultPreference(userId: string): AlarmPreference {
  return {
    userId,
    arrivalEnabled: true,
    arrivalLead: { kind: 'minutes', value: 5 },
    wakeUpEnabled: true,
    wakeUpLead: { kind: 'minutes', value: 3 },
  };
}

export class AlarmService {
  constructor(private prefs: IAlarmPreferenceRepository) {}

  async get(userId: string): Promise<AlarmPreference> {
    return (await this.prefs.get(userId)) ?? defaultPreference(userId);
  }

  async save(pref: AlarmPreference): Promise<AlarmPreference> {
    const okArrival = pref.arrivalLead.kind !== 'stops';
    if (!okArrival) throw new DomainError('BAD_LEAD', 'El aviso de llegada se mide en minutos o metros.');
    if (pref.arrivalLead.value <= 0 || pref.wakeUpLead.value <= 0) throw new DomainError('BAD_LEAD', 'La anticipación debe ser mayor a 0.');
    await this.prefs.save(pref);
    return pref;
  }
}
