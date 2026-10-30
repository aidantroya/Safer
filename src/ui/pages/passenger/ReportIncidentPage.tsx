import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { IncidentType } from '@/domain/model';
import { MAX_DESCRIPTION } from '@/service/IncidentService';
import { Icon } from '../../components/Icon';
import { haptic } from '../../lib/haptics';
import { useToasts } from '../../components/Toasts';
import { useSession } from '../../session/SessionContext';

const TYPES: { id: IncidentType; label: string; icon: string }[] = [
  { id: 'retraso', label: 'Retraso', icon: 'schedule' },
  { id: 'averia', label: 'Avería', icon: 'engineering' },
  { id: 'conducta', label: 'Conducta', icon: 'warning' },
  { id: 'accidente', label: 'Accidente', icon: 'car_crash' },
];

interface Props {
  /** 'driver' reutiliza la misma pantalla desde el panel del conductor. */
  role?: 'passenger' | 'driver';
  driverTripId?: string;
}

/** Pantalla "Reportar Incidencia" (pasajero) — también la usa el conductor. */
export function ReportIncidentPage({ role = 'passenger', driverTripId }: Props) {
  const { user } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [type, setType] = useState<IncidentType>();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ url: string; bytes: number }>();
  const [loc, setLoc] = useState<{ label: string; tripId?: string }>({ label: '…' });
  const [busy, setBusy] = useState(false);
  const [folio, setFolio] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const back = role === 'driver' ? '/conductor/panel' : '/pasajero/alertas';

  useEffect(() => {
    if (!user) return;
    if (role === 'driver') return setLoc({ label: 'Unidad en ruta', tripId: driverTripId });
    void app.passenger.getLocationLabel(user.id).then((r) => r.ok && setLoc(r.data));
  }, [user, role, driverTripId]);

  const onFile = (f?: File) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast('Foto muy grande', 'El máximo es 10 MB.', 'warn');
    const reader = new FileReader();
    reader.onload = () => {
      // se reduce a ~800 px para no llenar la memoria del navegador
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        setPhoto({ url: c.toDataURL('image/jpeg', 0.75), bytes: f.size });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!user || !type) return;
    setBusy(true);
    haptic.medium();
    const res = role === 'driver'
      ? await app.driver.reportIncident({ driverId: user.id, tripId: driverTripId, type, description: text, photoDataUrl: photo?.url, photoBytes: photo?.bytes, locationLabel: loc.label })
      : await app.passenger.reportIncident({ userId: user.id, type, description: text, photoDataUrl: photo?.url, photoBytes: photo?.bytes });
    setBusy(false);
    if (!res.ok) return toast('No se pudo enviar', res.error, 'warn');
    haptic.success();
    setFolio(res.data.folio);
  };

  const ready = !!type && text.trim().length >= 3 && !busy;

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col relative pb-32">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md px-margin py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Volver" onClick={() => navigate(back)} className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-low text-text-main active:scale-[0.985] hover:bg-surface-container">
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <div>
            <h1 className="text-headline-sm text-text-main leading-tight">Reportar Incidencia</h1>
            <p className="text-label-sm text-text-muted">BusTrack • Campus Transit</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-secondary-container/30 flex items-center justify-center text-on-secondary-container"><Icon name="shield" fill className="text-[20px]" /></div>
      </header>

      <main className="px-margin pt-4 flex-1 flex flex-col gap-4">
        <p className="px-1 text-body-md text-text-muted">Ayúdanos a mantener el servicio seguro, puntual y de calidad para toda la comunidad universitaria.</p>

        <form className="bg-surface-card rounded-3xl p-5 shadow-soft flex flex-col gap-5 border border-white" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span id="lbl-type" className="text-label-lg text-text-main">Tipo de incidencia</span>
              <span className="text-label-sm text-text-muted">Obligatorio</span>
            </div>
            <div role="radiogroup" aria-labelledby="lbl-type" className="grid grid-cols-2 gap-2.5">
              {TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => { haptic.light(); setType(t.id); }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl transition-all duration-150 active:scale-[0.985] ${on ? 'bg-primary-container text-on-primary shadow-md border border-transparent' : 'bg-surface-container-low text-text-main border border-outline-variant/40 hover:bg-surface-container'}`}>
                    <Icon name={t.icon} fill={on} className={`text-[22px] ${on ? '' : 'text-text-muted'}`} />
                    <span className="text-label-lg">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <hr className="border-t border-surface-container" />

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="desc" className="text-label-lg text-text-main">¿Qué ocurrió?</label>
              <span className="text-label-sm text-text-muted tabular">{text.length}/{MAX_DESCRIPTION}</span>
            </div>
            <textarea id="desc" rows={4} maxLength={MAX_DESCRIPTION} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Describe lo sucedido de forma breve y precisa (ej. bus detenido por fallo en parada tecnológica)..."
              className="w-full bg-[#F9FAFB] rounded-2xl p-3.5 text-body-md text-text-main placeholder:text-text-muted/60 border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all resize-none" />
          </div>
          <hr className="border-t border-surface-container" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-label-lg text-text-main">
              <span>Evidencia fotográfica</span><span className="text-label-sm text-text-muted font-normal">(Opcional)</span>
            </div>
            <input ref={fileRef} type="file" accept="image/png, image/jpeg" capture="environment" className="sr-only" aria-label="Adjuntar archivo fotográfico" onChange={(e) => onFile(e.target.files?.[0])} />
            {photo ? (
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/40">
                <img src={photo.url} alt="Foto adjunta" className="w-full h-40 object-cover" />
                <button type="button" aria-label="Quitar foto" onClick={() => { setPhoto(undefined); if (fileRef.current) fileRef.current.value = ''; }} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"><Icon name="close" className="text-[18px]" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-primary-fixed-dim/80 hover:border-primary-container bg-primary-fixed/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-primary-container shadow-sm"><Icon name="photo_camera" className="text-[26px]" /></div>
                <div>
                  <p className="text-label-lg text-primary font-semibold">Tocar para añadir foto</p>
                  <p className="text-label-sm text-text-muted mt-0.5">JPG o PNG hasta 10MB</p>
                </div>
              </button>
            )}
          </div>
          <hr className="border-t border-surface-container" />

          <div className="bg-[#F8FAFC] rounded-2xl p-3.5 border border-surface-container flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-container/40 text-on-secondary-container flex items-center justify-center shrink-0 mt-0.5"><Icon name="location_on" fill className="text-[20px]" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-label-sm font-semibold text-text-main">Ubicación del reporte</span>
                <span className="w-2 h-2 rounded-full bg-secondary inline-block animate-pulse" />
              </div>
              <p className="text-label-sm text-text-muted mt-0.5 leading-snug">Se adjuntará automáticamente: <strong className="text-text-main font-semibold">{loc.label}</strong></p>
            </div>
          </div>
        </form>

        <div className="pt-2 flex flex-col gap-2.5">
          <button type="button" disabled={!ready} onClick={submit} className="w-full py-4 px-6 rounded-full bg-primary-container hover:bg-primary text-on-primary text-label-lg shadow-[0_12px_24px_-6px_rgba(37,99,235,0.35)] flex items-center justify-center gap-2 transition-transform active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
            {busy ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                <span>Procesando...</span>
              </>
            ) : (<><Icon name="send" className="text-[20px]" /><span className="tracking-wide">Enviar Reporte</span></>)}
          </button>
          <p className="text-center text-label-sm text-text-muted px-4">Los reportes son gestionados por la central operativa de transporte.</p>
        </div>
      </main>

      {folio && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-5">
          <div role="dialog" aria-modal="true" className="animate-slideup bg-surface-card rounded-3xl p-6 max-w-sm w-full shadow-soft flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center"><Icon name="check_circle" fill className="text-[36px]" /></div>
            <h2 className="text-headline-sm text-text-main">¡Reporte enviado!</h2>
            <p className="text-body-md text-text-muted">Tu incidencia fue canalizada a la central de control. Folio asignado: <strong className="text-primary">{folio}</strong>.</p>
            <button type="button" onClick={() => navigate(back)} className="mt-2 w-full py-3 px-6 rounded-full bg-primary-container text-on-primary text-label-lg active:scale-[0.985]">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}
