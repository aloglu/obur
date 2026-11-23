<script lang="ts">
	// docs/ui.md "Speak": a pulsing mic with "Listening… say what you ate", an example and Done; then the transcription
	// (the server's add-on or the person's own key), handed to the same confirmation as typed text. The recording lives
	// only in this page's memory until it is sent, and is kept there for Try again; the server does not keep it.
	// The microphone's raw samples go through an AudioWorklet and become a 16 kHz WAV here, which the speech add-on reads
	// without FFmpeg (2026-11-22 audits A11/G02/G03; tested on an iPhone, Safari and Home Screen, 2026-11-23).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { PROVIDER_NAME, type RemoteError, type Source } from '#lib/shared/remote-models.ts';
	import { REMOTE_ERRORS, remoteProblem, type RemoteProblem } from '../remote-problem.ts';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Timer from '@lucide/svelte/icons/timer';
	import { m } from '#lib/paraglide/messages.js';
	import { accountHeaders, wrongAccount } from '#lib/client/account.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { recordingWav } from '#lib/client/wav.ts';
	import type { ParsedEntry } from '#lib/shared/entry-types.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';

	interface Props {
		date: string;
		/** What reads the recording: the server's add-on or the person's own key. */
		source: Source;
		/** The server has its own add-on, for "Read this one on obur's server instead". */
		local: boolean;
		onheard: (entry: ParsedEntry) => void;
		ontype: () => void;
		onclose: () => void;
	}
	let { date, source, local, onheard, ontype, onclose }: Props = $props();

	const MAX_SECONDS = 30;
	/** How long the browser may take to start sound once the microphone is on. */
	const START_MS = 4000;
	type Phase = 'starting' | 'listening' | 'working' | 'failed';
	type Problem = { title: string; line: string; tone: 'info' | 'warn' | 'bad'; icon: typeof Mic };
	const P = {
		offline: () => ({
			title: m.speak_offline(),
			line: m.speak_offline_line(),
			tone: 'warn',
			icon: CloudOff
		}),
		blocked: () => ({
			title: m.speak_mic_blocked(),
			line: m.speak_mic_blocked_line(),
			tone: 'warn',
			icon: MicOff
		}),
		missing: () => ({
			title: m.speak_mic_missing(),
			line: m.speak_mic_missing_line(),
			tone: 'warn',
			icon: MicOff
		}),
		nothing: () => ({
			title: m.speak_nothing_heard(),
			line: m.speak_nothing_line(),
			tone: 'info',
			icon: Mic
		}),
		long: () => ({
			title: m.speak_too_long(),
			line: m.speak_too_long_line(),
			tone: 'info',
			icon: Mic
		}),
		busy: () => ({
			title: m.speak_busy(),
			line: m.speak_busy_line(),
			tone: 'warn',
			icon: Hourglass
		}),
		limited: () => ({
			title: m.speak_limited(),
			line: m.speak_limited_line(),
			tone: 'warn',
			icon: Timer
		}),
		noSound: () => ({
			title: m.speak_no_sound(),
			line: m.speak_no_sound_line(),
			tone: 'warn',
			icon: MicOff
		}),
		noRecorder: () => ({
			title: m.speak_no_recorder(),
			line: m.speak_no_recorder_line(),
			tone: 'warn',
			icon: MicOff
		}),
		unavailable: () => ({
			title: m.speak_unavailable(),
			line: m.speak_unavailable_line(),
			tone: 'bad',
			icon: CircleAlert
		})
	} satisfies Record<string, () => Problem>;
	let phase = $state<Phase>('starting');
	let problem = $state<Problem | null>(null);
	/** A company's model gave no answer: its own card and fix. */
	let remote = $state<RemoteProblem | null>(null);
	/** The last recording, until it is understood: Try again sends it again. */
	let lastAudio: Blob | null = null;
	/** When it was recorded: "yesterday" counts from then, also when it is sent again later (A25). */
	let recordedAt = '';
	/** The last failure can be fixed by sending the same recording again (the server was busy or unreachable). */
	let resend = $state(false);
	/** The sheet was closed: a microphone permission answered after that must not start recording (A29). */
	let closed = false;
	let seconds = $state(0);
	let stream: MediaStream | undefined;
	let context: AudioContext | undefined;
	/** The microphone's samples so far, in 128-sample blocks at the context's own rate. */
	let parts: Float32Array[] = [];
	/** How many samples `parts` holds: the recording stops at 30 s of sound, also when timers run late. */
	let sampleCount = 0;
	let recording = false;
	let ticker: ReturnType<typeof setInterval> | undefined;
	/** The recording being sent: closing the sheet stops it (2026-11-23 Gemini audit 2, H21). */
	let sending: AbortController | undefined;

	/** Stops the microphone and the audio graph; what was recorded stays in `parts`. */
	function stopTracks() {
		clearInterval(ticker);
		recording = false;
		stream?.getTracks().forEach((t) => t.stop());
		stream = undefined;
		context?.close().catch(() => {});
		context = undefined;
	}

	async function start() {
		phase = 'starting';
		problem = null;
		remote = null;
		lastAudio = null;
		resend = false;
		seconds = 0;
		parts = [];
		sampleCount = 0;
		phase = 'starting';
		if (!navigator.onLine) return fail(P.offline());
		if (typeof AudioWorkletNode === 'undefined') return fail(P.noRecorder());
		// Made before anything is awaited, so it still counts as the tap that opened Speak (iPhones need that to start
		// sound); its real rate is read later (44.1, 48 or 16 kHz, also with Bluetooth). A browser can refuse to make
		// one (too many open, no sound device): that is said, not left on a blank sheet (Gemini audit 2, H07).
		let audio: AudioContext;
		try {
			audio = new AudioContext();
		} catch {
			return fail(P.noSound());
		}
		context = audio;
		audio.resume().catch(() => {});
		let granted: MediaStream;
		try {
			granted = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e) {
			const name = (e as DOMException).name;
			return fail(name === 'NotFoundError' ? P.missing() : P.blocked());
		}
		if (closed || context !== audio) {
			granted.getTracks().forEach((t) => t.stop());
			audio.close().catch(() => {});
			return;
		}
		stream = granted;
		// Asked again now that the microphone is on. A browser with no sound device never starts it (Firefox in the
		// test container, 2026-11-23): say so instead of waiting for good.
		const started = await running(audio);
		if (closed || context !== audio) return;
		if (!started) return fail(P.noSound());
		try {
			await audio.audioWorklet.addModule(asset('speak-tap.js'));
			if (closed || context !== audio) return;
			const tap = new AudioWorkletNode(audio, 'speak-tap');
			const most = audio.sampleRate * MAX_SECONDS;
			tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
				if (!recording) return;
				parts.push(e.data);
				sampleCount += e.data.length;
				if (sampleCount >= most) done();
			};
			// Through a silent gain, so the graph runs without playing the microphone back.
			const silent = audio.createGain();
			silent.gain.value = 0;
			audio.createMediaStreamSource(granted).connect(tap);
			tap.connect(silent);
			silent.connect(audio.destination);
		} catch {
			return fail(P.noRecorder());
		}
		recordedAt = new Date().toISOString();
		recording = true;
		phase = 'listening';
		ticker = setInterval(() => {
			seconds += 1;
			if (seconds >= MAX_SECONDS) done();
		}, 1000);
	}

	/** The audio context is running, or starts within a few seconds. */
	async function running(audio: AudioContext): Promise<boolean> {
		if (audio.state === 'running') return true;
		const late = new Promise<void>((r) => setTimeout(r, START_MS));
		await Promise.race([audio.resume().catch(() => {}), late]);
		// Read again: the state changed while this waited.
		return (audio.state as AudioContextState) === 'running';
	}

	function done() {
		if (!recording || !context) return stopTracks();
		const rate = context.sampleRate;
		stopTracks();
		lastAudio = recordingWav(parts, rate, MAX_SECONDS);
		parts = [];
		send();
	}

	function fail(message: Problem, canResend = false) {
		stopTracks();
		problem = message;
		resend = canResend && lastAudio !== null;
		phase = 'failed';
	}

	/** Try again: the same recording when only the sending failed, otherwise a new one (A30). */
	const tryAgain = () => (resend ? send() : start());

	/** The recording in `lastAudio`, new or kept for Try again (`viaServer`: this once on the server's add-on). */
	async function send(viaServer = false) {
		phase = 'working';
		problem = null;
		remote = null;
		const audio = lastAudio!;
		sending?.abort();
		const request = new AbortController();
		sending = request;
		try {
			const response = await fetch(
				`/api/v1/speech?date=${date}&zone=${encodeURIComponent(deviceZone())}&at=${encodeURIComponent(recordedAt)}${viaServer ? '&via=server' : ''}`,
				{
					method: 'POST',
					headers: { 'content-type': audio.type, ...accountHeaders() },
					body: audio,
					signal: request.signal
				}
			);
			const body = (await response.json().catch(() => ({}))) as {
				entry?: ParsedEntry;
				error?: string;
			};
			// Closed while it was being read: nothing opens behind the person's back (2026-11-22 Gemini audit, G29).
			if (closed) return;
			if (response.ok && body.entry) return onheard(body.entry);
			if (wrongAccount(body.error ?? '', response.status)) return;
			if (source !== 'server' && !viaServer && REMOTE_ERRORS.includes(body.error ?? '')) {
				remote = remoteProblem(body.error as RemoteError, source, 'speak');
				phase = 'failed';
				return;
			}
			const problems: Record<string, () => Problem> = {
				nothing_heard: P.nothing,
				too_long: P.long,
				too_large: P.long,
				busy: P.busy,
				limited: P.limited
			};
			// Busy, limited for now or unavailable: the recording itself was fine.
			const again = !['nothing_heard', 'too_long', 'too_large', 'decode_failed'].includes(
				body.error ?? ''
			);
			fail((problems[body.error ?? ''] ?? P.unavailable)(), again);
		} catch {
			if (closed) return;
			fail(P.unavailable(), true);
		}
	}

	function fix() {
		if (!remote) return;
		if (remote.fix === 'settings') goto(resolve('/(app)/more/speak-and-scan'));
		else if (remote.fix === 'retry') send();
		else start();
	}

	onMount(() => {
		start();
		return () => {
			closed = true;
			sending?.abort();
			stopTracks(); // closing the sheet discards the recording
			parts = [];
		};
	});
</script>

<Sheet title={m.speak_title()} {onclose}>
	{#if phase === 'failed' && remote}
		<Notice tone={remote.tone} title={remote.title}>
			{remote.line}
			{#snippet actions()}
				<div class="flex flex-col gap-2">
					<Button wide onclick={fix}>{remote!.fixLabel}</Button>
					<Button wide variant="ghost" onclick={ontype}>{m.speak_type_instead()}</Button>
					{#if local}
						<button
							type="button"
							onclick={() => send(true)}
							class="min-h-11 text-[0.9375rem] font-[650] text-accent"
							>{m.remote_via_server()}</button
						>
					{/if}
				</div>
			{/snippet}
		</Notice>
	{:else if phase === 'failed' && problem}
		<Notice tone={problem.tone} title={problem.title} icon={problem.icon}>
			{problem.line}
			{#snippet actions()}
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={ontype}>{m.speak_type_instead()}</Button>
					<Button onclick={tryAgain}>{m.speak_try_again()}</Button>
				</div>
			{/snippet}
		</Notice>
	{:else}
		<!-- The whole layout from the first frame, so the sheet slides in at its full size instead of growing when the
		     microphone starts (owner, 2026-11-23); Done waits for the microphone. -->
		<div class="flex flex-col items-center gap-4 py-2 text-center">
			<span
				class={[
					'grid size-24 place-items-center rounded-full bg-voice-bg text-voice',
					phase === 'listening' && 'mic-pulse'
				]}
			>
				<Mic size={44} aria-hidden="true" />
			</span>
			<!-- Only the phase is read aloud: a screen reader saying the seconds would talk into the open microphone
			     (2026-11-23 Gemini audit 2, H02). -->
			<p aria-live="polite" class="text-[1.1875rem] font-bold">
				{phase === 'listening'
					? m.speak_listening()
					: phase === 'working'
						? m.speak_working()
						: m.speak_starting()}
			</p>
			<p class="text-[0.875rem] text-muted">{m.speak_example()}</p>
			<p class="text-[0.8125rem] text-muted tabular-nums">
				{m.speak_elapsed({ seconds: String(seconds) })}
			</p>
		</div>
		<Button wide disabled={phase !== 'listening'} onclick={done}>{m.speak_done()}</Button>
		{#if source !== 'server'}
			<p class="text-center text-[0.8125rem] text-muted">
				{m.speak_via({ provider: PROVIDER_NAME[source] })}
			</p>
		{/if}
	{/if}
</Sheet>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.mic-pulse {
			animation: mic-pulse 700ms ease-in-out infinite alternate;
		}
	}
	@keyframes mic-pulse {
		from {
			box-shadow: 0 0 0 0 var(--color-voice-bg);
		}
		to {
			box-shadow: 0 0 0 14px var(--color-voice-bg);
		}
	}
</style>
