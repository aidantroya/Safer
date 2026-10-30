import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { coordinatorApi } from '@/api/coordinatorApi';
import type { ReviewInsight, Route } from '@/domain/model';
import { WEEKDAY_NAMES, type PlanItem, type WeekPlan } from '@/service/PlanningService';
import { Icon } from '../../components/Icon';
import { InsightCard } from '../../components/InsightCard';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { DriversSection } from './DriversSection';

const SHORT_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Lo que el coordinador eligió para una ruta un día ('' = sin elegir). */
interface Cell { driverId: string; busId: string }
/** Borrador de la semana: [día][routeId] → celda. */
type Draft = Record<string, Cell>[];

const emptyCell: Cell = { driverId: '', busId: '' };

function toDraft(plan: WeekPlan): Draft {
  return Array.from({ length: 7 }, (_, d) =>
    Object.fromEntries(
      plan.routes.map((r) => {
        const a = plan.assignments.find((x) => x.weekday === d && x.routeId === r.id);
        return [r.id, a ? { driverId: a.driverId, busId: a.busId } : emptyCell];
      }),
    ),
  );
}

function toItems(day: Record<string, Cell>): PlanItem[] {
  return Object.entries(day)
    .filter(([, c]) => c.driverId && c.busId)
    .map(([routeId, c]) => ({ routeId, driverId: c.driverId, busId: c.busId }));
}

/** Mismas reglas que PlanningService, para avisar antes de guardar. */
function dayProblems(day: Record<string, Cell>, plan: WeekPlan): string[] {
  const out: string[] = [];
  const count = (key: keyof Cell, id: string) => Object.values(day).filter((c) => c[key] === id).length;
  for (const r of plan.routes) {
    const c = day[r.id];
    if (c.driverId && !c.busId) out.push(`Ruta ${r.code}: falta elegir el bus.`);
    if (!c.driverId && c.busId) out.push(`Ruta ${r.code}: falta elegir el conductor.`);
  }
  for (const d of plan.drivers) if (count('driverId', d.id) > 1) out.push(`${d.fullName} está en dos rutas.`);
  for (const b of plan.buses) {
    if (count('busId', b.id) > 1) out.push(`El Bus #${b.number} está en dos rutas.`);
    if (count('busId', b.id) > 0 && !b.online) out.push(`El Bus #${b.number} está fuera de línea.`);
  }
  return out;
}

const sameDay = (a: Record<string, Cell>, b: Record<string, Cell>) =>
  Object.keys(a).every((k) => a[k].driverId === b[k]?.driverId && a[k].busId === b[k]?.busId);

/** Pantalla "Planificador semanal" de Coordinación: conductor + bus para cada ruta y cada día. */
export function PlannerPage() {
  const { user, ready, logout, backend, isCoordinator } = useSession();
  const api = useMemo(() => coordinatorApi(backend === 'supabase'), [backend]);
  const [loadError, setLoadError] = useState<string>();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<WeekPlan>();
  const [saved, setSaved] = useState<Draft>();
  const [draft, setDraft] = useState<Draft>();
  const [mode, setMode] = useState<'dia' | 'semana' | 'conductores'>('dia');
  const [day, setDay] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<Record<string, ReviewInsight>>({});

  const load = useCallback(async () => {
    const res = await api.coordinator.getWeekPlan();
    if (!res.ok) return setLoadError(res.error);
    setLoadError(undefined);
    const d = toDraft(res.data);
    setPlan(res.data);
    setSaved(d);
    setDraft(d);
    setDay((cur) => cur ?? res.data.today);
    for (const d of res.data.drivers) {
      void api.coordinator.getDriverInsight(d.id).then((r) => {
        if (r.ok && r.data) setInsights((cur) => ({ ...cur, [d.id]: r.data! }));
      });
    }
  }, [api]);

  useEffect(() => {
    if (user?.role === 'coordinator') void load();
  }, [user, load]);

  const problems = useMemo(() => (plan && draft ? draft.map((d) => dayProblems(d, plan)) : []), [plan, draft]);

  if (ready && (!user || user.role !== 'coordinator')) return <Navigate to="/coordinador" replace />;
  if (!user) return null;
  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-5">
        <div role="alert" className="max-w-sm w-full bg-surface-card rounded-3xl p-6 shadow-level-2 border border-outline-variant/30 flex flex-col gap-3">
          <Icon name="cloud_off" className="text-[36px] text-alert-coral" />
          <h1 className="text-headline-sm font-bold text-on-surface">No se pudo cargar la planificación</h1>
          <p className="text-body-sm text-on-surface-variant">{loadError}</p>
          <button type="button" onClick={() => void load()} className="h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold">Reintentar</button>
          <button type="button" onClick={() => { logout(); navigate('/coordinador'); }} className="h-11 rounded-full text-on-surface-variant text-label-md font-semibold">Cerrar sesión</button>
        </div>
      </div>
    );
  }
  if (!plan || !draft || !saved || day === undefined) {
    return <p className="p-6 text-on-surface-variant">Cargando planificador…</p>;
  }

  const dirty = draft.map((d, i) => !sameDay(d, saved[i]));
  const anyDirty = dirty.some(Boolean);

  const setCell = (d: number, routeId: string, patch: Partial<Cell>) => {
    setDraft((cur) => cur!.map((x, i) => (i === d ? { ...x, [routeId]: { ...x[routeId], ...patch } } : x)));
  };

  const saveDay = async () => {
    if (problems[day].length) return toast('Revisa el plan', problems[day][0], 'warn');
    setBusy(true);
    const res = await api.coordinator.saveDay(day, toItems(draft[day]));
    setBusy(false);
    if (!res.ok) return toast('No se pudo guardar', res.error, 'warn');
    haptic.success();
    toast('Plan guardado', `${WEEKDAY_NAMES[day]}: ${toItems(draft[day]).length} de ${plan.routes.length} rutas cubiertas.`, 'ok');
    await load();
  };

  const saveWeek = async () => {
    const bad = problems.findIndex((p) => p.length);
    if (bad >= 0) {
      setDay(bad);
      return toast(`Revisa el ${WEEKDAY_NAMES[bad].toLowerCase()}`, problems[bad][0], 'warn');
    }
    setBusy(true);
    const res = await api.coordinator.saveWeek(draft.map(toItems));
    setBusy(false);
    if (!res.ok) return toast('No se pudo guardar', res.error, 'warn');
    haptic.success();
    toast('Semana guardada', 'La programación de los 7 días quedó actualizada.', 'ok');
    await load();
  };

  const copyDayToWeek = () => {
    haptic.light();
    setDraft((cur) => cur!.map(() => ({ ...cur![day] })));
    setMode('semana');
    toast('Copiado a toda la semana', `Se repitió el plan del ${WEEKDAY_NAMES[day].toLowerCase()}. Revisa y guarda la semana.`, 'info');
  };

  const todayCovered = toItems(saved[plan.today]).length;

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md border-b border-outline-variant/30 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between px-margin h-14">
          <div className="flex items-center gap-2">
            <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
            <div>
              <h1 className="text-headline-sm text-primary font-bold tracking-tight leading-none">Planificador</h1>
              <p className="text-[11px] text-on-surface-variant font-medium">Coordinación de Transporte</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={() => { logout(); navigate('/'); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="logout" className="text-[20px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto px-margin pt-4 flex flex-col gap-space-md">
        <div className="bg-surface-card rounded-2xl p-3.5 shadow-level-1 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-11 h-11 rounded-[12px] bg-primary text-on-primary flex items-center justify-center shrink-0">
            <Icon name="event_available" className="text-[24px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-label-sm text-on-surface-variant">Hoy, {WEEKDAY_NAMES[plan.today].toLowerCase()}</p>
            <p className="text-title-md font-bold text-on-surface">{todayCovered} de {plan.routes.length} rutas cubiertas</p>
          </div>
          <div className="text-right text-label-sm text-on-surface-variant shrink-0">
            <span className="block">{plan.drivers.length} conductores</span>
            <span className="block">{plan.buses.filter((b) => b.online).length} buses en línea</span>
          </div>
        </div>

        {api.source === 'supabase' ? (
          <div className="flex flex-col gap-2">
            <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
              <Icon name="cloud_done" className="text-[16px] text-secondary" /> Datos reales de Supabase • {plan.routes.length} rutas • {plan.buses.length} buses
            </p>
            {!isCoordinator && (
              <p role="status" className="text-label-sm rounded-xl p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Tu cuenta no tiene el rol de Coordinación en la base: puedes ver el plan, pero no guardarlo.
              </p>
            )}
            {plan.drivers.length === 0 && (
              <button type="button" onClick={() => setMode('conductores')} className="text-left text-label-sm rounded-xl p-2.5 bg-primary/10 text-primary border border-primary/30 font-semibold">
                Aún no hay conductores en la base. Regístralos en la pestaña Conductores →
              </button>
            )}
          </div>
        ) : (
          <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
            <Icon name="science" className="text-[16px]" /> Modo demo: datos de ejemplo en memoria
          </p>
        )}

        <div role="tablist" aria-label="Modo de planificación" className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          {([['dia', 'Por día', 'today'], ['semana', 'Semana', 'date_range'], ['conductores', 'Conductores', 'badge']] as const).map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[44px] rounded-xl text-label-md flex items-center justify-center gap-1 transition-all ${
                mode === m ? 'bg-surface-card text-primary font-bold shadow-level-1' : 'text-on-surface-variant font-medium'
              }`}
            >
              <Icon name={icon} className="text-[18px]" /> {label}
            </button>
          ))}
        </div>

        {mode === 'conductores' && <DriversSection drivers={api.drivers} buses={plan.buses} onChanged={() => void load()} />}

        {mode === 'dia' && Object.keys(insights).length > 0 && (
          <details className="bg-surface-card rounded-2xl shadow-level-1 border border-outline-variant/30 group">
            <summary className="list-none cursor-pointer px-3.5 py-3 flex items-center gap-2 text-label-lg font-bold text-on-surface">
              <Icon name="auto_awesome" className="text-[20px] text-primary" />
              Desempeño de conductores
              <Icon name="expand_more" className="ml-auto text-[20px] text-on-surface-variant group-open:rotate-180 transition-transform" />
            </summary>
            <ul className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
              {plan.drivers.map((d) => insights[d.id] && (
                <li key={d.id} className="px-3.5 py-3"><InsightCard insight={insights[d.id]} title={d.fullName} compact /></li>
              ))}
            </ul>
          </details>
        )}

        {mode === 'conductores' ? null : mode === 'dia' ? (
          <>
            <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Día de la semana">
              {SHORT_DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={day === i}
                  aria-label={WEEKDAY_NAMES[i]}
                  onClick={() => setDay(i)}
                  className={`relative min-h-[48px] rounded-xl text-label-lg font-bold flex flex-col items-center justify-center border transition-all ${
                    day === i
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-card text-on-surface border-outline-variant/40 hover:bg-surface-container-low'
                  }`}
                >
                  {d}
                  {i === plan.today && <span className={`text-[9px] font-semibold ${day === i ? 'opacity-90' : 'text-secondary'}`}>hoy</span>}
                  {(problems[i].length > 0 || dirty[i]) && (
                    <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${problems[i].length ? 'bg-alert-coral' : 'bg-amber-500'}`} />
                  )}
                </button>
              ))}
            </div>

            <DayEditor plan={plan} weekday={day} cells={draft[day]} problems={problems[day]} onChange={(r, p) => setCell(day, r, p)} />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={saveDay}
                disabled={busy || !dirty[day]}
                className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-md active:scale-[0.985] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="save" className="text-[20px]" /> Guardar {WEEKDAY_NAMES[day].toLowerCase()}
              </button>
              <button
                type="button"
                onClick={copyDayToWeek}
                className="w-full h-12 rounded-full border border-outline-variant/50 bg-surface-card text-primary text-label-lg font-bold active:scale-[0.985] flex items-center justify-center gap-2"
              >
                <Icon name="content_copy" className="text-[20px]" /> Repetir este día en toda la semana
              </button>
            </div>
          </>
        ) : (
          <>
            {draft.map((cells, d) => (
              <section key={d} aria-labelledby={`dia-${d}`} className="flex flex-col gap-2">
                <h2 id={`dia-${d}`} className="flex items-center gap-2 text-label-md font-bold uppercase tracking-wider text-on-surface-variant">
                  {WEEKDAY_NAMES[d]}
                  {d === plan.today && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container normal-case tracking-normal">Hoy</span>}
                  {dirty[d] && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 normal-case tracking-normal">Sin guardar</span>}
                </h2>
                <DayEditor plan={plan} weekday={d} cells={cells} problems={problems[d]} compact onChange={(r, p) => setCell(d, r, p)} />
              </section>
            ))}
          </>
        )}
      </main>

      {mode === 'semana' && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-surface-card border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
          <div className="max-w-md mx-auto px-margin py-3 flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(saved)}
              disabled={!anyDirty || busy}
              className="h-12 px-4 rounded-full border border-outline-variant/50 text-on-surface text-label-lg font-semibold disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={saveWeek}
              disabled={!anyDirty || busy}
              className="flex-1 h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-md active:scale-[0.985] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Icon name="save" className="text-[20px]" /> {busy ? 'Guardando…' : 'Guardar semana'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DayEditor({
  plan, weekday, cells, problems, compact = false, onChange,
}: {
  plan: WeekPlan;
  weekday: number;
  cells: Record<string, Cell>;
  problems: string[];
  compact?: boolean;
  onChange: (routeId: string, patch: Partial<Cell>) => void;
}) {
  const usedDrivers = new Set(Object.values(cells).map((c) => c.driverId).filter(Boolean));
  const usedBuses = new Set(Object.values(cells).map((c) => c.busId).filter(Boolean));
  const freeDrivers = plan.drivers.filter((d) => !usedDrivers.has(d.id));
  const freeBuses = plan.buses.filter((b) => b.online && !usedBuses.has(b.id));

  return (
    <div className="bg-surface-card rounded-2xl shadow-level-1 border border-outline-variant/30 overflow-hidden">
      <ul className="divide-y divide-outline-variant/20">
        {plan.routes.map((r) => (
          <RouteRow key={r.id} route={r} plan={plan} weekday={weekday} cells={cells} compact={compact} onChange={onChange} />
        ))}
      </ul>

      {problems.length > 0 ? (
        <div role="alert" className="px-3.5 py-2.5 bg-alert-coral/10 border-t border-alert-coral/30 text-alert-coral text-label-sm font-semibold flex flex-col gap-0.5">
          {problems.map((p) => (
            <span key={p} className="flex items-center gap-1.5"><Icon name="error" className="text-[16px]" /> {p}</span>
          ))}
        </div>
      ) : (
        !compact && (
          <div className="px-3.5 py-2.5 bg-surface-container-low/70 border-t border-outline-variant/20 text-label-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">Libres:</span>{' '}
            {freeDrivers.length ? freeDrivers.map((d) => d.fullName).join(', ') : 'ningún conductor'} •{' '}
            {freeBuses.length ? freeBuses.map((b) => `Bus #${b.number}`).join(', ') : 'ningún bus'}
          </div>
        )
      )}
    </div>
  );
}

function RouteRow({
  route, plan, weekday, cells, compact, onChange,
}: {
  route: Route;
  plan: WeekPlan;
  weekday: number;
  cells: Record<string, Cell>;
  compact: boolean;
  onChange: (routeId: string, patch: Partial<Cell>) => void;
}) {
  const cell = cells[route.id];
  /** Ruta donde ya está ese conductor/bus ese día (para anotarlo en la opción). */
  const takenIn = (key: keyof Cell, id: string) => {
    const other = plan.routes.find((r) => r.id !== route.id && cells[r.id][key] === id);
    return other ? ` (en R${other.code})` : '';
  };
  const sel =
    'w-full min-h-[44px] rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface px-2.5 text-body-sm focus:bg-surface-card focus:border-primary outline-none';
  const id = `${weekday}-${route.id}`;

  return (
    <li className={`px-3.5 ${compact ? 'py-2.5' : 'py-3.5'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded-md bg-primary text-on-primary text-label-sm font-extrabold tabular">R{route.code}</span>
        <span className="text-label-lg font-bold text-on-surface truncate">{route.shortName}</span>
        {!cell.driverId && !cell.busId && (
          <span className="ml-auto text-label-sm text-on-surface-variant italic shrink-0">Sin asignar</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          {!compact && <label htmlFor={`drv-${id}`} className="text-[11px] font-semibold text-on-surface-variant block mb-0.5">Conductor</label>}
          <select
            id={`drv-${id}`}
            aria-label={`Conductor de la Ruta ${route.code}, ${WEEKDAY_NAMES[weekday]}`}
            value={cell.driverId}
            onChange={(e) => onChange(route.id, { driverId: e.target.value })}
            className={sel}
          >
            <option value="">— Conductor —</option>
            {plan.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}{d.rating.average !== null ? ` ★${d.rating.average.toFixed(1)}` : ''}{takenIn('driverId', d.id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          {!compact && <label htmlFor={`bus-${id}`} className="text-[11px] font-semibold text-on-surface-variant block mb-0.5">Bus</label>}
          <select
            id={`bus-${id}`}
            aria-label={`Bus de la Ruta ${route.code}, ${WEEKDAY_NAMES[weekday]}`}
            value={cell.busId}
            onChange={(e) => onChange(route.id, { busId: e.target.value })}
            className={sel}
          >
            <option value="">— Bus —</option>
            {plan.buses.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.online}>
                Bus #{b.number} • {b.capacity} asientos{!b.online ? ' (fuera de línea)' : takenIn('busId', b.id)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}
