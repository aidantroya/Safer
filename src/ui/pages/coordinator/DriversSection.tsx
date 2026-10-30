import { useCallback, useEffect, useState } from 'react';
import type { Bus } from '@/domain/model';
import type { DriverListItem, DriversAdmin } from '@/api/coordinatorApi';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { initials } from '../../lib/format';
import { haptic } from '../../lib/haptics';

/** Sección "Conductores": lista los conductores y permite registrar uno nuevo ligándolo a un bus. */
export function DriversSection({ drivers, buses, onChanged }: { drivers: DriversAdmin; buses: Bus[]; onChanged: () => void }) {
  const { toast } = useToasts();
  const [list, setList] = useState<DriverListItem[]>();
  const [email, setEmail] = useState('');
  const [busNumber, setBusNumber] = useState<number>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await drivers.list();
    if (!r.ok) return toast('No se pudieron leer los conductores', r.error, 'warn');
    setList(r.data);
  }, [drivers, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async () => {
    if (!busNumber) return;
    setBusy(true);
    const r = await drivers.register(email, busNumber);
    setBusy(false);
    if (!r.ok) return toast('No se pudo registrar', r.error, 'warn');
    haptic.success();
    toast('Conductor registrado', `${email} ahora maneja el Bus #${busNumber}.`, 'ok');
    setEmail('');
    await load();
    onChanged();
  };

  const field = 'w-full min-h-[44px] rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface px-3 text-body-md focus:bg-surface-card focus:border-primary outline-none';

  return (
    <div className="flex flex-col gap-space-md">
      <section aria-labelledby="nuevo-conductor" className="bg-surface-card rounded-2xl p-space-md shadow-level-1 border border-outline-variant/30">
        <h2 id="nuevo-conductor" className="text-headline-sm font-bold text-primary flex items-center gap-2">
          <Icon name="person_add" className="text-[22px]" /> Registrar conductor
        </h2>
        {drivers.canRegister ? (
          <>
            <p className="text-body-sm text-on-surface-variant mt-1">
              El conductor crea su cuenta con su correo institucional; aquí le das el rol de conductor y su bus.
            </p>
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <label htmlFor="drv-email" className="text-[11px] font-semibold text-on-surface-variant">Correo del conductor</label>
              <input id="drv-email" type="email" required className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@espol.edu.ec" />
              <label htmlFor="drv-bus" className="text-[11px] font-semibold text-on-surface-variant mt-1">Bus</label>
              <select id="drv-bus" required className={field} value={busNumber ?? ''} onChange={(e) => setBusNumber(Number(e.target.value) || undefined)}>
                <option value="">— Elige el bus —</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.number} disabled={!b.online}>
                    Bus #{b.number} • {b.plate || 'sin placa'}{!b.online ? ' (fuera de línea)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || !email || !busNumber}
                className="mt-2 h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="how_to_reg" className="text-[20px]" /> {busy ? 'Registrando…' : 'Registrar conductor'}
              </button>
            </form>
          </>
        ) : (
          <p className="text-body-sm text-on-surface-variant mt-1">Disponible con una cuenta real de Supabase. En la demo los conductores ya vienen cargados.</p>
        )}
      </section>

      <section aria-labelledby="lista-conductores" className="flex flex-col gap-2">
        <h2 id="lista-conductores" className="text-label-md font-bold uppercase tracking-wider text-on-surface-variant">
          Conductores {list ? `(${list.length})` : ''}
        </h2>
        {!list ? (
          <p className="text-body-sm text-on-surface-variant">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant bg-surface-card rounded-2xl p-4 border border-outline-variant/30">
            Todavía no hay conductores. Regístralos arriba para poder asignarlos a las rutas.
          </p>
        ) : (
          <ul className="bg-surface-card rounded-2xl shadow-level-1 border border-outline-variant/30 divide-y divide-outline-variant/20">
            {list.map((d) => (
              <li key={d.id} className="px-3.5 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-lg font-bold shrink-0">{initials(d.fullName)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-label-lg font-bold text-on-surface truncate">{d.fullName}</p>
                  {d.email && <p className="text-label-sm text-on-surface-variant truncate">{d.email}</p>}
                </div>
                {d.busNumber !== undefined && <span className="text-label-md font-bold text-primary shrink-0">Bus #{d.busNumber}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
