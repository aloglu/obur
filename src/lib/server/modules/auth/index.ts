// Public entry of the auth module (passkeys, invites, sessions, recovery). Other code imports only this file,
// as '#lib/server/modules/auth/index.ts'.
export { users } from './schema.ts';
export { AuthError, createAuthStore, type AuthErrorCode, type SessionRecord } from './store.ts';
export { createAuthService, type AuthConfig, type AuthService } from './service.ts';
export { POLICY as AUTH_POLICY } from './policy.ts';
export { RateLimiter } from './rate-limit.ts';
