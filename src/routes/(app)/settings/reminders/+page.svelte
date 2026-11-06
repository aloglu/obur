<script lang="ts">
	// Reminders (docs/ui.md, "Reminders"; owner's choices 2026-10-31): this device's notifications, a switch and the
	// system's own time picker per reminder, and quiet hours. Each change saves itself, with this device's time zone.
	import { beforeNavigate } from '$app/navigation';
	import Share from '@lucide/svelte/icons/share';
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
	import { resolve } from '$app/paths';
	import BackLink from '#lib/ui/BackLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import TimeField from '#lib/ui/TimeField.svelte';

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
</script>

<svelte:head><title>{m.reminders_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<BackLink href={resolve('/(app)/more')} label={m.nav_more()} />
	<h1 class="text-[24px] font-[750]">{m.reminders_title()}</h1>

	{#if device === 'install'}
		<Card title={m.reminders_install_title()}>
			<p class="text-[13px] text-muted">{m.reminders_install_why()}</p>
			<ol class="flex flex-col gap-2.5">
				{#each [m.reminders_install_share(), m.reminders_install_add(), m.reminders_install_open()] as step, i (step)}
					<li class="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 text-[14.5px]">
						<span
							class="grid size-7 place-items-center rounded-full bg-soft text-[13px] font-bold text-accent"
							>{i + 1}</span
						>
						<span class="flex items-center gap-1.5"
							>{step}{#if i === 0}<Share size={16} aria-hidden="true" />{/if}</span
						>
					</li>
				{/each}
			</ol>
		</Card>
	{:else if device}
		<Card title={m.reminders_device()}>
			{#if device === 'on'}
				<p class="text-[15px]">{m.reminders_device_on()}</p>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={sample}>{m.reminders_preview()}</Button>
					<Button variant="ghost" disabled={busy} onclick={turnOff}>{m.reminders_turn_off()}</Button
					>
				</div>
			{:else if device === 'off'}
				<p class="text-[15px] text-muted">{m.reminders_device_off()}</p>
				<Button disabled={busy} onclick={turnOn}>{m.reminders_turn_on()}</Button>
			{:else if device === 'blocked'}
				<Notice>{m.reminders_blocked()}</Notice>
			{:else if device === 'unsupported'}
				<Notice tone="info">{m.reminders_unsupported()}</Notice>
			{/if}
		</Card>
	{/if}

	<ul class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
		{#each REMINDER_KINDS as kind (kind)}
			{@const at = settings.times[kind]}
			<li class="flex min-h-14 items-center justify-between gap-3 py-1.5">
				<span class="min-w-0 text-[15px] font-semibold">{NAME[kind]()}</span>
				<span class="flex shrink-0 items-center">
					<!-- The time slides away when off, and comes back at the time it starts with. -->
					<span class={['time-slot', at && 'on']}>
						<span class="min-w-0 overflow-hidden" inert={!at}>
							<TimeField
								value={at ?? START[kind]}
								label={m.reminders_time({ reminder: NAME[kind]() })}
								tabbable={!!at}
								onchange={(v) => {
									settings.times[kind] = v;
									save();
								}}
							/>
						</span>
					</span>
					<Switch bare label={NAME[kind]()} checked={at !== null} onchange={() => toggle(kind)} />
				</span>
			</li>
		{/each}
	</ul>
	<p class="px-1 text-[13px] text-muted">{m.reminders_hint()}</p>

	<div class="flex flex-col divide-y divide-line rounded-card bg-surface px-[18px] shadow-card">
		<h2 class="py-3 text-[19px] font-bold">{m.reminders_quiet()}</h2>
		<div class="flex min-h-14 items-center justify-between gap-3">
			<span class="text-[15px] font-semibold" aria-hidden="true">{m.reminders_quiet_from()}</span>
			<TimeField
				value={settings.quietStart}
				label={m.reminders_quiet_from()}
				onchange={(v) => {
					settings.quietStart = v;
					save();
				}}
			/>
		</div>
		<div class="flex min-h-14 items-center justify-between gap-3">
			<span class="text-[15px] font-semibold" aria-hidden="true">{m.reminders_quiet_until()}</span>
			<TimeField
				value={settings.quietEnd}
				label={m.reminders_quiet_until()}
				onchange={(v) => {
					settings.quietEnd = v;
					save();
				}}
			/>
		</div>
	</div>
	<p class="px-1 text-[13px] text-muted">{m.reminders_quiet_hint()}</p>
</main>

<style>
	.time-slot {
		display: grid;
		grid-template-columns: 0fr;
		opacity: 0;
		transition:
			grid-template-columns 300ms var(--ui),
			margin-right 300ms var(--ui),
			opacity 200ms;
	}
	.time-slot.on {
		grid-template-columns: 1fr;
		margin-right: 10px;
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.time-slot {
			transition: none;
		}
	}
</style>
