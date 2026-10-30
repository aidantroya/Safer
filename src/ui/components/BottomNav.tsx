import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const items = [
  { to: '/pasajero', label: 'Rutas', icon: 'map', end: true },
  { to: '/pasajero/pase', label: 'Pase QR', icon: 'qr_code_2' },
  { to: '/pasajero/alertas', label: 'Alertas', icon: 'notifications_active' },
  { to: '/pasajero/perfil', label: 'Perfil', icon: 'person' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 mx-auto max-w-md z-50 flex justify-around items-center px-margin py-2 bg-surface-card border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] transition-colors duration-200"
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center rounded-2xl py-1 px-3 min-w-[64px] min-h-[44px] active:scale-[0.985] transition-all duration-150 ${
              isActive
                ? 'bg-primary text-white font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-low font-medium'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={it.icon} fill={isActive} className="text-[22px]" />
              <span className="text-label-sm mt-0.5">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
