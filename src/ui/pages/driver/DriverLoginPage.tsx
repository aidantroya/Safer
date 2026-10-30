import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { Bus, Route } from '@/domain/model';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { TRIP_KEY, useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

/** Pantalla "Inicio de sesión de Conductor (SAFER)". PIN de demo: 4821. */
export function DriverLoginPage() {
  const { loginDriver } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('carlos.mendoza@bustrack.edu');
  const [pin, setPin] = useState(['4', '8', '2', '1']);
  const [assignedBus, setAssignedBus] = useState<Bus>();
  const [assignedRoute, setAssignedRoute] = useState<Route>();
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // La coordinación de transporte ya tiene asignada la unidad y la ruta para este turno
    void app.driver.getSetupOptions().then((r) => {
      if (!r.ok) return;
      const bus = r.data.buses.find((b) => b.online) ?? r.data.buses[0];
      const route = r.data.routes[0];
      setAssignedBus(bus);
      setAssignedRoute(route);
    });
    refs.current[3]?.focus();
  }, []);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[i] = d;
    setPin(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const submit = async () => {
    if (!assignedBus || !assignedRoute) {
      return toast('Cargando turno', 'Esperando confirmación de la central de despacho…', 'info');
    }
    setBusy(true);
    haptic.medium();

    const login = await loginDriver(email, pin.join(''));
    if (!login.user) {
      setBusy(false);
      return toast('Credenciales inválidas', login.error, 'warn');
    }

    // El viaje se inicia automáticamente con la ruta y unidad asignadas por el coordinador
    const res = await app.driver.startTrip(login.user, assignedBus.id, assignedRoute.id);
    setBusy(false);

    if (!res.ok) {
      return toast('No se pudo iniciar el viaje', res.error, 'warn');
    }

    sessionStorage.setItem(TRIP_KEY, res.data.id);
    haptic.success();
    toast('Turno iniciado', `Ruta asignada: ${assignedRoute.name}`, 'ok');
    navigate('/conductor/panel');
  };

  const field =
    'w-full pl-10 pr-3.5 py-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md focus:bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all';

  return (
    <main className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col justify-between px-space-md py-4 sm:px-margin sm:py-6 transition-colors duration-200">
      {/* Barra superior con botón de regresar y toggle de tema */}
      <nav className="w-full flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/40 bg-surface-card hover:bg-surface-container-low text-on-surface text-label-md font-semibold active:scale-[0.96] transition-all shadow-xs"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          <span>Volver al inicio</span>
        </button>

        <ThemeToggle showLabel />
      </nav>

      {/* Cabecera con Logotipo SAFER */}
      <header className="w-full flex flex-col items-center text-center my-4">
        <div className="w-20 h-20 rounded-3xl bg-surface-card p-2.5 shadow-level-1 border border-outline-variant/30 flex items-center justify-center mb-3">
          <img
            src="/logo-safer-icon.jpg"
            alt="Logo SAFER"
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>
        <span className="text-label-md text-primary font-bold tracking-widest uppercase">
          Portal Conductor • SAFER
        </span>
        <h1 className="text-headline-md text-on-surface font-extrabold tracking-tight mt-1">
          Bienvenido, Conductor
        </h1>
        <p className="text-body-sm text-on-surface-variant max-w-xs mt-1">
          Ingresa tus credenciales para acceder a tu turno y ruta asignada por Coordinación.
        </p>
      </header>

      {/* Formulario de Login Únicamente */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full bg-surface-card rounded-3xl shadow-level-2 border border-outline-variant/30 p-5 sm:p-6 flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
          <legend className="text-label-lg text-on-surface font-bold mb-1 flex items-center gap-1.5">
            <Icon name="badge" className="text-[20px] text-primary" />
            Credenciales de turno
          </legend>

          <div>
            <label htmlFor="conductor-email" className="text-label-sm text-on-surface-variant font-medium block mb-1">
              Usuario o correo institucional
            </label>
            <div className="relative flex items-center">
              <Icon name="alternate_email" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                id="conductor-email"
                type="email"
                autoComplete="username"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos.mendoza@bustrack.edu"
                required
              />
            </div>
          </div>

          <div className="pt-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-label-sm text-on-surface-variant font-medium">PIN de turno</span>
              <span className="text-label-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Demo: 4821
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {pin.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Dígito ${i + 1} del PIN`}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !pin[i] && i > 0) refs.current[i - 1]?.focus();
                  }}
                  placeholder="•"
                  className="h-13 text-center text-headline-sm font-bold bg-surface-container-low border border-outline-variant/50 rounded-2xl text-on-surface focus:bg-surface-card focus:border-2 focus:border-primary outline-none transition-all shadow-inner"
                />
              ))}
            </div>
          </div>
        </fieldset>

        {/* Tarjeta de Asignación por el Coordinador */}
        <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
            <Icon name="assignment_turned_in" className="text-[22px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-label-sm font-bold text-primary truncate">Ruta y unidad asignadas</span>
            </div>
            <p className="text-body-sm text-on-surface-variant truncate font-medium mt-0.5">
              {assignedRoute && assignedBus
                ? `${assignedRoute.name} • Bus #${assignedBus.number}`
                : 'Cargando asignación de coordinación…'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || pin.some((d) => !d)}
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white hover:opacity-95 active:scale-[0.985] text-label-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
        >
          <span>{busy ? 'Iniciando turno…' : 'Iniciar turno y ver ruta'}</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </button>
      </form>

      {/* Pie con nota de seguridad */}
      <footer className="w-full text-center py-3">
        <p className="text-label-sm text-on-surface-variant/80 flex items-center justify-center gap-1.5">
          <Icon name="lock" className="text-[16px] text-primary" />
          <span>Despacho centralizado por el coordinador del sistema SAFER.</span>
        </p>
      </footer>
    </main>
  );
}
