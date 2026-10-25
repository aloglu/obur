import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { body, respondBody } from '#lib/server/body.ts';
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

/** POST /api/v1/body/weight (kg) or /api/v1/body/water (ml). */
export const POST: RequestHandler = ({ params, request, locals }) =>
	respondBody(async () => {
		const userId = locals.session!.userId;
		if (params.kind === 'weight') {
			const r = await readJson(request, Reading(700));
			return json(
				await body.logWeight(userId, { id: r.id, localDate: r.date, zone: r.zone }, r.value),
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
		error(404, 'Not found');
	});

/** GET /api/v1/body/weight?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const GET: RequestHandler = ({ params, url, locals }) =>
	respondBody(async () => {
		if (params.kind !== 'weight') error(404, 'Not found');
		const range = v.safeParse(v.object({ from: DateString, to: DateString }), {
			from: url.searchParams.get('from'),
			to: url.searchParams.get('to')
		});
		if (!range.success) error(400, 'Invalid range');
		return json({
			readings: await body.weights(locals.session!.userId, range.output.from, range.output.to)
		});
	});
