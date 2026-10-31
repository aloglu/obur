// Hold an entry, then let go to select it or move to drag it to another meal (docs/ui.md, "Bulk actions"; owner's
// pick F, 2026-10-31, the same on desktop). Moving before the hold completes cancels it, so a swipe still scrolls.
// While lifted, a card follows the pointer, the meal under it is marked as the drop target, the page scrolls near
// the screen's top and bottom edges, and the page itself must not scroll (iOS needs a non-passive touchmove).
// The click that follows a hold or a drag is swallowed, so it doesn't also open the entry.

export const HOLD_MS = 450;
const SLOP_PX = 8;
const EDGE_PX = 80;
/** The phone's tab bar covers the bottom of the screen; the scroll zone starts above it. */
const BOTTOM_EDGE_PX = 120;

export interface HoldDragOptions {
	/** Released without moving: select this entry. */
	onselect: () => void;
	/** Lifted: the entries being dragged (this one, or the whole selection when it's part of it). */
	onlift: () => { label: string; count: number };
	/** Dropped on a meal (its `data-meal-drop` value), or on nothing (null). */
	ondrop: (meal: string | null) => void;
	enabled?: boolean;
}

export function holdDrag(node: HTMLElement, initial: HoldDragOptions) {
	let options = initial;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start = { x: 0, y: 0 };
	let swallowClick = false;
	let lifted: {
		ghost: HTMLElement;
		offset: { x: number; y: number };
		target: HTMLElement | null;
		last: { x: number; y: number };
		moved: boolean;
		frame: number;
		pointerId: number;
	} | null = null;

	const noScroll = (e: TouchEvent) => e.preventDefault();

	function cancelHold() {
		clearTimeout(timer);
		timer = undefined;
		node.removeAttribute('data-pressing');
	}

	function setTarget(target: HTMLElement | null) {
		if (!lifted || target === lifted.target) return;
		lifted.target?.removeAttribute('data-drop-target');
		target?.setAttribute('data-drop-target', 'true');
		lifted.target = target;
	}

	function place(x: number, y: number) {
		if (!lifted) return;
		const { ghost, offset } = lifted;
		ghost.style.transform = `translate(${x - offset.x}px, ${y - offset.y}px)`;
		const under = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-meal-drop]') ?? null;
		setTarget(under);
	}

	function edgeScroll() {
		if (!lifted) return;
		const { y } = lifted.last;
		const step = !lifted.moved
			? 0
			: y < EDGE_PX
				? -10
				: y > window.innerHeight - BOTTOM_EDGE_PX
					? 10
					: 0;
		if (step) {
			window.scrollBy(0, step);
			place(lifted.last.x, lifted.last.y);
		}
		lifted.frame = requestAnimationFrame(edgeScroll);
	}

	function lift(pointerId: number) {
		node.removeAttribute('data-pressing');
		const { label, count } = options.onlift();
		const box = node.getBoundingClientRect();
		const ghost = document.createElement('div');
		ghost.className = 'hold-drag-ghost';
		ghost.style.width = `${box.width}px`;
		const name = document.createElement('span');
		name.className = 'hold-drag-name';
		name.textContent = label;
		ghost.append(name);
		if (count > 1) {
			const badge = document.createElement('span');
			badge.className = 'hold-drag-count';
			badge.textContent = String(count);
			ghost.append(badge);
		}
		ghost.setAttribute('aria-hidden', 'true');
		document.body.append(ghost);
		lifted = {
			ghost,
			offset: { x: start.x - box.left, y: start.y - box.top },
			target: null,
			last: { ...start },
			moved: false,
			frame: 0,
			pointerId
		};
		try {
			node.setPointerCapture(pointerId);
		} catch {
			// The pointer may already be gone; the release then ends the drag.
		}
		node.addEventListener('touchmove', noScroll, { passive: false });
		navigator.vibrate?.(10);
		place(start.x, start.y);
		lifted.frame = requestAnimationFrame(edgeScroll);
	}

	function drop(released: boolean) {
		if (!lifted) return;
		const { ghost, target, moved, frame } = lifted;
		cancelAnimationFrame(frame);
		ghost.remove();
		target?.removeAttribute('data-drop-target');
		node.removeEventListener('touchmove', noScroll);
		lifted = null;
		swallowClick = true;
		setTimeout(() => (swallowClick = false), 700);
		if (!released) options.ondrop(null);
		else if (!moved) options.onselect();
		else options.ondrop(target?.dataset.mealDrop ?? null);
	}

	function onDown(e: PointerEvent) {
		if (options.enabled === false || e.button > 0 || e.ctrlKey || e.metaKey) return;
		start = { x: e.clientX, y: e.clientY };
		node.setAttribute('data-pressing', 'true');
		const pointerId = e.pointerId;
		timer = setTimeout(() => {
			timer = undefined;
			lift(pointerId);
		}, HOLD_MS);
	}

	function onMove(e: PointerEvent) {
		if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP_PX) cancelHold();
		if (!lifted) return;
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP_PX) lifted.moved = true;
		lifted.last = { x: e.clientX, y: e.clientY };
		place(e.clientX, e.clientY);
	}

	const onUp = () => (lifted ? drop(true) : cancelHold());
	const onCancel = () => (lifted ? drop(false) : cancelHold());
	function onClick(e: MouseEvent) {
		if (!swallowClick) return;
		swallowClick = false;
		e.stopPropagation();
		e.preventDefault();
	}
	// A touch hold would otherwise bring up the phone's own menu for the row.
	const onContextMenu = (e: Event) => {
		if (timer || lifted) e.preventDefault();
	};

	node.addEventListener('pointerdown', onDown);
	node.addEventListener('pointermove', onMove);
	node.addEventListener('pointerup', onUp);
	node.addEventListener('pointercancel', onCancel);
	node.addEventListener('click', onClick, true);
	node.addEventListener('contextmenu', onContextMenu);

	return {
		update(next: HoldDragOptions) {
			options = next;
		},
		destroy() {
			cancelHold();
			if (lifted) drop(false);
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('pointermove', onMove);
			node.removeEventListener('pointerup', onUp);
			node.removeEventListener('pointercancel', onCancel);
			node.removeEventListener('click', onClick, true);
			node.removeEventListener('contextmenu', onContextMenu);
		}
	};
}
