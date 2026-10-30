import { useEffect, useState } from 'react';

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  at: number;
}

export type GeoStatus = 'off' | 'pidiendo' | 'activa' | 'denegada' | 'no_disponible';

/**
 * Sigue la ubicación del dispositivo mientras `enabled` sea true. Al apagarlo deja de escuchar el GPS.
 * Ojo: el navegador sólo da la ubicación en https o en localhost.
 */
export function useGeolocation(enabled: boolean): { fix?: GeoFix; status: GeoStatus; error?: string } {
  const [fix, setFix] = useState<GeoFix>();
  const [status, setStatus] = useState<GeoStatus>('off');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    if (!('geolocation' in navigator)) {
      setStatus('no_disponible');
      setError('Este dispositivo no tiene GPS disponible en el navegador.');
      return;
    }
    setStatus('pidiendo');
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setStatus('activa');
        setError(undefined);
        setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy, speedMps: p.coords.speed, at: p.timestamp });
      },
      (e) => {
        setStatus(e.code === e.PERMISSION_DENIED ? 'denegada' : 'no_disponible');
        setError(e.code === e.PERMISSION_DENIED ? 'Permiso de ubicación denegado.' : 'No se pudo obtener la ubicación.');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix: enabled ? fix : undefined, status, error };
}
