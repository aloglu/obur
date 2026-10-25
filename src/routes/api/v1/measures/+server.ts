import { json } from '@sveltejs/kit';
import { catalog } from '#lib/server/catalog.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	json({ measures: await catalog.householdMeasures() });
