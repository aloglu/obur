import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { goals } from '#lib/server/goals.ts';
import { readJson } from '#lib/server/http.ts';
import { APP_ICONS } from '#lib/shared/app-icons.ts';
import type { RequestHandler } from './$types';

const AppIconInput = v.object({ icon: v.picklist(APP_ICONS.map((i) => i.id)) });

/** PUT { icon }: the Home Screen icon, kept with the account so Safari offers it too (docs/ui.md, "App icon"). */
export const PUT: RequestHandler = async ({ request, locals }) => {
	const { icon } = await readJson(request, AppIconInput);
	await goals.setAppIcon(locals.session!.userId, icon);
	return json({ icon });
};
