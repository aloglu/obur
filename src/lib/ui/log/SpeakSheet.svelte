<script lang="ts">
	// docs/ui.md "Speak": a pulsing mic with "Listening… say what you ate", an example and Done; then the server's
	// transcription, handed to the same confirmation as typed text. The recording lives only in this page's memory
	// until it is sent; the server does not keep it.
	import { onMount } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Mic from '@lucide/svelte/icons/mic';
	import MicOff from '@lucide/svelte/icons/mic-off';
	import Timer from '@lucide/svelte/icons/timer';
	import { m } from '#lib/paraglide/messages.js';
	import { deviceZone } from '#lib/client/prefs.ts';
	import type { ParsedEntry } from '#lib/shared/entry-types.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';

	interface Props {
		date: string;
		onheard: (entry: ParsedEntry) => void;
		ontype: () => void;
		onclose: () => void;
	}
	let { date, onheard, ontype, onclose }: Props = $props();

	const MAX_SECONDS = 30;
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
		unavailable: () => ({
			title: m.speak_unavailable(),
			line: m.speak_unavailable_line(),
			tone: 'bad',
			icon: CircleAlert
		})
	} satisfies Record<string, () => Problem>;
	let phase = $state<Phase>('starting');
	let problem = $state<Problem | null>(null);
	let seconds = $state(0);
	let recorder: MediaRecorder | undefined;
	let stream: MediaStream | undefined;
	let chunks: Blob[] = [];
	let ticker: ReturnType<typeof setInterval> | undefined;

	/** A format the server can decode: Safari records MP4 (AAC), Chrome and Firefox WebM or Ogg (Opus). */
	const mimeType = () =>
		['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) =>
			MediaRecorder.isTypeSupported(t)
		);

	function stopTracks() {
		clearInterval(ticker);
		stream?.getTracks().forEach((t) => t.stop());
		stream = undefined;
	}

	async function start() {
		phase = 'starting';
		problem = null;
		seconds = 0;
		chunks = [];
		if (!navigator.onLine) return fail(P.offline());
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e) {
			const name = (e as DOMException).name;
			return fail(name === 'NotFoundError' ? P.missing() : P.blocked());
		}
		const type = mimeType();
		recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
		recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
		recorder.onstop = send;
		recorder.start();
		phase = 'listening';
		ticker = setInterval(() => {
			seconds += 1;
			if (seconds >= MAX_SECONDS) done();
		}, 1000);
	}

	function done() {
		if (recorder?.state === 'recording') recorder.stop();
		stopTracks();
	}

	function fail(message: Problem) {
		stopTracks();
		problem = message;
		phase = 'failed';
	}

	async function send() {
		phase = 'working';
		const audio = new Blob(chunks, { type: recorder?.mimeType || 'audio/mp4' });
		chunks = [];
		try {
			const response = await fetch(
				`/api/v1/speech?date=${date}&zone=${encodeURIComponent(deviceZone())}`,
				{ method: 'POST', headers: { 'content-type': audio.type }, body: audio }
			);
			const body = (await response.json().catch(() => ({}))) as {
				entry?: ParsedEntry;
				error?: string;
			};
			if (response.ok && body.entry) return onheard(body.entry);
			const problems: Record<string, () => Problem> = {
				nothing_heard: P.nothing,
				too_long: P.long,
				too_large: P.long,
				busy: P.busy,
				limited: P.limited
			};
			fail((problems[body.error ?? ''] ?? P.unavailable)());
		} catch {
			fail(P.unavailable());
		}
	}

	onMount(() => {
		start();
		return () => {
			if (recorder?.state === 'recording') {
				recorder.onstop = null; // closing the sheet discards the recording
				recorder.stop();
			}
			stopTracks();
		};
	});
</script>

<Sheet title={m.speak_title()} {onclose}>
	{#if phase === 'failed' && problem}
		<Notice tone={problem.tone} title={problem.title} icon={problem.icon}>
			{problem.line}
			{#snippet actions()}
				<div class="grid grid-cols-2 gap-2">
					<Button onclick={start}>{m.speak_try_again()}</Button>
					<Button variant="ghost" onclick={ontype}>{m.speak_type_instead()}</Button>
				</div>
			{/snippet}
		</Notice>
	{:else}
		<div class="flex flex-col items-center gap-4 py-2 text-center" aria-live="polite">
			<span
				class={[
					'grid size-24 place-items-center rounded-full bg-voice-bg text-voice',
					phase === 'listening' && 'mic-pulse'
				]}
			>
				<Mic size={44} aria-hidden="true" />
			</span>
			{#if phase === 'listening'}
				<p class="text-[1.1875rem] font-bold">{m.speak_listening()}</p>
				<p class="text-[0.875rem] text-muted">{m.speak_example()}</p>
				<p class="text-[0.8125rem] text-muted tabular-nums">
					{m.speak_elapsed({ seconds: String(seconds) })}
				</p>
			{:else if phase === 'working'}
				<p class="text-[1.1875rem] font-bold">{m.speak_working()}</p>
			{/if}
		</div>
	{/if}
	{#if phase === 'listening'}
		<Button wide onclick={done}>{m.speak_done()}</Button>
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
