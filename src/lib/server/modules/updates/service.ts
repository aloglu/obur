// Telling admins that a newer obur is published (docs/design.md, "Deployment, network and maintenance"). Off until
// an admin turns it on, because asking is the one thing obur does toward an outside service by itself: it fetches the
// public list of version tags (nothing about this installation is sent) at most once a day, and only while an admin
// is looking at a page that shows the answer. The answer lives in household_settings, which only admins may change.
import type { Database } from '../../db/index.ts';
import { withUser } from '../../db/identity.ts';
import { newerVersion } from '../../../shared/version.ts';
import { householdSettings } from '../remote-models/index.ts';

export interface UpdateStatus {
	/** The version running. */
	current: string;
	/** The admin's switch. */
	check: boolean;
	/** A published version newer than this one, when the switch is on and one is known. */
	latest: string | null;
	checkedAt: string | null;
}

const DAY_MS = 24 * 3600_000;
/** After a failed attempt (GitHub away, no internet), the next one waits: pages must not slow down for it. */
const RETRY_MS = 3600_000;

export interface UpdatesOptions {
	current: string;
	/** The published version tags, from outside. Throws when it cannot be reached. */
	published: () => Promise<string[]>;
	now?: () => Date;
}

export function createUpdates(db: Database, options: UpdatesOptions) {
	const now = options.now ?? (() => new Date());
	let lastFailure = 0;

	const read = async (userId: string) => {
		const [row] = await withUser(db, userId, (tx) => tx.select().from(householdSettings));
		return row;
	};
	const toStatus = (row: Awaited<ReturnType<typeof read>>): UpdateStatus => ({
		current: options.current,
		check: row?.updateCheck ?? false,
		latest:
			row?.updateCheck && row.latestVersion
				? newerVersion(options.current, [row.latestVersion])
				: null,
		checkedAt: row?.updateCheck ? (row.latestCheckedAt?.toISOString() ?? null) : null
	});

	/** Asks and stores the answer. A failure changes nothing and is tried again later. */
	async function ask(adminId: string): Promise<void> {
		let names: string[];
		try {
			names = await options.published();
		} catch (e) {
			lastFailure = now().getTime();
			console.error('updates: the published versions could not be read:', (e as Error).message);
			return;
		}
		lastFailure = 0;
		await withUser(db, adminId, (tx) =>
			tx.update(householdSettings).set({
				latestVersion: newerVersion(options.current, names),
				latestCheckedAt: now()
			})
		);
	}

	return {
		/** What an admin sees; asks first when the stored answer is over a day old. Others always get "off". */
		async status(userId: string, isAdmin: boolean): Promise<UpdateStatus> {
			if (!isAdmin)
				return { current: options.current, check: false, latest: null, checkedAt: null };
			let row = await read(userId);
			const t = now().getTime();
			const stale = !row?.latestCheckedAt || t - row.latestCheckedAt.getTime() > DAY_MS;
			if (row?.updateCheck && stale && t - lastFailure > RETRY_MS) {
				await ask(userId);
				row = await read(userId);
			}
			return toStatus(row);
		},

		/** Turns the check on (asking at once) or off (forgetting the answer). Null: not an admin. */
		async setCheck(adminId: string, on: boolean): Promise<UpdateStatus | null> {
			const rows = await withUser(db, adminId, (tx) =>
				tx
					.update(householdSettings)
					.set({ updateCheck: on, latestVersion: null, latestCheckedAt: null, updatedAt: now() })
					.returning({ on: householdSettings.updateCheck })
			);
			if (rows.length !== 1) return null;
			if (on) {
				lastFailure = 0;
				await ask(adminId);
			}
			return toStatus(await read(adminId));
		}
	};
}

export type Updates = ReturnType<typeof createUpdates>;
