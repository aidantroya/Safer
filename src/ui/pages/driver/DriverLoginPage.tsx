import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { app } from '@/api';
import type { Bus, Route } from '@/domain/model';
import { Icon } from '../../components/Icon';
import { useToasts } from '../../components/Toasts';
import { haptic } from '../../lib/haptics';
import { TRIP_KEY, useSession } from '../../session/SessionContext';

/** Pantalla "Inicio de sesión y configuración de ruta (conductor)". PIN de demo: 4821. */
export function DriverLoginPage() {
  const { loginDriver } = useSession();
  const { toast } = useToasts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('carlos.mendoza@bustrack.edu');
  const [pin, setPin] = useState(['4', '8', '2', '']);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busId, setBusId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    void app.driver.getSetupOptions().then((r) => {
      if (!r.ok) return;
      setBuses(r.data.buses);
      setRoutes(r.data.routes);
      setBusId(r.data.buses.find((b) => b.online)?.id ?? '');
      setRouteId(r.data.routes[0]?.id ?? '');
    });
    refs.current[3]?.focus();
  }, []);

  const bus = buses.find((b) => b.id === busId);
  const route = routes.find((r) => r.id === routeId);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[i] = d;
    setPin(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const submit = async () => {
    setBusy(true);
    haptic.medium();
    const login = await loginDriver(email, pin.join(''));
    if (!login.user) {
      setBusy(false);
      return toast('No pudimos iniciar sesión', login.error, 'warn');
    }
    const res = await app.driver.startTrip(login.user, busId, routeId);
    setBusy(false);
    if (!res.ok) return toast('No se pudo iniciar el viaje', res.error, 'warn');
    sessionStorage.setItem(TRIP_KEY, res.data.id);
    haptic.success();
    navigate('/conductor/panel');
  };

  const field = 'w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-outline-variant bg-[#F8F9FA] text-on-surface text-body-md focus:bg-surface-card focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors';

  return (
    <main className="w-full max-w-md mx-auto min-h-screen bg-[#F8F9FA] flex flex-col justify-between px-space-md py-space-sm sm:px-margin sm:py-space-md">
      <header className="w-full flex flex-col items-center">
        <div className="flex flex-col items-center text-center mt-space-lg mb-space-md">
          <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm mb-space-sm"><Icon name="directions_bus" fill className="text-[30px]" /></div>
          <span className="text-label-lg text-primary-container tracking-wide font-bold">BusTrack Conductor</span>
          <h1 className="text-headline-md text-on-surface mt-1 tracking-tight">Bienvenido, Conductor</h1>
          <p className="text-body-md text-text-muted mt-1 px-space-md leading-relaxed max-w-xs">Inicia sesión y selecciona tu unidad operativa para el turno de hoy</p>
        </div>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="w-full bg-surface-card rounded-3xl shadow-soft p-space-md sm:p-space-lg flex flex-col gap-space-md">
        <fieldset className="flex flex-col gap-space-sm border-0 p-0 m-0">
          <legend className="text-label-lg text-on-surface font-semibold mb-1 flex items-center gap-1.5"><Icon name="badge" className="text-[18px] text-primary" />Credenciales de turno</legend>
          <label htmlFor="conductor-email" className="text-label-sm text-text-muted font-medium">Usuario o correo institucional</label>
          <div className="relative flex items-center">
            <Icon name="alternate_email" className="absolute left-3.5 text-outline-variant text-[20px] pointer-events-none" />
            <input id="conductor-email" type="email" autoComplete="username" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="carlos.mendoza@bustrack.edu" />
          </div>
          <div className="pt-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-label-sm text-text-muted font-medium">PIN rápido de turno</span>
              <span className="text-label-sm text-text-muted">Demo: 4821</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {pin.map((d, i) => (
                <input
                  key={i} ref={(el) => { refs.current[i] = el; }} type="password" inputMode="numeric" maxLength={1} aria-label={`Dígito ${i + 1} del PIN`} value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Backspace' && !pin[i] && i > 0) refs.current[i - 1]?.focus(); }}
                  placeholder="•"
                  className="h-12 text-center text-headline-sm font-bold bg-[#F8F9FA] border border-outline-variant rounded-xl text-on-surface focus:bg-surface-card focus:border-2 focus:border-primary outline-none transition-all shadow-inner"
                />
              ))}
            </div>
          </div>
        </fieldset>

        <div className="w-full h-px bg-surface-container-high my-1" />

        <fieldset className="flex flex-col gap-space-sm border-0 p-0 m-0">
          <legend className="text-label-lg text-on-surface font-semibold mb-1 flex items-center gap-1.5"><Icon name="tune" className="text-[18px] text-primary" />Asignación y despacho</legend>

          <span className="text-label-sm text-text-muted font-medium">Unidad asignada</span>
          <label className="relative w-full flex items-center justify-between p-3 rounded-2xl border border-outline-variant bg-[#F8F9FA] hover:bg-surface-container-low transition-colors cursor-pointer focus-within:border-primary">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0"><Icon name="directions_bus" className="text-[20px]" /></div>
              <div className="truncate">
                <div className="text-label-lg text-on-surface font-bold leading-tight truncate">{bus ? `Bus #${bus.number} • Placa ${bus.plate}` : 'Elige una unidad'}</div>
                {bus && <div className={`text-label-sm font-medium flex items-center gap-1 mt-0.5 ${bus.online ? 'text-secondary' : 'text-alert-coral'}`}><span className={`w-1.5 h-1.5 rounded-full ${bus.online ? 'bg-secondary' : 'bg-alert-coral'}`} />{bus.capacity} asientos • {bus.online ? 'En línea' : 'Fuera de línea'}</div>}
              </div>
            </div>
            <Icon name="expand_more" className="text-outline text-[22px] shrink-0 ml-2" />
            <select aria-label="Unidad asignada" className="absolute inset-0 opacity-0 cursor-pointer" value={busId} onChange={(e) => setBusId(e.target.value)}>
              {buses.map((b) => <option key={b.id} value={b.id}>Bus #{b.number} • {b.plate}{b.online ? '' : ' (fuera de línea)'}</option>)}
            </select>
          </label>

          <span className="text-label-sm text-text-muted font-medium mt-1">Ruta del día</span>
          <label className="relative w-full flex items-center justify-between p-3 rounded-2xl border border-outline-variant bg-[#F8F9FA] hover:bg-surface-container-low transition-colors cursor-pointer focus-within:border-primary">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0"><Icon name="route" className="text-[20px]" /></div>
              <div className="truncate">
                <div className="text-label-lg text-on-surface font-bold leading-tight truncate">{route?.name ?? 'Elige una ruta'}</div>
                {route && <div className="text-label-sm text-text-muted mt-0.5">{route.stops.length} paradas • Frecuencia {route.frequencyMin} min</div>}
              </div>
            </div>
            <Icon name="expand_more" className="text-outline text-[22px] shrink-0 ml-2" />
            <select aria-label="Ruta del día" className="absolute inset-0 opacity-0 cursor-pointer" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </fieldset>

        <div className="bg-surface-container-low rounded-2xl p-2.5 px-3 flex items-center justify-between border border-secondary-container">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary" /></span>
            <span className="text-label-sm text-on-secondary-container font-semibold tracking-tight">GPS simulado • Validador QR listo</span>
          </div>
          <Icon name="check_circle" fill className="text-secondary text-[18px]" />
        </div>

        <button type="submit" disabled={busy || pin.some((d) => !d) || !busId} className="w-full py-3.5 px-space-md rounded-2xl bg-primary-container hover:bg-primary active:scale-[0.985] text-on-primary text-label-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50">
          <span>{busy ? 'Ingresando…' : 'Ingresar y preparar ruta'}</span><Icon name="arrow_forward" className="text-[20px]" />
        </button>
      </form>

      <footer className="w-full text-center py-space-sm px-space-md">
        <p className="text-label-sm text-text-muted flex items-center justify-center gap-1.5 leading-normal">
          <Icon name="lock" className="text-[16px] text-outline" />
          <span>PIN institucional sincronizado con la central operativa de transporte.</span>
        </p>
      </footer>
    </main>
  );
}
