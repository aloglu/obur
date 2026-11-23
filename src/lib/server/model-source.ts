// What reads a person's recordings or label photos right now (docs/design.md, "Remote models for Speak and Scan"):
// their own key when they chose it and personal keys work here, otherwise this server's add-on when it has one,
// otherwise nothing (the feature is off for them).
import type { Feature, Source } from '#lib/shared/remote-models.ts';
import { config } from './config.ts';
import { remoteModels } from './remote-models.ts';

export const hasLocal = (feature: Feature) =>
	feature === 'speak' ? config.speechUrl !== null : config.ocrUrl !== null;

export async function effectiveSource(userId: string, feature: Feature): Promise<Source | null> {
	const choice = (await remoteModels.choices(userId))[feature];
	if (choice !== 'server' && (await remoteModels.allowed(userId))) return choice;
	return hasLocal(feature) ? 'server' : null;
}

/** effectiveSource for Speak and Scan, and whether personal keys work, from one read of each (Gemini audit 2, H10). */
export async function allSources(
	userId: string
): Promise<{ speak: Source | null; scan: Source | null; keysAllowed: boolean }> {
	const [choices, keysAllowed] = await Promise.all([
		remoteModels.choices(userId),
		remoteModels.allowed(userId)
	]);
	const pick = (feature: Feature): Source | null => {
		const choice = choices[feature];
		if (choice !== 'server' && keysAllowed) return choice;
		return hasLocal(feature) ? 'server' : null;
	};
	return { speak: pick('speak'), scan: pick('scan'), keysAllowed };
}

/**
 * The source for one request. `viaServer` (the person tapped "Read this one on obur's server instead"): this
 * server's add-on or nothing, never a provider, even when the add-on was removed after the page opened. `normal` is
 * the person's usual choice (effectiveSource).
 */
export async function requestSource(
	viaServer: boolean,
	local: boolean,
	normal: () => Promise<Source | null>
): Promise<Source | 'local_missing' | null> {
	if (viaServer) return local ? 'server' : 'local_missing';
	return normal();
}
