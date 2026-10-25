import { defineConfig, devices } from '@playwright/test';

// Phone-size WebKit and desktop Chromium, per CLAUDE.md. Run with `npm run test:e2e` (Docker image with
// both browsers) so results do not depend on the host's system libraries.
try {
	process.loadEnvFile('.env');
} catch {
	// CI provides the variables directly.
}

const E2E_DATABASE = 'obur_e2e';
const onE2e = (url = '') =>
	Object.assign(new URL(url), { pathname: `/${E2E_DATABASE}` }).toString();
const PORT = 4173;

/** Environment for the app under test, also used by tests that call operator commands. */
export const e2eEnv = {
	E2E_DATABASE,
	DATABASE_URL: onE2e(process.env.DATABASE_URL),
	DATABASE_MIGRATOR_URL: onE2e(process.env.DATABASE_MIGRATOR_URL),
	PUBLIC_ORIGIN: `http://localhost:${PORT}`,
	WEBAUTHN_RP_ID: 'localhost'
};

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: false,
	webServer: {
		command: `node scripts/e2e-db.ts && npm run build && npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: false,
		timeout: 180_000,
		env: { ...(process.env as Record<string, string>), ...e2eEnv }
	},
	use: { baseURL: `http://localhost:${PORT}` },
	projects: [
		// The passkey journey starts with first-admin setup, which needs an empty database, so it runs first.
		// Chromium only: WebKit has no supported virtual authenticator.
		{ name: 'auth-journey', testMatch: 'auth.e2e.ts', use: { ...devices['Desktop Chrome'] } },
		{
			name: 'phone-webkit',
			testIgnore: 'auth.e2e.ts',
			dependencies: ['auth-journey'],
			use: { ...devices['iPhone 13'] }
		},
		{
			name: 'desktop-chromium',
			testIgnore: 'auth.e2e.ts',
			dependencies: ['auth-journey'],
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
