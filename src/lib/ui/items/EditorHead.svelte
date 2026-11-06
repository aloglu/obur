<script lang="ts">
	// The top of the recipe and saved meal editors (docs/ui.md, "Recipes and saved meals"): the way back, the title with
	// a … menu beside it, and the menu's confirmation opening under the title.
	import { m } from '#lib/paraglide/messages.js';
	import ActionMenu from '../ActionMenu.svelte';
	import BackLink from '../BackLink.svelte';
	import Button from '../Button.svelte';

	interface Props {
		backHref: string;
		backLabel: string;
		title: string;
		/** The destructive action behind the … menu, when there's something to act on. */
		remove?: { label: string; confirm: string; yes: string; run: () => void };
		/** Done straight away, without a confirmation (Restore). */
		direct?: { label: string; run: () => void };
		busy: boolean;
	}
	let { backHref, backLabel, title, remove, direct, busy }: Props = $props();
	let confirming = $state(false);
	const items = $derived([
		...(direct ? [{ label: direct.label, action: direct.run }] : []),
		...(remove ? [{ label: remove.label, danger: true, action: () => (confirming = true) }] : [])
	]);
</script>

<BackLink href={backHref} label={backLabel} />
<div class="flex items-center justify-between gap-2">
	<h1 class="min-w-0 text-[24px] font-[750]">{title}</h1>
	{#if items.length > 0}
		<div class="-mr-2 shrink-0"><ActionMenu label={m.editor_actions()} {items} /></div>
	{/if}
</div>
{#if remove}
	<!-- Takes no room while closed; the padding gives the card's shadow somewhere to fall. -->
	<div class={['collapse-row -mx-3.5 -mt-3', confirming && 'open']}>
		<div inert={!confirming}>
			<div
				class="mx-3.5 mt-3 mb-2 flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
			>
				<p class="text-[15px]">{remove.confirm}</p>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={() => (confirming = false)}>{m.editor_keep()}</Button>
					<Button variant="danger" disabled={busy} onclick={remove.run}>{remove.yes}</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
