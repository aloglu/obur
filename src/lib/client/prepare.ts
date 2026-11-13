// Asks the service worker to prepare the pages likely to be opened next (shared/prepare.ts): the tabs, the open
// page's links, and anything marked with data-prepare. Again after every page change, after every save, when the
// app comes back to the foreground, and every 45 seconds while it is in view, so a tap finds data seconds old.
// A finger touching something marked data-prepare-touch prepares that at once (a food's details before its sheet).
import { PREPARED_FOR_MS, preparedRequest, toPrepare } from '#lib/shared/prepare.ts';

const KEEP_FRESH_MS = Math.round(PREPARED_FOR_MS * 0.75);

function send(urls: string[]) {
	const worker = navigator.serviceWorker?.controller;
	if (!worker || urls.length === 0) return;
	worker.postMessage({
		type: 'obur:prepare',
		urls: urls.map((u) => preparedRequest(u, location.origin))
	});
}

/** Prepares what the open page leads to. `tabs` are the main tabs' addresses. */
export function prepareFromPage(tabs: string[]) {
	const main = document.querySelector('main');
	send(
		toPrepare({
			tabs,
			links: [...(main?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])]
				.filter((a) => !a.hasAttribute('download') && a.dataset.sveltekitReload === undefined)
				.map((a) => a.getAttribute('href')!),
			marked: [...document.querySelectorAll<HTMLElement>('[data-prepare]')].map(
				(el) => el.dataset.prepare!
			),
			current: location.pathname + location.search,
			origin: location.origin
		})
	);
}

/** Drops everything prepared (the time zone changed: every day's page may differ). */
export function forgetPrepared() {
	navigator.serviceWorker?.controller?.postMessage({ type: 'obur:forget' });
}

/**
 * Starts preparing for this page and keeps it up; returns a function that stops it. `again` is called by the
 * layout after every page change.
 */
export function startPreparing(tabs: string[]): { again: () => void; stop: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;
	// After the page has drawn, so preparing never competes with what is on screen.
	const again = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (document.visibilityState !== 'visible') return;
			prepareFromPage(tabs);
			timer = setTimeout(again, KEEP_FRESH_MS);
		}, 300);
	};
	const visible = () => {
		if (document.visibilityState === 'visible') again();
	};
	const written = (event: MessageEvent) => {
		if (event.data?.type === 'obur:written') again();
	};
	const touched = (event: PointerEvent) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>('[data-prepare-touch]');
		if (target?.dataset.prepareTouch) send([target.dataset.prepareTouch]);
	};
	document.addEventListener('visibilitychange', visible);
	navigator.serviceWorker?.addEventListener('message', written);
	document.addEventListener('pointerdown', touched, { capture: true, passive: true });
	again();
	return {
		again,
		stop: () => {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', visible);
			navigator.serviceWorker?.removeEventListener('message', written);
			document.removeEventListener('pointerdown', touched, { capture: true });
		}
	};
}
