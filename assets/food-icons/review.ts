// Writes the owner's review page for a batch of icons (docs/ui.md, "Our own food icon set": how a batch is reviewed):
// the Foods screen at real size, light and dark, and keep or redo with a note per icon, saved in the page's database
// (published as a private Claude artifact with the `db` capability; Claude reads the verdicts from the collection).
// No guessing round: the owner asked that it never be made again (2026-11-28).
//   node assets/food-icons/review.ts <out.html>
// DECIDE=a,b,c asks only about those icons (a later round); COLLECTION names the round's collection; INTRO replaces
// the opening line. BATCH picks the batch's Foods rows from batches.ts (default 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { BATCHES } from './batches.ts';

const dir = 'assets/food-icons/svg';
const [out] = process.argv.slice(2);
if (!out) throw new Error('Usage: node assets/food-icons/review.ts <out.html>');
// A later round decides only the redrawn icons, in its own collection; the Foods screen still shows the whole batch.
const DECIDE = process.env.DECIDE ? process.env.DECIDE.split(',') : null;
const COLLECTION = process.env.COLLECTION || 'verdicts';

const batch = BATCHES[Number(process.env.BATCH || 1)];
if (!batch) throw new Error(`No batch ${process.env.BATCH}: see batches.ts.`);
const ICONS = batch.rows.map(([name, row, detail, kcal, pilot]) => ({
	name,
	label: name.replace(/_/g, ' '),
	row,
	detail,
	kcal,
	pilot: !!pilot,
	src: 'data:image/svg+xml;base64,' + readFileSync(`${dir}/${name}.svg`).toString('base64')
}));

const INTRO = process.env.INTRO || batch.intro;

const html = `<title>Icons batch ${process.env.BATCH || 1}: ${batch.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Inter:wght@400..800&display=swap" rel="stylesheet">
<style>
/* VOICE everyday: the owner reviewing a batch of their app's icons
   IDEA obur's own review step: see it in the app, decide
   PICTURE the icons themselves, in tiles and in the Foods screen
   COLOUR Pazar tokens, light and dark
   TYPE Bricolage Grotesque titles + Inter, as in the app
   LAYOUT the Foods screen beside the verdicts on wide screens, stacked on phones */
:root{--bg:#f6f3ee;--surface:#fff;--surface2:#f1ebe3;--line:#e5ddd2;--text:#1e1a16;--muted:#665d53;--accent:#c2410c;--on-accent:#fff;--good:#2e7d3b;--bad:#c62f3a;--soft:#fdf0e7;--icon-tile:#f3ece3;--shadow:0 1px 2px rgba(60,40,20,.06),0 8px 24px rgba(60,40,20,.08);--bezel:#2a241f;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;--good:#6ccb7a;--bad:#ff6b6b;--soft:#3d2619;--icon-tile:#332c26;--shadow:0 1px 2px rgba(0,0,0,.5);--bezel:#3a332c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#161310;--surface:#211d19;--surface2:#2c2722;--line:#3a332c;--text:#f4eee7;--muted:#b6ab9f;--accent:#ff8f55;--on-accent:#2a1304;--good:#6ccb7a;--bad:#ff6b6b;--soft:#3d2619;--icon-tile:#332c26;--shadow:0 1px 2px rgba(0,0,0,.5);--bezel:#3a332c;color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{background:var(--bg);color:var(--text);font:16px/1.45 'Inter',system-ui,sans-serif;margin:0;overflow-x:clip}
h1,h2{font-family:'Bricolage Grotesque','Inter',system-ui,sans-serif;margin:0;letter-spacing:-.01em}
.wrap{max-width:1080px;margin:0 auto;padding-block:28px 64px;padding-left:max(5vw,16px,env(safe-area-inset-left,0px));padding-right:max(5vw,16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:36px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:16px}
header h1{font-size:2.25rem;font-weight:750;line-height:1.05}
header p{margin:8px 0 0;color:var(--muted);max-width:60ch}
.count{display:flex;gap:10px;flex-wrap:wrap}
.chip{background:var(--surface);box-shadow:var(--shadow);border-radius:14px;padding:10px 14px;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
.chip b{color:var(--accent)}
.step{display:flex;flex-direction:column;gap:14px}
.step>h2{font-size:1.5rem;font-weight:750}
.step>p{margin:0;color:var(--muted);max-width:68ch}
.note{font:inherit;font-size:16px;width:100%;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface2);color:var(--text);padding:0 12px}
.note:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:1px}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
button{font:inherit;cursor:pointer}
.ghost{border:1px solid var(--line);background:var(--surface);color:var(--text);min-height:44px;padding:0 16px;border-radius:14px;font-weight:650}
.seg{display:inline-flex;background:var(--surface2);border:1px solid var(--line);border-radius:14px;padding:3px}
.seg button{border:0;background:none;color:var(--text);min-height:38px;padding:0 14px;border-radius:10px;font-weight:650}
.seg button[aria-pressed="true"]{background:var(--surface);box-shadow:var(--shadow);color:var(--accent)}
.split{display:grid;grid-template-columns:400px minmax(0,1fr);gap:32px;align-items:start}
.phone{width:400px;height:820px;border-radius:52px;background:var(--bezel);padding:10px;position:sticky;top:20px}
.screen{height:100%;border-radius:42px;background:var(--bg);overflow:auto;scrollbar-width:none}
.screen::-webkit-scrollbar{display:none}
.status{position:sticky;top:0;z-index:2;background:var(--bg);display:flex;justify-content:space-between;padding:14px 28px 6px;font-size:.9375rem;font-weight:650}
.app{display:flex;flex-direction:column;gap:12px;padding:8px 14px 28px}
.app h3{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:1.5rem;font-weight:750;margin:0 0 0 4px}
.card{background:var(--surface);border-radius:22px;box-shadow:var(--shadow);padding:0 18px 8px}
.listhead{display:flex;justify-content:space-between;padding:10px 0 2px;font-size:.78125rem;font-weight:650;color:var(--muted)}
.card ul{list-style:none;margin:0 -10px;padding:0}
.row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:56px;padding:6px 10px}
.tile{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--icon-tile);flex-shrink:0}
.tile img{width:29px;height:29px}
.tile.light{background:#f3ece3}.tile.dark{background:#332c26}
.row b{display:block;font-size:.9375rem;font-weight:600}
.row small{display:block;font-size:.8125rem;color:var(--muted)}
.row .k{font-size:.9375rem;font-weight:600;font-variant-numeric:tabular-nums}
.verdicts{display:flex;flex-direction:column;gap:10px}
.v{background:var(--surface);border-radius:22px;box-shadow:var(--shadow);padding:14px 16px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 16px;align-items:center}
.v .look{display:flex;gap:8px;align-items:center}
.v .big{width:72px;height:72px;border-radius:16px;background:var(--icon-tile);display:grid;place-items:center}
.v .big img{width:52px;height:52px}
.v .name{font-weight:700;font-size:1.0625rem}
.v .name small{font-weight:600;font-size:.8125rem;color:var(--muted);margin-left:6px}
.v .acts{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.v .acts .note{flex:1 1 220px}
.keep,.redo{min-height:44px;padding:0 18px;border-radius:14px;border:1px solid var(--line);background:var(--surface2);color:var(--text);font-weight:700}
.keep[aria-pressed="true"]{background:var(--good);border-color:var(--good);color:#fff}
.redo[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
.saved{font-size:.8125rem;color:var(--muted);min-width:6em}
.warn{background:var(--soft);border-radius:14px;padding:12px 14px;margin:0}
@media (max-width:860px){.split{grid-template-columns:minmax(0,1fr)}.phone{position:static;width:auto;height:auto;border-radius:0;background:none;padding:0;margin-inline:calc(-1*max(5vw,16px))}.screen{border-radius:0;border-block:1px solid var(--line)}.status{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
  <header>
    <div>
      <h1>Icons, batch ${process.env.BATCH || 1}: ${batch.title}</h1>
      <p>${INTRO} Your answers save as you go, and Claude reads them from this page.</p>
    </div>
    <div class="count"><span class="chip">Decided <b id="n-done">0</b> of ${(DECIDE || ICONS).length}</span></div>
  </header>
  <p class="warn" id="offline" hidden>This view can’t save. Open the page on claude.ai while signed in, and your answers will be kept.</p>

  <section class="step">
    <h2>In the app, then keep or redo</h2>
    <p>The Foods screen at real size, beside the decisions. Look at it on your phone too. Redo with a short note on what's off (shape, colour, too busy, too small).</p>
    <div class="tools"><span>Mode</span><div class="seg" role="group" aria-label="Mode"><button id="t-light">Light</button><button id="t-dark">Dark</button></div></div>
    <div class="split">
      <div class="phone"><div class="screen"><div class="status" aria-hidden="true"><span>9:41</span><span>●●●</span></div>
        <div class="app"><h3>Foods</h3><section class="card"><div class="listhead"><span>Your foods and scans</span><span>kcal</span></div><ul id="rows"></ul></section></div>
      </div></div>
      <div class="verdicts" id="verdicts"></div>
    </div>
  </section>
</div>

<script>
{
  const ICONS = ${JSON.stringify(ICONS).replace(/</g, '\\u003c')};
  const byName = Object.fromEntries(ICONS.map(i => [i.name, i]));
  const DECIDE = ${JSON.stringify(DECIDE)};
  const ASK = DECIDE ? ICONS.filter(i => DECIDE.includes(i.name)) : ICONS;
  const state = {}; // name -> {verdict, note}
  let db = null, col = null;
  const pending = {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);

  // Rows and tiles are built once; later changes only update text and buttons, so typing is never interrupted.
  $('rows').innerHTML = ICONS.map(i => '<li class="row"><span class="tile"><img alt="" src="' + i.src + '"></span><span><b>' + esc(i.row) + '</b><small>' + esc(i.detail) + '</small></span><span class="k">' + esc(i.kcal) + '</span></li>').join('');
  $('verdicts').innerHTML = ASK.map(i => '<div class="v" data-name="' + i.name + '"><div class="look"><span class="big"><img alt="" src="' + i.src + '"></span><span class="tile light"><img alt="" src="' + i.src + '"></span><span class="tile dark"><img alt="" src="' + i.src + '"></span></div><div class="name">' + esc(i.label) + (i.pilot ? '<small>pilot</small>' : '') + '</div><div class="acts"><button class="keep" aria-pressed="false">Keep</button><button class="redo" aria-pressed="false">Redo</button><input class="note" id="n-' + i.name + '" aria-label="Note on ' + esc(i.label) + '" placeholder="Note (optional)" autocomplete="off"><span class="saved" id="s-' + i.name + '"></span></div></div>').join('');

  const render = () => {
    let done = 0;
    for (const i of ASK) {
      const st = state[i.name] || {};
      if (st.verdict) done++;
      const card = document.querySelector('.v[data-name="' + i.name + '"]');
      card.querySelector('.keep').setAttribute('aria-pressed', st.verdict === 'keep');
      card.querySelector('.redo').setAttribute('aria-pressed', st.verdict === 'redo');
      const note = $('n-' + i.name);
      if (document.activeElement !== note && note.value !== (st.note || '')) note.value = st.note || '';
    }
    $('n-done').textContent = done;
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('t-light').setAttribute('aria-pressed', !dark); $('t-dark').setAttribute('aria-pressed', dark);
  };

  // One write at a time per icon; a change made while one is saving goes in the next.
  const save = async name => {
    const status = $('s-' + name);
    if (!col) { if (status) status.textContent = 'Not saved'; return; }
    if (pending[name]) { pending[name] = 'again'; return; }
    pending[name] = true;
    try {
      do {
        if (pending[name] === 'again') pending[name] = true;
        await col.doc(name).set({ ...state[name], at: new Date().toISOString() });
      } while (pending[name] === 'again');
      if (status) status.textContent = 'Saved';
    } catch (e) {
      if (status) status.textContent = 'Not saved';
    } finally { delete pending[name]; }
  };
  const change = (name, patch) => { state[name] = { ...(state[name] || {}), ...patch }; render(); save(name); };

  $('verdicts').addEventListener('click', e => {
    const b = e.target.closest('.keep,.redo'); if (!b) return;
    const name = b.closest('.v').dataset.name; const v = b.classList.contains('keep') ? 'keep' : 'redo';
    change(name, { verdict: (state[name] || {}).verdict === v ? null : v });
  });
  $('verdicts').addEventListener('change', e => { const t = e.target; if (t.matches('.note')) change(t.closest('.v').dataset.name, { note: t.value.trim() }); });
  $('t-light').onclick = () => { document.documentElement.dataset.theme = 'light'; render(); };
  $('t-dark').onclick = () => { document.documentElement.dataset.theme = 'dark'; render(); };
  render();

  const offline = setTimeout(() => { $('offline').hidden = false; }, 10000);
  (async () => {
    db = await window.claude?.use?.('db');
    if (!db) { clearTimeout(offline); $('offline').hidden = false; return; }
    col = db.collection(${JSON.stringify(COLLECTION)});
    col.onSnapshot(snap => {
      clearTimeout(offline);
      for (const d of snap.docs) if (d.exists && byName[d.id]) { const v = d.data() || {}; state[d.id] = { verdict: v.verdict || null, note: v.note || '' }; }
      render();
    }, () => { clearTimeout(offline); $('offline').hidden = false; });
  })();
}
</script>
`;
writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' KB');
