// Arrow keys in a radio group (docs/ui.md "Choices"): one Tab stop for the group, and the arrows move between its
// options, as WAI-ARIA's radio group pattern asks (2026-11-23 Gemini audit 2, H22).

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const BACK = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Moves focus to the next or previous enabled option of the event's radio group, round the ends; Home and End go
 * to the first and last. `select`: the option is also chosen (clicked), as the pattern does; false where choosing
 * saves or opens a question, so only Space or Enter chooses.
 */
export function radioKeys(event: KeyboardEvent, select = true): void {
	const { key } = event;
	if (!NEXT.has(key) && !BACK.has(key) && key !== 'Home' && key !== 'End') return;
	const current = event.currentTarget as HTMLElement;
	const group = current.closest('[role="radiogroup"]');
	if (!group) return;
	const options = [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
		(o) => !(o as HTMLButtonElement).disabled && o.closest('[role="radiogroup"]') === group
	);
	if (!options.length) return;
	const at = options.indexOf(current);
	const to =
		key === 'Home'
			? 0
			: key === 'End'
				? options.length - 1
				: (at + (NEXT.has(key) ? 1 : -1) + options.length) % options.length;
	event.preventDefault();
	const target = options[to];
	target.focus();
	if (select && target.getAttribute('aria-checked') !== 'true') target.click();
}
