import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { body, respondBody } from '#lib/server/body.ts';
import { budgetNote, followLatestWeight } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { DateString, Zone } from '#lib/shared/diary-input.ts';
import type { RequestHandler } from './$types';

const Reading = (max: number) =>
	v.object({
		id: v.optional(v.pipe(v.string(), v.uuid())),
		date: DateString,
		zone: Zone,
		value: v.pipe(v.number(), v.finite(), v.gtValue(0), v.ltValue(max))
	});

/** POST /api/v1/body/weight (kg), /api/v1/body/water (ml) or /api/v1/body/activity (kcal, note). */
export const POST: RequestHandler = ({ params, request, locals }) =>
	respondBody(async () => {
		const userId = locals.session!.userId;
		if (params.kind === 'weight') {
			const r = await readJson(request, Reading(700));
			const reading = await body.logWeight(
				userId,
				{ id: r.id, localDate: r.date, zone: r.zone },
				r.value
			);
			// A calculated budget follows the latest weight from today on (the reply says how it changed).
			const change = await followLatestWeight(userId, locals.zone);
			return json(
				{
					...reading,
					budget: budgetNote(change)
				},
				{ status: 201 }
			);
		}
		if (params.kind === 'water') {
			const r = await readJson(request, Reading(10_001));
			return json(
				await body.logWater(userId, { id: r.id, localDate: r.date, zone: r.zone }, r.value),
				{ status: 201 }
			);
		}
		if (params.kind === 'activity') {
			const r = await readJson(
				request,
				v.object({
					id: v.optional(v.pipe(v.string(), v.uuid())),
					date: DateString,
					zone: Zone,
					value: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000)),
					note: v.pipe(
						v.optional(v.nullable(v.string()), null),
						v.transform((s) => (s ? s.normalize('NFC').trim().slice(0, 120) || null : null))
					)
				})
			);
			return json(
				await body.logActivity(
					userId,
					{ id: r.id, localDate: r.date, zone: r.zone },
					r.value,
					r.note
				),
				{ status: 201 }
			);
		}
		error(404, 'Not found');
	});

/**
 * GET /api/v1/body/weight?from=YYYY-MM-DD&to=YYYY-MM-DD (a range, oldest first), or
 * GET /api/v1/body/weight?limit=N[&after=<date>,<created at>,<id>] (a page, newest first).
 */
export const GET: RequestHandler = ({ params, url, locals }) =>
	respondBody(async () => {
		if (params.kind !== 'weight') error(404, 'Not found');
		const userId = locals.session!.userId;
		if (url.searchParams.has('limit')) {
			const [localDate, createdAt, id] = (url.searchParams.get('after') ?? '').split(',');
			const page = v.safeParse(
				v.object({
					limit: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)),
					after: v.optional(
						v.object({
							localDate: DateString,
							createdAt: v.pipe(v.string(), v.isoTimestamp()),
							id: v.pipe(v.string(), v.uuid())
						})
					)
				}),
				{
					limit: url.searchParams.get('limit'),
					after: url.searchParams.has('after') ? { localDate, createdAt, id } : undefined
				}
			);
			if (!page.success) error(400, 'Invalid page');
			return json({
				readings: await body.weightPage(userId, page.output.limit, page.output.after)
			});
		}
		const range = v.safeParse(v.object({ from: DateString, to: DateString }), {
			from: url.searchParams.get('from'),
			to: url.searchParams.get('to')
		});
		if (!range.success) error(400, 'Invalid range');
		return json({ readings: await body.weights(userId, range.output.from, range.output.to) });
	});
