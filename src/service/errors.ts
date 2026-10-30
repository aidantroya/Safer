/** Error de negocio con mensaje listo para mostrar al usuario. */
export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
