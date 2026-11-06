// The confirmation after logging a typed entry: how many items, with one Undo for all of them.
import { m } from '#lib/paraglide/messages.js';
import type { LoggedEntry } from '#lib/shared/entry-types.ts';
import { api } from './api.ts';
import { showToast } from './toast.svelte.ts';

export function showLoggedEntry(logged: LoggedEntry, refresh: () => Promise<unknown>) {
	showToast({
		message:
			logged.count === 1
				? m.saved_logged_one()
				: m.saved_logged_many({ count: String(logged.count) }),
		detail: logged.skipped?.length
			? m.entry_skipped({ names: logged.skipped.join(', ') })
			: undefined,
		undo: async () => {
			for (const path of logged.undo) await api('POST', path, {});
			await refresh();
		}
	});
}
