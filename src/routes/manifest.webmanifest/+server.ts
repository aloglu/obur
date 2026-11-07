// The web app manifest, with the icons of the app icon chosen on Appearance (its id in the query, as the page links
// it; docs/ui.md, "App icon"). Public: browsers fetch it without the session. Never cached (server.js).
import { DEFAULT_APP_ICON, appIconFile, isAppIcon } from '#lib/shared/app-icons.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const requested = url.searchParams.get('icon');
	const id = isAppIcon(requested) ? requested : DEFAULT_APP_ICON;
	const manifest = {
		name: 'obur',
		short_name: 'obur',
		description: 'Calories, weight and water, on your own server.',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: '#F6F3EE',
		theme_color: '#C2410C',
		icons: [
			{ src: appIconFile(id, 'icon-192.png'), sizes: '192x192', type: 'image/png' },
			{ src: appIconFile(id, 'icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
			{
				src: appIconFile(id, 'icon-maskable-512.png'),
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	};
	return new Response(JSON.stringify(manifest, null, '\t'), {
		headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' }
	});
};
