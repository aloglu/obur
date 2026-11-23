<script lang="ts" module>
	/** The camera was refused, or there is none: not asked again while the app stays open (audit S11). */
	let refused = false;
</script>

<script lang="ts">
	// Scan a label (docs/ui.md, "Scan"), as a sheet like Speak and Type it: take or choose a photo of the nutrition
	// table; it is made smaller on the phone (which also drops its location data) and read on the server, waiting in
	// line when the scanner is busy. The frame shows the camera live from the start, as Speak listens at once, and
	// Take photo or a tap on the frame takes what it shows (owner, 2026-11-23); without a camera the page may use
	// (refused, none, an old browser) Take photo opens the phone's own. What was read goes to `onread`, which shows it
	// as a food form to check; nothing is saved here. The photo is never kept on the server.
	import { onMount } from 'svelte';
	import Camera from '@lucide/svelte/icons/camera';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Focus from '@lucide/svelte/icons/focus';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImageOff from '@lucide/svelte/icons/image-off';
	import Table2 from '@lucide/svelte/icons/table-2';
	import Timer from '@lucide/svelte/icons/timer';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { accountHeaders, wrongAccount } from '#lib/client/account.ts';
	import { BY_HAND, type LabelProposal, type ScanResult } from '#lib/client/scan-result.svelte.ts';
	import { PROVIDER_NAME, type RemoteError, type Source } from '#lib/shared/remote-models.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import { REMOTE_ERRORS, remoteProblem, type RemoteProblem } from '../remote-problem.ts';
	import Sheet from '../Sheet.svelte';

	interface Props {
		/** What reads the photo: the server's add-on or the person's own key. */
		source: Source;
		/** The server's add-on is there too, to try when the person's key fails. */
		local: boolean;
		onread: (result: ScanResult) => void;
		onclose: () => void;
	}
	let { source, local, onread, onclose }: Props = $props();

	let reading = $state(false);
	/** Waiting in line while the scanner reads other photos: how many are ahead. */
	let waiting = $state<number | null>(null);
	/** Each photo's attempt; a newer photo, Fill in by hand or closing ends the wait for an older one. */
	let attempt = 0;
	const RETRY_MS = 3000;
	const GIVE_UP_MS = 120_000;
	type Problem = { title: string; line: string; icon: typeof Camera };
	const P = {
		noTable: () => ({ title: m.scan_no_table(), line: m.scan_no_table_line(), icon: Table2 }),
		blurry: () => ({ title: m.scan_blurry(), line: m.scan_blurry_line(), icon: Focus }),
		photo: () => ({
			title: m.scan_unreadable_photo(),
			line: m.scan_unreadable_line(),
			icon: ImageOff
		}),
		busy: () => ({ title: m.scan_busy(), line: m.scan_busy_line(), icon: Hourglass }),
		limited: () => ({ title: m.scan_limited(), line: m.scan_limited_line(), icon: Timer }),
		unavailable: () => ({
			title: m.scan_unavailable(),
			line: m.scan_unavailable_line(),
			icon: CircleAlert
		}),
		offline: () => ({ title: m.scan_offline(), line: m.scan_offline_line(), icon: CloudOff })
	} satisfies Record<string, () => Problem>;

	let problem = $state<Problem | null>(null);
	/** A company's model gave no answer: its own card and fix. */
	let remote = $state<RemoteProblem | null>(null);
	/** The last photo, kept on the phone for Try again; the server never keeps it. */
	let lastImage: Blob | null = null;

	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | undefined;
	/** The camera shows in the frame. */
	let live = $state(false);
	/** The photo being read, shown in the frame in place of the camera. */
	let still = $state<string | null>(null);
	let closed = false;

	let starting = false;
	async function startCamera() {
		if (starting || refused || closed || !navigator.mediaDevices?.getUserMedia) return;
		starting = true;
		try {
			const granted = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: 'environment' },
					width: { ideal: 1920 },
					height: { ideal: 1440 }
				}
			});
			if (closed || !video) return granted.getTracks().forEach((t) => t.stop());
			stream = granted;
			// The phone can take the camera away (another app, Choose photo's own camera): back to the phone's camera
			// until the page is shown again.
			for (const track of granted.getVideoTracks())
				track.onended = () => {
					lost = true;
					stopCamera();
				};
			video.srcObject = granted;
			await video.play();
			if (!closed) live = true;
		} catch (e) {
			// Refused or no camera: Take photo uses the phone's own camera instead.
			const name = (e as DOMException).name;
			if (name === 'NotAllowedError' || name === 'NotFoundError') refused = true;
			stopCamera();
		} finally {
			starting = false;
		}
	}

	/** The camera was on and the phone took it away: it comes back when the page is shown again. Never asked again
	 *  after a refusal. */
	let lost = false;
	/** The camera was taken away and may come back: when the page is shown, gets focus or a photo picker closes. */
	function comeBack() {
		if (!lost || closed || document.visibilityState !== 'visible') return;
		lost = false;
		startCamera();
	}

	function stopCamera() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = undefined;
		if (video) video.srcObject = null;
		live = false;
	}

	/** What the frame shows, at most about 1600 px on the long side (like a chosen photo after `shrink`). */
	function snapshot(): Promise<Blob> {
		const v = video!;
		const box = v.getBoundingClientRect();
		// The frame crops the picture to fill it (object-fit: cover): the photo is cut the same way.
		const fit = Math.max(box.width / v.videoWidth, box.height / v.videoHeight);
		const sw = box.width / fit;
		const sh = box.height / fit;
		const sx = (v.videoWidth - sw) / 2;
		const sy = (v.videoHeight - sh) / 2;
		const scale = Math.min(1, 1600 / Math.max(sw, sh));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(sw * scale);
		canvas.height = Math.round(sh * scale);
		canvas.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
		return new Promise((done, fail) =>
			canvas.toBlob((b) => (b ? done(b) : fail(new Error('encode'))), 'image/jpeg', 0.88)
		);
	}

	async function take() {
		if (reading || !live || !video?.videoWidth) return;
		const mine = ++attempt;
		problem = null;
		remote = null;
		reading = true;
		waiting = null;
		let image: Blob;
		try {
			image = await snapshot();
		} catch {
			if (mine === attempt) {
				problem = P.photo();
				reading = false;
			}
			return;
		}
		lastImage = image;
		showStill(image);
		await send(image, mine);
	}

	function showStill(image: Blob | null) {
		if (still) URL.revokeObjectURL(still);
		still = image ? URL.createObjectURL(image) : null;
	}

	/** About 1600 px on the long side as JPEG: OCR gains nothing above that, and drawing drops the location data. */
	async function shrink(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		return new Promise((done, fail) =>
			canvas.toBlob((b) => (b ? done(b) : fail(new Error('encode'))), 'image/jpeg', 0.88)
		);
	}

	async function picked(event: Event) {
		comeBack(); // the phone's own camera may have taken the live one (audit S06)
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const mine = ++attempt;
		problem = null;
		remote = null;
		reading = true;
		waiting = null;
		let image: Blob;
		try {
			image = await shrink(file);
		} catch {
			if (mine === attempt) {
				problem = P.photo();
				reading = false;
			}
			return;
		}
		lastImage = image;
		showStill(image);
		await send(image, mine);
	}

	/** The kept photo again (`viaServer`: this once on the server's add-on). */
	function again(viaServer = false) {
		if (!lastImage) return;
		problem = null;
		remote = null;
		reading = true;
		showStill(lastImage);
		send(lastImage, ++attempt, viaServer);
	}

	async function send(image: Blob, mine: number, viaServer = false) {
		try {
			// A busy scanner: wait in line and ask again, for up to two minutes.
			const started = Date.now();
			let response: Response;
			let body: { error?: string; ahead?: number; proposal?: LabelProposal; blurry?: boolean };
			for (;;) {
				response = await fetch(`/api/v1/scan${viaServer ? '?via=server' : ''}`, {
					method: 'POST',
					headers: { 'content-type': 'image/jpeg', ...accountHeaders() },
					body: image
				});
				body = await response.json().catch(() => ({}));
				if (mine !== attempt) return;
				if (response.ok || body.error !== 'busy' || Date.now() - started > GIVE_UP_MS) break;
				waiting = body.ahead ?? 1;
				await new Promise((done) => setTimeout(done, RETRY_MS));
				if (mine !== attempt) return;
			}
			waiting = null;
			if (!response.ok) {
				if (wrongAccount(body.error ?? '', response.status)) return;
				if (source !== 'server' && !viaServer && REMOTE_ERRORS.includes(body.error ?? '')) {
					remote = remoteProblem(body.error as RemoteError, source, 'scan');
					return;
				}
				problem =
					body.error === 'busy'
						? P.busy()
						: body.error === 'limited'
							? P.limited()
							: body.error === 'decode_failed'
								? P.photo()
								: P.unavailable();
				return;
			}
			const read = body.proposal as LabelProposal;
			if (read.nutrients.length === 0) {
				problem = body.blurry ? P.blurry() : P.noTable();
				return;
			}
			const photo = URL.createObjectURL(image);
			lastImage = null;
			attempt++;
			// The photo stays in the frame until the next screen is there; the camera is done (audit S10).
			stopCamera();
			onread({ proposal: read, blurry: body.blurry === true, photo });
		} catch {
			if (mine === attempt) problem = navigator.onLine ? P.unavailable() : P.offline();
		} finally {
			if (mine === attempt) {
				reading = false;
				waiting = null;
				showStill(null);
			}
		}
	}

	/** No photo to go on: the same form, empty. */
	function byHand() {
		attempt++;
		onread(BY_HAND);
	}

	function close() {
		attempt++; // a photo still being read no longer opens anything
		onclose();
	}

	// Gone another way (Back, a link): a photo still being read stops being asked about (Gemini audit 2, H12).
	onMount(() => {
		startCamera();
		// Hidden: the camera goes off (no light in a background tab, no stale picture after the phone was away) and
		// comes back when the page is shown again (audit S05).
		const shown = () => {
			if (document.visibilityState === 'hidden') {
				if (stream) {
					stopCamera();
					lost = true;
				}
			} else comeBack();
		};
		document.addEventListener('visibilitychange', shown);
		window.addEventListener('focus', comeBack);
		return () => {
			document.removeEventListener('visibilitychange', shown);
			window.removeEventListener('focus', comeBack);
			closed = true;
			attempt++;
			stopCamera();
			showStill(null);
		};
	});
</script>

{#snippet camera(primary: boolean, label?: string)}
	{@const look = [
		'inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button px-2 text-[1rem] font-[750] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
		primary ? 'bg-fill text-on-accent' : 'bg-surface2',
		reading && 'pointer-events-none opacity-50'
	]}
	{#if live}
		<button
			type="button"
			class={[
				look,
				'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
			]}
			disabled={reading}
			onclick={take}
		>
			<Camera size={20} aria-hidden="true" />{label ?? (problem ? m.scan_retake() : m.scan_take())}
		</button>
	{:else}
		<label class={look}>
			<Camera size={20} aria-hidden="true" />{label ?? (problem ? m.scan_retake() : m.scan_take())}
			<input
				type="file"
				accept="image/*"
				capture="environment"
				class="sr-only"
				disabled={reading}
				onchange={picked}
				oncancel={comeBack}
			/>
		</label>
	{/if}
{/snippet}

<Sheet title={m.log_scan()} onclose={close}>
	{#if remote}
		<Notice tone={remote.tone} title={remote.title}>
			{remote.line}
			{#snippet actions()}
				<div class="flex flex-col gap-2">
					{#if remote!.fix === 'again'}
						{@render camera(true, remote!.fixLabel)}
					{:else}
						<Button
							wide
							onclick={() =>
								remote!.fix === 'settings' ? goto(resolve('/(app)/more/speak-and-scan')) : again()}
							>{remote!.fixLabel}</Button
						>
					{/if}
					<Button variant="ghost" wide onclick={byHand}>{m.scan_by_hand()}</Button>
					{#if local}
						<button
							type="button"
							onclick={() => again(true)}
							class="min-h-11 text-[0.9375rem] font-[650] text-accent"
							>{m.remote_via_server()}</button
						>
					{/if}
				</div>
			{/snippet}
		</Notice>
	{:else if problem}
		<Notice tone="warn" title={problem.title} icon={problem.icon}>
			{problem.line}
			{#snippet actions()}
				<Button variant="ghost" wide onclick={byHand}>{m.scan_by_hand()}</Button>
			{/snippet}
		</Notice>
	{/if}
	<!-- The camera, live, inside the frame; the photo being read stays there while it is read. Without the camera the
	     frame says how to take the photo, and the phone's own camera takes it. -->
	<div
		class="relative grid aspect-[4/3] max-h-[42dvh] w-full place-items-center overflow-hidden rounded-input border-2 border-dashed border-accent bg-soft px-6 text-center text-[0.9375rem] font-semibold text-accent"
	>
		<video
			bind:this={video}
			muted
			playsinline
			aria-hidden="true"
			class={['absolute inset-0 size-full object-cover', !live && 'invisible']}
		></video>
		{#if still}
			<img src={still} alt="" class="absolute inset-0 size-full object-cover" />
		{/if}
		{#if live && !still && !reading}
			<!-- A tap on the camera takes the photo too (owner, 2026-11-23); Take photo below is the named control. -->
			<button
				type="button"
				tabindex="-1"
				aria-hidden="true"
				class="absolute inset-0 cursor-pointer"
				onclick={take}
			></button>
		{/if}
		{#if waiting !== null || reading}
			<span
				role="status"
				class={[
					'relative flex flex-col gap-1',
					(live || still) && 'rounded-button bg-surface/90 px-4 py-2 shadow-sheet'
				]}
			>
				{#if waiting !== null}
					<span>{m.scan_waiting()}</span>
					<span class="text-[0.875rem] font-medium text-muted">
						{waiting === 1 ? m.scan_waiting_one() : m.scan_waiting_many({ count: String(waiting) })}
					</span>
				{:else}{m.scan_reading()}{/if}
			</span>
		{:else if !live}<span class="relative">{m.scan_frame()}</span>{/if}
	</div>
	<p class="text-[0.8125rem] text-muted">{m.scan_tip()}</p>
	<div class="grid grid-cols-2 gap-2">
		{@render camera(true)}
		<label
			class={[
				'inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button bg-surface2 px-2 text-[1rem] font-[750] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
				reading && 'pointer-events-none opacity-50'
			]}
		>
			<ImageIcon size={20} aria-hidden="true" />{m.scan_choose()}
			<input
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic"
				class="sr-only"
				disabled={reading}
				onchange={picked}
				oncancel={comeBack}
			/>
		</label>
	</div>
	{#if source !== 'server'}
		<p class="text-center text-[0.8125rem] text-muted">
			{m.speak_via({ provider: PROVIDER_NAME[source] })}
		</p>
	{/if}
	{#if waiting !== null}
		<Button variant="ghost" wide onclick={byHand}>{m.scan_by_hand()}</Button>
	{/if}
</Sheet>
