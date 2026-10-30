// Profiles and versioned targets against real PostgreSQL, run as the runtime role.
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createGoals, GoalError } from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const goals = createGoals(drizzle(appSql));

const AYSE = randomUUID();
const MEHMET = randomUUID();
const adult = { heightCm: 180, birthDate: '1996-01-01', sex: 'male' as const };

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
	} catch (e) {
		if (e instanceof GoalError) return e.code;
		const err = e as { code?: string; cause?: { code?: string } };
		return err.cause?.code ?? err.code;
	}
	return undefined;
}

const asUser = <T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) =>
	appSql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	}) as Promise<T>;

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name, role) values (${AYSE}, 'Ayşe', 'admin'), (${MEHMET}, 'Mehmet', 'member')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end()]);
});

describe('calculated targets', () => {
	it('stores the computed numbers and the inputs used', async () => {
		await goals.saveProfile(MEHMET, adult);
		const v = await goals.setTarget(
			MEHMET,
			{ mode: 'calculated', effectiveFrom: '2026-06-01', rateKgPerWeek: 0.5 },
			80
		);
		expect(v).toMatchObject({
			mode: 'calculated',
			baseBurnKcal: 2136,
			deficitKcal: 550,
			floorKcal: 1500,
			proteinGPerKg: 1.2,
			proteinBasisKg: 80,
			fatShare: 0.3
		});
		expect(v.inputs).toMatchObject({
			formula: 'mifflin_st_jeor',
			weightKg: 80,
			age: 30,
			bmr: 1780
		});
	});

	it('caps the rate at 1 % of body weight and bases protein on a lower goal weight', async () => {
		await goals.saveProfile(MEHMET, adult);
		const v = await goals.setTarget(
			MEHMET,
			{ mode: 'calculated', effectiveFrom: '2026-06-01', rateKgPerWeek: 1, goalWeightKg: 70 },
			60
		);
		expect(v).toMatchObject({ rateKgPerWeek: 0.6, deficitKcal: 660 });
		const heavy = await goals.setTarget(
			MEHMET,
			{ mode: 'calculated', effectiveFrom: '2026-06-02', rateKgPerWeek: 0.5, goalWeightKg: 90 },
			120
		);
		expect(heavy.proteinBasisKg).toBe(90);
	});

	it('uses a fixed base burn when the person sets one', async () => {
		await goals.saveProfile(MEHMET, adult);
		const v = await goals.setTarget(
			MEHMET,
			{
				mode: 'calculated',
				effectiveFrom: '2026-06-01',
				rateKgPerWeek: 0,
				fixedBaseBurnKcal: 2400
			},
			80
		);
		expect(v).toMatchObject({ baseBurnKcal: 2400, deficitKcal: 0 });
		expect(v.inputs.formula).toBe('fixed');
	});

	it('refuses calculated targets without a profile or weight, and for minors, pregnancy or breastfeeding', async () => {
		const req = { mode: 'calculated' as const, effectiveFrom: '2026-06-01', rateKgPerWeek: 0.5 };
		expect(await errorCode(goals.setTarget(MEHMET, req, 80))).toBe('profile_incomplete');
		await goals.saveProfile(MEHMET, adult);
		expect(await errorCode(goals.setTarget(MEHMET, req, null))).toBe('weight_required');
		await goals.saveProfile(MEHMET, { ...adult, birthDate: '2010-01-01' });
		expect(await errorCode(goals.setTarget(MEHMET, req, 60))).toBe('targets_not_allowed');
		await goals.saveProfile(AYSE, { ...adult, sex: 'female', pregnant: true });
		expect(await errorCode(goals.setTarget(AYSE, req, 70))).toBe('targets_not_allowed');
		await goals.saveProfile(AYSE, { ...adult, sex: 'female', breastfeeding: true });
		expect(await errorCode(goals.setTarget(AYSE, req, 70))).toBe('targets_not_allowed');
		// A professional's target can still be entered by hand.
		const manual = await goals.setTarget(
			AYSE,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2300 },
			null
		);
		expect(manual).toMatchObject({ mode: 'manual', baseBurnKcal: 2300, deficitKcal: 0 });
	});
});

describe('versions', () => {
	it('applies the newest version effective on or before a day and never rewrites earlier days', async () => {
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2000 },
			null
		);
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-07-01', budgetKcal: 1800 },
			null
		);
		expect(await goals.targetFor(MEHMET, '2026-05-31')).toBeNull();
		expect((await goals.targetFor(MEHMET, '2026-06-30'))?.baseBurnKcal).toBe(2000);
		expect((await goals.targetFor(MEHMET, '2026-07-15'))?.baseBurnKcal).toBe(1800);

		// A deliberate correction for June is a new, auditable row; the old one remains.
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2100 },
			null
		);
		expect((await goals.targetFor(MEHMET, '2026-06-30'))?.baseBurnKcal).toBe(2100);
		expect(await goals.history(MEHMET)).toHaveLength(3);

		await goals.setTarget(MEHMET, { mode: 'none', effectiveFrom: '2026-08-01' }, null);
		expect((await goals.targetFor(MEHMET, '2026-08-02'))?.mode).toBe('none');
	});

	it('keeps target versions append-only in the database', async () => {
		const v = await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2000 },
			null
		);
		expect(
			await errorCode(
				asUser(MEHMET, (tx) => tx`update goal_versions set base_burn_kcal = 1 where id = ${v.id}`)
			)
		).toBe('42501');
		expect(
			await errorCode(asUser(MEHMET, (tx) => tx`delete from goal_versions where id = ${v.id}`))
		).toBe('42501');
	});
});

describe('following the latest weight', () => {
	const calculated = {
		mode: 'calculated' as const,
		effectiveFrom: '2026-06-01',
		rateKgPerWeek: 0.5,
		goalWeightKg: 75,
		floorKcal: 1500,
		proteinGPerKg: 1.5,
		fatShare: 0.25
	};

	it('records a version from today with the same choices; past days keep their budget', async () => {
		await goals.saveProfile(MEHMET, adult);
		const first = await goals.setTarget(MEHMET, calculated, 80);
		const change = await goals.followWeight(MEHMET, '2026-06-10', 78);
		expect(change).toMatchObject({ beforeKcal: 2136 - 550, afterKcal: 2112 - 550 });
		expect(change!.target).toMatchObject({
			effectiveFrom: '2026-06-10',
			mode: 'calculated',
			baseBurnKcal: 2112,
			deficitKcal: 550,
			floorKcal: 1500,
			goalWeightKg: 75,
			proteinGPerKg: 1.5,
			proteinBasisKg: 75,
			fatShare: 0.25
		});
		expect(change!.target.inputs).toMatchObject({ weightKg: 78, source: 'weight' });
		expect((await goals.targetFor(MEHMET, '2026-06-09'))?.id).toBe(first.id);
		expect((await goals.targetFor(MEHMET, '2026-06-10'))?.id).toBe(change!.target.id);
	});

	it('does nothing when the numbers stay the same, so repeating it is harmless', async () => {
		await goals.saveProfile(MEHMET, adult);
		await goals.setTarget(MEHMET, calculated, 80);
		expect(await goals.followWeight(MEHMET, '2026-06-10', 80)).toBeNull();
		expect(await goals.followWeight(MEHMET, '2026-06-10', 79)).not.toBeNull();
		expect(await goals.followWeight(MEHMET, '2026-06-10', 79)).toBeNull();
		expect(await goals.history(MEHMET)).toHaveLength(2);
	});

	it('keeps the requested rate, so a cap from a lower weight is lifted again later', async () => {
		await goals.saveProfile(MEHMET, adult);
		await goals.setTarget(MEHMET, { ...calculated, rateKgPerWeek: 1 }, 120);
		const lower = await goals.followWeight(MEHMET, '2026-06-10', 60);
		expect(lower!.target).toMatchObject({ rateKgPerWeek: 0.6, deficitKcal: 660 });
		const higher = await goals.followWeight(MEHMET, '2026-06-11', 110);
		expect(higher!.target).toMatchObject({ rateKgPerWeek: 1, deficitKcal: 1100 });
	});

	it('keeps a fixed base burn and only updates the weight-based parts', async () => {
		await goals.saveProfile(MEHMET, adult);
		await goals.setTarget(
			MEHMET,
			{ ...calculated, goalWeightKg: null, fixedBaseBurnKcal: 2400 },
			80
		);
		const change = await goals.followWeight(MEHMET, '2026-06-10', 78);
		expect(change!.target).toMatchObject({ baseBurnKcal: 2400, proteinBasisKg: 78 });
		expect(change!.target.inputs.formula).toBe('fixed');
	});

	it('leaves manual, none and refused targets alone', async () => {
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2000 },
			null
		);
		expect(await goals.followWeight(MEHMET, '2026-06-10', 70)).toBeNull();
		await goals.setTarget(MEHMET, { mode: 'none', effectiveFrom: '2026-06-02' }, null);
		expect(await goals.followWeight(MEHMET, '2026-06-10', 70)).toBeNull();

		await goals.saveProfile(AYSE, { ...adult, sex: 'female' });
		await goals.setTarget(AYSE, calculated, 70);
		await goals.saveProfile(AYSE, { ...adult, sex: 'female', pregnant: true });
		expect(await goals.followWeight(AYSE, '2026-06-10', 72)).toBeNull();
		expect(await goals.followWeight(AYSE, '2026-06-10', null)).toBeNull();
		expect(await goals.history(MEHMET)).toHaveLength(2);
		expect(await goals.history(AYSE)).toHaveLength(1);
	});

	it("never reads or changes another person's targets", async () => {
		await goals.saveProfile(MEHMET, adult);
		await goals.setTarget(MEHMET, calculated, 80);
		expect(await goals.followWeight(AYSE, '2026-06-10', 70)).toBeNull();
		expect(await goals.history(MEHMET)).toHaveLength(1);
		expect(await goals.history(AYSE)).toHaveLength(0);
	});
});

describe('privacy', () => {
	it('keeps profiles and targets private, even from the admin', async () => {
		await goals.saveProfile(MEHMET, adult);
		await goals.setTarget(
			MEHMET,
			{ mode: 'manual', effectiveFrom: '2026-06-01', budgetKcal: 2000 },
			null
		);
		expect(await goals.profile(AYSE)).toBeNull();
		expect(await goals.targetFor(AYSE, '2026-06-02')).toBeNull();
		const seen = await asUser(AYSE, (tx) => tx`select * from profiles`);
		expect(seen).toHaveLength(0);
	});

	it('validates profile ranges in the service and in the database', async () => {
		await expect(goals.saveProfile(MEHMET, { ...adult, heightCm: 20 })).rejects.toThrow();
		await expect(goals.saveProfile(MEHMET, { ...adult, bodyFatPct: 90 })).rejects.toThrow();
		expect(
			await errorCode(
				asUser(MEHMET, (tx) => tx`insert into profiles (user_id, height_cm) values (${MEHMET}, 20)`)
			)
		).toBe('23514');
	});
});
