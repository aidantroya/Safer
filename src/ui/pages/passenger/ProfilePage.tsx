import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { initials } from '../../lib/format';
import { useSession } from '../../session/SessionContext';

/** El diseño de Stitch no incluía esta pantalla: es un mínimo funcional para poder cerrar sesión. */
export function ProfilePage() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="px-margin pt-6 pb-28">
      <h1 className="text-headline-md text-text-main mb-4">Perfil</h1>
      <div className="bg-white rounded-3xl p-5 shadow-soft flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-headline-md">{initials(user.fullName)}</div>
        <div className="min-w-0">
          <p className="text-title-md font-bold text-text-main truncate">{user.fullName}</p>
          <p className="text-body-sm text-text-muted truncate">{user.email}</p>
          <p className="text-body-sm text-text-muted">ID {user.studentId} • {user.program}</p>
        </div>
      </div>
      <button type="button" onClick={() => { logout(); navigate('/'); }} className="mt-6 w-full min-h-[48px] rounded-full border border-outline-variant bg-white text-label-lg flex items-center justify-center gap-2 active:scale-[0.985]">
        <Icon name="logout" className="text-[20px]" /> Cerrar sesión
      </button>
    </div>
  );
}
