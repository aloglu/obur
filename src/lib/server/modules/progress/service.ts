// Achievements (docs/design.md, "Progress, graphs and optional encouragement"): worked out from the person's records
// by shared/achievements.ts and kept in step with them in the `achievements` table, which remembers what was
// celebrated. One reached in the last few days waits to be celebrated; older ones (an import, a backfilled weigh-in,
// the history before achievements existed) arrive quietly with their real dates.
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import {
	achievementKey,
	achievements as derive,
	startWeight,
	type Achievement,
	type First
} from '../../../shared/achievements.ts';
import { addDays } from '../../../shared/diary-rules.ts';
import { targetsAllowed } from '../../../shared/goals.ts';
import { weightEntries } from '../body/index.ts';
import { foods, recipes } from '../catalog/index.ts';
import { dayCompletions } from '../diary/index.ts';
import { goalVersions, profiles } from '../goals/index.ts';
import { achievements } from './schema.ts';

/** Reached this many days before today or more recently: celebrated; earlier: quiet. */
export const CELEBRATE_DAYS = 2;

export type StoredAchievement = Achievement & { seen: boolean };

const levelText = (a: Pick<Achievement, 'level'>) => String(a.level);
const parse = (row: typeof achievements.$inferSelect): StoredAchievement =>
	({
		kind: row.kind,
		level: row.kind === 'first' ? row.level : Number(row.level),
		date: row.achievedOn,
		seen: row.seenAt !== null
	}) as StoredAchievement;

export function createProgress(db: Database) {
	return {
		/**
		 * Brings the stored achievements in step with the records and returns them all, oldest first. `zone` turns the
		 * moment a scan or recipe was saved into the person's day.
		 */
		async sync(userId: string, today: string, zone: string): Promise<StoredAchievement[]> {
			return withUser(db, userId, async (tx) => {
				const [readings, completed, goals, [profile], [scan], [recipe], stored] = await Promise.all(
					[
						tx
							.select({ localDate: weightEntries.localDate, value: weightEntries.kg })
							.from(weightEntries)
							.where(and(eq(weightEntries.userId, userId), isNull(weightEntries.deletedAt)))
							.orderBy(asc(weightEntries.localDate), asc(weightEntries.createdAt)),
						tx
							.select({ localDate: dayCompletions.localDate })
							.from(dayCompletions)
							.where(eq(dayCompletions.userId, userId)),
						tx
							.select({
								effectiveFrom: goalVersions.effectiveFrom,
								createdAt: goalVersions.createdAt,
								goalWeightKg: goalVersions.goalWeightKg,
								mode: goalVersions.mode,
								deficitKcal: goalVersions.deficitKcal
							})
							.from(goalVersions)
							.where(eq(goalVersions.userId, userId)),
						tx.select().from(profiles).where(eq(profiles.userId, userId)),
						tx
							.select({
								scan: sql<string | null>`min((${foods.createdAt} at time zone ${zone})::date)::text`
							})
							.from(foods)
							.where(and(eq(foods.ownerId, userId), eq(foods.origin, 'label_scan'))),
						tx
							.select({
								recipe: sql<
									string | null
								>`min((${foods.createdAt} at time zone ${zone})::date)::text`
							})
							.from(recipes)
							.innerJoin(foods, eq(foods.id, recipes.foodId))
							.where(eq(recipes.ownerId, userId)),
						tx.select().from(achievements).where(eq(achievements.userId, userId))
					]
				);

				// Weight celebrations: an adult who is neither pregnant nor breastfeeding, losing toward a goal below
				// the starting weight (or, without a goal weight, with a deficit). Off otherwise.
				const start = startWeight(readings);
				const latest = goals
					.slice()
					.sort((a, b) =>
						a.effectiveFrom === b.effectiveFrom
							? a.createdAt.getTime() - b.createdAt.getTime()
							: a.effectiveFrom < b.effectiveFrom
								? -1
								: 1
					)
					.at(-1);
				const losing =
					latest !== undefined &&
					latest.mode !== 'none' &&
					(latest.goalWeightKg !== null
						? start !== null && latest.goalWeightKg < start
						: latest.deficitKcal > 0);
				const birthDate = profile?.birthDate ?? null;
				const weightAllowed =
					losing &&
					birthDate !== null &&
					targetsAllowed(
						{ birthDate, pregnant: profile!.pregnant, breastfeeding: profile!.breastfeeding },
						today
					);

				const voice = stored.find((r) => r.kind === 'first' && r.level === 'voice');
				const derived = derive({
					readings,
					goals: goals.map((g) => ({
						effectiveFrom: g.effectiveFrom,
						createdAt: g.createdAt.toISOString(),
						goalWeightKg: g.goalWeightKg
					})),
					completed: completed.map((c) => c.localDate),
					firsts: {
						...(scan?.scan ? { scan: scan.scan } : {}),
						...(recipe?.recipe ? { recipe: recipe.recipe } : {}),
						...(voice ? { voice: voice.achievedOn } : {})
					},
					weightAllowed
				});

				const want = new Map(derived.map((a) => [achievementKey(a), a]));
				const have = new Map(stored.map((r) => [`${r.kind}:${r.level}`, r]));
				const gone = stored.filter((r) => !want.has(`${r.kind}:${r.level}`));
				for (const r of gone) {
					await tx
						.delete(achievements)
						.where(
							and(
								eq(achievements.userId, userId),
								eq(achievements.kind, r.kind),
								eq(achievements.level, r.level)
							)
						);
				}
				const quietBefore = addDays(today, -CELEBRATE_DAYS);
				const fresh = derived.filter((a) => !have.has(achievementKey(a)));
				if (fresh.length) {
					await tx
						.insert(achievements)
						.values(
							fresh.map((a) => ({
								userId,
								kind: a.kind,
								level: levelText(a),
								achievedOn: a.date,
								seenAt: a.date < quietBefore ? new Date() : null
							}))
						)
						.onConflictDoNothing();
				}
				for (const a of derived) {
					const row = have.get(achievementKey(a));
					if (row && row.achievedOn !== a.date) {
						await tx
							.update(achievements)
							.set({ achievedOn: a.date })
							.where(
								and(
									eq(achievements.userId, userId),
									eq(achievements.kind, a.kind),
									eq(achievements.level, levelText(a))
								)
							);
					}
				}
				const rows = await tx
					.select()
					.from(achievements)
					.where(eq(achievements.userId, userId))
					.orderBy(asc(achievements.achievedOn));
				return rows.map(parse);
			});
		},

		/** Celebrated, dismissed or shown: these won't be celebrated again. */
		async markSeen(userId: string, keys: string[]): Promise<void> {
			await withUser(db, userId, async (tx) => {
				for (const key of new Set(keys)) {
					const at = key.indexOf(':');
					await tx
						.update(achievements)
						.set({ seenAt: new Date() })
						.where(
							and(
								eq(achievements.userId, userId),
								eq(achievements.kind, key.slice(0, at) as StoredAchievement['kind']),
								eq(achievements.level, key.slice(at + 1)),
								isNull(achievements.seenAt)
							)
						);
				}
			});
		},

		/** A first with no record behind it (the first voice log): written when it happens, once. */
		async recordFirst(userId: string, first: Extract<First, 'voice'>, date: string): Promise<void> {
			await withUser(db, userId, (tx) =>
				tx
					.insert(achievements)
					.values({ userId, kind: 'first', level: first, achievedOn: date })
					.onConflictDoNothing()
			);
		}
	};
}

export type Progress = ReturnType<typeof createProgress>;
