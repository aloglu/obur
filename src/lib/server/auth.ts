// The application's auth service instance (runtime role, configured origin and passkey domain).
import { createAuthService, createAuthStore } from '#lib/server/modules/auth/index.ts';
import { config } from './config.ts';
import { db } from './db/index.ts';

export const auth = createAuthService(createAuthStore(db), config);
export const SESSION_COOKIE = 'obur_session';
