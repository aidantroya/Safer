import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { TRIP_KEY, useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

/** Pantalla "Inicio de sesión de Conductor (SAFER)". Correo y contraseña; la ruta y la unidad las asigna Coordinación. */
export function DriverLoginPage() {
  const { loginDriver, logout } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('carlos.mendoza@bustrack.edu');
  const [password, setPassword] = useState('conductor123');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    haptic.medium();

    const login = await loginDriver(email, password);
    if (!login.user) {
      setBusy(false);
      return toast('Credenciales inválidas', login.error, 'warn');
    }

    // El viaje se inicia con la ruta y la unidad que Coordinación le asignó hoy al conductor
    const assigned = await app.driver.getTodayAssignment(login.user.id);
    if (!assigned.ok || !assigned.data) {
      setBusy(false);
      logout();
      return toast('Sin turno asignado', 'Coordinación no te asignó una ruta para hoy.', 'warn');
    }
    const { route, bus } = assigned.data;
    const res = await app.driver.startTrip(login.user, bus.id, route.id);
    setBusy(false);

    if (!res.ok) {
      logout();
      return toast('No se pudo iniciar el viaje', res.error, 'warn');
    }

    sessionStorage.setItem(TRIP_KEY, res.data.id);
    haptic.success();
    toast('Turno iniciado', `${route.name} • Bus #${bus.number}`, 'ok');
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
          Ingresa con tu correo institucional y tu contraseña para iniciar tu turno.
        </p>
      </header>

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
            Iniciar sesión
          </legend>

          <div>
            <label htmlFor="conductor-email" className="text-label-sm text-on-surface-variant font-medium block mb-1">
              Correo institucional
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
                placeholder="nombre@bustrack.edu"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="conductor-password" className="text-label-sm text-on-surface-variant font-medium">
                Contraseña
              </label>
              <span className="text-label-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Demo: conductor123
              </span>
            </div>
            <div className="relative flex items-center">
              <Icon name="lock" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                id="conductor-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`${field} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
              </button>
            </div>
          </div>
        </fieldset>

        <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
            <Icon name="assignment_turned_in" className="text-[22px]" />
          </div>
          <p className="text-body-sm text-on-surface-variant font-medium">
            Tu ruta y tu unidad de hoy se cargan automáticamente según la programación de Coordinación.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary hover:opacity-95 active:scale-[0.985] text-label-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
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
