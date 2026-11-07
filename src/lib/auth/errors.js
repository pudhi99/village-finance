/**
 * Authentication & Authorization Error Classes — Village Finance
 */
export class AuthError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
