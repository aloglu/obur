<script lang="ts">
	// Scan a label (docs/ui.md, "Scan"): take or choose a photo of the nutrition table; it is made smaller on the
	// phone (which also drops its location data) and read on the server. The values come back as a proposal in the
	// food form beside the photo, to check and save; nothing is saved before that. The photo is never kept.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Camera from '@lucide/svelte/icons/camera';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Table2 from '@lucide/svelte/icons/table-2';
	import Timer from '@lucide/svelte/icons/timer';
	import ImageOff from '@lucide/svelte/icons/image-off';
	import Button from '#lib/ui/Button.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
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
	import { scanEdits } from '#lib/shared/scan-edits.ts';
	import FoodForm from '#lib/ui/food/FoodForm.svelte';
	import ScanNotes from '#lib/ui/food/ScanNotes.svelte';
	import type { LabelNote } from '#lib/shared/label-notes.ts';

	let { data } = $props();

	interface Proposal {
		basis: '100g' | '100ml' | 'serving' | null;
		portion: { name: string; amount: number; unit: 'g' | 'ml' } | null;
		nutrients: NutrientValue[];
		layout: 'table' | 'text' | 'none';
		notes: LabelNote[];
	}

	let photo = $state<string | null>(null);
	let reading = $state(false);
	type Problem = { title: string; line: string; icon: typeof Camera; retake: boolean };
	const P = {
		noTable: () => ({
			title: m.scan_no_table(),
			line: m.scan_no_table_line(),
			icon: Table2,
			retake: true
		}),
		photo: () => ({
			title: m.scan_unreadable_photo(),
			line: m.scan_unreadable_line(),
			icon: ImageOff,
			retake: true
		}),
		busy: () => ({ title: m.scan_busy(), line: m.scan_busy_line(), icon: Hourglass, retake: true }),
		limited: () => ({
			title: m.scan_limited(),
			line: m.scan_limited_line(),
			icon: Timer,
			retake: false
		}),
		unavailable: () => ({
			title: m.scan_unavailable(),
			line: m.scan_unavailable_line(),
			icon: CircleAlert,
			retake: true
		}),
		offline: () => ({
			title: m.scan_offline(),
			line: m.scan_offline_line(),
			icon: CloudOff,
			retake: false
		})
	} satisfies Record<string, () => Problem>;

	let problem = $state<Problem | null>(null);
	let proposal = $state<Proposal | null>(null);
	let showPhoto = $state(false);
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
		problem = null;
		proposal = null;
		reading = true;
		try {
			let image: Blob;
			try {
				image = await shrink(file);
			} catch {
				problem = P.photo();
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
						? P.busy()
						: body.error === 'limited'
							? P.limited()
							: body.error === 'decode_failed'
								? P.photo()
								: P.unavailable();
				return;
			}
			const read = body.proposal as Proposal;
			if (read.nutrients.length === 0) {
				problem = P.noTable();
				return;
			}
			proposal = read;
			showPhoto = false;
		} catch {
			problem = navigator.onLine ? P.unavailable() : P.offline();
		} finally {
			reading = false;
		}
	}

	/** No photo to go on: the same form, empty. */
	function byHand() {
		problem = null;
		proposal = { basis: '100g', portion: null, nutrients: [], layout: 'none', notes: [] };
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

{#snippet scanNotes()}
	{#if proposal && initial}
		<ScanNotes
			notes={proposal.notes}
			basis={initial.basis}
			nutrients={initial.nutrients}
			sodiumLeftOut={initial.nutrients.length < proposal.nutrients.length}
		/>
	{/if}
{/snippet}

{#snippet camera(primary: boolean)}
	<label
		class={[
			'inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button px-2 text-[16px] font-[750]',
			primary ? 'bg-fill text-on-accent' : 'bg-surface2'
		]}
	>
		<Camera size={20} aria-hidden="true" />{proposal || problem ? m.scan_retake() : m.scan_take()}
		<input
			type="file"
			accept="image/*"
			capture="environment"
			class="sr-only"
			disabled={reading}
			onchange={picked}
		/>
	</label>
{/snippet}

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<a href={resolve('/(app)/log')} class="flex items-center gap-1 self-start font-bold text-accent">
		<ChevronLeft size={20} aria-hidden="true" />{m.nav_log()}
	</a>
	<h1 class="text-[24px] font-[750]">
		{proposal?.nutrients.length
			? m.scan_check_title()
			: proposal
				? m.scan_new_food()
				: m.log_scan()}
	</h1>
	{#if !data.scan}
		<Notice>{m.scan_off()}</Notice>
	{:else if !proposal}
		<Card>
			<!-- The frame says how to take the photo; the camera itself is the phone's. -->
			<div
				class="grid aspect-[4/3] place-items-center rounded-input border-2 border-dashed border-accent bg-soft px-6 text-center text-[15px] font-semibold text-accent"
			>
				{#if reading}<span role="status">{m.scan_reading()}</span>{:else}{m.scan_frame()}{/if}
			</div>
			<div class="grid grid-cols-2 gap-2">
				{@render camera(true)}
				<label
					class="inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-button bg-surface2 px-2 text-[16px] font-[750]"
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
		</Card>
		{#if problem}
			<Notice tone="warn" title={problem.title} icon={problem.icon}>
				{problem.line}
				{#snippet actions()}
					<Button variant="ghost" wide onclick={byHand}>{m.scan_by_hand()}</Button>
				{/snippet}
			</Notice>
		{/if}
	{:else}
		{#if proposal.nutrients.length}
			{#if photo}
				<div class="rounded-card bg-surface px-[18px] py-1 shadow-card">
					<button
						type="button"
						aria-expanded={showPhoto}
						onclick={() => (showPhoto = !showPhoto)}
						class="flex min-h-14 w-full items-center justify-between gap-3 text-left text-[15px] font-[650]"
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
		<label class="flex min-h-11 cursor-pointer items-center gap-3 px-1">
			<input type="checkbox" bind:checked={logAfter} onchange={rememberLogAfter} />
			<span class="text-[15px] font-semibold">{m.scan_log_after()}</span>
		</label>
		{#key proposal}<FoodForm
				{initial}
				{busy}
				onsave={save}
				unsaved
				saveLabel={logAfter ? m.scan_save_and_amount() : undefined}
				valueNotes={proposal.nutrients.length && initial ? scanNotes : undefined}
			/>{/key}
		{@render camera(false)}
	{/if}
</main>
