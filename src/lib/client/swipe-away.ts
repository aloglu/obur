// A toast can be swiped away, like a phone's own notifications (docs/ui.md, "Toast"; owner, 2026-11-21): sideways
// or down, it follows the finger; let go past half its width (or height, going down), or with a quick flick, and it
// slides off; otherwise it goes back. While a finger is on it, its timer stops (`onhold` / `onrelease`). Touch and
// pen only: a mouse has no swipe, and a computer's screen has room to wait. The click that ends a swipe is swallowed,
// so an achievement toast doesn't also open. With reduced motion it still follows the finger, but it doesn't slide.

const SLOP_PX = 8;
const FLICK_PX_PER_MS = 0.6;
const SLIDE_MS = 180;

export interface SwipeAwayOptions {
	ondismiss: () => void;
	onhold?: () => void;
	onrelease?: () => void;
}

export function swipeAway(node: HTMLElement, initial: SwipeAwayOptions) {
	let options = initial;
	let press: { id: number; x: number; y: number; at: number } | null = null;
	let axis: 'x' | 'y' | null = null;
	let offset = 0;
	let last = { offset: 0, at: 0, speed: 0 };
	let swallowClick = false;
	// The slide's last step, cleared when the element goes: run after it, it dismissed the next toast instead
	// (2026-11-25 Review.md audit, 2.8).
	let after: ReturnType<typeof setTimeout> | undefined;
	node.style.touchAction = 'none';

	const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function show(distance: number, animate: boolean) {
		const s = node.style;
		s.transition =
			animate && !reduced() ? `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease` : '';
		s.transform = axis === 'y' ? `translateY(${distance}px)` : `translateX(${distance}px)`;
		const size = axis === 'y' ? node.offsetHeight : node.offsetWidth;
		s.opacity = String(Math.max(0, 1 - Math.abs(distance) / (size * 1.5)));
	}

	function reset() {
		node.style.transition = '';
		node.style.transform = '';
		node.style.opacity = '';
	}

	function down(e: PointerEvent) {
		// A swipe whose click never came must not eat the next tap.
		swallowClick = false;
		if (e.pointerType === 'mouse' || press) return;
		press = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp };
		axis = null;
		offset = 0;
		last = { offset: 0, at: e.timeStamp, speed: 0 };
		options.onhold?.();
	}

	function move(e: PointerEvent) {
		if (!press || e.pointerId !== press.id) return;
		const dx = e.clientX - press.x;
		const dy = e.clientY - press.y;
		if (!axis) {
			if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP_PX) return;
			axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
			try {
				node.setPointerCapture(e.pointerId);
			} catch {
				// The pointer is already gone: the swipe still follows the moves that come.
			}
		}
		// Down only: the toast sits at the bottom, and up would carry it over the page.
		offset = axis === 'x' ? dx : Math.max(0, dy);
		const elapsed = e.timeStamp - last.at;
		if (elapsed > 0) last = { offset, at: e.timeStamp, speed: (offset - last.offset) / elapsed };
		show(offset, false);
	}

	function up(e: PointerEvent) {
		if (!press || e.pointerId !== press.id) return;
		press = null;
		if (!axis) {
			options.onrelease?.();
			return;
		}
		swallowClick = true;
		const size = axis === 'y' ? node.offsetHeight : node.offsetWidth;
		const flick =
			Math.abs(last.speed) > FLICK_PX_PER_MS && Math.sign(last.speed) === Math.sign(offset);
		if (e.type === 'pointerup' && offset !== 0 && (Math.abs(offset) > size / 2 || flick)) {
			const away = Math.sign(offset) * (axis === 'y' ? size + 40 : window.innerWidth);
			if (reduced()) options.ondismiss();
			else {
				show(away, true);
				after = setTimeout(() => options.ondismiss(), SLIDE_MS);
			}
			return;
		}
		show(0, true);
		after = setTimeout(reset, SLIDE_MS);
		options.onrelease?.();
	}

	function click(e: MouseEvent) {
		if (!swallowClick) return;
		swallowClick = false;
		e.preventDefault();
		e.stopPropagation();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	node.addEventListener('click', click, { capture: true });
	return {
		update(next: SwipeAwayOptions) {
			options = next;
		},
		destroy() {
			clearTimeout(after);
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('click', click, { capture: true });
		}
	};
}
