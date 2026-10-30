// Profiles and versioned targets (docs/design.md, "Targets, profile and activity"). Targets are estimates; minors,
// pregnancy and breastfeeding get no calculated targets, but a professional's target can be entered by hand.
import { desc, eq, lte } from 'drizzle-orm';
import { withUser, type Database, type Tx } from '../../db/identity.ts';
import {
	ageOn,
	baseBurn,
	CALCULATION_VERSION,
	DEFAULT_FAT_SHARE,
	DEFAULT_FLOOR,
	DEFAULT_PROTEIN_G_PER_KG,
	dailyDeficit,
	maxRate,
	SEDENTARY_FACTOR,
	targetsAllowed
} from '../../../shared/goals.ts';
import * as v from 'valibot';
import { ProfileInput, type Profile, type TargetVersion } from '../../../shared/goal-types.ts';
import { goalVersions, profiles } from './schema.ts';

export class GoalError extends Error {
	constructor(readonly code: 'profile_incomplete' | 'targets_not_allowed' | 'weight_required') {
		super(code);
	}
}

export type TargetRequest =
	| {
			mode: 'calculated';
			effectiveFrom: string;
			rateKgPerWeek: number;
			goalWeightKg?: number | null;
			/** Replaces the calculated base burn with a number the person chose. */
			fixedBaseBurnKcal?: number | null;
			floorKcal?: number | null;
			proteinGPerKg?: number | null;
			fatShare?: number | null;
	  }
	| { mode: 'manual'; effectiveFrom: string; budgetKcal: number }
	| { mode: 'none'; effectiveFrom: string };

type ProfileRow = typeof profiles.$inferSelect;
type VersionRow = typeof goalVersions.$inferSelect;

const toProfile = (r: ProfileRow): Profile => ({
	heightCm: r.heightCm,
	birthDate: r.birthDate,
	sex: r.sex,
	bodyFatPct: r.bodyFatPct,
	waistCm: r.waistCm,
	pregnant: r.pregnant,
	breastfeeding: r.breastfeeding,
	decimalMark: r.decimalMark,
	firstDayOfWeek: r.firstDayOfWeek
});

const toVersion = (r: VersionRow): TargetVersion => ({
	id: r.id,
	effectiveFrom: r.effectiveFrom,
	mode: r.mode,
	baseBurnKcal: r.baseBurnKcal,
	deficitKcal: r.deficitKcal,
	floorKcal: r.floorKcal,
	goalWeightKg: r.goalWeightKg,
	rateKgPerWeek: r.rateKgPerWeek,
	proteinGPerKg: r.proteinGPerKg,
	proteinBasisKg: r.proteinBasisKg,
	fatShare: r.fatShare,
	inputs: r.inputs as Record<string, unknown>,
	createdAt: r.createdAt.toISOString()
});

type CalculatedRequest = Extract<TargetRequest, { mode: 'calculated' }>;

/** The row for a calculated target; refuses when the profile is incomplete or targets are not allowed. */
async function calculatedValues(
	tx: Tx,
	userId: string,
	request: CalculatedRequest,
	currentWeightKg: number | null
): Promise<typeof goalVersions.$inferInsert> {
	const [p] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	if (!p?.birthDate || !p.sex || !p.heightCm) throw new GoalError('profile_incomplete');
	if (
		!targetsAllowed(
			{ birthDate: p.birthDate, pregnant: p.pregnant, breastfeeding: p.breastfeeding },
			request.effectiveFrom
		)
	) {
		throw new GoalError('targets_not_allowed');
	}
	if (!currentWeightKg) throw new GoalError('weight_required');
	const facts = {
		sex: p.sex,
		birthDate: p.birthDate,
		heightCm: p.heightCm,
		weightKg: currentWeightKg,
		bodyFatPct: p.bodyFatPct
	};
	const burn = baseBurn(facts, request.effectiveFrom);
	const fixed = request.fixedBaseBurnKcal ? Math.round(request.fixedBaseBurnKcal) : null;
	const rate = Math.min(Math.max(request.rateKgPerWeek, 0), maxRate(currentWeightKg));
	const goal = request.goalWeightKg ?? null;
	return {
		userId,
		effectiveFrom: request.effectiveFrom,
		calculationVersion: CALCULATION_VERSION,
		mode: 'calculated',
		baseBurnKcal: fixed ?? burn.kcal,
		deficitKcal: dailyDeficit(rate, currentWeightKg),
		floorKcal: Math.round(request.floorKcal ?? DEFAULT_FLOOR[p.sex]),
		goalWeightKg: goal,
		rateKgPerWeek: rate,
		proteinGPerKg: request.proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG,
		proteinBasisKg: goal !== null && goal < currentWeightKg ? goal : currentWeightKg,
		fatShare: request.fatShare ?? DEFAULT_FAT_SHARE,
		inputs: {
			weightKg: currentWeightKg,
			heightCm: p.heightCm,
			age: ageOn(p.birthDate, request.effectiveFrom),
			sex: p.sex,
			bodyFatPct: p.bodyFatPct,
			formula: fixed ? 'fixed' : burn.formula,
			bmr: fixed ? null : Math.round(burn.bmr),
			sedentaryFactor: SEDENTARY_FACTOR,
			requestedRateKgPerWeek: request.rateKgPerWeek
		}
	};
}

/** The same choices as an earlier calculated version, from a new date. */
function repeatRequest(v: VersionRow, effectiveFrom: string): CalculatedRequest {
	const inputs = v.inputs as Record<string, unknown>;
	const requested = inputs.requestedRateKgPerWeek;
	return {
		mode: 'calculated',
		effectiveFrom,
		rateKgPerWeek: typeof requested === 'number' ? requested : (v.rateKgPerWeek ?? 0),
		goalWeightKg: v.goalWeightKg,
		fixedBaseBurnKcal: inputs.formula === 'fixed' ? v.baseBurnKcal : null,
		floorKcal: v.floorKcal,
		proteinGPerKg: v.proteinGPerKg,
		fatShare: v.fatShare
	};
}

/** A budget change caused by a new weight, for the confirmation. */
export interface BudgetChange {
	beforeKcal: number;
	afterKcal: number;
	target: TargetVersion;
}

export function createGoals(db: Database) {
	return {
		async profile(userId: string): Promise<Profile | null> {
			const [row] = await withUser(db, userId, (tx) =>
				tx.select().from(profiles).where(eq(profiles.userId, userId))
			);
			return row ? toProfile(row) : null;
		},

		/** Validates and saves the profile (missing optional fields take their defaults). */
		async saveProfile(userId: string, raw: v.InferInput<typeof ProfileInput>): Promise<Profile> {
			const input = v.parse(ProfileInput, raw);
			const values = { ...input, updatedAt: new Date() };
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.insert(profiles)
					.values({ userId, ...values })
					.onConflictDoUpdate({ target: profiles.userId, set: values })
					.returning()
			);
			return toProfile(row);
		},

		/** The target in force on a day: the newest version among those effective on or before it. */
		async targetFor(userId: string, onDate: string): Promise<TargetVersion | null> {
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(goalVersions)
					.where(lte(goalVersions.effectiveFrom, onDate))
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
					.limit(1)
			);
			return row ? toVersion(row) : null;
		},

		async history(userId: string): Promise<TargetVersion[]> {
			const rows = await withUser(db, userId, (tx) =>
				tx
					.select()
					.from(goalVersions)
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
			);
			return rows.map(toVersion);
		},

		/**
		 * Records a new target version. Calculated targets need a complete profile and a current weight, and are
		 * refused for minors, pregnancy and breastfeeding.
		 */
		async setTarget(
			userId: string,
			request: TargetRequest,
			currentWeightKg: number | null
		): Promise<TargetVersion> {
			return withUser(db, userId, async (tx) => {
				const base = {
					userId,
					effectiveFrom: request.effectiveFrom,
					calculationVersion: CALCULATION_VERSION
				};
				let values: typeof goalVersions.$inferInsert;
				if (request.mode === 'none') {
					values = { ...base, mode: 'none', baseBurnKcal: null, inputs: {} };
				} else if (request.mode === 'manual') {
					values = {
						...base,
						mode: 'manual',
						baseBurnKcal: Math.round(request.budgetKcal),
						inputs: { source: 'manual' }
					};
				} else {
					values = await calculatedValues(tx, userId, request, currentWeightKg);
				}
				const [row] = await tx.insert(goalVersions).values(values).returning();
				return toVersion(row);
			});
		},

		/**
		 * Keeps a calculated target in step with the latest weight (docs/design.md, "Targets, profile and
		 * activity"): when the latest reading on or before `today` changes the numbers of the calculated target in
		 * force today, records a new version from today with the same choices. Past days never change; manual
		 * targets, "none" and refused calculations are left alone. Safe to call again: no change, no new version.
		 */
		async followWeight(
			userId: string,
			today: string,
			latestWeightKg: number | null
		): Promise<BudgetChange | null> {
			if (!latestWeightKg) return null;
			return withUser(db, userId, async (tx) => {
				const [current] = await tx
					.select()
					.from(goalVersions)
					.where(lte(goalVersions.effectiveFrom, today))
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
					.limit(1);
				if (current?.mode !== 'calculated') return null;
				let values: typeof goalVersions.$inferInsert;
				try {
					values = await calculatedValues(
						tx,
						userId,
						repeatRequest(current, today),
						latestWeightKg
					);
				} catch (e) {
					if (e instanceof GoalError) return null;
					throw e;
				}
				const same =
					values.baseBurnKcal === current.baseBurnKcal &&
					values.deficitKcal === current.deficitKcal &&
					values.proteinBasisKg === current.proteinBasisKg &&
					(current.inputs as Record<string, unknown>).weightKg === latestWeightKg;
				if (same) return null;
				values.inputs = { ...(values.inputs as Record<string, unknown>), source: 'weight' };
				const [row] = await tx.insert(goalVersions).values(values).returning();
				const budget = (r: VersionRow) => Math.max(r.floorKcal, r.baseBurnKcal! - r.deficitKcal);
				return { beforeKcal: budget(current), afterKcal: budget(row), target: toVersion(row) };
			});
		}
	};
}

export type Goals = ReturnType<typeof createGoals>;
