import { DomainError } from '@/service/errors';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

/** Convierte excepciones del dominio en respuestas que la UI puede mostrar sin try/catch. */
export async function run<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message, code: e.code };
    console.error(e);
    return { ok: false, error: 'Ocurrió un error inesperado.', code: 'UNEXPECTED' };
  }
}
