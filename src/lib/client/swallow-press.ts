// A press outside an open menu only closes it (docs/ui.md, "Choices"): the rest of that press (focus, click) must not
// reach what was under it, so closing a menu never presses a row, link or field by accident. Every menu calls
// `swallowRestOfPress` from its outside pointerdown. The guard outlives the menu, since the click comes after it
// closes. A press that turns into a scroll ends in pointercancel and has no click to stop.

let armed = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let installed = false;

function block(event: Event) {
	if (!armed) return;
	event.preventDefault();
	event.stopPropagation();
	if (event.type === 'click') armed = false;
}

function install() {
	if (installed) return;
	installed = true;
	window.addEventListener('mousedown', block, { capture: true });
	window.addEventListener('click', block, { capture: true });
	window.addEventListener('pointercancel', () => (armed = false), { capture: true });
}

export function swallowRestOfPress() {
	install();
	armed = true;
	clearTimeout(timer);
	timer = setTimeout(() => (armed = false), 800);
}
