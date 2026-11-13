// Profiles and versioned targets (docs/design.md, "Targets, profile and activity"). Targets are estimates; minors,
// pregnancy and breastfeeding get no calculated targets, but a professional's target can be entered by hand.
import { DEFAULT_APP_ICON, isAppIcon } from '../../../shared/app-icons.ts';
import {
	DEFAULT_PREFERENCES,
	PreferencesInput,
	type Preferences
} from '../../../shared/preferences.ts';
import { isPalette } from '../../../shared/themes.ts';
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
	targetsAllowed,
	goalWeightAllowed
} from '../../../shared/goals.ts';
import * as v from 'valibot';
import {
	ProfileDetailsInput,
	ProfileInput,
	type BudgetSettings,
	type BudgetSettingsChange,
	type DetailsOutcome,
	type MacroChoice,
	type Profile,
	type TargetVersion
} from '../../../shared/goal-types.ts';
import { goalVersions, profiles } from './schema.ts';

export class GoalError extends Error {
	readonly code: 'profile_incomplete' | 'targets_not_allowed' | 'weight_required' | 'no_target';
	constructor(
		code: 'profile_incomplete' | 'targets_not_allowed' | 'weight_required' | 'no_target'
	) {
		super(code);
		this.code = code;
	}
}

export type TargetRequest =
	| ({
			mode: 'calculated';
			effectiveFrom: string;
			rateKgPerWeek: number;
			goalWeightKg?: number | null;
			/** Replaces the calculated base burn with a number the person chose. */
			fixedBaseBurnKcal?: number | null;
			floorKcal?: number | null;
			proteinGPerKg?: number | null;
			fatShare?: number | null;
	  } & Partial<BudgetSettings>)
	| ({
			mode: 'manual';
			effectiveFrom: string;
			budgetKcal: number;
			/** For the weight chart and achievements only: a budget set by hand never follows it. */
			goalWeightKg?: number | null;
	  } & Partial<BudgetSettings>)
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

const toPreferences = (r: ProfileRow): Preferences => ({
	themeMode: r.themeMode,
	palette: isPalette(r.palette) ? r.palette : DEFAULT_PREFERENCES.palette,
	appIcon: isAppIcon(r.appIcon) ? r.appIcon : DEFAULT_APP_ICON,
	timeFormat: r.timeFormat,
	weightView: r.weightView,
	voiceOffSeen: r.voiceOffSeen,
	holdHintSeen: r.holdHintSeen,
	maintainOfferDeclinedKg: r.maintainOfferDeclinedKg
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
	countActivity: r.countActivity,
	atGoal: r.atGoal,
	macroMode: r.macroMode,
	proteinShare: r.proteinShare,
	carbShare: r.carbShare,
	createdAt: r.createdAt.toISOString()
});

/** The macro choice a version records (percent shares back as whole percents). */
function macroChoice(r: VersionRow): MacroChoice {
	if (r.macroMode !== 'percent') return { mode: 'balanced' };
	const pct = (share: number | null) => Math.round((share ?? 0) * 100);
	return {
		mode: 'percent',
		proteinPct: pct(r.proteinShare),
		carbPct: pct(r.carbShare),
		fatPct: pct(r.fatShare)
	};
}

/** The macro columns for a choice; `balancedFatShare` is the fat share the balanced default uses (null: none). */
function macroColumns(choice: MacroChoice, balancedFatShare: number | null) {
	return choice.mode === 'percent'
		? {
				macroMode: 'percent' as const,
				proteinShare: choice.proteinPct / 100,
				carbShare: choice.carbPct / 100,
				fatShare: choice.fatPct / 100
			}
		: {
				macroMode: 'balanced' as const,
				proteinShare: null,
				carbShare: null,
				fatShare: balancedFatShare
			};
}

/** The settings in force: what the newest version up to a day records, with the defaults before any. */
function settingsOf(r: VersionRow | undefined): BudgetSettings {
	return {
		countActivity: r?.countActivity ?? true,
		atGoal: r?.atGoal ?? 'keep',
		macros: r ? macroChoice(r) : { mode: 'balanced' }
	};
}

type CalculatedRequest = Extract<TargetRequest, { mode: 'calculated' }>;

/** A goal weight beside a budget set by hand: refused for minors, pregnancy and breastfeeding (goalWeightAllowed). */
async function requireGoalAllowed(tx: Tx, userId: string, onDate: string) {
	const [p] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
	if (!goalWeightAllowed(p, onDate)) throw new GoalError('targets_not_allowed');
}

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
	const goal = request.goalWeightKg ?? null;
	// "Switch to maintenance" once the goal weight is reached; the requested rate comes back if weight rises above it.
	const atGoal = request.atGoal ?? 'keep';
	const reached = atGoal === 'maintain' && goal !== null && currentWeightKg <= goal;
	const rate = reached ? 0 : Math.min(Math.max(request.rateKgPerWeek, 0), maxRate(currentWeightKg));
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
		countActivity: request.countActivity ?? true,
		atGoal,
		...macroColumns(request.macros ?? { mode: 'balanced' }, request.fatShare ?? DEFAULT_FAT_SHARE),
		inputs: {
			weightKg: currentWeightKg,
			heightCm: p.heightCm,
			age: ageOn(p.birthDate, request.effectiveFrom),
			sex: p.sex,
			bodyFatPct: p.bodyFatPct,
			formula: fixed ? 'fixed' : burn.formula,
			bmr: fixed ? null : Math.round(burn.bmr),
			sedentaryFactor: SEDENTARY_FACTOR,
			requestedRateKgPerWeek: request.rateKgPerWeek,
			...(reached ? { goalReached: true } : {})
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
		// A percent version's fat share is the person's own; the balanced default comes back if they switch.
		fatShare: v.macroMode === 'balanced' ? v.fatShare : null,
		...settingsOf(v)
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

		/** The person's settings, and whether they were ever saved to the account (shared/preferences.ts). */
		async preferences(userId: string): Promise<{ preferences: Preferences; saved: boolean }> {
			const [row] = await withUser(db, userId, (tx) =>
				tx.select().from(profiles).where(eq(profiles.userId, userId))
			);
			return row
				? { preferences: toPreferences(row), saved: row.preferencesSavedAt !== null }
				: { preferences: DEFAULT_PREFERENCES, saved: false };
		},

		/** Saves any of the settings; the rest stay as they are. */
		async savePreferences(
			userId: string,
			raw: v.InferInput<typeof PreferencesInput>
		): Promise<Preferences> {
			const { appIcon, ...rest } = v.parse(PreferencesInput, raw);
			const now = new Date();
			const set = {
				...rest,
				...(appIcon !== undefined
					? { appIcon: appIcon === DEFAULT_APP_ICON ? null : appIcon }
					: {}),
				preferencesSavedAt: now,
				updatedAt: now
			};
			const [row] = await withUser(db, userId, (tx) =>
				tx
					.insert(profiles)
					.values({ userId, ...set })
					.onConflictDoUpdate({ target: profiles.userId, set })
					.returning()
			);
			return toPreferences(row);
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
				// A new target keeps the person's settings unless the request changes them.
				const [inForce] = await tx
					.select()
					.from(goalVersions)
					.where(lte(goalVersions.effectiveFrom, request.effectiveFrom))
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
					.limit(1);
				const kept = settingsOf(inForce);
				const asked: Partial<BudgetSettings> = request.mode !== 'none' ? request : {};
				const settings: BudgetSettings = {
					countActivity: asked.countActivity ?? kept.countActivity,
					atGoal: asked.atGoal ?? kept.atGoal,
					macros: asked.macros ?? kept.macros
				};
				const base = {
					userId,
					effectiveFrom: request.effectiveFrom,
					calculationVersion: CALCULATION_VERSION,
					countActivity: settings.countActivity,
					atGoal: settings.atGoal
				};
				let values: typeof goalVersions.$inferInsert;
				if (request.mode === 'none') {
					// No budget, so no macro targets; the choice is kept for the next budget.
					values = {
						...base,
						mode: 'none',
						baseBurnKcal: null,
						inputs: {},
						...macroColumns(settings.macros, null)
					};
				} else if (request.mode === 'manual') {
					if (request.goalWeightKg != null)
						await requireGoalAllowed(tx, userId, request.effectiveFrom);
					values = {
						...base,
						mode: 'manual',
						baseBurnKcal: Math.round(request.budgetKcal),
						goalWeightKg: request.goalWeightKg ?? null,
						inputs: { source: 'manual' },
						// The balanced default needs body weight, so a hand-set budget only has own percentages.
						...macroColumns(settings.macros, null)
					};
				} else {
					values = await calculatedValues(tx, userId, { ...request, ...settings }, currentWeightKg);
				}
				const [row] = await tx.insert(goalVersions).values(values).returning();
				return toVersion(row);
			});
		},

		/**
		 * Changes the budget settings from `today` on: a new version with the same choices and the new settings, so
		 * earlier days keep their budgets. Nothing to change without a budget.
		 */
		async changeSettings(
			userId: string,
			today: string,
			latestWeightKg: number | null,
			change: BudgetSettingsChange
		): Promise<TargetVersion> {
			return withUser(db, userId, async (tx) => {
				const [current] = await tx
					.select()
					.from(goalVersions)
					.where(lte(goalVersions.effectiveFrom, today))
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
					.limit(1);
				if (!current || current.mode === 'none') throw new GoalError('no_target');
				const kept = settingsOf(current);
				const settings: BudgetSettings = {
					countActivity: change.countActivity ?? kept.countActivity,
					atGoal: change.atGoal ?? kept.atGoal,
					macros: change.macros ?? kept.macros
				};
				if (current.mode === 'manual' && change.goalWeightKg != null)
					await requireGoalAllowed(tx, userId, today);
				const values: typeof goalVersions.$inferInsert =
					current.mode === 'calculated'
						? await calculatedValues(
								tx,
								userId,
								{
									...repeatRequest(current, today),
									...settings,
									...(change.rateKgPerWeek === undefined
										? {}
										: { rateKgPerWeek: change.rateKgPerWeek }),
									...(change.goalWeightKg === undefined
										? {}
										: { goalWeightKg: change.goalWeightKg })
								},
								latestWeightKg ?? ((current.inputs as Record<string, unknown>).weightKg as number)
							)
						: {
								userId,
								effectiveFrom: today,
								mode: current.mode,
								baseBurnKcal: current.baseBurnKcal,
								deficitKcal: current.deficitKcal,
								floorKcal: current.floorKcal,
								// A goal weight next to a budget set by hand (owner, 2026-11-08): it changes nothing in
								// the budget, only the weight chart's goal line and the weight achievements.
								goalWeightKg:
									current.mode === 'manual' && change.goalWeightKg !== undefined
										? change.goalWeightKg
										: current.goalWeightKg,
								inputs: current.inputs,
								calculationVersion: current.calculationVersion,
								countActivity: settings.countActivity,
								atGoal: settings.atGoal,
								...macroColumns(settings.macros, null)
							};
				values.inputs = { ...(values.inputs as Record<string, unknown>), source: 'settings' };
				const [row] = await tx.insert(goalVersions).values(values).returning();
				return toVersion(row);
			});
		},

		/**
		 * Saves the details Profile edits (height, birth date, sex, and the goal weight of a calculated budget) and,
		 * in the same transaction, recalculates a calculated budget from `today` with the same choices when its
		 * numbers change. Past days keep their budgets; manual budgets are left alone. When the new details no longer
		 * allow a calculation (a birth date that makes the person a minor), the details are saved and the budget in
		 * force stays, for the person to replace with their own number.
		 */
		async updateDetails(
			userId: string,
			today: string,
			latestWeightKg: number | null,
			raw: v.InferInput<typeof ProfileDetailsInput>
		): Promise<{ profile: Profile; outcome: DetailsOutcome; target: TargetVersion | null }> {
			const { goalWeightKg, ...given } = v.parse(ProfileDetailsInput, raw);
			// Details left out stay as they are.
			const facts = Object.fromEntries(
				Object.entries(given).filter(([, value]) => value !== undefined)
			) as typeof given;
			return withUser(db, userId, async (tx) => {
				const set = { ...facts, updatedAt: new Date() };
				const [profileRow] = await tx
					.insert(profiles)
					.values({ userId, ...set })
					.onConflictDoUpdate({ target: profiles.userId, set })
					.returning();
				const [current] = await tx
					.select()
					.from(goalVersions)
					.where(lte(goalVersions.effectiveFrom, today))
					.orderBy(desc(goalVersions.effectiveFrom), desc(goalVersions.createdAt))
					.limit(1);
				const done = (outcome: DetailsOutcome, row = current) => ({
					profile: toProfile(profileRow),
					outcome,
					target: row ? toVersion(row) : null
				});
				if (current?.mode !== 'calculated') return done({ kind: 'unchanged' });
				const request = {
					...repeatRequest(current, today),
					...(goalWeightKg !== undefined ? { goalWeightKg } : {})
				};
				let values: typeof goalVersions.$inferInsert;
				try {
					values = await calculatedValues(tx, userId, request, latestWeightKg);
				} catch (e) {
					if (e instanceof GoalError && e.code !== 'no_target')
						return done({ kind: 'not_recalculated', reason: e.code });
					throw e;
				}
				const inputs = values.inputs as Record<string, unknown>;
				const before = current.inputs as Record<string, unknown>;
				const same =
					values.baseBurnKcal === current.baseBurnKcal &&
					values.deficitKcal === current.deficitKcal &&
					values.proteinBasisKg === current.proteinBasisKg &&
					values.goalWeightKg === current.goalWeightKg &&
					(['weightKg', 'heightCm', 'age', 'sex', 'bodyFatPct'] as const).every(
						(k) => inputs[k] === before[k]
					);
				if (same) return done({ kind: 'unchanged' });
				values.inputs = { ...inputs, source: 'details' };
				const [row] = await tx.insert(goalVersions).values(values).returning();
				const budget = (r: VersionRow) => Math.max(r.floorKcal, r.baseBurnKcal! - r.deficitKcal);
				return done(
					{ kind: 'recalculated', beforeKcal: budget(current), afterKcal: budget(row) },
					row
				);
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
