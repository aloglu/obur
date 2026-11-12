<script lang="ts">
	import PageHead from '#lib/ui/PageHead.svelte';
	// Check the label (docs/ui.md, "Scan"): what the Scan sheet read, as the food form beside the photo, to check
	// and save; then Log's amount sheet for the new food. Retake opens the sheet again in place. Opened without a
	// reading (a reload, a bookmark), it goes to Log with the Scan sheet open. The photo is never kept.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Camera from '@lucide/svelte/icons/camera';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { logFoodHref, scanSheetHref } from '#lib/client/links.ts';
	import { proposalFood, takeOver, type ScanResult } from '#lib/client/scan-result.svelte.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import { scanEdits } from '#lib/shared/scan-edits.ts';
	import Button from '#lib/ui/Button.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import ScanNotes from '#lib/ui/food/ScanNotes.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import ScanSheet from '#lib/ui/scan/ScanSheet.svelte';

	let { data } = $props();

	let result = $state<ScanResult | null>(null);
	const proposal = $derived(result?.proposal ?? null);
	const photo = $derived(result?.photo ?? null);
	const blurry = $derived(result?.blurry ?? false);
	let showPhoto = $state(false);
	let retaking = $state(false);
	let busy = $state(false);
	let saveProblem = $state('');

	onMount(() => {
		result = takeOver();
		if (!result && data.scan) void goto(scanSheetHref(), { replaceState: true });
		return () => {
			if (result?.photo) URL.revokeObjectURL(result.photo);
		};
	});

	function retaken(next: ScanResult) {
		retaking = false;
		if (result?.photo) URL.revokeObjectURL(result.photo);
		result = next;
		showPhoto = false;
		window.scrollTo({ top: 0 });
	}

	const initial = $derived(proposal ? proposalFood(proposal) : undefined);

	async function save(food: FoodInput) {
		busy = true;
		saveProblem = '';
		try {
			// How much the proposal was corrected: counts only (shared/scan-edits.ts).
			const scanEditCounts =
				initial && proposal
					? scanEdits({ ...initial, basisKnown: proposal.basis !== null }, food)
					: undefined;
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', {
				food,
				source: 'label_scan',
				scanEdits: scanEditCounts
			});
			showToast({ message: m.scan_saved({ name: food.name }) });
			await goto(logFoodHref(id));
		} catch (e) {
			saveProblem =
				e instanceof ApiError && e.code === 'energy_required'
					? m.food_energy_required()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.scan_check_title()} · {m.app_name()}</title></svelte:head>

{#snippet scanNotes()}
	{#if proposal && initial}
		<ScanNotes
			notes={proposal.notes}
			basis={initial.basis}
			nutrients={initial.nutrients}
			sodiumLeftOut={initial.nutrients.length < proposal.nutrients.length}
			{blurry}
		/>
	{/if}
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<PageHead
		href={resolve('/(app)/log')}
		label={m.nav_log()}
		title={!data.scan
			? m.log_scan()
			: proposal
				? proposal.nutrients.length
					? m.scan_check_title()
					: m.scan_new_food()
				: undefined}
	/>
	{#if !data.scan}
		<Notice>{m.scan_off()}</Notice>
	{:else if proposal}
		{#if proposal.nutrients.length}
			{#if photo}
				<div class="rounded-card bg-surface px-[18px] py-1 shadow-card">
					<button
						type="button"
						aria-expanded={showPhoto}
						onclick={() => (showPhoto = !showPhoto)}
						class="flex min-h-14 w-full items-center justify-between gap-3 text-left text-[0.9375rem] font-[650]"
					>
						{m.scan_your_photo()}
						<ChevronDown
							size={22}
							aria-hidden="true"
							class={[
								'text-muted transition-transform duration-300 ease-(--ui) motion-reduce:transition-none',
								showPhoto && 'rotate-180'
							]}
						/>
					</button>
					<div class={['collapse-row', showPhoto && 'open']}>
						<div>
							<img
								src={photo}
								alt={m.scan_photo_alt()}
								class="mb-3.5 max-h-[60vh] w-full rounded-small object-contain"
							/>
						</div>
					</div>
				</div>
			{/if}
			<Notice tone="info">{m.scan_check()}</Notice>
			<!-- The form needs a basis; when the label didn't say, it starts at per 100 g and asks to check it. -->
			{#if !proposal.basis}<Notice>{m.scan_basis_unknown()}</Notice>{/if}
		{/if}
		{#if saveProblem}<Notice>{saveProblem}</Notice>{/if}
		{#key proposal}<FoodForm
				{initial}
				{busy}
				onsave={save}
				unsaved
				saveLabel={m.scan_save_and_amount()}
				valueNotes={proposal.nutrients.length && initial ? scanNotes : undefined}
			/>{/key}
		{#if data.scanSource}
			<Button variant="ghost" wide onclick={() => (retaking = true)}
				><Camera size={20} aria-hidden="true" />{m.scan_retake()}</Button
			>
		{/if}
	{/if}
</main>

{#if retaking && data.scanSource}
	<ScanSheet
		source={data.scanSource}
		local={data.local.scan}
		onread={retaken}
		onclose={() => (retaking = false)}
	/>
{/if}
