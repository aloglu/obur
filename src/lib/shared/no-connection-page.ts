// The page the service worker shows when a page can't be loaded (docs/design.md, "Connection required";
// docs/ui.md, "No connection"). Built by the service worker from the message catalog, so it needs nothing from the
// server. It holds every language's text and picks one by the language cookie, and it follows the theme cookie,
// because a service worker can't read cookies. No personal data. Pure: text in, HTML out.

export interface NoConnectionText {
	title: string;
	line: string;
	retry: string;
	still: string;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** JSON inside a script element: `<` escaped, so no text can end the element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** The cloud-off icon (Lucide), as the app's warning card shows it. */
const CLOUD_OFF =
	'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/></svg>';

/**
 * `texts`: each language's text, by language code; `fallback`: the language used when the cookie names none.
 * `reachable`: the message the page sends the service worker once the server answers again.
 */
export function noConnectionPage(
	texts: Record<string, NoConnectionText>,
	fallback: string,
	reachable: string
): string {
	const first = texts[fallback];
	return `<!doctype html>
<html lang="${escape(fallback)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escape(first.title)}</title>
<style>
:root{--bg:#f6f3ee;--surface:#fff;--surface2:#f1ebe3;--line:#e5ddd2;--text:#1e1a16;--muted:#665d53;--accent:#c2410c;--on-accent:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;color-scheme:dark}}
:root[data-theme=dark]{--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;color-scheme:dark}
html{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}
main{width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-sizing:border-box}
.row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:start}
.tile{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--surface2);color:var(--muted)}
h1{margin:0;font-size:1rem;line-height:1.35;font-weight:700}
p{margin:2px 0 0;font-size:.875rem;line-height:1.35;color:var(--muted)}
button{min-height:52px;border:0;border-radius:14px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:1.0625rem;font-weight:750;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
</style>
</head>
<body>
<main role="alert">
<div class="row"><span class="tile">${CLOUD_OFF}</span><div><h1 id="t">${escape(first.title)}</h1><p id="l">${escape(first.line)}</p></div></div>
<button id="b" type="button">${escape(first.retry)}</button>
</main>
<script>
(function () {
var texts = ${scriptJson(texts)};
var cookie = function (name) {
	var hit = document.cookie.split(';').map(function (c) { return c.trim(); })
		.find(function (c) { return c.indexOf(name + '=') === 0; });
	return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
};
var lang = cookie('obur_lang');
var text = texts[lang] || texts[${scriptJson(fallback)}];
var theme = cookie('obur_theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
if (texts[lang]) document.documentElement.lang = lang;
document.title = text.title;
document.getElementById('t').textContent = text.title;
document.getElementById('l').textContent = text.line;
var button = document.getElementById('b');
button.textContent = text.retry;
var tryAgain = function () {
	button.disabled = true;
	fetch('/_app/version.json', { cache: 'no-store' }).then(function (r) {
		if (!r.ok) throw new Error();
		var worker = navigator.serviceWorker && navigator.serviceWorker.controller;
		if (worker) worker.postMessage({ type: ${scriptJson(reachable)} });
		setTimeout(function () { location.reload(); }, 50);
	}).catch(function () {
		button.disabled = false;
		document.getElementById('l').textContent = text.still;
	});
};
button.addEventListener('click', tryAgain);
addEventListener('online', tryAgain);
})();
</script>
</body>
</html>`;
}
