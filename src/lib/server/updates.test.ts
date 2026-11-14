import { describe, expect, it } from 'vitest';
import { nextPage } from './updates.ts';

const first = 'https://api.github.com/repos/aloglu/obur/tags?per_page=100';

describe('nextPage', () => {
	it('follows GitHub’s next link on the same host', () => {
		const link =
			'<https://api.github.com/repositories/1/tags?per_page=100&page=2>; rel="next", <https://api.github.com/repositories/1/tags?per_page=100&page=3>; rel="last"';
		expect(nextPage(link, first)).toBe(
			'https://api.github.com/repositories/1/tags?per_page=100&page=2'
		);
	});

	it('stops on the last page, without a header, or for another host', () => {
		expect(nextPage('<https://api.github.com/x?page=1>; rel="prev"', first)).toBeNull();
		expect(nextPage(null, first)).toBeNull();
		expect(nextPage('<https://evil.example/tags?page=2>; rel="next"', first)).toBeNull();
	});
});
