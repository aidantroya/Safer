export type LeadTime =
  | { kind: 'minutes'; value: number }
  | { kind: 'meters'; value: number }
  | { kind: 'stops'; value: number };

export interface AlarmPreference {
  userId: string;
  /** Aviso cuando el bus se acerca a la parada donde SUBES. */
  arrivalEnabled: boolean;
  arrivalLead: LeadTime;
  /** Alarma "No te duermas" antes de la parada donde BAJAS. */
  wakeUpEnabled: boolean;
  wakeUpLead: LeadTime;
}
