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

export function showToast(message: Omit<ToastMessage, 'id'>): void {
	clearTimeout(timer);
	toast.current = { ...message, id: nextId++ };
	timer = setTimeout(dismissToast, LIFETIME_MS);
}

export function dismissToast(): void {
	clearTimeout(timer);
	toast.current = undefined;
}
