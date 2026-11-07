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
