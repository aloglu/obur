// Phase 0 phone probe client. Throwaway.
const $ = (id) => document.getElementById(id);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const { startRegistration, startAuthentication } = window.SimpleWebAuthnBrowser;

function log(id, text) {
	$(id).textContent = `${new Date().toLocaleTimeString()}  ${text}\n` + $(id).textContent;
}

async function api(method, path, body, headers = {}) {
	const isJson = body !== undefined && !(body instanceof Blob);
	const res = await fetch(path, {
		method, credentials: 'same-origin',
		headers: { 'x-probe': '1', ...(isJson ? { 'content-type': 'application/json' } : {}), ...headers },
		body: isJson ? JSON.stringify(body) : body
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
	return data;
}

$('env').textContent = [
	`Mode: ${standalone ? 'installed app (standalone)' : 'browser tab'}`,
	`Online: ${navigator.onLine}`,
	`Passkey API: ${'PublicKeyCredential' in window}`,
	`MediaRecorder: ${'MediaRecorder' in window}`,
	`Formats: ${['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
		.filter((t) => window.MediaRecorder?.isTypeSupported?.(t)).join(', ') || 'none'}`,
	`Service worker: ${'serviceWorker' in navigator}`
].join('\n');

// 1. Passkeys
async function refreshStatus() {
	try {
		const s = await api('GET', '/api/status');
		$('auth-status').textContent = `${s.signedIn ? 'Signed in' : 'Signed out'} · ${s.credentialCount} passkey(s) registered`;
		$('cred-list').replaceChildren(...s.credentials.map((c) => {
			const b = document.createElement('button');
			b.className = 'secondary';
			b.textContent = `Remove "${c.label}"`;
			b.onclick = async () => {
				if (!confirm(`Remove passkey "${c.label}" from the server?`)) return;
				try {
					const r = await api('POST', '/api/credentials/remove', { idPrefix: c.id });
					log('auth-log', `Removed ${r.removed}. ${r.signedOut ? 'This session used it, so it was signed out.' : ''}`);
				} catch (e) { log('auth-log', `Remove failed: ${e.message}`); }
				refreshStatus();
			};
			return b;
		}));
	} catch (e) { $('auth-status').textContent = `Status failed: ${e.message}`; }
}

$('register').onclick = async () => {
	try {
		const { options, challengeId } = await api('POST', '/api/register/options', { setupCode: $('setup-code').value.trim() });
		const response = await startRegistration({ optionsJSON: options });
		const r = await api('POST', '/api/register/verify', { challengeId, response, label: $('cred-label').value.trim() || 'passkey', standalone });
		log('auth-log', `Passkey created (${r.deviceType}, backed up: ${r.backedUp}). Signed in.`);
	} catch (e) { log('auth-log', `Create failed: ${e.name ?? ''} ${e.message}`); }
	refreshStatus();
};

$('login').onclick = async () => {
	try {
		const { options, challengeId } = await api('POST', '/api/login/options', {});
		const response = await startAuthentication({ optionsJSON: options });
		const r = await api('POST', '/api/login/verify', { challengeId, response, standalone });
		log('auth-log', `Signed in with "${r.label}".`);
	} catch (e) { log('auth-log', `Sign-in failed: ${e.name ?? ''} ${e.message}`); }
	refreshStatus();
};

$('logout').onclick = async () => { await api('POST', '/api/logout', {}); log('auth-log', 'Signed out.'); refreshStatus(); };

// 2. Camera
async function uploadPhoto(blob, source, clientMs) {
	const t0 = performance.now();
	try {
		const r = await api('POST', '/api/photo', blob, { 'content-type': blob.type || 'application/octet-stream', 'x-source': source, 'x-client-ms': String(Math.round(clientMs)) });
		log('photo-log', `${source}: ${r.type} ${r.width ?? '?'}×${r.height ?? '?'}, ${(r.bytes / 1e6).toFixed(2)} MB, upload ${Math.round(performance.now() - t0)} ms`);
	} catch (e) { log('photo-log', `${source} upload failed: ${e.message}`); }
}

$('photo-input').onchange = (ev) => {
	const file = ev.target.files?.[0];
	if (file) uploadPhoto(file, `picker (${file.type || 'no type'})`, 0);
	ev.target.value = '';
};

let stream;
$('cam-start').onclick = async () => {
	try {
		stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4032 }, height: { ideal: 3024 } }, audio: false });
		const v = $('video');
		v.srcObject = stream;
		v.style.display = 'block';
		await v.play();
		const track = stream.getVideoTracks()[0];
		const s = track.getSettings();
		const caps = track.getCapabilities?.() ?? {};
		log('photo-log', `Live camera ${s.width}×${s.height}; focus modes: ${caps.focusMode?.join(', ') ?? 'not exposed'}; torch: ${'torch' in caps}`);
	} catch (e) { log('photo-log', `Camera failed: ${e.name} ${e.message}`); }
};

$('cam-shot').onclick = async () => {
	const v = $('video');
	if (!stream) return log('photo-log', 'Start the live camera first.');
	const t0 = performance.now();
	const canvas = document.createElement('canvas');
	canvas.width = v.videoWidth;
	canvas.height = v.videoHeight;
	canvas.getContext('2d').drawImage(v, 0, 0);
	canvas.toBlob((blob) => uploadPhoto(blob, 'live capture', performance.now() - t0), 'image/jpeg', 0.9);
};

// 3. Voice: press and hold, or tap twice.
let recorder, chunks, recStarted;
async function startRec() {
	if (recorder?.state === 'recording') return;
	try {
		const media = await navigator.mediaDevices.getUserMedia({ audio: true });
		const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
		recorder = new MediaRecorder(media, type ? { mimeType: type } : undefined);
		chunks = [];
		recorder.ondataavailable = (e) => chunks.push(e.data);
		recorder.onstop = () => { media.getTracks().forEach((t) => t.stop()); sendAudio(); };
		recorder.start();
		recStarted = performance.now();
		$('rec').classList.add('recording');
		$('rec').textContent = 'Recording… release to send';
	} catch (e) { log('audio-log', `Microphone failed: ${e.name} ${e.message}`); }
}
function stopRec() {
	if (recorder?.state !== 'recording') return;
	recorder.stop();
	$('rec').classList.remove('recording');
	$('rec').textContent = 'Hold to record';
}
async function sendAudio() {
	const stopped = performance.now();
	const blob = new Blob(chunks, { type: recorder.mimeType });
	log('audio-log', `Sending ${(blob.size / 1024).toFixed(0)} KB ${blob.type}, held ${((stopped - recStarted) / 1000).toFixed(1)} s…`);
	try {
		const r = await api('POST', '/api/audio', blob, { 'content-type': blob.type, 'x-model': $('model').value, 'x-standalone': standalone ? '1' : '0' });
		const total = performance.now() - stopped;
		log('audio-log', r.error ? `Server: ${r.error}` :
			`"${r.text}"\n  ${r.servedModel}, ${r.language}, audio ${r.audioS}s · release→result ${(total / 1000).toFixed(2)} s ` +
			`(upload ${r.receiveMs} ms, queue ${r.queueMs} ms, decode ${r.decodeMs} ms, speech ${r.asrMs} ms)`);
	} catch (e) { log('audio-log', `Failed: ${e.message}`); }
}
const rec = $('rec');
rec.addEventListener('pointerdown', (e) => { e.preventDefault(); startRec(); });
rec.addEventListener('pointerup', stopRec);
rec.addEventListener('pointercancel', stopRec);
rec.addEventListener('contextmenu', (e) => e.preventDefault());

// 4. Offline queue in IndexedDB; sent on load, reconnection and when the app returns to the foreground.
const dbp = new Promise((resolve, reject) => {
	const req = indexedDB.open('obur-probe', 1);
	req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'operationId' });
	req.onsuccess = () => resolve(req.result);
	req.onerror = () => reject(req.error);
});
async function store(mode, fn) {
	const db = await dbp;
	return new Promise((resolve, reject) => {
		const tx = db.transaction('queue', mode);
		const out = fn(tx.objectStore('queue'));
		tx.oncomplete = () => resolve(out?.result);
		tx.onerror = () => reject(tx.error);
	});
}
let lastSent;
let flushing = false;
async function flush(reason) {
	if (flushing) return;
	flushing = true;
	try {
		const items = await store('readonly', (s) => s.getAll());
		for (const item of items) {
			item.attempts += 1;
			await store('readwrite', (s) => s.put(item));
			try {
				const r = await api('POST', '/api/entries', item);
				await store('readwrite', (s) => s.delete(item.operationId));
				lastSent = item;
				log('queue-log', `Sent "${item.payload.text}" (${reason}, attempt ${item.attempts}, waited ${(r.queuedFor / 1000).toFixed(0)} s, replayed: ${r.replayed})`);
			} catch (e) {
				log('queue-log', `Kept "${item.payload.text}" locally: ${e.message}`);
				break;
			}
		}
		const left = await store('readonly', (s) => s.count());
		if (left) log('queue-log', `${left} entry/entries pending (not on the server yet)`);
	} finally { flushing = false; }
}
$('entry-add').onclick = async () => {
	const item = { operationId: crypto.randomUUID(), recordId: crypto.randomUUID(), attempts: 0,
		payload: { text: $('entry-text').value.trim() || 'test', zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
		queuedAt: new Date().toISOString(), createdOffline: !navigator.onLine };
	await store('readwrite', (s) => s.put(item));
	log('queue-log', `Saved locally: "${item.payload.text}" (${navigator.onLine ? 'online' : 'offline'})`);
	$('entry-text').value = '';
	flush('after add');
};
$('entry-flush').onclick = () => flush('manual');
$('entry-dup').onclick = async () => {
	if (!lastSent) return log('queue-log', 'Send something first.');
	try {
		const r = await api('POST', '/api/entries', lastSent);
		log('queue-log', `Duplicate of "${lastSent.payload.text}": replayed ${r.replayed} (expected true)`);
	} catch (e) { log('queue-log', `Duplicate failed: ${e.message}`); }
};
addEventListener('online', () => flush('online event'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush('foreground'); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((e) => log('queue-log', `SW failed: ${e.message}`));
refreshStatus();
flush('page load');
