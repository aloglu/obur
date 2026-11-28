// Writes a page where the owner picks one of a few drafts for each icon (docs/ui.md, "Our own food icon set"):
// each version large, at row size on the light and dark tile, and in a Foods row; Pick or "None of these" with a note,
// saved in the page's database (a private Claude artifact with the `db` capability), one document per icon:
// { pick: 'a' | 'b' | 'c' | 'none', note }. No guessing round (owner, 2026-11-28).
//   PICK=banana:Banana,lemon:Limon COLLECTION=picks1 node assets/food-icons/pick.ts <out.html>
// Drafts are svg/draft_<name>_<a|b|c>.svg.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [out] = process.argv.slice(2);
const pick = process.env.PICK;
if (!out || !pick)
	throw new Error('Usage: PICK=name:Row name,… node assets/food-icons/pick.ts <out.html>');
const COLLECTION = process.env.COLLECTION || 'picks';
const INTRO = process.env.INTRO || 'Pick the version that works, or say none of them do.';

const uri = (file: string) =>
	'data:image/svg+xml;base64,' +
	readFileSync(`assets/food-icons/svg/${file}.svg`).toString('base64');
const GROUPS = pick.split(',').map((entry) => {
	const [name, row] = entry.split(':');
	const options = ['a', 'b', 'c', 'd']
		.filter((v) => existsSync(`assets/food-icons/svg/draft_${name}_${v}.svg`))
		.map((v) => ({ v, src: uri(`draft_${name}_${v}`) }));
	return { name, label: name.replace(/_/g, ' '), row: row || name, options };
});

const html = `<title>Icon picks</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Inter:wght@400..800&display=swap" rel="stylesheet">
<style>
/* VOICE everyday: the owner choosing between drafts of their app's icons
   IDEA a line-up per icon, each version seen as it will be used
   PICTURE the drafts themselves, large and at row size
   COLOUR Pazar tokens, light and dark
   TYPE Bricolage Grotesque titles + Inter, as in the app
   LAYOUT one card per icon, its versions side by side; stacked on phones */
:root{--bg:#f6f3ee;--surface:#fff;--surface2:#f1ebe3;--line:#e5ddd2;--text:#1e1a16;--muted:#665d53;--accent:#c2410c;--on-accent:#fff;--bad:#c62f3a;--soft:#fdf0e7;--icon-tile:#f3ece3;--shadow:0 1px 2px rgba(60,40,20,.06),0 8px 24px rgba(60,40,20,.08);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;--bad:#ff6b6b;--soft:#3d2619;--icon-tile:#332c26;--shadow:0 1px 2px rgba(0,0,0,.5);color-scheme:dark}}
:root[data-theme="dark"]{--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;--bad:#ff6b6b;--soft:#3d2619;--icon-tile:#332c26;--shadow:0 1px 2px rgba(0,0,0,.5);color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{background:var(--bg);color:var(--text);font:16px/1.45 'Inter',system-ui,sans-serif;margin:0;overflow-x:clip}
h1,h2{font-family:'Bricolage Grotesque','Inter',system-ui,sans-serif;margin:0;letter-spacing:-.01em}
.wrap{max-width:1080px;margin:0 auto;padding-block:28px 64px;padding-left:max(5vw,16px,env(safe-area-inset-left,0px));padding-right:max(5vw,16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:20px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:16px}
header h1{font-size:2.25rem;font-weight:750;line-height:1.05}
header p{margin:8px 0 0;color:var(--muted);max-width:62ch}
.chip{background:var(--surface);box-shadow:var(--shadow);border-radius:14px;padding:10px 14px;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
.chip b{color:var(--accent)}
.tools{display:flex;gap:10px;align-items:center}
.seg{display:inline-flex;background:var(--surface2);border:1px solid var(--line);border-radius:14px;padding:3px}
.seg button{font:inherit;border:0;background:none;color:var(--text);min-height:38px;padding:0 14px;border-radius:10px;font-weight:650;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--surface);box-shadow:var(--shadow);color:var(--accent)}
.group{background:var(--surface);border-radius:22px;box-shadow:var(--shadow);padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px}
.group h2{font-size:1.25rem;font-weight:750}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.opt{border:2px solid var(--line);border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px;align-items:center;background:var(--bg)}
.opt.on{border-color:var(--accent);background:var(--soft)}
.big{width:120px;height:120px;border-radius:20px;background:var(--icon-tile);display:grid;place-items:center}
.big img{width:88px;height:88px}
.tiles{display:flex;gap:8px}
.tile{width:40px;height:40px;border-radius:10px;display:grid;place-items:center}
.tile img{width:29px;height:29px}
.light{background:#f3ece3}.dark{background:#332c26}
.row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;width:100%;background:var(--surface);border-radius:14px;padding:6px 10px}
.row .tile{background:var(--icon-tile)}
.row b{font-size:.9375rem;font-weight:600}
.opt button,.none{font:inherit;cursor:pointer;min-height:44px;padding:0 18px;border-radius:14px;border:1px solid var(--line);background:var(--surface2);color:var(--text);font-weight:700;width:100%}
.opt.on button{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.none{width:auto}
.none[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
.note{font:inherit;font-size:16px;flex:1 1 240px;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface2);color:var(--text);padding:0 12px}
button:focus-visible,.note:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
.saved{font-size:.8125rem;color:var(--muted)}
.warn{background:var(--soft);border-radius:14px;padding:12px 14px;margin:0}
</style>

<div class="wrap">
  <header>
    <div><h1>Icon picks</h1><p>${INTRO} Your answers save as you go, and Claude reads them from this page.</p></div>
    <span class="chip">Decided <b id="n-done">0</b> of ${GROUPS.length}</span>
  </header>
  <p class="warn" id="offline" hidden>This view can’t save. Open the page on claude.ai while signed in, and your answers will be kept.</p>
  <div class="tools"><span>Mode</span><div class="seg" role="group" aria-label="Mode"><button id="t-light">Light</button><button id="t-dark">Dark</button></div></div>
  <div id="groups"></div>
</div>

<script>
{
  const GROUPS = ${JSON.stringify(GROUPS).replace(/</g, '\\u003c')};
  const byName = Object.fromEntries(GROUPS.map(g => [g.name, g]));
  const state = {}; const pending = {}; let col = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('groups').style.cssText = 'display:flex;flex-direction:column;gap:16px';
  $('groups').innerHTML = GROUPS.map(g => '<section class="group" data-name="' + g.name + '"><h2>' + esc(g.label) + '</h2><div class="opts">' +
    g.options.map(o => '<div class="opt" data-v="' + o.v + '"><span class="big"><img alt="' + esc(g.label) + ', version ' + o.v.toUpperCase() + '" src="' + o.src + '"></span><div class="tiles"><span class="tile light"><img alt="" src="' + o.src + '"></span><span class="tile dark"><img alt="" src="' + o.src + '"></span></div><div class="row"><span class="tile"><img alt="" src="' + o.src + '"></span><b>' + esc(g.row) + '</b></div><button aria-pressed="false">Pick ' + o.v.toUpperCase() + '</button></div>').join('') +
    '</div><div class="foot"><button class="none" aria-pressed="false">None of these</button><input class="note" aria-label="Note on ' + esc(g.label) + '" placeholder="Note (optional)" autocomplete="off"><span class="saved"></span></div></section>').join('');

  const render = () => {
    let done = 0;
    for (const g of GROUPS) {
      const st = state[g.name] || {}; if (st.pick) done++;
      const sec = document.querySelector('.group[data-name="' + g.name + '"]');
      sec.querySelectorAll('.opt').forEach(o => { const on = st.pick === o.dataset.v; o.classList.toggle('on', on); o.querySelector('button').setAttribute('aria-pressed', on); });
      sec.querySelector('.none').setAttribute('aria-pressed', st.pick === 'none');
      const note = sec.querySelector('.note'); if (document.activeElement !== note && note.value !== (st.note || '')) note.value = st.note || '';
    }
    $('n-done').textContent = done;
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('t-light').setAttribute('aria-pressed', !dark); $('t-dark').setAttribute('aria-pressed', dark);
  };
  // One write at a time per icon; a change made while one is saving goes in the next.
  const save = async name => {
    const status = document.querySelector('.group[data-name="' + name + '"] .saved');
    if (!col) { status.textContent = 'Not saved'; return; }
    if (pending[name]) { pending[name] = 'again'; return; }
    pending[name] = true;
    try {
      do { if (pending[name] === 'again') pending[name] = true; await col.doc(name).set({ ...state[name], at: new Date().toISOString() }); } while (pending[name] === 'again');
      status.textContent = 'Saved';
    } catch { status.textContent = 'Not saved'; } finally { delete pending[name]; }
  };
  const change = (name, patch) => { state[name] = { ...(state[name] || {}), ...patch }; render(); save(name); };
  $('groups').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const name = b.closest('.group').dataset.name;
    const v = b.classList.contains('none') ? 'none' : b.closest('.opt').dataset.v;
    change(name, { pick: (state[name] || {}).pick === v ? null : v });
  });
  $('groups').addEventListener('change', e => { if (e.target.matches('.note')) change(e.target.closest('.group').dataset.name, { note: e.target.value.trim() }); });
  $('t-light').onclick = () => { document.documentElement.dataset.theme = 'light'; render(); };
  $('t-dark').onclick = () => { document.documentElement.dataset.theme = 'dark'; render(); };
  render();
  const offline = setTimeout(() => { $('offline').hidden = false; }, 10000);
  (async () => {
    const db = await window.claude?.use?.('db');
    if (!db) { clearTimeout(offline); $('offline').hidden = false; return; }
    col = db.collection(${JSON.stringify(COLLECTION)});
    col.onSnapshot(snap => {
      clearTimeout(offline);
      for (const d of snap.docs) if (d.exists && byName[d.id]) { const v = d.data() || {}; state[d.id] = { pick: v.pick || null, note: v.note || '' }; }
      render();
    }, () => { clearTimeout(offline); $('offline').hidden = false; });
  })();
}
</script>
`;
writeFileSync(out, html);
console.log(`${out}: ${Math.round(html.length / 1024)} KB`);
