// Fields that open in place (Other amount, New weigh-in): only one at a time, and a tap on anything that isn't a control
// closes it without saving (docs/ui.md, "Inline fields").
export const inlineField = $state<{ open: string | null }>({ open: null });

const CONTROL = 'input, button, a, select, textarea, label, [role="button"], [role="switch"]';

/** Call from an effect on the page that shows such fields; returns the cleanup. */
export function closeInlineOnOutsideTap(): () => void {
	const onpointerdown = (event: PointerEvent) => {
		if (inlineField.open && !(event.target as Element).closest?.(CONTROL)) inlineField.open = null;
	};
	document.addEventListener('pointerdown', onpointerdown);
	return () => {
		document.removeEventListener('pointerdown', onpointerdown);
		inlineField.open = null;
	};
}
