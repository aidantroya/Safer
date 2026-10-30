import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { app } from '@/api';
import type { PassToken } from '@/service/BoardingService';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { fmtClock, initials } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { usePolling } from '../../lib/usePolling';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { usePassenger } from './PassengerContext';

/** Pantalla "Pase de Abordaje QR": el QR contiene un token dinámico de 60 s que escanea el conductor. */
export function BoardingPassPage() {
  const { snap, refresh } = usePassenger();
  const { user } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [pass, setPass] = useState<PassToken>();
  const [svg, setSvg] = useState('');
  const [now, setNow] = useState(Date.now());
  const [success, setSuccess] = useState<'boarded' | 'alighted'>();

  const issue = useCallback(async () => {
    if (!user) return;
    const res = await app.passenger.issuePass(user.id);
    if (!res.ok) return toast('No se pudo generar el pase', res.error, 'warn');
    setPass(res.data);
    setSvg(await QRCode.toString(res.data.token, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }));
  }, [user, toast]);

  useEffect(() => { void issue(); }, [issue]);
  usePolling(() => setNow(Date.now()), 1000);

  const secondsLeft = pass ? Math.max(0, Math.ceil((pass.expiresAt - now) / 1000)) : 0;
  useEffect(() => { if (pass && secondsLeft === 0) void issue(); }, [pass, secondsLeft, issue]);

  if (!snap || !user) return null;
  const onboard = snap.state === 'a_bordo';
  const trip = snap.trip;

  const simulate = async () => {
    if (!trip || !pass) return toast('Sin viaje', 'No hay un bus en curso para escanear.', 'warn');
    const res = await app.driver.scanPassenger(trip.id, pass.token);
    if (!res.ok) return toast('Escaneo rechazado', res.error, 'warn');
    haptic.success();
    setSuccess(res.data.action);
    void refresh();
    void issue();
    setTimeout(() => { setSuccess(undefined); navigate('/pasajero'); }, 1500);
  };

  return (
    <div className="relative flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md flex items-center justify-between px-margin h-14 border-b border-outline-variant/30 shadow-xs">
        <div className="flex items-center gap-2">
          <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
          <div>
            <h1 className="text-headline-sm text-primary font-bold tracking-tight leading-none">Pase de Abordaje</h1>
            <p className="text-[11px] text-on-surface-variant font-medium">Campus Transit ID</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="h-8 px-2.5 flex items-center gap-1 rounded-full bg-secondary-container text-on-secondary-container border border-secondary/30" title="Sube el brillo de tu pantalla para escanear más rápido">
            <Icon name="brightness_high" className="text-[16px]" />
            <span className="text-label-sm font-semibold">Brillo máx.</span>
          </span>
        </div>
      </header>

      <main className="px-margin pt-4 flex flex-col gap-space-md">
        <div className="relative bg-surface-card rounded-3xl shadow-level-2 border border-outline-variant/30 overflow-hidden">
          <div className="bg-primary text-on-primary px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary" />
              </span>
              <span className="text-label-sm uppercase tracking-wider font-bold">{onboard ? 'A bordo • Válido hoy' : 'Ticket activo • Válido hoy'}</span>
            </div>
            <span className="text-label-sm tabular opacity-90 font-medium">{new Date(now).toLocaleTimeString('es', { hour12: false })}</span>
          </div>

          <div className="p-6 pb-5 flex flex-col items-center">
            {/* El QR va siempre sobre blanco: los lectores necesitan alto contraste, también en tema oscuro. */}
            <div className="relative p-3.5 bg-white rounded-2xl border-2 border-secondary/40 shadow-inner">
              <div className="absolute inset-x-3.5 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-laser pointer-events-none z-10" />
              {svg ? (
                <div role="img" aria-label="Código QR de tu pase" className="w-52 h-52 sm:w-56 sm:h-56 text-slate-950 [&>svg]:w-full [&>svg]:h-full [&_path]:fill-current" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : <div className="w-52 h-52 sm:w-56 sm:h-56 bg-slate-100 rounded-xl animate-pulse" />}
            </div>
            <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container border border-secondary/30">
              <Icon name="sync" className="text-[16px]" />
              <span className="text-label-sm">Token dinámico expira en: <span className="font-bold tabular">{secondsLeft}s</span></span>
            </div>
          </div>

          <div className="relative flex items-center justify-between my-1">
            <div className="ticket-cutout-left -top-3" />
            <div className="w-full border-t-2 border-dashed border-outline-variant/60 mx-5" />
            <div className="ticket-cutout-right -top-3" />
          </div>

          <div className="p-6 pt-4">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-outline-variant/30">
              <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-sm shadow-sm ring-2 ring-primary/20 shrink-0">{initials(user.fullName)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-title-md text-on-surface font-bold truncate">{user.fullName}</span>
                  <Icon name="verified" fill className="text-primary text-[18px]" />
                </div>
                <p className="text-body-sm text-on-surface-variant">Estudiante Regular • <span className="font-semibold text-on-surface">{user.program}</span></p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm border border-secondary/30 font-semibold">Activo</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-surface-container-low rounded-[12px] p-3 border border-outline-variant/30">
                <span className="text-label-sm text-on-surface-variant block uppercase font-medium">ID Estudiante</span>
                <span className="text-title-md text-on-surface font-bold tracking-tight">{user.studentId}</span>
              </div>
              <div className="bg-surface-container-low rounded-[12px] p-3 border border-outline-variant/30">
                <span className="text-label-sm text-on-surface-variant block uppercase font-medium">Aforo del bus</span>
                <span className="text-title-md text-primary font-bold tracking-tight tabular">
                  {snap.occupancy ? `${snap.occupancy.occupied}/${snap.occupancy.capacity}` : '—'}
                </span>
                {snap.target && <span className="text-label-sm text-on-surface-variant block mt-0.5">Llega {fmtClock(snap.target.arrivalAtMs)}</span>}
              </div>
              <div className="col-span-2 bg-surface-container-low rounded-[12px] p-3 border border-outline-variant/30 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-label-sm text-on-surface-variant block uppercase font-medium">Ruta asignada</span>
                  <span className="text-title-md text-on-surface font-bold">Ruta ESPOL - {snap.route.shortName}</span>
                  <span className="text-label-sm text-on-surface-variant block mt-0.5">Sube: {snap.boardStop.name} • Baja: {snap.dropStop.name}</span>
                </div>
                <div className="w-10 h-10 rounded-[12px] bg-primary text-on-primary flex items-center justify-center shrink-0 ml-2 shadow-sm"><Icon name="directions_bus" className="text-[22px]" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-card border border-outline-variant/30 shadow-level-1">
          <div className="w-9 h-9 rounded-[12px] bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0"><Icon name="document_scanner" className="text-[20px]" /></div>
          <p className="text-body-sm text-on-surface leading-snug">Muestra este código al conductor al subir y bajar de la unidad para registrar tu aforo.</p>
        </div>

        <div className="bg-surface-card rounded-2xl p-3.5 border border-outline-variant/30 shadow-level-1">
          <div className="flex items-start gap-2.5">
            <Icon name="vibration" className="text-secondary text-[20px] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-sm uppercase tracking-wide text-on-surface font-bold">Modo demostración</span>
                <button type="button" onClick={simulate} className="px-2.5 py-1.5 rounded-lg bg-secondary text-surface-card hover:opacity-90 text-label-sm font-bold active:scale-95 flex items-center gap-1 shadow-sm shrink-0">
                  <Icon name="play_arrow" className="text-[15px]" />
                  {onboard ? 'Simular escaneo (−1)' : 'Simular escaneo (+1)'}
                </button>
              </div>
              <p className="text-label-sm text-on-surface-variant mt-1 leading-normal">
                Hace lo mismo que el conductor al escanear tu QR: suma o resta 1 al aforo, vibra y vuelve al mapa en 1,5 s.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => { haptic.medium(); void issue(); }} className="flex-1 py-3 px-4 rounded-[12px] bg-surface-card hover:bg-surface-container-low active:scale-[0.985] text-on-surface border border-outline-variant/40 text-label-md flex items-center justify-center gap-2 shadow-xs">
            <Icon name="refresh" className="text-[18px] text-on-surface-variant" />
            <span className="font-semibold">Regenerar token</span>
          </button>
          <div className="px-4 py-3 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-label-md flex items-center gap-1.5 shrink-0" title="El token necesita internet para validarse en el servidor">
            <Icon name="wifi" className="text-[18px]" />
            <span className="font-semibold">Requiere internet</span>
          </div>
        </div>
      </main>

      {success && (
        <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-3xl p-8 max-w-xs mx-auto text-center shadow-2xl border border-outline-variant/30 animate-slideup">
            <div className="w-20 h-20 mx-auto rounded-full bg-secondary-container flex items-center justify-center mb-4 animate-bounce"><Icon name="check_circle" fill className="text-[48px] text-secondary" /></div>
            <h3 className="text-headline-md text-on-surface mb-1 font-bold">{success === 'boarded' ? '¡Abordaje confirmado!' : '¡Bajada registrada!'}</h3>
            <p className="text-body-md text-on-surface-variant">{success === 'boarded' ? 'Subida registrada con éxito.' : 'Gracias por viajar con nosotros.'}</p>
            <div className="mt-4 px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container border border-secondary/30 text-label-sm inline-flex items-center gap-1.5">
              <Icon name="vibration" className="text-[16px]" /> <span className="font-medium">Aforo actualizado</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
