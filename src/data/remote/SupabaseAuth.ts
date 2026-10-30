import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import type { User } from '@/domain/model';
import { DomainError } from '@/service/errors';
import { COORDINATOR_ROLE_IDS } from '../repository/SupabaseRepositories';

export interface RemoteSession {
  user: User;
  /** Roles que la base le reconoce (my_roles). Vacío si no se pudieron leer. */
  roles: string[];
  isCoordinator: boolean;
}

/** Login real con Supabase Auth para Coordinación (y, más adelante, estudiantes y conductores). */
export class SupabaseAuth {
  constructor(private sb: SupabaseClient) {}

  /** Acepta correo o identificador (se traduce con la función email_for_login de la base). */
  async signIn(identifier: string, password: string): Promise<RemoteSession> {
    let email = identifier.trim();
    if (!email.includes('@')) {
      const { data } = await this.sb.rpc('email_for_login', { identifier: email });
      if (typeof data === 'string' && data) email = data;
    }
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new DomainError('AUTH_INVALID', translate(error?.message));
    return this.toSession(data.user);
  }

  /** Crea la cuenta. Si el proyecto pide confirmar el correo, no hay sesión hasta confirmarlo. */
  async signUp(fullName: string, email: string, password: string): Promise<RemoteSession | 'confirmar_correo'> {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), name: fullName.trim().split(' ')[0] } },
    });
    if (error) throw new DomainError('SIGNUP', translate(error.message));
    if (!data.session || !data.user) return 'confirmar_correo';
    return this.toSession(data.user);
  }

  async restore(): Promise<RemoteSession | undefined> {
    const { data } = await this.sb.auth.getSession();
    return data.session ? this.toSession(data.session.user) : undefined;
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  private async toSession(au: AuthUser): Promise<RemoteSession> {
    const { data: profile } = await this.sb.from('profiles').select('full_name, name').eq('id', au.id).maybeSingle();
    const meta = au.user_metadata as { full_name?: string; name?: string };
    const fullName = profile?.full_name ?? meta.full_name ?? au.email ?? 'Coordinación';
    const roles = await this.myRoles();
    return {
      user: { id: au.id, name: profile?.name ?? meta.name ?? fullName.split(' ')[0], fullName, email: au.email ?? '', role: 'coordinator' },
      roles,
      isCoordinator: roles.some((r) => COORDINATOR_ROLE_IDS.includes(r)),
    };
  }

  /** my_roles puede devolver ['admin'] o [{ role_id: 'admin' }]: se normaliza a una lista de textos. */
  private async myRoles(): Promise<string[]> {
    const { data, error } = await this.sb.rpc('my_roles');
    if (error || data == null) return [];
    const flat = (Array.isArray(data) ? data : [data]).flatMap((x) =>
      typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).filter((v): v is string => typeof v === 'string') : [],
    );
    return [...new Set(flat.map((r) => r.toLowerCase()))];
  }
}

function translate(msg?: string): string {
  if (!msg) return 'No se pudo iniciar sesión.';
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar (revisa tu bandeja).';
  if (/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/domain|dominio/i.test(msg)) return 'Ese dominio de correo no está permitido para registrarse.';
  return msg;
}
