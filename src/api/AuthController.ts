import type { User } from '@/domain/model';
import type { AuthService } from '@/service/AuthService';
import { run, type ApiResult } from './ApiResult';

export class AuthController {
  constructor(private auth: AuthService) {}
  loginPassenger(email: string, password: string): Promise<ApiResult<User>> {
    return run(() => this.auth.login(email, password, 'passenger'));
  }
  loginDriver(email: string, pin: string): Promise<ApiResult<User>> {
    return run(() => this.auth.login(email, pin, 'driver'));
  }
  getUser(id: string): Promise<User | undefined> {
    return this.auth.getUser(id);
  }
}
