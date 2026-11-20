import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { describeError } from './log.ts';

describe('describeError', () => {
	it('keeps the kind of error and its code, never the query or its values (2026-11-20 audit)', () => {
		const cause = Object.assign(new Error('value too long'), {
			name: 'PostgresError',
			code: '22001'
		});
		const failed = new DrizzleQueryError(
			'insert into day_notes (text) values ($1)',
			['Felt awful after the party'],
			cause
		);
		const text = describeError(failed);
		expect(text).toBe('DrizzleQueryError (PostgresError 22001)');
		expect(text).not.toContain('party');
		expect(describeError(new TypeError('x is undefined'))).toBe('TypeError');
		expect(describeError('a string')).toBe('string');
	});
});
