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
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setPhoto({ url: dataUrl, bytes: Math.round((dataUrl.length * 3) / 4) });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!user || !type) return;
    setBusy(true);
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
    <div className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col relative pb-32 transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md px-margin py-3 flex items-center justify-between shadow-xs border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Volver" onClick={() => navigate(back)} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface active:scale-[0.985] hover:bg-surface-container border border-outline-variant/30">
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <div>
            <h1 className="text-headline-sm text-on-surface font-bold leading-tight">Reportar Incidencia</h1>
            <p className="text-label-sm text-on-surface-variant">SAFER Transit • Central de Control</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-secondary-container/40 flex items-center justify-center text-on-secondary-container"><Icon name="shield" fill className="text-[20px]" /></div>
      </header>

      <main className="px-margin pt-4 flex-1 flex flex-col gap-4">
        <p className="px-1 text-body-md text-on-surface-variant">Ayúdanos a mantener el servicio seguro, puntual y de calidad para toda la comunidad universitaria.</p>

        <form className="bg-surface-card rounded-3xl p-5 shadow-level-1 flex flex-col gap-5 border border-outline-variant/30" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span id="lbl-type" className="text-label-lg text-on-surface font-bold">Tipo de incidencia</span>
              <span className="text-label-sm text-on-surface-variant">Obligatorio</span>
            </div>
            <div role="radiogroup" aria-labelledby="lbl-type" className="grid grid-cols-2 gap-2.5">
              {TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => { haptic.light(); setType(t.id); }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl transition-all duration-150 active:scale-[0.985] ${on ? 'bg-primary text-white shadow-sm font-bold border border-transparent' : 'bg-surface-container-low text-on-surface border border-outline-variant/40 hover:bg-surface-container font-medium'}`}>
                    <Icon name={t.icon} fill={on} className={`text-[22px] ${on ? 'text-white' : 'text-on-surface-variant'}`} />
                    <span className="text-label-lg">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="inc-desc" className="text-label-lg text-on-surface font-bold">Descripción del suceso</label>
              <span className="text-label-sm text-on-surface-variant tabular">{text.length}/{MAX_DESCRIPTION}</span>
            </div>
            <textarea
              id="inc-desc" rows={4} maxLength={MAX_DESCRIPTION} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Describe con claridad lo ocurrido (mínimo 3 caracteres)…"
              className="w-full p-3.5 rounded-2xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md focus:bg-surface-card focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-lg text-on-surface font-bold">Evidencia fotográfica (opcional)</span>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {photo ? (
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/40">
                <img src={photo.url} alt="Evidencia subida" className="w-full h-44 object-cover" />
                <button type="button" aria-label="Quitar foto" onClick={() => setPhoto(undefined)} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900">
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="h-28 rounded-2xl border-2 border-dashed border-outline-variant/60 flex flex-col items-center justify-center gap-1.5 text-on-surface-variant hover:bg-surface-container-low active:scale-[0.99] transition-all">
                <Icon name="add_a_photo" className="text-[26px] text-primary" />
                <span className="text-label-sm font-semibold">Tomar foto o subir desde la galería</span>
              </button>
            )}
          </div>

          <div className="p-3 bg-surface-container-low rounded-2xl flex items-center gap-2.5 border border-outline-variant/30 text-on-surface">
            <Icon name="fmd_good" className="text-secondary text-[20px]" />
            <span className="text-body-sm text-on-surface-variant font-medium">Ubicación asignada: <span className="font-bold text-on-surface">{loc.label}</span></span>
          </div>

          <button type="submit" disabled={!ready} className="w-full h-12 rounded-full bg-primary text-white font-bold text-label-lg shadow-sm active:scale-[0.985] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            <Icon name="send" className="text-[20px]" />
            <span>{busy ? 'Enviando…' : 'Enviar reporte a central'}</span>
          </button>
        </form>
      </main>

      {/* Modal de confirmación con número de folio */}
      {folio && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-surface-card rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/40 text-center flex flex-col items-center gap-3 animate-slideup">
            <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-sm">
              <Icon name="check_circle" fill className="text-[36px]" />
            </div>
            <h2 className="text-headline-sm font-bold text-on-surface">Reporte registrado</h2>
            <p className="text-body-sm text-on-surface-variant">Tu incidencia fue enviada directamente a la Central Operativa de Despacho.</p>
            <div className="w-full p-3 bg-surface-container-low rounded-2xl border border-outline-variant/40 my-1">
              <span className="text-label-sm text-on-surface-variant block">Número de folio</span>
              <span className="text-headline-sm font-bold text-primary font-mono tracking-wider">{folio}</span>
            </div>
            <button type="button" onClick={() => navigate(back)} className="w-full h-12 rounded-full bg-primary text-white font-bold text-label-lg shadow-sm active:scale-[0.985]">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
