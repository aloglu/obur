// Everything the Speak and Scan page shows (docs/ui.md, "Your own AI key for Speak and Scan").
import { FEATURES } from '#lib/shared/remote-models.ts';
import { hasLocal } from './model-source.ts';
import { remoteModels } from './remote-models.ts';

export async function remoteSettings(userId: string) {
	const [allowed, householdAllows, choices, keys, usage] = await Promise.all([
		remoteModels.allowed(userId),
		remoteModels.householdAllows(userId),
		remoteModels.choices(userId),
		remoteModels.keys(userId),
		remoteModels.usage(userId)
	]);
	return {
		/** Personal keys work here (the household allows them and the server has its secrets key). */
		allowed,
		/** Off by the household's choice (rather than the server lacking its key). */
		householdOff: !householdAllows,
		local: Object.fromEntries(FEATURES.map((f) => [f, hasLocal(f)])) as Record<
			(typeof FEATURES)[number],
			boolean
		>,
		choices,
		keys,
		usage
	};
}
