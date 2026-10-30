import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

/** Pantalla "Inicio de sesión de Coordinación". */
export function CoordinatorLoginPage() {
  const { loginCoordinator } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('coordinacion@bustrack.edu');
  const [password, setPassword] = useState('coord123');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    haptic.medium();
    const err = await loginCoordinator(email, password);
    setBusy(false);
    if (err) return toast('Credenciales inválidas', err, 'warn');
    haptic.success();
    navigate('/coordinador/planificador');
  };

  const field =
    'w-full pl-10 pr-3.5 py-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low text-on-surface text-body-md focus:bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all';

  return (
    <main className="w-full max-w-md mx-auto min-h-screen bg-surface-bg flex flex-col justify-between px-space-md py-4 sm:px-margin sm:py-6 transition-colors duration-200">
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

      <header className="w-full flex flex-col items-center text-center my-4">
        <div className="w-20 h-20 rounded-3xl bg-surface-card p-2.5 shadow-level-1 border border-outline-variant/30 flex items-center justify-center mb-3">
          <img src="/logo-safer-icon.jpg" alt="Logo SAFER" className="w-full h-full object-contain rounded-2xl" />
        </div>
        <span className="text-label-md text-primary font-bold tracking-widest uppercase">Portal Coordinación • SAFER</span>
        <h1 className="text-headline-md text-on-surface font-extrabold tracking-tight mt-1">Planificación de turnos</h1>
        <p className="text-body-sm text-on-surface-variant max-w-xs mt-1">
          Asigna conductores y buses a cada ruta, por día o para toda la semana.
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
            <Icon name="calendar_month" className="text-[20px] text-primary" />
            Iniciar sesión
          </legend>

          <div>
            <label htmlFor="coord-email" className="text-label-sm text-on-surface-variant font-medium block mb-1">
              Correo institucional
            </label>
            <div className="relative flex items-center">
              <Icon name="alternate_email" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input id="coord-email" type="email" autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="coord-password" className="text-label-sm text-on-surface-variant font-medium">Contraseña</label>
              <span className="text-label-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Demo: coord123</span>
            </div>
            <div className="relative flex items-center">
              <Icon name="lock" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                id="coord-password"
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

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary hover:opacity-95 active:scale-[0.985] text-label-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
        >
          <span>{busy ? 'Ingresando…' : 'Abrir planificador'}</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </button>
      </form>

      <footer className="w-full text-center py-3">
        <p className="text-label-sm text-on-surface-variant/80">Coordinación de Transporte • SAFER</p>
      </footer>
    </main>
  );
}
