import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToasts } from '../components/Toasts';
import { useSession } from '../session/SessionContext';

/** Entrada de desarrollo (no viene de Stitch): elige con qué rol probar la demo. */
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
    <main className="min-h-screen max-w-md mx-auto px-margin flex flex-col justify-center gap-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto flex items-center justify-center text-white shadow-sm"><Icon name="directions_bus" fill className="text-[34px]" /></div>
        <h1 className="text-headline-lg text-text-main mt-4">BusTrack</h1>
        <p className="text-body-md text-text-muted mt-1">Trazabilidad y aforo de buses institucionales</p>
      </div>
      <button type="button" onClick={asPassenger} className="bg-white rounded-3xl p-5 shadow-soft flex items-center gap-4 text-left active:scale-[0.985] transition-transform border border-outline-variant/30">
        <div className="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center"><Icon name="person" fill /></div>
        <div className="flex-1"><p className="text-title-md font-bold">Entrar como pasajero</p><p className="text-body-sm text-text-muted">Diego • diego@espol.edu.ec</p></div>
        <Icon name="arrow_forward" className="text-outline" />
      </button>
      <button type="button" onClick={() => navigate('/conductor')} className="bg-white rounded-3xl p-5 shadow-soft flex items-center gap-4 text-left active:scale-[0.985] transition-transform border border-outline-variant/30">
        <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center"><Icon name="badge" fill /></div>
        <div className="flex-1"><p className="text-title-md font-bold">Entrar como conductor</p><p className="text-body-sm text-text-muted">Carlos • PIN 4821</p></div>
        <Icon name="arrow_forward" className="text-outline" />
      </button>
      <p className="text-label-sm text-text-muted text-center">Demo con datos simulados en memoria. Las dos vistas comparten el mismo bus mientras no recargues la pestaña.</p>
    </main>
  );
}
