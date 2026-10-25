import { defineConfig } from 'drizzle-kit';

// Used only to generate SQL migrations from the module schemas (`npm run db:generate`).
// Migrations are applied by our own runner (`npm run db:migrate`), never by drizzle-kit.
export default defineConfig({
	schema: './src/lib/server/modules/*/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	verbose: true,
	strict: true
});
