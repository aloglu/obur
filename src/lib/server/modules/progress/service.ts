// Achievements (docs/design.md, "Progress, graphs and optional encouragement"): worked out from the person's records
// by shared/achievements.ts and kept in step with them in the `achievements` table, which remembers what was
// celebrated. One reached in the last few days waits to be celebrated; older ones (an import, a backfilled weigh-in,
// the history before achievements existed) arrive quietly with their real dates.
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { withUser, type Database } from '../../db/identity.ts';
import {
	achievementKey,
	achievements as derive,
	startWeight,
	type Achievement,
	type First
} from '../../../shared/achievements.ts';
import { addDays } from '../../../shared/diary-rules.ts';
import type { WeightUnit } from '../../../shared/weight-convert.ts';
import { goalWeightAllowed } from '../../../shared/goals.ts';

import { weightEntries } from '../body/index.ts';
import { foods, recipes } from '../catalog/index.ts';
import { dayCompletions, diaryEntries } from '../diary/index.ts';
import { goalVersions, profiles } from '../goals/index.ts';
import { achievements } from './schema.ts';

/** Why weight achievements are off: no goal below the start, no birth date, or a profile that rules them out. */
export type WeightOff = 'goal' | 'birth_date' | 'profile';

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
		 * Brings the stored achievements in step with the records and returns them all, oldest first, and whether weight
		 * achievements apply. `zone` turns the moment a scan or recipe was saved into the person's day.
		 */
		async sync(
			userId: string,
			today: string,
			zone: string
		): Promise<{
			list: StoredAchievement[];
			weightAllowed: boolean;
			/** Why weight achievements are off, for Achievements to say (2026-11-25 Review.md audit, 1.6). */
			weightOff: WeightOff | null;
			weightUnit: WeightUnit;
		}> {
			return withUser(db, userId, async (tx) => {
				const [readings, completed, goals, [profile], [scan], [recipe], stored, [logged]] =
					await Promise.all([
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
						tx.select().from(achievements).where(eq(achievements.userId, userId)),
						// The first day with anything in the diary (its intended day, so a backfill counts on that day).
						tx
							.select({ day: sql<string | null>`min(${diaryEntries.localDate})::text` })
							.from(diaryEntries)
							.where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)))
					]);

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
				// A known adult age is needed (docs/design.md, "Achievements"; owner kept it, 2026-11-25), though a goal
				// weight beside a budget set by hand needs only no known reason against it.
				const birthDate = profile?.birthDate ?? null;
				const weightOff: WeightOff | null =
					profile && !goalWeightAllowed(profile, today)
						? 'profile'
						: !losing
							? 'goal'
							: birthDate === null
								? 'birth_date'
								: null;
				const weightAllowed = weightOff === null;

				const weightUnit: WeightUnit = profile?.weightUnit ?? 'kg';
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
						...(logged?.day ? { day_logged: logged.day } : {}),
						...(scan?.scan ? { scan: scan.scan } : {}),
						...(recipe?.recipe ? { recipe: recipe.recipe } : {}),
						...(voice ? { voice: voice.achievedOn } : {})
					},
					weightAllowed,
					weightUnit
				});

				const want = new Map(derived.map((a) => [achievementKey(a), a]));
				const have = new Map(stored.map((r) => [`${r.kind}:${r.level}`, r]));
				const gone = stored.filter((r) => !want.has(`${r.kind}:${r.level}`));
				// In one statement (Review.md audit, 3.2: one each).
				if (gone.length)
					await tx
						.delete(achievements)
						.where(
							and(
								eq(achievements.userId, userId),
								or(
									...gone.map((r) =>
										and(eq(achievements.kind, r.kind), eq(achievements.level, r.level))
									)
								)
							)
						);
				const quietBefore = addDays(today, -CELEBRATE_DAYS);
				// A change of unit (Units) swaps kilo marks for pound marks or back: the new ones were earned before and
				// arrive quietly, never celebrated a second time.
				const weightKinds = ['weight', 'weight_lb'];
				const swapped = gone.some(
					(r) => weightKinds.includes(r.kind) && !derived.some((a) => a.kind === r.kind)
				);
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
								seenAt:
									a.date < quietBefore || (swapped && weightKinds.includes(a.kind))
										? new Date()
										: null
							}))
						)
						.onConflictDoNothing();
				}
				let moved = false;
				for (const a of derived) {
					const row = have.get(achievementKey(a));
					if (row && row.achievedOn !== a.date) {
						moved = true;
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
				// Nothing changed (most page loads): the rows read above are the answer (Gemini audit 2, H10).
				const rows =
					gone.length || fresh.length || moved
						? await tx
								.select()
								.from(achievements)
								.where(eq(achievements.userId, userId))
								.orderBy(asc(achievements.achievedOn))
						: stored
								.slice()
								.sort((a, b) =>
									a.achievedOn < b.achievedOn ? -1 : a.achievedOn > b.achievedOn ? 1 : 0
								);
				return { list: rows.map(parse), weightAllowed, weightOff, weightUnit };
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
