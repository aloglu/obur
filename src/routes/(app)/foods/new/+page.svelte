<script lang="ts">
	// New food (docs/ui.md, "Food form"): the food form, with Scan label on the right of the Nutrition title when
	// scanning is set up. Scan label opens the Scan sheet over the form; what it reads fills the Nutrition card in
	// place (asking first when values were typed), with the notes and the photo one tap away. Save food goes back
	// to Foods with the food highlighted. Nothing is logged. The photo is never kept. After a scan the button beside
	// the title is Show photo; Retake, under the opened photo, scans again and replaces the values without asking.
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { foodsSavedHref } from '#lib/client/links.ts';
	import { proposalFood, type ScanResult } from '#lib/client/scan-result.svelte.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import { scanEdits } from '#lib/shared/scan-edits.ts';
	import BackLink from '#lib/ui/BackLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import ScanNotes from '#lib/ui/food/ScanNotes.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import ScanAction from '#lib/ui/scan/ScanAction.svelte';
	import ScanSheet from '#lib/ui/scan/ScanSheet.svelte';

	let { data } = $props();

	let busy = $state(false);
	let problem = $state('');
	let form = $state<ReturnType<typeof FoodForm>>();

	// The last label read into the form, if any.
	let result = $state<ScanResult | null>(null);
	const scanned = $derived(result ? proposalFood(result.proposal) : undefined);
	let scanning = $state(false);
	let asking = $state(false);
	let showPhoto = $state(false);

	onDestroy(() => {
		if (result?.photo) URL.revokeObjectURL(result.photo);
	});

	function scanLabel() {
		if (form?.hasValues()) asking = true;
		else scanning = true;
	}

	function read(next: ScanResult) {
		scanning = false;
		asking = false;
		// Fill in by hand, or a photo with nothing on it: the form stays as it was.
		if (!next.proposal.nutrients.length) {
			if (next.photo) URL.revokeObjectURL(next.photo);
			return;
		}
		if (result?.photo) URL.revokeObjectURL(result.photo);
		result = next;
		showPhoto = false;
		form?.fillValues(proposalFood(next.proposal));
	}

	async function save(food: FoodInput) {
		busy = true;
		problem = '';
		try {
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', {
				food,
				// A food filled from a label counts as a scan, with how much of it was corrected (counts only).
				...(result && scanned
					? {
							source: 'label_scan',
							scanEdits: scanEdits({ ...scanned, basisKnown: result.proposal.basis !== null }, food)
						}
					: {})
			});
			showToast({ message: m.scan_saved({ name: food.name }) });
			await goto(foodsSavedHref(id));
		} catch (e) {
			problem =
				e instanceof ApiError && e.code === 'energy_required'
					? m.food_energy_required()
					: m.error_generic();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{m.food_new_title()} · {m.app_name()}</title></svelte:head>

{#snippet scanAction()}
	{#if result?.photo}
		<ScanAction
			icon="photo"
			label={showPhoto ? m.scan_hide_photo() : m.scan_show_photo()}
			expanded={showPhoto}
			onclick={() => (showPhoto = !showPhoto)}
		/>
	{:else}
		<ScanAction icon="scan" label={m.food_scan_label()} onclick={scanLabel} />
	{/if}
{/snippet}

<!-- The photo opens under the title; Retake sits under it, never over the label's values. -->
{#snippet photoPanel()}
	{#if result?.photo}
		<div class={['collapse-row -mt-3', showPhoto && 'open']}>
			<div inert={!showPhoto}>
				<div class="mt-3 flex flex-col gap-2.5 rounded-input bg-surface2 p-2.5">
					<img
						src={result.photo}
						alt={m.scan_photo_alt()}
						class="max-h-[60vh] w-full rounded-small object-contain"
					/>
					<div class="flex justify-end">
						<ScanAction
							raised
							icon="scan"
							label={m.scan_retake()}
							onclick={() => (scanning = true)}
						/>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet valueNotes()}
	{#if asking}
		<div
			class="flex flex-col gap-3 rounded-input bg-surface2 p-3.5"
			role="group"
			aria-label={m.food_scan_label()}
		>
			<p class="text-[0.9375rem]">{m.food_scan_replace_ask()}</p>
			<div class="grid grid-cols-2 gap-2">
				<Button variant="ghost" onclick={() => (asking = false)}>{m.food_scan_keep()}</Button>
				<Button onclick={() => ((asking = false), (scanning = true))}
					>{m.food_scan_replace()}</Button
				>
			</div>
		</div>
	{:else if result && scanned}
		<ScanNotes
			notes={result.proposal.notes}
			basis={scanned.basis}
			nutrients={scanned.nutrients}
			sodiumLeftOut={scanned.nutrients.length < result.proposal.nutrients.length}
			blurry={result.blurry}
		/>
	{:else}
		<p class="text-[0.8125rem] text-muted">{m.food_values_hint_scan()}</p>
	{/if}
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<BackLink href={resolve('/(app)/foods')} label={m.foods_title()} />
	<h1 class="text-[1.5rem] font-[750]">{m.food_new_title()}</h1>
	{#if problem}<Notice>{problem}</Notice>{/if}
	<FoodForm
		bind:this={form}
		{busy}
		onsave={save}
		unsaved={result !== null}
		startName={page.url.searchParams.get('name') ?? ''}
		valuesAction={data.scanSource ? scanAction : undefined}
		valueNotes={data.scanSource ? valueNotes : undefined}
		valuesTop={data.scanSource ? photoPanel : undefined}
	/>
</main>

{#if scanning && data.scanSource}
	<ScanSheet
		source={data.scanSource}
		local={data.local.scan}
		onread={read}
		onclose={() => (scanning = false)}
	/>
{/if}
