// Thin JSON API for passkeys, sessions, invites and recovery. Logic lives in the auth module.
import { error, json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import * as v from 'valibot';
import { auth, SESSION_COOKIE } from '#lib/server/auth.ts';
import { config } from '#lib/server/config.ts';
import { clearSessionCookie, readJson, respond, setSessionCookie } from '#lib/server/http.ts';
import type { SessionRecord } from '#lib/server/modules/auth/index.ts';

// SimpleWebAuthn verifies the contents; here we only bound the shape and size.
const short = v.pipe(v.string(), v.maxLength(512));
const b64 = v.pipe(v.string(), v.maxLength(8192));
const registration = v.looseObject({
	id: short,
	rawId: short,
	type: v.literal('public-key'),
	response: v.looseObject({ clientDataJSON: b64, attestationObject: b64 }),
	clientExtensionResults: v.optional(v.looseObject({}), {})
});
const assertion = v.looseObject({
	id: short,
	rawId: short,
	type: v.literal('public-key'),
	response: v.looseObject({
		clientDataJSON: b64,
		authenticatorData: b64,
		signature: b64,
		userHandle: v.optional(short)
	}),
	clientExtensionResults: v.optional(v.looseObject({}), {})
});
const token = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{20,100}$/));
const label = v.optional(v.pipe(v.string(), v.maxLength(80)));
const displayName = v.pipe(v.string(), v.maxLength(200));
const challengeId = v.pipe(v.string(), v.uuid());

type Handler = (event: RequestEvent, session: SessionRecord | undefined) => Promise<Response>;

const requireSession = (session: SessionRecord | undefined): SessionRecord => {
	if (!session) error(401, 'Sign in first');
	return session;
};

// The registration response is narrowed for shape only; SimpleWebAuthn's own types are wider.
type Reg = Parameters<typeof auth.setupVerify>[2];
type Auth = Parameters<typeof auth.loginVerify>[1];

const routes: Record<string, Handler> = {
	'POST setup/options': async ({ request, getClientAddress }) => {
		const body = await readJson(request, v.object({ token, displayName }));
		return json(await auth.setupOptions(body.token, body.displayName, getClientAddress()));
	},
	'POST setup/verify': async ({ request, cookies }) => {
		const body = await readJson(
			request,
			v.object({ token, challengeId, response: registration, label })
		);
		const result = await auth.setupVerify(
			body.token,
			body.challengeId,
			body.response as Reg,
			body.label
		);
		setSessionCookie(cookies, result.sessionToken);
		return json({ recoveryCodes: result.recoveryCodes });
	},
	'POST join/options': async ({ request, getClientAddress }) => {
		const body = await readJson(request, v.object({ token, displayName }));
		return json(await auth.joinOptions(body.token, body.displayName, getClientAddress()));
	},
	'POST join/verify': async ({ request, cookies }) => {
		const body = await readJson(
			request,
			v.object({ token, challengeId, response: registration, label })
		);
		const result = await auth.joinVerify(
			body.token,
			body.challengeId,
			body.response as Reg,
			body.label
		);
		setSessionCookie(cookies, result.sessionToken);
		return json({ recoveryCodes: result.recoveryCodes });
	},
	'POST login/options': async ({ getClientAddress }) =>
		json(await auth.loginOptions(getClientAddress())),
	'POST login/verify': async ({ request, cookies, getClientAddress }) => {
		const body = await readJson(request, v.object({ challengeId, response: assertion }));
		const sessionToken = await auth.loginVerify(
			body.challengeId,
			body.response as Auth,
			getClientAddress()
		);
		setSessionCookie(cookies, sessionToken);
		return json({ ok: true });
	},
	'POST logout': async ({ cookies }, session) => {
		if (session) await auth.signOut(session);
		clearSessionCookie(cookies);
		return json({ ok: true });
	},
	'POST reauth/options': async (_, session) =>
		json(await auth.reauthOptions(requireSession(session))),
	'POST reauth/verify': async ({ request }, session) => {
		const body = await readJson(request, v.object({ challengeId, response: assertion }));
		await auth.reauthVerify(requireSession(session), body.challengeId, body.response as Auth);
		return json({ ok: true });
	},
	'GET credentials': async (_, session) =>
		json({ credentials: await auth.listCredentials(requireSession(session)) }),
	'POST credentials/options': async (_, session) =>
		json(await auth.addCredentialOptions(requireSession(session))),
	'POST credentials/verify': async ({ request }, session) => {
		const body = await readJson(request, v.object({ challengeId, response: registration, label }));
		await auth.addCredentialVerify(
			requireSession(session),
			body.challengeId,
			body.response as Reg,
			body.label
		);
		return json({ ok: true });
	},
	'POST credentials/remove': async ({ request }, session) => {
		const body = await readJson(request, v.object({ id: short }));
		await auth.removeCredential(requireSession(session), body.id);
		return json({ ok: true });
	},
	'GET recovery-codes': async (_, session) =>
		json({ remaining: await auth.recoveryCodeCount(requireSession(session)) }),
	'POST recovery-codes': async (_, session) =>
		json({ recoveryCodes: await auth.regenerateRecoveryCodes(requireSession(session)) }),
	'POST sessions/sign-out-others': async (_, session) =>
		json({ signedOut: await auth.signOutOtherSessions(requireSession(session)) }),
	'POST recovery/begin': async ({ request, cookies, getClientAddress }) => {
		const body = await readJson(
			request,
			v.object({
				code: v.optional(v.pipe(v.string(), v.maxLength(64))),
				linkToken: v.optional(token)
			})
		);
		const recoveryToken = await auth.beginRecovery(body, getClientAddress());
		setSessionCookie(cookies, recoveryToken, true);
		return json({ ok: true });
	},
	'POST recovery/options': async ({ cookies }, session) =>
		json(await auth.recoveryOptions(requireSession(session), cookies.get(SESSION_COOKIE) ?? '')),
	'POST recovery/verify': async ({ request, cookies }, session) => {
		const body = await readJson(request, v.object({ challengeId, response: registration, label }));
		const result = await auth.recoveryVerify(
			requireSession(session),
			cookies.get(SESSION_COOKIE) ?? '',
			body.challengeId,
			body.response as Reg,
			body.label
		);
		setSessionCookie(cookies, result.sessionToken);
		return json({ recoveryCodes: result.recoveryCodes });
	},
	'GET invites': async (_, session) =>
		json({ invites: await auth.listInvites(requireSession(session)) }),
	'POST invites': async ({ request }, session) => {
		const body = await readJson(
			request,
			v.object({ note: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(200)))) })
		);
		const inviteToken = await auth.createInvite(requireSession(session), body.note ?? null);
		// Shown once to the admin; the token travels in the fragment so it never reaches server logs.
		return json({ link: `${config.origin}/join#${inviteToken}` });
	},
	'POST invites/revoke': async ({ request }, session) => {
		const body = await readJson(request, v.object({ id: v.pipe(v.string(), v.uuid()) }));
		return json({ revoked: await auth.revokeInvite(requireSession(session), body.id) });
	}
};

const dispatch: RequestHandler = (event) =>
	respond(async () => {
		const handler = routes[`${event.request.method} ${event.params.action}`];
		if (!handler) error(404, 'Not found');
		return handler(event, event.locals.session);
	});

export const GET = dispatch;
export const POST = dispatch;
