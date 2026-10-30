import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/data/datasource/supabaseClient';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { useSession } from '../../session/SessionContext';
import { ThemeToggle } from '../../theme/ThemeContext';

const DEMO_EMAIL = 'coordinacion@bustrack.edu';
const DEMO_PASSWORD = 'coord123';

/**
 * Pantalla "Inicio de sesión de Coordinación". Viene rellena con la cuenta de demo (entrada rápida);
 * con Supabase configurado, cualquier otra cuenta entra con Supabase Auth, y se puede crear una cuenta real.
 */
export function CoordinatorLoginPage() {
  const { loginCoordinator, loginRemote, signUpRemote } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const real = !!supabase;
  const [tab, setTab] = useState<'entrar' | 'crear'>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const isDemoAccount = email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;

  const switchTab = (t: 'entrar' | 'crear') => {
    setTab(t);
    // crear cuenta empieza en blanco; al volver a "Iniciar sesión" se rellena otra vez la demo
    setEmail(t === 'crear' ? '' : DEMO_EMAIL);
    setPassword(t === 'crear' ? '' : DEMO_PASSWORD);
  };
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = () => {
    haptic.success();
    navigate('/coordinador/planificador');
  };

  const submit = async () => {
    setBusy(true);
    haptic.medium();
    let err: string | undefined;
    if (!real || (tab === 'entrar' && isDemoAccount)) err = await loginCoordinator(email, password);
    else if (tab === 'entrar') err = await loginRemote(email, password);
    else {
      const r = await signUpRemote(fullName, email, password);
      if (r === 'confirmar_correo') {
        setBusy(false);
        switchTab('entrar');
        return toast('Cuenta creada', 'Te enviamos un correo para confirmarla. Después inicia sesión.', 'ok');
      }
      err = r;
    }
    setBusy(false);
    if (err) return toast(tab === 'crear' ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión', err, 'warn');
    done();
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
          Asigna conductores y buses a las rutas reales, por día o para toda la semana.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full bg-surface-card rounded-3xl shadow-level-2 border border-outline-variant/30 p-5 sm:p-6 flex flex-col gap-4"
      >
        {real && (
          <div role="tablist" aria-label="Cuenta" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            {([['entrar', 'Iniciar sesión'], ['crear', 'Crear cuenta']] as const).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => switchTab(t)}
                className={`min-h-[40px] rounded-xl text-label-lg transition-all ${tab === t ? 'bg-surface-card text-primary font-bold shadow-level-1' : 'text-on-surface-variant font-medium'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
          <legend className="sr-only">{tab === 'crear' ? 'Crear cuenta' : 'Iniciar sesión'}</legend>

          {real && tab === 'crear' && (
            <div>
              <label htmlFor="coord-name" className="text-label-sm text-on-surface-variant font-medium block mb-1">Nombre completo</label>
              <div className="relative flex items-center">
                <Icon name="person" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
                <input id="coord-name" autoComplete="name" className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="coord-email" className="text-label-sm text-on-surface-variant font-medium block mb-1">
              {real && tab === 'entrar' ? 'Correo o usuario' : 'Correo institucional'}
            </label>
            <div className="relative flex items-center">
              <Icon name="alternate_email" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                id="coord-email"
                type={real && tab === 'entrar' ? 'text' : 'email'}
                autoComplete="username"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="coord-password" className="text-label-sm text-on-surface-variant font-medium">Contraseña</label>
              {tab === 'entrar' && <span className="text-label-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Demo: {DEMO_PASSWORD}</span>}
            </div>
            <div className="relative flex items-center">
              <Icon name="lock" className="absolute left-3.5 text-on-surface-variant/60 text-[20px] pointer-events-none" />
              <input
                id="coord-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={tab === 'crear' ? 'new-password' : 'current-password'}
                minLength={tab === 'crear' ? 6 : undefined}
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
          disabled={busy || !email || !password || (real && tab === 'crear' && !fullName.trim())}
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary hover:opacity-95 active:scale-[0.985] text-label-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
        >
          <span>{busy ? 'Un momento…' : real && tab === 'crear' ? 'Crear cuenta' : 'Abrir planificador'}</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </button>

        {real && tab === 'entrar' && (
          <p className="text-center text-label-sm text-on-surface-variant">
            {isDemoAccount
              ? 'Cuenta de demo (datos de ejemplo). Escribe tu correo para entrar con la base real.'
              : 'Entrarás con tu cuenta real de Supabase.'}
          </p>
        )}
      </form>

      <footer className="w-full text-center py-3">
        <p className="text-label-sm text-on-surface-variant/80">
          {real ? 'Cuenta real de Supabase • Coordinación de Transporte' : 'Coordinación de Transporte • SAFER'}
        </p>
      </footer>
    </main>
  );
}
