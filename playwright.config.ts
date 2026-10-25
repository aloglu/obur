import { defineConfig, devices } from '@playwright/test';

// Phone-size WebKit and desktop Chromium, per CLAUDE.md. Run with `npm run test:e2e` (Docker image with
// both browsers) so results do not depend on the host's system libraries.
export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	testDir: 'tests/e2e',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{ name: 'phone-webkit', use: { ...devices['iPhone 13'] } },
		{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }
	]
});
