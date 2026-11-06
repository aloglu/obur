// Keeps something being edited above the on-screen keyboard and the tab bar. A browser scrolls a field into view once,
// when it gets focus; a field in a card that is still opening then grows behind the keyboard, which also arrives late.

const MARGIN = 12;

/** How far the page must scroll so that `bottom` clears `limit`, without pushing `top` above `ceiling`. */
export function scrollNeeded(
	box: { top: number; bottom: number },
	limit: number,
	ceiling: number
): number {
	const over = box.bottom + MARGIN - limit;
	if (over <= 0) return 0;
	return Math.max(0, Math.min(over, box.top - ceiling - MARGIN));
}

/** The time a card takes to open (`.collapse-row`), plus a little. */
const SETTLE_MS = 500;

/** Starts watching `element`; returns the function that stops. */
export function keepInView(element: HTMLElement): () => void {
	const viewport = window.visualViewport;
	const check = () => {
		const top = viewport?.offsetTop ?? 0;
		const visibleBottom = top + (viewport?.height ?? window.innerHeight);
		const bar = document.querySelector('[data-tabbar]')?.getBoundingClientRect();
		const limit = bar?.height ? Math.min(visibleBottom, bar.top) : visibleBottom;
		const by = scrollNeeded(element.getBoundingClientRect(), limit, top);
		if (by > 0) window.scrollBy({ top: by, behavior: 'instant' });
	};

	let frame = 0;
	const start = performance.now();
	const settle = () => {
		check();
		if (performance.now() - start < SETTLE_MS) frame = requestAnimationFrame(settle);
	};
	settle();
	// The keyboard opening or closing changes the visible area.
	viewport?.addEventListener('resize', check);
	return () => {
		cancelAnimationFrame(frame);
		viewport?.removeEventListener('resize', check);
	};
}
