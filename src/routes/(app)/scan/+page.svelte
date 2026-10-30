<script lang="ts">
	// Scan a label (docs/ui.md, "Scan"): take or choose a photo of the nutrition table; it is made smaller on the
	// phone (which also drops its location data) and read on the server. The values come back as a proposal in the
	// food form beside the photo, to check and save; nothing is saved before that. The photo is never kept.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Camera from '@lucide/svelte/icons/camera';
	import ImageIcon from '@lucide/svelte/icons/image';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { logFoodHref } from '#lib/client/links.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import type { FoodInput } from '#lib/shared/food-input.ts';
	import type { FoodDetail } from '#lib/shared/food-types.ts';
	import type { NutrientValue } from '#lib/shared/nutrients.ts';
	import Card from '#lib/ui/Card.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';

	let { data } = $props();

	interface Proposal {
		basis: '100g' | '100ml' | 'serving' | null;
		portion: { name: string; amount: number; unit: 'g' | 'ml' } | null;
		nutrients: NutrientValue[];
		layout: 'table' | 'text' | 'none';
	}

	let photo = $state<string | null>(null);
	let reading = $state(false);
	let problem = $state('');
	let proposal = $state<Proposal | null>(null);
	let showPhoto = $state(true);
	let busy = $state(false);
	let saveProblem = $state('');

	// Whether saving opens Log for the new food, or stays here for the next label (scanning groceries in one go).
	// A per-device convenience, so browser storage is enough; it may be unavailable, and then it stays on.
	const LOG_AFTER = 'obur:scan-log-after-save';
	let logAfter = $state(true);
	try {
		logAfter = localStorage.getItem(LOG_AFTER) !== 'no';
	} catch {
		// Storage blocked: keep the default.
	}
	function rememberLogAfter() {
		try {
			localStorage.setItem(LOG_AFTER, logAfter ? 'yes' : 'no');
		} catch {
			// Not remembered on this device; the choice still applies now.
		}
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
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		problem = '';
		proposal = null;
		reading = true;
		try {
			let image: Blob;
			try {
				image = await shrink(file);
			} catch {
				problem = m.scan_unreadable_photo();
				return;
			}
			if (photo) URL.revokeObjectURL(photo);
			photo = URL.createObjectURL(image);
			const response = await fetch('/api/v1/scan', {
				method: 'POST',
				headers: { 'content-type': 'image/jpeg' },
				body: image
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				problem =
					body.error === 'busy'
						? m.scan_busy()
						: body.error === 'limited'
							? m.scan_limited()
							: body.error === 'decode_failed'
								? m.scan_unreadable_photo()
								: m.scan_unavailable();
				return;
			}
			proposal = body.proposal as Proposal;
			showPhoto = true;
		} catch {
			problem = navigator.onLine ? m.scan_unavailable() : m.scan_offline();
		} finally {
			reading = false;
		}
	}

	/** The proposal as the food form's starting values; the name and brand are typed by the person. */
	const initial = $derived.by((): FoodDetail | undefined => {
		if (!proposal) return undefined;
		const p = proposal;
		const serving = p.basis === 'serving';
		return {
			id: '',
			name: '',
			brand: null,
			visibility: 'shared',
			basis: p.basis ?? '100g',
			servingLabel: serving ? (p.portion?.name ?? '') : null,
			servingSize: serving && p.portion ? { amount: p.portion.amount, unit: p.portion.unit } : null,
			barcode: null,
			icon: null,
			origin: 'label_scan',
			curatedDataset: null,
			archived: false,
			version: 0,
			mine: true,
			editable: true,
			derivedFrom: null,
			// A stated sodium makes the form treat the label as American (carbohydrate as total); with salt there too,
			// as on Turkish and EU labels, salt is enough.
			nutrients: p.nutrients.some((n) => n.code === 'salt')
				? p.nutrients.filter((n) => n.code !== 'sodium')
				: p.nutrients,
			servings:
				!serving && p.portion
					? [
							{
								id: '',
								name: p.portion.name,
								amount: p.portion.amount,
								unit: p.portion.unit,
								source: 'label'
							}
						]
					: [],
			warnings: []
		};
	});

	async function save(food: FoodInput) {
		busy = true;
		saveProblem = '';
		try {
			const { id } = await api<{ id: string }>('POST', '/api/v1/foods', {
				food,
				source: 'label_scan'
			});
			showToast({ message: m.scan_saved({ name: food.name }) });
			if (logAfter) {
				await goto(logFoodHref(id));
				return;
			}
			// Ready for the next label.
			proposal = null;
			if (photo) URL.revokeObjectURL(photo);
			photo = null;
			window.scrollTo({ top: 0 });
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

<svelte:head><title>{m.log_scan()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/log')} class="text-[14px] font-semibold text-accent">← {m.nav_log()}</a>
	<h1 class="text-[24px] font-[750]">{m.log_scan()}</h1>
	{#if !data.scan}
		<Notice>{m.scan_off()}</Notice>
	{:else}
		<Card>
			<!-- With a result on screen, the instructions step aside and the buttons offer another photo. -->
			{#if !proposal}
				<p class="text-[15px]">{m.scan_intro()}</p>
				<ul class="flex list-disc flex-col gap-1 pl-5 text-[14px] text-muted">
					<li>{m.scan_tip_frame()}</li>
					<li>{m.scan_tip_light()}</li>
					<li>{m.scan_tip_flat()}</li>
				</ul>
			{/if}
			<div class="grid grid-cols-2 gap-2">
				<label
					class="inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button bg-accent px-2 text-[16px] font-[750] whitespace-nowrap text-on-accent focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent"
				>
					<Camera size={20} aria-hidden="true" />{proposal ? m.scan_retake() : m.scan_take()}
					<input
						type="file"
						accept="image/*"
						capture="environment"
						class="sr-only"
						disabled={reading}
						onchange={picked}
					/>
				</label>
				<label
					class="inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button border border-line bg-surface px-2 text-[16px] font-[750] whitespace-nowrap focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent"
				>
					<ImageIcon size={20} aria-hidden="true" />{m.scan_choose()}
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic"
						class="sr-only"
						disabled={reading}
						onchange={picked}
					/>
				</label>
			</div>
			{#if reading}<p class="text-[15px] font-semibold" role="status">{m.scan_reading()}</p>{/if}
			{#if problem}<Notice>{problem}</Notice>{/if}
		</Card>

		{#if proposal && initial}
			{#if photo}
				<Card>
					<button
						type="button"
						aria-expanded={showPhoto}
						onclick={() => (showPhoto = !showPhoto)}
						class="self-start text-[14px] font-semibold text-accent"
						>{showPhoto ? m.scan_hide_photo() : m.scan_show_photo()}</button
					>
					{#if showPhoto}<img
							src={photo}
							alt={m.scan_photo_alt()}
							class="max-h-[60vh] w-full rounded-small object-contain"
						/>{/if}
				</Card>
			{/if}
			<Notice tone="info">
				{proposal.nutrients.length ? m.scan_check() : m.scan_nothing_read()}
			</Notice>
			<!-- The form needs a basis; when the label didn't say, it starts at per 100 g and asks to check it. -->
			{#if proposal.nutrients.length && !proposal.basis}<Notice>{m.scan_basis_unknown()}</Notice
				>{/if}
			{#if saveProblem}<Notice>{saveProblem}</Notice>{/if}
			<label class="flex min-h-11 cursor-pointer items-center gap-3 px-1">
				<input
					type="checkbox"
					bind:checked={logAfter}
					onchange={rememberLogAfter}
					class="size-5 shrink-0 accent-accent"
				/>
				<span class="text-[15px] font-semibold">{m.scan_log_after()}</span>
			</label>
			<Card title={m.scan_new_food()}>
				{#key proposal}<FoodForm {initial} {busy} onsave={save} />{/key}
			</Card>
		{/if}
	{/if}
</main>
