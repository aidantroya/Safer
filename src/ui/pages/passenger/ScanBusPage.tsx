import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { haversineM } from '@/domain/geo';
import { Icon } from '../../components/Icon';
import { QrScanner } from '../../components/QrScanner';
import { useToasts } from '../../components/Toasts';
import { fmtClock } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { usePassenger } from './PassengerContext';

/** Ubicación del estudiante en el momento de escanear (para validar que esté junto al bus). Nunca bloquea: 5 s máximo. */
function currentPosition(): Promise<[number, number] | undefined> {
  if (!('geolocation' in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10_000 },
    ),
  );
}

/**
 * Pantalla "Escanear QR del bus": el estudiante escanea el QR pegado en la puerta de la unidad al subir,
 * y lo vuelve a escanear al bajar. Cada escaneo suma o resta 1 al aforo.
 */
export function ScanBusPage() {
  const { snap, refresh } = usePassenger();
  const { user } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState<{ action: 'boarded' | 'alighted'; busNumber?: number; occupied: number; capacity: number }>();

  if (!snap || !user) return null;
  const onboard = snap.state === 'a_bordo';

  const scan = async (unitCode: string, demoMode = false) => {
    if (busy) return;
    setBusy(true);
    // Si el bus comparte GPS, se comprueba que el estudiante esté junto a él (evita marcar desde lejos).
    let distanceToBusM: number | undefined;
    if (!demoMode && snap.trip?.gps) {
      const me = await currentPosition();
      if (me) distanceToBusM = haversineM(me, [snap.trip.gps.lat, snap.trip.gps.lng]);
    }
    const res = await app.passenger.scanUnitQr(user.id, unitCode.trim(), { distanceToBusM, demoMode });
    setBusy(false);
    if (!res.ok) {
      haptic.light();
      return toast('No se pudo registrar', res.error, 'warn');
    }
    haptic.success();
    setSuccess({ action: res.data.action, busNumber: snap.bus?.number, occupied: res.data.occupancy.occupied, capacity: res.data.occupancy.capacity });
    setCode('');
    void refresh();
    setTimeout(() => {
      setSuccess(undefined);
      navigate('/pasajero');
    }, 1800);
  };

  return (
    <div className="relative flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md flex items-center justify-between px-margin h-14 border-b border-outline-variant/30 shadow-xs">
        <div className="flex items-center gap-2">
          <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
          <div>
            <h1 className="text-headline-sm text-primary font-bold tracking-tight leading-none">{onboard ? 'Bajar del bus' : 'Subir al bus'}</h1>
            <p className="text-[11px] text-on-surface-variant font-medium">Escanea el QR pegado en la puerta</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-margin pt-4 flex flex-col gap-space-md">
        <div className={`rounded-2xl p-3.5 border flex items-center gap-3 ${onboard ? 'bg-secondary-container text-on-secondary-container border-secondary/30' : 'bg-surface-card text-on-surface border-outline-variant/30 shadow-level-1'}`}>
          <div className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 ${onboard ? 'bg-secondary text-surface-card' : 'bg-primary text-on-primary'}`}>
            <Icon name={onboard ? 'airline_seat_recline_normal' : 'directions_bus'} className="text-[24px]" />
          </div>
          <div className="min-w-0">
            {onboard ? (
              <>
                <p className="text-label-lg font-bold">A bordo del Bus #{snap.bus?.number}</p>
                <p className="text-label-sm opacity-90">Al bajar en {snap.dropStop.name}, escanea otra vez el QR del bus.</p>
              </>
            ) : (
              <>
                <p className="text-label-lg font-bold">{snap.bus ? `Tu bus: #${snap.bus.number}` : 'Sin bus en ruta'} • {snap.route.shortName}</p>
                <p className="text-label-sm text-on-surface-variant">
                  Subes en {snap.boardStop.name}
                  {snap.target && snap.state === 'esperando' ? ` • llega ${fmtClock(snap.target.arrivalAtMs)}` : ''}
                </p>
              </>
            )}
          </div>
        </div>

        <section aria-label="Escáner de QR" className="bg-surface-card rounded-3xl p-5 shadow-level-2 border border-outline-variant/30 flex flex-col gap-3">
          <QrScanner onResult={(text) => void scan(text)} paused={!!success} />
          <p className="text-center text-body-sm text-on-surface-variant">
            Apunta la cámara al QR de la unidad. {onboard ? 'Así registras que bajaste.' : 'Así registras que subiste y se actualiza el aforo.'}
          </p>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) void scan(code);
            }}
          >
            <label htmlFor="unit-code" className="sr-only">Código de la unidad</label>
            <input
              id="unit-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="¿Sin cámara? Código del bus"
              autoCapitalize="characters"
              className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface px-3 text-body-md focus:bg-surface-card focus:border-primary outline-none"
            />
            <button type="submit" disabled={busy || !code.trim()} className="min-h-[44px] px-4 rounded-xl bg-primary text-on-primary text-label-lg font-bold disabled:opacity-50">
              Validar
            </button>
          </form>
        </section>

        {snap.bus && (
          <div className="bg-surface-card rounded-2xl p-3.5 border border-outline-variant/30 shadow-level-1">
            <div className="flex items-start gap-2.5">
              <Icon name="vibration" className="text-secondary text-[20px] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-sm uppercase tracking-wide text-on-surface font-bold">Modo demostración</span>
                  <button
                    type="button"
                    onClick={() => void scan(snap.bus!.unitCode, true)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-secondary text-surface-card hover:opacity-90 text-label-sm font-bold active:scale-95 flex items-center gap-1 shadow-sm shrink-0 disabled:opacity-50"
                  >
                    <Icon name="qr_code_scanner" className="text-[15px]" />
                    {onboard ? 'Simular bajada' : `Simular QR del Bus #${snap.bus.number}`}
                  </button>
                </div>
                <p className="text-label-sm text-on-surface-variant mt-1 leading-normal">
                  Hace lo mismo que escanear el QR pegado en el bus, sin usar la cámara.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {success && (
        <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="status" className="bg-surface-card rounded-3xl p-8 max-w-xs mx-auto text-center shadow-2xl border border-outline-variant/30 animate-slideup">
            <div className="w-20 h-20 mx-auto rounded-full bg-secondary-container flex items-center justify-center mb-4 animate-bounce">
              <Icon name="check_circle" fill className="text-[48px] text-secondary" />
            </div>
            <h3 className="text-headline-md text-on-surface mb-1 font-bold">{success.action === 'boarded' ? '¡Subida registrada!' : '¡Bajada registrada!'}</h3>
            <p className="text-body-md text-on-surface-variant">
              {success.action === 'boarded' ? `Bienvenido al Bus #${success.busNumber ?? ''}.` : 'Gracias por viajar con nosotros.'}
            </p>
            <div className="mt-4 px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container border border-secondary/30 text-label-sm inline-flex items-center gap-1.5">
              <Icon name="groups" className="text-[16px]" /> <span className="font-medium">Aforo: {success.occupied}/{success.capacity}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
