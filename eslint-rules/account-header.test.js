import { RuleTester } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import rule from './account-header.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
// RuleTester signals failure by throwing; the project requires an explicit assertion per test.
RuleTester.it = (name, run) => it(name, () => expect(run).not.toThrow());

const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });

tester.run('account-header', rule, {
	valid: [
		"fetch('/api/v1/export', { method: 'POST', headers: { 'content-type': 'x', ...accountHeaders() } });",
		"fetch('/api/v1/queue', { method: 'POST', headers: { ...accountHeaders(owner) } });",
		"fetch('/_app/version.json', { cache: 'no-store' });",
		"fetch('/api/v1/foods', { method: 'GET' });",
		'fetch(request);'
	],
	invalid: [
		{
			code: "fetch('/api/v1/speech', { method: 'POST', headers: { 'content-type': 'audio/mp4' }, body });",
			errors: [{ messageId: 'missing' }]
		},
		{ code: "fetch('/api/v1/x', { method: 'DELETE' });", errors: [{ messageId: 'missing' }] },
		{
			code: "fetch('/api/v1/x', { method, headers: { ...other() } });",
			errors: [{ messageId: 'missing' }]
		}
	]
});
