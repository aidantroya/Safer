import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const passengerItems: NavItem[] = [
  { to: '/pasajero', label: 'En vivo', icon: 'map', end: true },
  { to: '/pasajero/rutas', label: 'Rutas', icon: 'alt_route' },
  { to: '/pasajero/escanear', label: 'Escanear', icon: 'qr_code_scanner' },
  { to: '/pasajero/alertas', label: 'Alertas', icon: 'notifications_active' },
  { to: '/pasajero/perfil', label: 'Perfil', icon: 'person' },
];

export const driverNavItems: NavItem[] = [
  { to: '/conductor/panel', label: 'Mi viaje', icon: 'directions_bus' },
  { to: '/conductor/perfil', label: 'Perfil', icon: 'person' },
];

export function BottomNav({ items = passengerItems }: { items?: NavItem[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 mx-auto max-w-md z-50 flex justify-around items-center px-2 py-2 bg-surface-card border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] transition-colors duration-200"
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center rounded-2xl py-1 px-2 min-w-[60px] min-h-[44px] active:scale-[0.985] transition-all duration-150 ${
              isActive
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-low font-medium'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={it.icon} fill={isActive} className="text-[22px]" />
              <span className="text-label-sm mt-0.5 whitespace-nowrap">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
