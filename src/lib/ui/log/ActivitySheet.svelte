<script lang="ts">
	// Manual activity (docs/design.md): calories burned above an inactive day, with an optional note. The sheet states
	// that meaning plainly.
	import { m } from '#lib/paraglide/messages.js';
	import { api } from '#lib/client/api.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import type { ActivityEntry } from '#lib/shared/body-types.ts';
	import { parseDecimal } from '#lib/shared/numbers.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';
	import TextField from '../TextField.svelte';

	interface Props {
		date: string;
		onsaved: (entry: ActivityEntry) => void;
		onclose: () => void;
	}
	let { date, onsaved, onclose }: Props = $props();
	let kcalText = $state('');
	let note = $state('');
	let busy = $state(false);
	let problem = $state('');
	const value = $derived(parseDecimal(kcalText));
	const valid = $derived(value !== undefined && value >= 1 && value <= 10_000);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!valid) return;
		busy = true;
		problem = '';
		try {
			onsaved(
				await api<ActivityEntry>('POST', '/api/v1/body/activity', {
					id: crypto.randomUUID(),
					date,
					zone: deviceZone(),
					value: Math.round(value!),
					note: note || null
				})
			);
		} catch {
			problem = m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<Sheet title={m.activity_title()} {onclose}>
	<p class="text-[14px] text-muted">{m.activity_meaning()}</p>
	<form class="flex flex-col gap-4" onsubmit={save}>
		<TextField
			label={m.activity_kcal()}
			bind:value={kcalText}
			inputmode="numeric"
			autocomplete="off"
			aria-invalid={kcalText.trim() !== '' && !valid}
		/>
		<TextField
			label={m.activity_note()}
			placeholder={m.activity_note_placeholder()}
			bind:value={note}
			maxlength={120}
		/>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<Button type="submit" wide disabled={busy || !valid}
			>{busy ? m.common_working() : m.activity_save()}</Button
		>
	</form>
</Sheet>
