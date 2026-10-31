// Achievements waiting to be celebrated (docs/ui.md, "Achievements, Journal and Help"): the most notable gets a toast;
// tapping it opens the full-screen celebration. Whatever was offered is then marked seen, so it is celebrated once,
// and the others that arrived with it are kept quietly.
import { achievementKey, type Achievement } from '#lib/shared/achievements.ts';

/** How long the toast stays before it is taken as seen. */
const TOAST_MS = 8000;
const RANK: Record<Achievement['kind'], number> = { goal: 4, weight: 3, streak: 2, first: 1 };

export const celebration = $state<{ toast: Achievement | null; open: Achievement | null }>({
	toast: null,
	open: null
});

// Bookkeeping only, never rendered, so not reactive.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const offered = new Set<string>();
let pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function markSeen() {
	const keys = pending;
	pending = [];
	if (!keys.length) return;
	fetch('/api/v1/achievements/seen', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ keys })
	}).catch(() => {
		// Offline: they stay unseen on the server and are offered again next time.
		for (const k of keys) offered.delete(k);
	});
}

/** New achievements from the server; ones already offered on this page are ignored. */
export function offer(list: Achievement[]) {
	const fresh = list.filter((a) => !offered.has(achievementKey(a)));
	if (!fresh.length || celebration.open) return;
	for (const a of fresh) offered.add(achievementKey(a));
	pending.push(...fresh.map(achievementKey));
	const best = [...fresh, ...(celebration.toast ? [celebration.toast] : [])].sort(
		(a, b) => RANK[b.kind] - RANK[a.kind] || Number(b.level) - Number(a.level)
	)[0];
	celebration.toast = best;
	clearTimeout(timer);
	timer = setTimeout(dismissToast, TOAST_MS);
}

export function dismissToast() {
	clearTimeout(timer);
	celebration.toast = null;
	markSeen();
}

export function openCelebration() {
	clearTimeout(timer);
	celebration.open = celebration.toast;
	celebration.toast = null;
}

export function closeCelebration() {
	celebration.open = null;
	markSeen();
}
