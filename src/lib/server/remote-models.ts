// The application's remote-models instance (docs/design.md, "Remote models for Speak and Scan"): people's own keys,
// encrypted with this server's secrets key. Without that key, personal keys are off.
import { OBUR_SECRETS_KEY } from '$app/env/private';
import { createRemoteModels, parseSecretsKey } from '#lib/server/modules/remote-models/index.ts';
import { db } from './db/index.ts';

export const remoteModels = createRemoteModels(
	db,
	OBUR_SECRETS_KEY ? parseSecretsKey(OBUR_SECRETS_KEY) : null
);
