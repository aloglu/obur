import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { config } from '#lib/server/config.ts';
import { readJson } from '#lib/server/http.ts';
import { reminders } from '#lib/server/reminders.ts';
import type { RequestHandler } from './$types';

// The browser's push endpoint: an https URL at its push service.
const Endpoint = v.pipe(v.string(), v.maxLength(2048), v.url(), v.startsWith('https://'));
const Key = (max: number) => v.pipe(v.string(), v.maxLength(max), v.regex(/^[A-Za-z0-9_=-]+$/));
const Subscription = v.object({
	endpoint: Endpoint,
	keys: v.object({ p256dh: Key(200), auth: Key(100) })
});

const enabled = () => {
	if (!config.pushKey) error(404, 'Reminders are off on this server');
};

/** GET ?endpoint=…: whether this device receives the person's reminders. */
export const GET: RequestHandler = async ({ url, locals }) => {
	enabled();
	const endpoint = v.safeParse(Endpoint, url.searchParams.get('endpoint'));
	if (!endpoint.success) return json({ subscribed: false });
	return json({ subscribed: await reminders.subscribed(locals.session!.userId, endpoint.output) });
};

/** POST the browser's PushSubscription JSON: this device receives the person's reminders. */
export const POST: RequestHandler = async ({ request, locals }) => {
	enabled();
	await reminders.subscribe(locals.session!.userId, await readJson(request, Subscription));
	return json({ subscribed: true }, { status: 201 });
};

/** DELETE { endpoint }: this device stops receiving the person's reminders. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	enabled();
	const { endpoint } = await readJson(request, v.object({ endpoint: Endpoint }));
	await reminders.unsubscribe(locals.session!.userId, endpoint);
	return json({ subscribed: false });
};
