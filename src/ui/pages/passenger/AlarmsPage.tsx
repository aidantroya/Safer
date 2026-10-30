import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { AlarmPreference, LeadTime } from '@/domain/model';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { unlockAudio } from '../../lib/sound';
import { useSession } from '../../session/SessionContext';

const ARRIVAL_OPTIONS: { label: string; lead: LeadTime }[] = [
  { label: '5 min antes', lead: { kind: 'minutes', value: 5 } },
  { label: '10 min antes', lead: { kind: 'minutes', value: 10 } },
  { label: 'A 500 metros', lead: { kind: 'meters', value: 500 } },
];
const WAKE_OPTIONS: { label: string; icon: string; lead: LeadTime }[] = [
  { label: '3 min antes', icon: 'schedule', lead: { kind: 'minutes', value: 3 } },
  { label: '1 parada antes', icon: 'fmd_good', lead: { kind: 'stops', value: 1 } },
];
const same = (a: LeadTime, b: LeadTime) => a.kind === b.kind && a.value === b.value;

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => { haptic.light(); onChange(!on); }}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 ${on ? 'bg-primary-container' : 'bg-outline-variant'}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={() => { haptic.light(); onClick(); }}
      className={`py-2 px-3 rounded-full text-center text-label-sm transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 ${active ? 'bg-primary-container text-white shadow-sm font-semibold' : 'bg-surface-bg text-text-main hover:bg-surface-container border border-outline-variant/40 font-medium'}`}>
      {children}
    </button>
  );
}

/** Pantalla "Configuración de Alarmas". */
export function AlarmsPage() {
  const { user } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [pref, setPref] = useState<AlarmPreference>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) void app.passenger.getAlarmPreferences(user.id).then((r) => r.ok && setPref(r.data));
  }, [user]);

  if (!pref) return null;
  const patch = (p: Partial<AlarmPreference>) => setPref({ ...pref, ...p });

  const save = async () => {
    unlockAudio(); // permite que la alarma suene luego (política de autoplay)
    setSaving(true);
    const res = await app.passenger.saveAlarmPreferences(pref);
    setSaving(false);
    if (!res.ok) return toast('No se pudo guardar', res.error, 'warn');
    haptic.success();
    toast('Preferencias guardadas', 'Se aplican desde tu próximo aviso.', 'ok');
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col relative pb-28">
      <header className="sticky top-0 z-40 bg-surface-bg/95 backdrop-blur-md px-margin pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Volver" onClick={() => navigate('/pasajero')} className="w-11 h-11 rounded-full bg-surface-card flex items-center justify-center text-text-main shadow-soft active:scale-[0.96] transition-transform">
            <Icon name="arrow_back" />
          </button>
          <div>
            <h1 className="text-headline-sm text-text-main tracking-tight leading-tight">Alarmas y Avisos</h1>
            <p className="text-label-sm text-text-muted mt-0.5">Personaliza tus notificaciones de viaje</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center shadow-soft text-primary"><Icon name="vibration" fill /></div>
      </header>

      <main className="px-margin pt-2 flex flex-col gap-space-md">
        <div className="bg-primary-container text-on-primary rounded-[20px] p-space-md shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
              <span className="text-label-sm text-on-primary-container uppercase tracking-wider font-semibold">Modo trayecto seguro</span>
            </div>
            <p className="text-body-md text-white font-medium">GPS y avisos inteligentes sincronizados en tiempo real.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 relative z-10"><Icon name="notifications_active" className="text-3xl" /></div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        </div>

        <section className="bg-surface-card rounded-[22px] p-space-md shadow-soft border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary-fixed/40 flex items-center justify-center text-primary-container shrink-0 mt-0.5"><Icon name="directions_bus" fill className="text-2xl" /></div>
              <div>
                <h2 className="text-headline-sm text-text-main">Aviso de llegada a tu parada</h2>
                <p className="text-body-md text-text-muted mt-0.5 leading-snug">Te avisaremos cuando el bus esté cerca para que salgas a tiempo.</p>
              </div>
            </div>
            <Switch on={pref.arrivalEnabled} label="Activar aviso de llegada" onChange={(v) => patch({ arrivalEnabled: v })} />
          </div>
          {pref.arrivalEnabled && (
            <div className="pt-2 border-t border-surface-container-low flex flex-col gap-2">
              <span className="text-label-sm text-text-muted font-medium">Anticipación del recordatorio</span>
              <div className="grid grid-cols-3 gap-2">
                {ARRIVAL_OPTIONS.map((o) => <Pill key={o.label} active={same(pref.arrivalLead, o.lead)} onClick={() => patch({ arrivalLead: o.lead })}>{o.label}</Pill>)}
              </div>
            </div>
          )}
        </section>

        <section className="bg-surface-card rounded-[22px] p-space-md shadow-soft border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-tertiary-fixed/60 flex items-center justify-center text-tertiary shrink-0 mt-0.5"><Icon name="alarm" fill className="text-2xl" /></div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-headline-sm text-text-main">Alarma 'No te duermas'</h2>
                  <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Sonoro</span>
                </div>
                <p className="text-body-md text-text-muted mt-0.5 leading-snug">Vibración y sonido fuerte antes de llegar a tu destino.</p>
              </div>
            </div>
            <Switch on={pref.wakeUpEnabled} label="Activar alarma no te duermas" onChange={(v) => patch({ wakeUpEnabled: v })} />
          </div>
          {pref.wakeUpEnabled && (
            <div className="pt-2 border-t border-surface-container-low flex flex-col gap-2">
              <span className="text-label-sm text-text-muted font-medium">Disparar alerta cuando esté:</span>
              <div className="grid grid-cols-2 gap-2">
                {WAKE_OPTIONS.map((o) => (
                  <Pill key={o.label} active={same(pref.wakeUpLead, o.lead)} onClick={() => patch({ wakeUpLead: o.lead })}>
                    <Icon name={o.icon} className="text-sm" />{o.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-[#E6F8F1] border border-[#A7F3D0] rounded-[22px] p-space-md flex flex-col gap-3 select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-white flex items-center justify-center text-[#059669] shrink-0"><Icon name="verified" fill className="text-2xl text-[#059669]" /></div>
              <div>
                <h2 className="text-headline-sm text-text-main">Llegada al destino</h2>
                <p className="text-label-sm text-text-muted">Protocolo de seguridad operativa</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 bg-[#D1FAE5] text-[#059669] px-3 py-1 rounded-full text-label-sm font-semibold shrink-0"><Icon name="check" className="text-sm" /><span>Siempre activo</span></div>
          </div>
          <p className="text-body-md text-text-main leading-relaxed bg-white/70 rounded-[12px] p-3 border border-[#A7F3D0]/40">
            La app siempre te notificará en pantalla cuando hayas llegado a tu parada final. Esta opción no se puede desactivar por seguridad institucional.
          </p>
        </section>

        <Link to="/pasajero/alertas/reportar" className="rounded-2xl bg-surface-card p-3.5 border border-outline-variant/40 flex items-center gap-3 active:scale-[0.99] transition-transform">
          <div className="w-10 h-10 rounded-[12px] bg-error-container text-error flex items-center justify-center shrink-0"><Icon name="report" /></div>
          <div className="flex-1">
            <p className="text-label-lg text-text-main">Reportar una incidencia</p>
            <p className="text-label-sm text-text-muted">Retrasos, averías, conducta o accidentes.</p>
          </div>
          <Icon name="chevron_right" className="text-outline" />
        </Link>

        <div className="pt-1 pb-2">
          <button type="button" onClick={save} disabled={saving} className="w-full bg-primary-container text-white py-3.5 px-6 rounded-full text-label-lg flex items-center justify-center gap-2 shadow-md hover:bg-primary transition-all duration-150 active:scale-[0.985] disabled:opacity-60">
            <Icon name="check_circle" className="text-xl" />Guardar preferencias
          </button>
          <p className="text-center text-label-sm text-text-muted mt-2">Los cambios se aplican en cuanto guardas.</p>
        </div>
      </main>
    </div>
  );
}
