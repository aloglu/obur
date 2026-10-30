import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { body, respondBody } from '#lib/server/body.ts';
import { budgetNote, followLatestWeight } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

/** Trash actions: ?action=delete or ?action=restore on a weight or water reading. */
export const POST: RequestHandler = ({ params, url, locals }) =>
	respondBody(async () => {
		const userId = locals.session!.userId;
		if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
		const action = url.searchParams.get('action');
		const handlers = {
			weight: { delete: body.removeWeight, restore: body.restoreWeight },
			water: { delete: body.removeWater, restore: body.restoreWater },
			activity: { delete: body.removeActivity, restore: body.restoreActivity }
		} as const;
		const kind = handlers[params.kind as keyof typeof handlers];
		const run = kind?.[action as keyof typeof kind];
		if (!run) error(400, 'Unknown action');
		await run(userId, params.id);
		if (params.kind !== 'weight') return json({ ok: true });
		const change = await followLatestWeight(userId, locals.zone);
		return json({
			ok: true,
			budget: budgetNote(change)
		});
	});

/** PATCH a weight (kg) or water (ml) reading's value: { revision, value }. A stale revision gets 409. */
export const PATCH: RequestHandler = ({ params, request, locals }) =>
	respondBody(async () => {
		const userId = locals.session!.userId;
		if (!v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success) error(404, 'Not found');
		const max = { weight: 700, water: 10_001 }[params.kind as 'weight' | 'water'];
		if (!max) error(404, 'Not found');
		const r = await readJson(
			request,
			v.object({
				revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
				value: v.pipe(v.number(), v.finite(), v.gtValue(0), v.ltValue(max))
			})
		);
		if (params.kind === 'water')
			return json(await body.editWater(userId, params.id, r.revision, r.value));
		const reading = await body.editWeight(userId, params.id, r.revision, r.value);
		return json({ ...reading, budget: budgetNote(await followLatestWeight(userId, locals.zone)) });
	});
