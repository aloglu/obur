// Session and token lifetimes. Recorded in docs/design.md ("Sessions, uploads and deployment").
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const POLICY = {
	sessionIdleMs: 14 * DAY,
	sessionAbsoluteMs: 90 * DAY,
	sessionTouchIntervalMs: HOUR,
	recoverySessionMs: 15 * MINUTE,
	recentAuthMs: 10 * MINUTE,
	inviteMs: 7 * DAY,
	bootstrapMs: 24 * HOUR,
	recoveryLinkMs: HOUR,
	challengeMs: 5 * MINUTE
} as const;

export interface SessionTimes {
	lastSeenAt: Date;
	expiresAt: Date;
}

/** A session is usable until its absolute expiry and while it has been seen within the idle window. */
export function sessionUsable(times: SessionTimes, now: Date): boolean {
	return (
		times.expiresAt.getTime() > now.getTime() &&
		now.getTime() - times.lastSeenAt.getTime() < POLICY.sessionIdleMs
	);
}

export function recentlyVerified(verifiedAt: Date, now: Date): boolean {
	return now.getTime() - verifiedAt.getTime() < POLICY.recentAuthMs;
}
