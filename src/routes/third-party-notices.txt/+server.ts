// Every bundled package's licence, written once when the app is built (2026-11-22 Gemini audit, G13 and G30). Public,
// like the sign-in page: the notices go with every copy of the app.
import { noticesText } from '../../../scripts/third-party-notices.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(noticesText(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
