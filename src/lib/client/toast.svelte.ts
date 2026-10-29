// One toast at a time (docs/ui.md, "Toast"): message, muted detail, optional Undo, 5 s, role="status".
export interface ToastMessage {
	id: number;
	message: string;
	detail?: string;
	undo?: () => void | Promise<void>;
}

const LIFETIME_MS = 5000;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export const toast = $state<{ current: ToastMessage | undefined }>({ current: undefined });

const CARRY_KEY = 'obur-toast';

export function showToast(message: Omit<ToastMessage, 'id'>): void {
	clearTimeout(timer);
	toast.current = { ...message, id: nextId++ };
	timer = setTimeout(dismissToast, LIFETIME_MS);
	// Carried over a full page load (an offline move can fall back to one), without its Undo action.
	try {
		sessionStorage.setItem(
			CARRY_KEY,
			JSON.stringify({ message: message.message, detail: message.detail, at: Date.now() })
		);
	} catch {
		// Storage unavailable: the toast simply does not survive a reload.
	}
}

/** Shows a toast that was cut short by a page load moments ago. */
export function restoreToast(): void {
	try {
		const raw = sessionStorage.getItem(CARRY_KEY);
		sessionStorage.removeItem(CARRY_KEY);
		if (!raw) return;
		const saved = JSON.parse(raw) as { message: string; detail?: string; at: number };
		if (Date.now() - saved.at < LIFETIME_MS && !toast.current)
			showToast({ message: saved.message, detail: saved.detail });
	} catch {
		// Nothing to restore.
	}
}

export function dismissToast(): void {
	clearTimeout(timer);
	toast.current = undefined;
	try {
		sessionStorage.removeItem(CARRY_KEY);
	} catch {
		// Storage unavailable.
	}
}
