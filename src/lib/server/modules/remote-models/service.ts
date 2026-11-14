// Remote models' data (docs/design.md, "Remote models for Speak and Scan"): each person's keys (encrypted), their
// choice per feature with the date they allowed it, this month's counts, and the admins' switch. Calls to the
// providers live in providers.ts; this module makes none.
import { and, eq, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import {
	FEATURES,
	type Feature,
	type KeySummary,
	type ModelChoices,
	type MonthUsage,
	type Provider,
	type Source
} from '../../../shared/remote-models.ts';
import { decryptKey, encryptKey } from './crypto.ts';
import { serverSettings, modelChoices, modelKeys, modelUsage } from './schema.ts';

export class ModelChoiceError extends Error {}

const monthOf = (d: Date) => `${d.toISOString().slice(0, 7)}-01`;

export function createRemoteModels(db: Database, secret: Buffer | null) {
	async function choicesIn(userId: string): Promise<ModelChoices> {
		const [row] = await withUser(db, userId, (tx) =>
			tx.select().from(modelChoices).where(eq(modelChoices.userId, userId))
		);
		return { speak: row?.speak ?? 'server', scan: row?.scan ?? 'server' };
	}

	return {
		/** Whether personal keys can work here at all: the server has its key, and an admin allows them. */
		async allowed(userId: string): Promise<boolean> {
			if (!secret) return false;
			const [row] = await withUser(db, userId, (tx) => tx.select().from(serverSettings));
			return row?.personalKeys ?? true;
		},

		/** The admins' switch as an admin sees it; RLS lets only an active admin change it. */
		async personalKeysAllowed(userId: string): Promise<boolean> {
			const [row] = await withUser(db, userId, (tx) => tx.select().from(serverSettings));
			return row?.personalKeys ?? true;
		},

		async setPersonalKeysAllowed(adminId: string, allow: boolean): Promise<boolean> {
			const rows = await withUser(db, adminId, (tx) =>
				tx
					.update(serverSettings)
					.set({ personalKeys: allow, updatedAt: new Date() })
					.returning({ personalKeys: serverSettings.personalKeys })
			);
			return rows.length === 1;
		},

		async keys(userId: string): Promise<KeySummary[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx.select().from(modelKeys).where(eq(modelKeys.userId, userId)).orderBy(modelKeys.provider)
			);
			return rows.map((r) => ({
				provider: r.provider,
				last4: r.last4,
				checkedAt: r.checkedAt.toISOString(),
				unreadable: !secret || decryptKey(secret, userId, r.ciphertext) === null
			}));
		},

		/** Stores a key the provider has just accepted, replacing any earlier one for that provider. */
		async saveKey(userId: string, provider: Provider, key: string, checkedAt = new Date()) {
			if (!secret) throw new ModelChoiceError('This server has no secrets key');
			const values = {
				ciphertext: encryptKey(secret, userId, key),
				last4: key.slice(-4),
				checkedAt
			};
			await withUser(db, userId, (tx) =>
				tx
					.insert(modelKeys)
					.values({ userId, provider, ...values })
					.onConflictDoUpdate({ target: [modelKeys.userId, modelKeys.provider], set: values })
			);
		},

		/** Removes a key; whatever used it goes back to the server. One transaction. */
		async removeKey(userId: string, provider: Provider): Promise<void> {
			await withUser(db, userId, async (tx) => {
				await tx
					.delete(modelKeys)
					.where(and(eq(modelKeys.userId, userId), eq(modelKeys.provider, provider)));
				for (const f of FEATURES) {
					await tx
						.update(modelChoices)
						.set({ [f]: 'server', updatedAt: new Date() })
						.where(and(eq(modelChoices.userId, userId), eq(modelChoices[f], provider)));
				}
			});
		},

		/** The key itself, only for a request to its provider; null when missing or unreadable here. */
		async keyFor(userId: string, provider: Provider): Promise<string | null> {
			if (!secret) return null;
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(modelKeys)
					.where(and(eq(modelKeys.userId, userId), eq(modelKeys.provider, provider)))
			);
			return row ? decryptKey(secret, userId, row.ciphertext) : null;
		},

		choices: choicesIn,

		/**
		 * Chooses what reads a feature. A provider needs the person's explicit agreement (`allowed`), a key for it and
		 * an admin's permission; the date is stored with the choice.
		 */
		async choose(
			userId: string,
			feature: Feature,
			source: Source,
			allowed: boolean
		): Promise<ModelChoices> {
			if (source !== 'server') {
				if (!allowed) throw new ModelChoiceError('A provider needs your agreement first');
				if (!(await this.allowed(userId))) throw new ModelChoiceError('Personal keys are off here');
				if (!(await this.keyFor(userId, source))) throw new ModelChoiceError('Add a key first');
			}
			const now = new Date();
			const set =
				feature === 'speak'
					? {
							speak: source,
							...(source !== 'server' ? { speakAllowedAt: now } : {}),
							updatedAt: now
						}
					: {
							scan: source,
							...(source !== 'server' ? { scanAllowedAt: now } : {}),
							updatedAt: now
						};
			await withUser(db, userId, (tx) =>
				tx
					.insert(modelChoices)
					.values({ userId, ...set })
					.onConflictDoUpdate({ target: modelChoices.userId, set })
			);
			return choicesIn(userId);
		},

		/** Counts one recording or photo sent with a key (never its content). */
		async countUse(userId: string, provider: Provider, feature: Feature, at = new Date()) {
			await withUser(db, userId, (tx) =>
				tx
					.insert(modelUsage)
					.values({ userId, month: monthOf(at), provider, feature, count: 1 })
					.onConflictDoUpdate({
						target: [modelUsage.userId, modelUsage.month, modelUsage.provider, modelUsage.feature],
						set: { count: sql`${modelUsage.count} + 1` }
					})
			);
		},

		async usage(userId: string, at = new Date()): Promise<MonthUsage> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(modelUsage)
					.where(and(eq(modelUsage.userId, userId), eq(modelUsage.month, monthOf(at))))
			);
			const out: MonthUsage = {};
			for (const r of rows) (out[r.provider] ??= {})[r.feature] = r.count;
			return out;
		}
	};
}

export type RemoteModels = ReturnType<typeof createRemoteModels>;
