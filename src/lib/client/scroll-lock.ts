// Keeps the page behind an open sheet still. overflow: hidden isn't enough on iPhones, where a swipe on a sheet can still
// move the page, so the body is pinned in place and put back where it was. Counted, because one sheet can open another.
let holders = 0;
let scrollY = 0;

export function lockPageScroll(): () => void {
	if (holders++ === 0) {
		scrollY = window.scrollY;
		const { style } = document.body;
		document.documentElement.style.scrollbarGutter = 'stable';
		style.position = 'fixed';
		style.top = `-${scrollY}px`;
		style.left = style.right = '0';
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--holders > 0) return;
		const { style } = document.body;
		style.position = style.top = style.left = style.right = '';
		document.documentElement.style.scrollbarGutter = '';
		window.scrollTo({ top: scrollY, behavior: 'instant' });
	};
}
