import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { AlarmPreference, LeadTime } from '@/domain/model';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { unlockAudio } from '../../lib/sound';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

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
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${on ? 'bg-primary' : 'bg-outline-variant/60'}`}>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={() => { haptic.light(); onClick(); }}
      className={`py-2 px-3 rounded-full text-center text-label-sm transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 ${active ? 'bg-primary text-white shadow-sm font-semibold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/40 font-medium'}`}>
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
    <div className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col relative pb-28 transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-bg/95 backdrop-blur-md px-margin pt-4 pb-3 flex items-center justify-between border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Volver" onClick={() => navigate('/pasajero')} className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-on-surface shadow-xs border border-outline-variant/30 active:scale-[0.96] transition-transform">
            <Icon name="arrow_back" />
          </button>
          <div>
            <h1 className="text-headline-sm text-on-surface font-bold tracking-tight leading-tight">Alarmas y Avisos</h1>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Notificaciones inteligentes SAFER</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-margin pt-3 flex flex-col gap-space-md">
        <div className="bg-primary text-white rounded-[20px] p-space-md shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-label-sm text-white/90 uppercase tracking-wider font-bold">Modo trayecto seguro</span>
            </div>
            <p className="text-body-md text-white font-medium">GPS y avisos inteligentes sincronizados en tiempo real.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 relative z-10"><Icon name="notifications_active" className="text-3xl" /></div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        </div>

        <section className="bg-surface-card rounded-[22px] p-space-md shadow-level-1 border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary shrink-0 mt-0.5"><Icon name="directions_bus" fill className="text-2xl" /></div>
              <div>
                <h2 className="text-headline-sm text-on-surface font-bold">Aviso de llegada a tu parada</h2>
                <p className="text-body-md text-on-surface-variant mt-0.5 leading-snug">Te avisaremos cuando el bus esté cerca para que salgas a tiempo.</p>
              </div>
            </div>
            <Switch on={pref.arrivalEnabled} label="Activar aviso de llegada" onChange={(v) => patch({ arrivalEnabled: v })} />
          </div>
          {pref.arrivalEnabled && (
            <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant font-medium">Avisarme con anticipación:</label>
              <div className="grid grid-cols-3 gap-2">
                {ARRIVAL_OPTIONS.map((opt) => (
                  <Pill key={opt.label} active={same(pref.arrivalLead, opt.lead)} onClick={() => patch({ arrivalLead: opt.lead })}>{opt.label}</Pill>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-surface-card rounded-[22px] p-space-md shadow-level-1 border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary shrink-0 mt-0.5"><Icon name="alarm" fill className="text-2xl" /></div>
              <div>
                <h2 className="text-headline-sm text-on-surface font-bold">Alarma "No te duermas"</h2>
                <p className="text-body-md text-on-surface-variant mt-0.5 leading-snug">Despierta antes de llegar a tu destino con sonido y vibración.</p>
              </div>
            </div>
            <Switch on={pref.wakeUpEnabled} label="Activar alarma de bajada" onChange={(v) => patch({ wakeUpEnabled: v })} />
          </div>
          {pref.wakeUpEnabled && (
            <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant font-medium">Sonar antes de mi parada:</label>
              <div className="grid grid-cols-2 gap-2">
                {WAKE_OPTIONS.map((opt) => (
                  <Pill key={opt.label} active={same(pref.wakeUpLead, opt.lead)} onClick={() => patch({ wakeUpLead: opt.lead })}><Icon name={opt.icon} className="text-[18px]" />{opt.label}</Pill>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-label-sm text-secondary font-medium">
                <Icon name="check_circle" className="text-[16px]" />
                <span>Incluye alerta sonora y vibración sincronizada</span>
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30 text-on-surface">
          <div className="flex items-center gap-2.5">
            <Icon name="report" className="text-alert-coral text-[22px]" />
            <div>
              <span className="text-label-md font-bold block">¿Problemas con el bus?</span>
              <span className="text-body-sm text-on-surface-variant block">Reporta retrasos o incidentes a la central</span>
            </div>
          </div>
          <Link to="/pasajero/alertas/reportar" className="text-label-md font-bold text-primary hover:underline">Reportar</Link>
        </div>

        <button type="button" onClick={save} disabled={saving} className="w-full h-12 rounded-full bg-primary text-white font-bold text-label-lg shadow-sm active:scale-[0.985] disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </main>
    </div>
  );
}
