import path from 'node:path';
import { RuleTester } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import rule from './module-boundaries.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
// RuleTester signals failure by throwing; the project requires an explicit assertion per test.
RuleTester.it = (name, run) => it(name, () => expect(run).not.toThrow());

const root = path.resolve(import.meta.dirname, '..');
const file = (rel) => path.join(root, rel);
const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });

tester.run('module-boundaries', rule, {
	valid: [
		{
			code: "import { x } from '$lib/server/modules/diary';",
			filename: file('src/routes/+page.server.ts')
		},
		{
			code: "import { x } from '#lib/server/modules/diary/index.ts';",
			filename: file('src/routes/+page.server.ts')
		},
		{
			code: "import { x } from './entries.ts';",
			filename: file('src/lib/server/modules/diary/index.ts')
		},
		{
			code: "import { x } from '../catalog';",
			filename: file('src/lib/server/modules/diary/service.ts')
		},
		{
			code: "import { x } from './numbers.ts';",
			filename: file('src/lib/server/modules/nl-parser/index.ts')
		},
		{
			code: "import { x } from '$lib/shared/units';",
			filename: file('src/lib/server/modules/nl-parser/index.ts')
		}
	],
	invalid: [
		{
			code: "import { x } from '$lib/server/modules/diary/entries';",
			filename: file('src/routes/+page.server.ts'),
			errors: [{ messageId: 'deepImport' }]
		},
		{
			code: "import { x } from '../catalog/repository.ts';",
			filename: file('src/lib/server/modules/diary/service.ts'),
			errors: [{ messageId: 'deepImport' }]
		},
		{
			code: "export * from '#lib/server/modules/auth/sessions';",
			filename: file('src/lib/server/modules/diary/index.ts'),
			errors: [{ messageId: 'deepImport' }]
		},
		{
			code: "import { sql } from 'drizzle-orm';",
			filename: file('src/lib/server/modules/label-parser/table.ts'),
			errors: [{ messageId: 'impure' }]
		},
		{
			code: "import { readFile } from 'node:fs/promises';",
			filename: file('src/lib/server/modules/nl-parser/index.ts'),
			errors: [{ messageId: 'impure' }]
		},
		{
			code: "import { db } from '$lib/server/db';",
			filename: file('src/lib/server/modules/nl-parser/index.ts'),
			errors: [{ messageId: 'pureServer' }]
		}
	]
});
