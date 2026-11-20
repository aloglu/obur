import { describe, expect, it } from 'vitest';
import { nothingNew } from './page-data.ts';

const data = (...nodes: unknown[]) => JSON.stringify({ type: 'data', nodes });
const skip = { type: 'skip' };

describe('nothingNew', () => {
	it('answers a refresh of the shared parts with nothing changed', () => {
		expect(nothingNew('110')).toBe(data(skip, skip, skip));
		expect(nothingNew('10')).toBe(data(skip, skip));
	});

	it('has no answer when the page itself was asked for, or everything was', () => {
		expect(nothingNew('001')).toBeUndefined();
		expect(nothingNew('111')).toBeUndefined();
		expect(nothingNew(null)).toBeUndefined();
		expect(nothingNew('')).toBeUndefined();
	});
});
