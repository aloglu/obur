<script lang="ts">
	// Reminders (docs/ui.md, "Reminders"; owner's choices 2026-10-31): this device's notifications, a switch and the
	// system's own time picker per reminder, and quiet hours. Each change saves itself, with this device's time zone.
	import { beforeNavigate } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { pushState, startReminders, stopReminders, type PushState } from '#lib/client/push.ts';
	import {
		REMINDER_KINDS,
		type ReminderKind,
		type ReminderSettings
	} from '#lib/shared/reminders.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let { data } = $props();
	const pushKey = untrack(() => data.pushKey!);
	let settings = $state<ReminderSettings>(untrack(() => structuredClone(data.settings)));
	let device = $state<PushState | null>(null);
	let busy = $state(false);

	/** The time a reminder starts with when switched on. */
	const START: Record<ReminderKind, string> = {
		breakfast: '10:00',
		lunch: '14:00',
		dinner: '20:30',
		weigh_in: '09:00',
		day_complete: '21:30'
	};
	const NAME: Record<ReminderKind, () => string> = {
		breakfast: m.reminders_breakfast,
		lunch: m.reminders_lunch,
		dinner: m.reminders_dinner,
		weigh_in: m.reminders_weigh_in,
		day_complete: m.reminders_day_complete
	};

	onMount(async () => {
		device = await pushState().catch(() => 'unsupported' as const);
	});

	// Changes made in quick succession are saved together; leaving the page saves at once, so nothing is lost.
	let timer: ReturnType<typeof setTimeout> | undefined;
	async function send() {
		timer = undefined;
		try {
			await api('PUT', '/api/v1/reminders', { ...$state.snapshot(settings), zone: deviceZone() });
			showToast({ message: m.reminders_saved() });
		} catch {
			showToast({ message: m.reminders_save_failed() });
		}
	}
	function save() {
		clearTimeout(timer);
		timer = setTimeout(send, 400);
	}
	function flush() {
		if (!timer) return;
		clearTimeout(timer);
		void send();
	}
	beforeNavigate(flush);
	onMount(() => {
		addEventListener('pagehide', flush);
		return () => removeEventListener('pagehide', flush);
	});
	function toggle(kind: ReminderKind) {
		settings.times[kind] = settings.times[kind] ? null : START[kind];
		save();
	}
	async function turnOn() {
		busy = true;
		try {
			device = await startReminders(pushKey);
			if (device === 'on') save();
		} finally {
			busy = false;
		}
	}
	async function turnOff() {
		busy = true;
		try {
			await stopReminders();
			device = 'off';
		} finally {
			busy = false;
		}
	}
	async function sample() {
		const registration = await navigator.serviceWorker.ready;
		// As a real reminder looks: the reminder itself is the title.
		await registration.showNotification(m.reminders_sample(), {
			icon: '/icon-192.png',
			tag: 'sample'
		});
	}
	const time = 'min-h-11 rounded-input border border-line bg-bg px-3 text-[16px] tabular-nums';
</script>

<svelte:head><title>{m.reminders_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<h1 class="text-[24px] font-[750]">{m.reminders_title()}</h1>

	<Card title={m.reminders_device()}>
		{#if device === 'on'}
			<p class="text-[15px]">{m.reminders_device_on()}</p>
			<div class="grid grid-cols-2 gap-2">
				<Button variant="ghost" onclick={sample}>{m.reminders_preview()}</Button>
				<Button variant="ghost" disabled={busy} onclick={turnOff}>{m.reminders_turn_off()}</Button>
			</div>
		{:else if device === 'off'}
			<p class="text-[15px] text-muted">{m.reminders_device_off()}</p>
			<Button disabled={busy} onclick={turnOn}>{m.reminders_turn_on()}</Button>
		{:else if device === 'blocked'}
			<Notice>{m.reminders_blocked()}</Notice>
		{:else if device === 'install'}
			<Notice tone="info">{m.reminders_install()}</Notice>
		{:else if device === 'unsupported'}
			<Notice tone="info">{m.reminders_unsupported()}</Notice>
		{/if}
	</Card>

	<Card title={m.reminders_which()}>
		<p class="text-[14px] text-muted">{m.reminders_hint()}</p>
		<ul class="flex flex-col divide-y divide-line">
			{#each REMINDER_KINDS as kind (kind)}
				{@const at = settings.times[kind]}
				<li class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2">
					<button
						type="button"
						role="switch"
						aria-checked={at !== null}
						onclick={() => toggle(kind)}
						class="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left text-[15px] font-semibold"
					>
						<span
							aria-hidden="true"
							class={[
								'relative h-7 w-12 shrink-0 rounded-full transition-colors',
								at ? 'bg-good' : 'bg-line'
							]}
							><span
								class={[
									'absolute top-0.5 size-6 rounded-full bg-surface shadow-card transition-[left] motion-reduce:transition-none',
									at ? 'left-[22px]' : 'left-0.5'
								]}
							></span></span
						>
						<span class="min-w-0">{NAME[kind]()}</span>
					</button>
					{#if at}
						<input
							type="time"
							value={at}
							aria-label={m.reminders_time({ reminder: NAME[kind]() })}
							onchange={(e) => {
								if (e.currentTarget.value) {
									settings.times[kind] = e.currentTarget.value.slice(0, 5);
									save();
								}
							}}
							class={time}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</Card>

	<Card title={m.reminders_quiet()}>
		<p class="text-[14px] text-muted">{m.reminders_quiet_hint()}</p>
		<div class="grid grid-cols-2 gap-2">
			<label class="flex flex-col gap-1.5">
				<span class="text-[13px] font-[650] text-muted">{m.reminders_quiet_from()}</span>
				<input
					type="time"
					value={settings.quietStart}
					onchange={(e) => {
						if (e.currentTarget.value) {
							settings.quietStart = e.currentTarget.value.slice(0, 5);
							save();
						}
					}}
					class={time}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-[13px] font-[650] text-muted">{m.reminders_quiet_until()}</span>
				<input
					type="time"
					value={settings.quietEnd}
					onchange={(e) => {
						if (e.currentTarget.value) {
							settings.quietEnd = e.currentTarget.value.slice(0, 5);
							save();
						}
					}}
					class={time}
				/>
			</label>
		</div>
	</Card>
</main>
