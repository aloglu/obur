<script lang="ts">
	// docs/ui.md "Signing in and first day": the icon and name centred on the screen, one button low, no subtitle or invite
	// line. Anything above the button (a warning, entries waiting) pushes the name up rather than covering it.
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { waitingAccounts, type Waiting } from '#lib/client/offline/waiting.ts';
	import { describeError, passkeysSupported, signIn } from '#lib/client/passkeys.ts';
	import Button from '#lib/ui/Button.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	let busy = $state(false);
	let problem = $state('');
	let waiting = $state<Waiting[]>([]);
	onMount(() => {
		waiting = waitingAccounts();
	});

	async function start() {
		busy = true;
		problem = '';
		try {
			await signIn();
			await invalidateAll();
			await goto(resolve('/(app)'));
		} catch (e) {
			problem = describeError(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.login_title()} · {m.app_name()}</title></svelte:head>

<main
	class="login mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-3.5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
>
	<h1 class="sr-only">{m.login_title()}</h1>
	<div class="spacer" aria-hidden="true"></div>
	<div class="hero relative flex flex-col items-center gap-4">
		<img src="/icon-512.png" alt="" width="112" height="112" class="rounded-[26px] shadow-card" />
		<p class="font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">
			{m.app_name()}
		</p>
	</div>
	<div class="act relative flex flex-col justify-end gap-2.5">
		{#if !passkeysSupported()}<Notice>{m.error_unsupported()}</Notice>{/if}
		{#if problem}<Notice>{problem}</Notice>{/if}
		{#each waiting as w, i (i)}
			<Notice
				icon={CloudOff}
				title={w.count === 1
					? m.login_waiting_one()
					: m.login_waiting_many({ count: String(w.count) })}
				>{w.count === 1
					? m.login_waiting_one_body({ name: w.name })
					: m.login_waiting_many_body({ name: w.name })}</Notice
			>
		{/each}
		<Button wide disabled={busy} onclick={start}>
			<KeyRound size={20} aria-hidden="true" />
			{busy ? m.common_working() : m.login_button()}
		</Button>
		<a
			class="inline-flex min-h-11 items-center justify-center text-center text-[15px] font-[650] text-accent"
			href={resolve('/recover')}>{m.login_lost()}</a
		>
	</div>
</main>

<style>
	/* The name stays centred on the screen: the space above and below share what's free. When what's below needs more than
	   its half, it keeps its height and the name moves up instead of being covered. On wide screens the group is centred. */
	.spacer,
	.act {
		flex: 1 1 0;
	}
	.act {
		padding-top: 32px;
	}
	.hero {
		isolation: isolate;
	}
	.hero::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 300px;
		height: 300px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--soft) 0, transparent 68%);
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: -1;
	}
	@media (min-width: 760px) {
		.login {
			justify-content: center;
			gap: 72px;
		}
		.spacer {
			display: none;
		}
		.act {
			flex: none;
			padding-top: 0;
		}
	}
</style>
