import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { initials } from '../../lib/format';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';
import { usePassenger } from './PassengerContext';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function ProfilePage() {
  const { user, logout } = useSession();
  const { snap, refresh } = usePassenger();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [editingStops, setEditingStops] = useState(false);

  if (!user) return null;

  const weekly = snap?.weekly;
  const activeAlarms = snap
    ? Number(snap.alarmPrefs.arrivalEnabled) + Number(snap.alarmPrefs.wakeUpEnabled)
    : 0;
  const nextDeparture = snap?.nextDeparture;
  const maxDay = weekly ? Math.max(1, ...weekly.perDay) : 1;
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-surface-bg transition-colors duration-200">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md flex items-center justify-between px-margin h-14 border-b border-outline-variant/30 shadow-xs">
        <div className="flex items-center gap-2">
          <img src="/logo-safer-icon.jpg" alt="SAFER" className="w-7 h-7 rounded-lg object-contain" />
          <h1 className="text-headline-sm text-primary font-bold tracking-tight">Mi Perfil</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-label-sm font-semibold border border-outline-variant/30">
            Estudiante
          </span>
        </div>
      </header>

      <main className="px-margin pt-4 flex flex-col gap-space-md">
        {/* Tarjeta de información de usuario */}
        <div className="bg-surface-card rounded-3xl p-5 shadow-level-1 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center text-headline-md font-bold shadow-md shrink-0">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-title-md font-bold text-on-surface truncate">{user.fullName}</p>
            <p className="text-body-sm text-on-surface-variant truncate">{user.email}</p>
            <div className="mt-1 flex items-center gap-2 text-label-sm text-secondary font-semibold">
              <span>Matrícula {user.studentId}</span>
              <span>•</span>
              <span className="truncate">{user.program}</span>
            </div>
          </div>
        </div>

        {/* Sección: Tu actividad semanal (movida desde inicio) */}
        {weekly && (
          <div className="bg-surface-card rounded-2xl p-space-md shadow-level-1 border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-label-sm text-on-surface-variant block capitalize">
                  {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <h3 className="text-headline-sm text-primary font-bold">Tu actividad semanal</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant text-label-sm font-semibold border border-outline-variant/30 flex items-center gap-1">
                <Icon name="insights" className="text-[14px] text-secondary" /> Resumen
              </span>
            </div>

            <div className="bg-surface-container-low/70 rounded-[12px] p-4 border border-outline-variant/20">
              <div className="flex items-center justify-between text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <Icon name="commute" className="text-[20px] text-secondary" />
                  <span className="text-label-md font-semibold text-primary">Esta semana</span>
                </div>
                <span className="text-label-sm">Promedio: {weekly.averagePerWeekday} / día</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-headline-lg font-bold text-primary leading-none">{weekly.total}</div>
                <span className="text-body-sm text-on-surface-variant">viajes completados</span>
              </div>
              <div className="flex items-end gap-1.5 h-14 mt-3 pt-1 border-t border-outline-variant/20">
                {weekly.perDay.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <span
                      className={`w-full rounded-sm ${
                        n > 0 ? (i === todayIdx ? 'bg-primary-container' : 'bg-secondary') : 'bg-outline-variant/60'
                      }`}
                      style={{ height: n > 0 ? `${Math.max(14, (n / maxDay) * 100)}%` : '8%' }}
                      title={`${n} viajes`}
                    />
                    <span className="text-[10px] text-on-surface-variant font-semibold">{DAYS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Accesos de rutas y alertas */}
        <div className="grid grid-cols-2 gap-space-md">
          <button
            type="button"
            onClick={() => navigate('/pasajero/alertas')}
            className="bg-surface-card p-4 rounded-2xl shadow-level-1 border border-outline-variant/40 flex flex-col justify-between items-start text-left min-h-[148px] active:scale-[0.98] transition-all hover:shadow-md group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-11 h-11 rounded-[12px] bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Icon name="notifications_active" className="text-[24px]" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-label-sm font-bold border border-outline-variant/30">
                {activeAlarms} activas
              </span>
            </div>
            <div className="mt-3">
              <span className="text-title-md font-bold text-primary block leading-tight">Alarmas</span>
              <span className="text-body-sm text-on-surface-variant block mt-0.5">Avisos de llegada</span>
            </div>
            <div className="w-full mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-secondary">
              <span className="text-label-sm font-semibold">Gestionar</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setEditingStops(true)}
            className="bg-surface-card p-4 rounded-2xl shadow-level-1 border border-outline-variant/40 flex flex-col justify-between items-start text-left min-h-[148px] active:scale-[0.98] transition-all hover:shadow-md group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-11 h-11 rounded-[12px] bg-primary text-on-primary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Icon name="add_road" className="text-[24px]" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-bold border border-secondary/30 flex items-center gap-0.5">
                <Icon name="add" className="text-[12px]" /> Paradas
              </span>
            </div>
            <div className="mt-3">
              <span className="text-title-md font-bold text-primary block leading-tight">Mis Paradas</span>
              <span className="text-body-sm text-on-surface-variant block mt-0.5">Recorrido habitual</span>
            </div>
            <div className="w-full mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-secondary">
              <span className="text-label-sm font-semibold">Cambiar paradas</span>
              <Icon name="arrow_forward" className="text-[16px]" />
            </div>
          </button>
        </div>

        {/* Próxima Salida */}
        {nextDeparture && (
          <div className="bg-surface-container-low rounded-2xl p-3.5 border border-outline-variant/30 flex items-center justify-between gap-3 shadow-level-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-surface-card text-on-surface-variant flex items-center justify-center border border-outline-variant/30 shrink-0">
                <Icon name="schedule" className="text-[20px]" />
              </div>
              <div>
                <span className="text-label-md font-bold text-primary block">Próxima Salida: {nextDeparture.time}</span>
                <span className="text-body-sm text-on-surface-variant block">{nextDeparture.detail}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast('Horarios', 'Frecuencia de unidades activa cada 15 minutos.', 'info')}
              className="min-h-[44px] px-3 rounded-[12px] bg-surface-card text-primary text-label-md font-semibold border border-outline-variant/40 hover:bg-surface-container flex items-center gap-1 active:scale-[0.985] shrink-0"
            >
              Horarios <Icon name="chevron_right" className="text-[16px]" />
            </button>
          </div>
        )}

        {/* Botón Cerrar Sesión */}
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="mt-2 w-full min-h-[48px] rounded-2xl border border-alert-coral/40 bg-surface-card text-alert-coral font-semibold text-label-lg flex items-center justify-center gap-2 hover:bg-alert-coral/10 active:scale-[0.985] transition-all shadow-xs"
        >
          <Icon name="logout" className="text-[20px]" /> Cerrar sesión
        </button>
      </main>

      {/* Modal para configurar paradas habituales */}
      {editingStops && snap && (
        <StopsDialog onClose={() => setEditingStops(false)} snap={snap} refresh={refresh} />
      )}
    </div>
  );
}

function StopsDialog({
  onClose,
  snap,
  refresh,
}: {
  onClose: () => void;
  snap: NonNullable<ReturnType<typeof usePassenger>['snap']>;
  refresh: () => Promise<void>;
}) {
  const { user } = useSession();
  const { toast } = useToasts();
  const stops = snap.route.stops;
  const [board, setBoard] = useState(snap.boardStop.id);
  const [drop, setDrop] = useState(snap.dropStop.id);

  const save = async () => {
    const res = await app.passenger.changeStops(user!.id, { boardStopId: board, dropStopId: drop });
    if (!res.ok) return toast('Revisa tus paradas', res.error, 'warn');
    await refresh();
    toast(
      'Recorrido actualizado',
      `${stops.find((s) => s.id === board)!.name} → ${stops.find((s) => s.id === drop)!.name}`,
      'ok',
    );
    onClose();
  };

  const sel = 'w-full min-h-[48px] rounded-2xl border border-outline-variant/50 bg-surface-container-low text-on-surface px-4 text-body-md focus:bg-surface-card outline-none';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir paradas habituales"
        className="animate-slideup relative w-full max-w-md bg-surface-card rounded-t-[28px] p-5 pb-8 shadow-2xl border-t border-outline-variant/30"
      >
        <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-3" />
        <h2 className="text-headline-sm font-bold mb-1 text-primary">Mi recorrido habitual</h2>
        <p className="text-body-sm text-on-surface-variant mb-4">{snap.route.name}</p>
        <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="sel-board">
          Subo en
        </label>
        <select id="sel-board" value={board} onChange={(e) => setBoard(e.target.value)} className={`${sel} mt-1 mb-3`}>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.name}
            </option>
          ))}
        </select>
        <label className="text-label-md font-semibold text-on-surface-variant" htmlFor="sel-drop">
          Bajo en
        </label>
        <select id="sel-drop" value={drop} onChange={(e) => setDrop(e.target.value)} className={`${sel} mt-1 mb-5`}>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          className="w-full h-12 rounded-full bg-primary text-on-primary text-label-lg font-bold shadow-md active:scale-[0.985] transition-transform"
        >
          Guardar paradas
        </button>
      </div>
    </div>
  );
}
