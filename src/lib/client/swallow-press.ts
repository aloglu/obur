// A press outside an open menu only closes it (docs/ui.md, "Choices"): the press itself and the rest of it (pointer
// moves and release, focus, click) must not reach what was under it, so closing a menu never presses a row, link,
// field or chart by accident. Every menu calls `swallowRestOfPress` from its outside pointerdown, a window capture
// listener, so the press stops before the page sees it. The guard outlives the menu, since the click comes after it
// closes. A press that turns into a scroll ends in pointercancel and has no click to stop.

let armed = false;
let pressing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let installed = false;

function block(event: Event) {
	if (!armed) return;
	event.preventDefault();
	event.stopPropagation();
	if (event.type === 'click') armed = false;
}

/** The moves and the release of the same press: the charts follow these, so they must not see them either. */
function blockPointer(event: Event) {
	if (!pressing) return;
	event.stopPropagation();
	if (event.type === 'pointerup') pressing = false;
}

function install() {
	if (installed) return;
	installed = true;
	window.addEventListener('mousedown', block, { capture: true });
	window.addEventListener('click', block, { capture: true });
	window.addEventListener('pointermove', blockPointer, { capture: true });
	window.addEventListener('pointerup', blockPointer, { capture: true });
	window.addEventListener(
		'pointercancel',
		() => {
			armed = false;
			pressing = false;
		},
		{ capture: true }
	);
}

export function swallowRestOfPress(press?: PointerEvent) {
	install();
	press?.stopPropagation();
	armed = true;
	pressing = true;
	clearTimeout(timer);
	timer = setTimeout(() => {
		armed = false;
		pressing = false;
	}, 800);
}
