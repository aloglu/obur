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
/** A stand-in speech and OCR service (tests/e2e/speech-stub.ts). */
export const SPEECH_STUB = `http://127.0.0.1:${PORT + 1}`;
/** The same app with Speak and label scanning switched off, as an installation without those services runs. */
export const FEATURES_OFF = `http://localhost:${PORT + 2}`;

/** Environment for the app under test, also used by tests that call operator commands. */
export const e2eEnv = {
	E2E_DATABASE,
	DATABASE_URL: onE2e(process.env.DATABASE_URL),
	DATABASE_MIGRATOR_URL: onE2e(process.env.DATABASE_MIGRATOR_URL),
	PUBLIC_ORIGIN: `http://localhost:${PORT}`,
	SPEECH_URL: SPEECH_STUB,
	OCR_URL: SPEECH_STUB,
	WEBAUTHN_RP_ID: 'localhost',
	// A throwaway Web Push public key so the Reminders page is offered; no worker sends anything in tests.
	VAPID_PUBLIC_KEY:
		'BNEjlPiBGAifsDg7V17978UFsToCwYizckYHDAeSaN4VHKUPEcEUJrZeAkyW4A8u1dGgdwOHZxnE-iiBSp-0VXE'
};

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: false,
	webServer: [
		{
			command: 'node tests/e2e/speech-stub.ts',
			url: `${SPEECH_STUB}/health`,
			reuseExistingServer: false,
			env: { SPEECH_STUB_PORT: String(PORT + 1) }
		},
		{
			// The production server (server.js), so its headers are tested too.
			command: `node scripts/e2e-db.ts && npm run build && node server.js`,
			port: PORT,
			reuseExistingServer: false,
			timeout: 180_000,
			env: {
				...(process.env as Record<string, string>),
				...e2eEnv,
				PORT: String(PORT),
				HOST: '127.0.0.1'
			}
		},
		{
			// A second copy of the built server, started once the first is up (the build is shared).
			command: `node tests/e2e/when-up.ts http://127.0.0.1:${PORT}/ && node server.js`,
			port: PORT + 2,
			reuseExistingServer: false,
			timeout: 240_000,
			env: {
				...(process.env as Record<string, string>),
				...e2eEnv,
				SPEECH_URL: '',
				OCR_URL: '',
				PUBLIC_ORIGIN: FEATURES_OFF,
				PORT: String(PORT + 2),
				HOST: '127.0.0.1'
			}
		}
	],
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
			use: {
				...devices['Desktop Chrome'],
				// A fake microphone for Speak (WebKit in Playwright has none).
				launchOptions: {
					args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
				}
			}
		}
	]
});
