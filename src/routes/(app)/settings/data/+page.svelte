<script lang="ts">
	// Your data (docs/design.md, "Your data: export, import and deletion"): export after a passkey check, import with
	// a preview first, and account deletion with an explicit choice about shared foods.
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { api, ApiError } from '#lib/client/api.ts';
	import { clearDeviceData } from '#lib/client/offline/sync.svelte.ts';
	import { describeError, withRecentAuth } from '#lib/client/passkeys.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { deviceZone } from '#lib/client/prefs.ts';
	import { shortDate } from '#lib/shared/format.ts';
	import { formatDecimal } from '#lib/shared/numbers.ts';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Download from '@lucide/svelte/icons/download';
	import FileArchive from '@lucide/svelte/icons/file-archive';
	import BackLink from '#lib/ui/BackLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Chips from '#lib/ui/Chips.svelte';
	import Switch from '#lib/ui/Switch.svelte';
	import Notice from '#lib/ui/Notice.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	let { data } = $props();

	type Counts = {
		new: number;
		unchanged: number;
		changed?: number;
		missing?: number;
		skipped: number;
	};
	interface Summary {
		source?: 'loseit';
		exportedAt?: string;
		alreadyImported: boolean;
		dateRange: { from: string; to: string } | null;
		counts: Record<string, Counts>;
		warnings: string[];
		deletedInLoseIt?: number;
		firstWeight?: number | null;
		reconciliation?: { days: number; mismatched: string[] };
	}

	const KINDS = [
		'diary',
		'food',
		'weight',
		'water',
		'activity',
		'target',
		'saved_meal',
		'dayCompletion',
		'dayNote',
		'profile'
	];
	const kindName: Record<string, () => string> = {
		diary: m.data_kind_diary,
		food: m.data_kind_food,
		weight: m.data_kind_weight,
		water: m.data_kind_water,
		activity: m.data_kind_activity,
		target: m.data_kind_target,
		saved_meal: m.data_kind_saved_meal,
		dayCompletion: m.data_kind_dayCompletion,
		dayNote: m.data_kind_dayNote,
		profile: m.data_kind_profile
	};
	const warning: Record<string, () => string> = {
		already_imported: m.data_warn_already_imported,
		changed_kept: m.data_warn_changed_kept,
		targets_kept: m.data_warn_targets_kept,
		profile_kept: m.data_warn_profile_kept,
		food_links_dropped: m.data_warn_food_links_dropped,
		budgets_after_own_target: m.data_warn_budgets_after_own_target,
		height_out_of_range: m.data_warn_height_out_of_range,
		reconciliation_mismatch: m.data_warn_reconciliation_mismatch
	};
	// Shown through their own controls instead.
	const QUIET_WARNINGS = new Set(['missing_rows']);

	let busy = $state(false);
	let exporting = $state(false);
	let importing = $state(false);
	// What the last import did, shown until another file is chosen.
	let finished = $state<{ count: number; from: string | null } | null>(null);
	// A file chosen before the page is interactive would be lost silently, so the picker waits for hydration.
	let ready = $state(false);
	// Foods from a LoseIt import, which can be archived all at once (docs/design.md, "LoseIt import").
	let imported = $state<{ active: number; archived: number } | null>(null);
	const loadImported = async () => {
		imported = await api<{ active: number; archived: number }>(
			'GET',
			'/api/v1/foods/imported'
		).catch(() => imported);
	};
	// Deleting the account asks about shared foods only when there are some.
	let sharedFoods = $state(0);
	onMount(() => {
		ready = true;
		void api<{ sharedFoods: number }>('GET', '/api/v1/account')
			.then((r) => (sharedFoods = r.sharedFoods))
			.catch(() => {});
		void loadImported();
	});
	const archiveImported = (archived: boolean) =>
		run(async () => {
			const { changed } = await api<{ changed: number }>('POST', '/api/v1/foods/imported', {
				archived
			});
			await loadImported();
			showToast({
				message: archived
					? m.data_imported_archived({ count: String(changed) })
					: m.data_imported_restored({ count: String(changed) })
			});
		});
	let problem = $state('');
	let file = $state<File | null>(null);
	let summary = $state<Summary | null>(null);
	// LoseIt imports: what the export cannot say for itself.
	let weightUnit = $state<'kg' | 'lb'>('kg');
	let shareFoods = $state(false);
	let trashMissing = $state(false);
	let removeShared = $state<'keep' | 'remove'>('keep');
	let confirming = $state(false);
	let understood = $state(false);

	const rows = $derived(
		summary
			? KINDS.map((k) => ({ kind: k, ...summary!.counts[k] })).filter(
					(r) => r.new + r.unchanged + (r.changed ?? 0) + r.skipped > 0
				)
			: []
	);
	const missing = $derived(
		summary ? Object.values(summary.counts).reduce((n, c) => n + (c.missing ?? 0), 0) : 0
	);
	const toAdd = $derived(rows.reduce((n, r) => n + r.new, 0));
	const size = (bytes: number) =>
		bytes < 1_000_000
			? `${formatDecimal(bytes / 1000, ',', 0)} kB`
			: `${formatDecimal(bytes / 1_000_000, ',', 1)} MB`;
	/** What the picker says about the chosen file once it has been read. */
	const fileDetail = $derived.by(() => {
		if (!file) return m.data_import_choose_hint();
		const what = summary?.source === 'loseit' ? m.data_import_loseit() : m.data_import_obur();
		if (!summary) return size(file.size);
		const dates = summary.dateRange
			? m.data_import_range({
					from: shortDate(summary.dateRange.from),
					to: shortDate(summary.dateRange.to)
				})
			: null;
		return [what, dates, size(file.size)].filter(Boolean).join(' · ');
	});
	const rowNote = (kind: string) =>
		summary?.source !== 'loseit'
			? undefined
			: kind === 'food'
				? m.data_row_food()
				: kind === 'activity'
					? m.data_row_activity()
					: kind === 'target'
						? m.data_row_target()
						: undefined;
	const nothingNew = $derived(rows.every((r) => r.new === 0) && !(trashMissing && missing > 0));

	function importProblem(e: unknown): string {
		if (e instanceof ApiError) {
			if (e.code === 'archive_too_large') return m.data_error_too_large();
			if (e.code === 'archive_unsupported_version') return m.data_error_version();
			if (e.code.startsWith('archive_')) return m.data_error_archive();
			if (e.code === 'already_imported') return m.data_warn_already_imported();
			if (e.code === 'loseit_unsupported_layout' || e.code === 'loseit_not_loseit')
				return m.data_error_loseit_layout();
			if (e.code === 'loseit_too_large') return m.data_error_too_large();
			if (e.code === 'loseit_invalid_value')
				return m.data_error_loseit_value({ detail: e.detail ?? '' });
		}
		return describeError(e);
	}

	async function run(action: () => Promise<void>, explain = describeError) {
		busy = true;
		problem = '';
		try {
			await action();
		} catch (e) {
			problem = explain(e);
		} finally {
			busy = false;
		}
	}

	const download = () =>
		run(() =>
			withRecentAuth(async () => {
				exporting = true;
				// A JSON body, so the request is never mistaken for a cross-site form post.
				const response = await fetch('/api/v1/export', {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'content-type': 'application/json' },
					body: '{}'
				});
				if (!response.ok) {
					const body = (await response.json().catch(() => ({}))) as { error?: string };
					throw new ApiError(body.error ?? 'error', response.status);
				}
				const name =
					/filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
					'obur-export.zip';
				const url = URL.createObjectURL(await response.blob());
				const link = Object.assign(document.createElement('a'), { href: url, download: name });
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 10_000);
				showToast({ message: m.data_export_done(), detail: name });
			}).finally(() => (exporting = false))
		);

	async function upload(apply: boolean): Promise<Summary> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built and sent at once, not reactive state
		const params = new URLSearchParams({
			zone: deviceZone(),
			weightUnit,
			share: shareFoods ? '1' : '0',
			trashMissing: trashMissing ? '1' : '0'
		});
		if (apply) params.set('apply', '1');
		const response = await fetch(`/api/v1/import?${params}`, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/zip' },
			body: file
		});
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
			detail?: string;
			summary?: Summary;
		};
		if (!response.ok) throw new ApiError(body.error ?? 'error', response.status, body.detail);
		return body.summary!;
	}

	function choose(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		file = input.files?.[0] ?? null;
		summary = null;
		finished = null;
		trashMissing = false;
		if (file) void preview();
	}

	/** Runs the dry run again, e.g. after a LoseIt option changed. */
	const preview = () =>
		run(async () => {
			summary = await upload(false);
		}, importProblem);

	const apply = () =>
		run(async () => {
			importing = true;
			try {
				await upload(true);
			} finally {
				importing = false;
			}
			finished = { count: toAdd, from: summary?.dateRange?.from ?? null };
			summary = null;
			file = null;
			showToast({ message: m.data_import_done() });
			await Promise.all([invalidateAll(), loadImported()]);
		}, importProblem);

	const deleteAccount = () =>
		run(
			() =>
				withRecentAuth(async () => {
					await api('DELETE', '/api/v1/account', { removeSharedFoods: removeShared === 'remove' });
					if (data.user) await clearDeviceData(data.user.id);
					confirming = false;
					await invalidateAll();
					await goto(resolve('/login'));
				}),
			(e) =>
				e instanceof ApiError && e.code === 'last_admin'
					? m.data_delete_last_admin()
					: describeError(e)
		);
</script>

<svelte:head><title>{m.data_title()} · {m.app_name()}</title></svelte:head>

<main class="mx-auto flex max-w-[640px] flex-col gap-3 px-3.5 py-4 desk:px-7">
	<BackLink href={resolve('/(app)/more/settings')} label={m.settings_title()} />
	<h1 class="text-[1.5rem] font-[750]">{m.data_title()}</h1>
	{#if problem && !confirming}<Notice>{problem}</Notice>{/if}

	<Card title={m.data_export_title()}>
		<p class="text-[0.8125rem] text-muted">{m.data_export_body()}</p>
		<Button disabled={busy} onclick={download}>
			{#if exporting}{m.data_export_busy()}{:else}<Download
					size={18}
					aria-hidden="true"
				/>{m.data_export_button()}{/if}
		</Button>
	</Card>

	<Card title={m.data_import_title()}>
		<p class="text-[0.8125rem] text-muted">{m.data_import_body()}</p>
		<label
			class={[
				'flex min-h-16 cursor-pointer items-center gap-3 rounded-input border-line px-3.5 py-2.5 focus-within:outline-3 focus-within:outline-accent',
				file ? 'border' : 'border-2 border-dashed'
			]}
		>
			<span
				class={[
					'grid size-10 shrink-0 place-items-center rounded-small',
					file ? 'bg-soft text-accent' : 'bg-surface2 text-muted'
				]}><FileArchive size={20} aria-hidden="true" /></span
			>
			<span class="min-w-0">
				<span class="block font-[650] break-words">{file ? file.name : m.data_import_choose()}</span
				>
				<small class="block text-[0.8125rem] text-muted">{fileDetail}</small>
			</span>
			<input
				type="file"
				accept=".zip,application/zip"
				class="sr-only"
				disabled={busy || !ready}
				onchange={choose}
			/>
		</label>
		{#if finished}
			<p class="flex items-start gap-2 text-[0.875rem] font-semibold text-good">
				<CircleCheck size={18} aria-hidden="true" class="mt-px shrink-0" />
				{m.data_import_finished({ count: String(finished.count) })}
			</p>
			{#if finished.from}<p class="text-[0.84375rem] text-muted">
					{m.data_import_goes_back({ day: shortDate(finished.from) })}
				</p>{/if}
		{/if}
		{#if summary}
			{@const check = summary.reconciliation}
			<div class="flex flex-col gap-3" data-testid="import-preview">
				{#if check && check.mismatched.length === 0}
					<p class="flex items-start gap-2 text-[0.875rem] font-semibold text-good">
						<CircleCheck size={18} aria-hidden="true" class="mt-px shrink-0" />
						{m.data_import_loseit_check_ok({ days: String(check.days) })}
					</p>
				{:else if check}
					<Notice
						>{m.data_import_loseit_check_bad({
							count: String(check.mismatched.length),
							dates: check.mismatched.slice(0, 5).join(', ')
						})}</Notice
					>
				{/if}
				{#if summary.alreadyImported}
					<Notice title={m.data_warn_already_imported()}>{m.data_already_detail()}</Notice>
				{:else}
					<table class="w-full text-left text-[0.90625rem]">
						<thead class="text-[0.78125rem] text-muted">
							<tr>
								<th scope="col" class="pb-1.5 font-[650]">{m.data_import_to_add()}</th>
								<th scope="col" class="pb-1.5 text-right font-[650]">{m.data_import_records()}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line border-t border-line">
							{#each rows as r (r.kind)}
								{@const kept = (r.changed ?? 0) + r.skipped}
								{@const others = [
									rowNote(r.kind),
									r.unchanged ? m.data_row_here({ count: String(r.unchanged) }) : null,
									kept ? m.data_row_kept({ count: String(kept) }) : null
								].filter(Boolean)}
								<tr>
									<th scope="row" class="py-2.5 font-normal">
										{kindName[r.kind]()}
										{#if others.length}<small class="block text-[0.78125rem] text-muted"
												>{others.join(' · ')}</small
											>{/if}
									</th>
									<td class="py-2.5 text-right align-baseline font-[650] tabular-nums">{r.new}</td>
								</tr>
							{/each}
							{#if summary.deletedInLoseIt}
								<tr class="text-muted">
									<th scope="row" class="py-2.5 font-normal">
										{m.data_row_deleted()}
										<small class="block text-[0.78125rem]">{m.data_row_left_out()}</small>
									</th>
									<td class="py-2.5 text-right align-baseline font-[650] tabular-nums"
										>{summary.deletedInLoseIt}</td
									>
								</tr>
							{/if}
						</tbody>
					</table>
					{#if summary.source === 'loseit'}
						<div class="flex flex-col divide-y divide-line border-y border-line">
							<div class="flex min-h-[60px] items-center justify-between gap-3 py-1.5">
								<span class="min-w-0 text-[0.9375rem] font-semibold">
									{m.data_import_weight_unit()}
									{#if summary.firstWeight != null}<small
											class="block text-[0.8125rem] font-normal text-muted"
											>{m.data_first_weight({
												value: formatDecimal(summary.firstWeight, ',', 1),
												unit: weightUnit
											})}</small
										>{/if}
								</span>
								<div class="w-[116px] shrink-0">
									<Chips
										label={m.data_import_weight_unit()}
										hideLabel
										bind:value={weightUnit}
										onchange={preview}
										options={[
											{ value: 'kg', label: 'kg' },
											{ value: 'lb', label: 'lb' }
										]}
									/>
								</div>
							</div>
							<Switch
								label={m.data_import_share()}
								detail={m.data_import_share_detail()}
								bind:checked={shareFoods}
							/>
							{#if missing > 0}
								<Switch
									label={m.data_import_missing_label({ count: String(missing) })}
									detail={m.data_import_missing_detail()}
									bind:checked={trashMissing}
								/>
							{/if}
						</div>
					{/if}
					{#each summary.warnings.filter((w) => !QUIET_WARNINGS.has(w) && w !== 'already_imported') as w (w)}
						<Notice tone="info">{warning[w]?.() ?? w}</Notice>
					{/each}
					{#if nothingNew}
						<p class="text-[0.875rem] text-muted">{m.data_import_nothing()}</p>
					{:else}
						<Button disabled={busy} onclick={apply}>
							{importing
								? m.data_importing()
								: toAdd > 0
									? m.data_import_count({ count: String(toAdd) })
									: m.data_import_button()}
						</Button>
					{/if}
				{/if}
			</div>
		{/if}
	</Card>

	{#if imported && imported.active + imported.archived > 0}
		<Card title={m.data_imported_title()}>
			<p class="text-[0.8125rem] text-muted">
				{imported.active > 0
					? m.data_imported_body({ count: String(imported.active) })
					: m.data_imported_all_archived({ count: String(imported.archived) })}
			</p>
			{#if imported.active > 0}
				<Button variant="ghost" disabled={busy} onclick={() => archiveImported(true)}
					>{m.data_imported_archive({ count: String(imported.active) })}</Button
				>
			{/if}
			{#if imported.archived > 0}
				<Button variant="ghost" disabled={busy} onclick={() => archiveImported(false)}
					>{m.data_imported_restore({ count: String(imported.archived) })}</Button
				>
			{/if}
		</Card>
	{/if}

	<Card title={m.data_delete_title()}>
		<p class="text-[0.8125rem] text-muted">{m.data_delete_body()}</p>
		{#if sharedFoods > 0}
			<Chips
				label={sharedFoods === 1
					? m.data_delete_shared_one()
					: m.data_delete_shared({ count: String(sharedFoods) })}
				bind:value={removeShared}
				options={[
					{ value: 'keep', label: m.data_delete_keep() },
					{ value: 'remove', label: m.data_delete_remove() }
				]}
			/>
			<p class="text-[0.8125rem] text-muted">{m.data_delete_shared_note()}</p>
		{/if}
		<p class="text-[0.8125rem] text-muted">{m.data_delete_backups()}</p>
		<button
			type="button"
			disabled={busy}
			onclick={() => ((confirming = true), (understood = false), (problem = ''))}
			class="min-h-[52px] rounded-button bg-surface2 px-5 text-[1.0625rem] font-[750] text-bad disabled:opacity-50"
			>{m.data_delete_button()}</button
		>
	</Card>
</main>

{#if confirming}
	<Sheet title={m.data_delete_confirm_title()} onclose={() => (confirming = false)}>
		<p class="text-[0.9375rem]">
			{m.data_delete_confirm_body()}
			{#if sharedFoods > 0}
				{removeShared === 'keep' ? m.data_delete_confirm_keep() : m.data_delete_confirm_remove()}
			{/if}
		</p>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<label class="flex min-h-11 items-center gap-3 text-[0.9375rem] font-semibold">
			<input type="checkbox" bind:checked={understood} class="size-5 accent-[var(--bad)]" />
			{m.data_delete_confirm_check()}
		</label>
		<Button variant="danger" disabled={busy || !understood} onclick={deleteAccount}
			>{m.data_delete_confirm_button()}</Button
		>
		<Button variant="ghost" onclick={() => (confirming = false)}>{m.common_cancel()}</Button>
	</Sheet>
{/if}
