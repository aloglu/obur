import { describe, expect, it } from 'vitest';
import { noConnectionPage } from './no-connection-page.ts';

const en = {
	title: 'obur needs a connection',
	line: 'Check it.',
	retry: 'Try again',
	still: 'Still not.'
};
const tr = {
	title: 'obur için bağlantı gerekiyor',
	line: 'Kontrol et.',
	retry: 'Tekrar dene',
	still: 'Hâlâ yok.'
};

describe('noConnectionPage', () => {
	it('draws the default language and carries every language for the cookie to pick', () => {
		const html = noConnectionPage({ en, tr }, 'en', 'obur:reachable');
		expect(html).toContain('<title>obur needs a connection</title>');
		expect(html).toContain('<html lang="en">');
		expect(html).toContain('"tr":{"title":"obur için bağlantı gerekiyor"');
		expect(html).toContain("cookie('obur_lang')");
		expect(html).toContain('"obur:reachable"');
	});

	it('escapes text in the page and cannot end its script early', () => {
		const hostile = { ...en, title: '</script><b>x</b>', line: 'a & "b"' };
		const html = noConnectionPage({ en: hostile }, 'en', 'obur:reachable');
		expect(html).toContain('<title>&#60;/script&#62;&#60;b&#62;x&#60;/b&#62;</title>');
		expect(html).toContain('a &#38; &#34;b&#34;');
		// Only the page's own script element closes.
		expect(html.match(/<\/script>/g)).toHaveLength(1);
		expect(html).toContain('\\u003c/script>');
	});
});
