import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToasts } from '../components/Toasts';
import { useSession } from '../session/SessionContext';
import { ThemeToggle } from '../theme/ThemeContext';

/** Pantalla de Bienvenida y Selección de Rol (SAFER Transit). */
export function LandingPage() {
  const { loginPassenger } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();

  const asPassenger = async () => {
    const err = await loginPassenger('diego@espol.edu.ec', 'demo1234');
    if (err) return toast('Error', err, 'warn');
    navigate('/pasajero');
  };

  return (
    <main className="min-h-screen max-w-md mx-auto px-margin py-8 flex flex-col justify-between gap-6 bg-surface-bg transition-colors duration-200">
      {/* Barra superior con selector de tema */}
      <div className="w-full flex justify-end">
        <ThemeToggle showLabel />
      </div>

      <div className="flex flex-col items-center text-center -mt-4">
        {/* Logo SAFER */}
        <div className="w-48 max-w-xs bg-white rounded-3xl p-3 shadow-level-1 border border-outline-variant/40 mb-4 flex items-center justify-center">
          <img src="/logo-safer.jpg" alt="SAFER Transit" className="w-full h-auto object-contain rounded-xl" />
        </div>
        <span className="text-label-md text-primary font-bold tracking-widest uppercase">
          Trazabilidad y Aforo en Tiempo Real
        </span>
        <h1 className="text-headline-lg text-on-surface font-extrabold mt-1 tracking-tight">
          Bienvenido a SAFER
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1.5 max-w-xs leading-relaxed">
          Selecciona tu rol para acceder a la plataforma institucional de transporte
        </p>
      </div>

      <div className="flex flex-col gap-3.5 w-full">
        <button
          type="button"
          onClick={asPassenger}
          className="bg-surface-card rounded-3xl p-5 shadow-level-1 flex items-center gap-4 text-left active:scale-[0.985] transition-all border border-outline-variant/40 hover:border-primary/50 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon name="person" className="text-[26px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-title-md font-bold text-on-surface group-hover:text-primary transition-colors">
              Entrar como pasajero
            </p>
            <p className="text-body-sm text-on-surface-variant truncate">
              Diego • diego@espol.edu.ec
            </p>
          </div>
          <Icon name="arrow_forward" className="text-on-surface-variant text-[22px] group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/conductor')}
          className="bg-surface-card rounded-3xl p-5 shadow-level-1 flex items-center gap-4 text-left active:scale-[0.985] transition-all border border-outline-variant/40 hover:border-primary/50 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon name="badge" className="text-[26px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-title-md font-bold text-on-surface group-hover:text-primary transition-colors">
              Entrar como conductor
            </p>
            <p className="text-body-sm text-on-surface-variant truncate">
              Carlos • carlos.mendoza@bustrack.edu
            </p>
          </div>
          <Icon name="arrow_forward" className="text-on-surface-variant text-[22px] group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/coordinador')}
          className="bg-surface-card rounded-3xl p-5 shadow-level-1 flex items-center gap-4 text-left active:scale-[0.985] transition-all border border-outline-variant/40 hover:border-primary/50 group"
        >
          <div className="w-13 h-13 rounded-2xl bg-surface-container text-primary flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon name="calendar_month" className="text-[26px]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-title-md font-bold text-on-surface group-hover:text-primary transition-colors">
              Entrar como coordinador
            </p>
            <p className="text-body-sm text-on-surface-variant truncate">
              Planifica conductores, buses y rutas
            </p>
          </div>
          <Icon name="arrow_forward" className="text-on-surface-variant text-[22px] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <footer className="text-center pt-2">
        <p className="text-label-sm text-on-surface-variant/80">
          Coordinación de Transporte • Turnos sincronizados en vivo
        </p>
      </footer>
    </main>
  );
}
