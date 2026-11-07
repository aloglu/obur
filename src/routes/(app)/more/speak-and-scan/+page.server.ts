import { remoteSettings } from '#lib/server/remote-settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	settings: await remoteSettings(locals.session!.userId)
});
