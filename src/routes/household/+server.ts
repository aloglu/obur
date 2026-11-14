import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The Members page was called Household until 2026-11-14; old bookmarks and links land on it.
export const GET: RequestHandler = () => redirect(308, '/members');
