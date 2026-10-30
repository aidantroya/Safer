import type { User } from '@/domain/model';
import type { IUserRepository } from '@/domain/repository';
import { DomainError } from './errors';

export class AuthService {
  constructor(private users: IUserRepository) {}

  /** Demo: contraseña/PIN en texto plano. En producción esto lo reemplaza Supabase Auth. */
  async login(email: string, secret: string, expectedRole: User['role']): Promise<User> {
    const user = await this.users.findByCredentials(email, secret);
    if (!user || user.role !== expectedRole) {
      throw new DomainError('AUTH_INVALID', 'Correo o clave incorrectos.');
    }
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.findById(id);
  }
}
