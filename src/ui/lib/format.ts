export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase().replace(/\./g, '');
}

export function fmtDistance(m: number): string {
  if (m < 50) return 'en la parada';
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 10) * 10} m`;
}

/** Devuelve valor + unidad separados para el número grande del ETA. */
export function fmtEta(seconds: number): { value: string; unit: string } {
  if (seconds < 20) return { value: '¡Ya!', unit: '' };
  if (seconds < 90) return { value: '1', unit: 'min' };
  return { value: String(Math.round(seconds / 60)), unit: 'min' };
}

export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export const cn = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');
