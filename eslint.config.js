import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import moduleBoundaries from './eslint-rules/module-boundaries.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: ['src/**/*.{js,ts,svelte}'],
		plugins: { obur: { rules: { 'module-boundaries': moduleBoundaries } } },
		rules: { 'obur/module-boundaries': 'error' }
	},
	{
		// The worker and operator scripts run these files with Node's type stripping, which has no parameter
		// properties (`constructor(readonly code)`); write the field out instead.
		files: ['src/lib/server/**/*.ts', 'src/lib/shared/**/*.ts', 'scripts/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSParameterProperty',
					message:
						'Declare the field and assign it: Node type stripping has no parameter properties.'
				}
			]
		}
	}
);
