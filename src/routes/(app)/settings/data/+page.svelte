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
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Chips from '#lib/ui/Chips.svelte';
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
		reconciliation?: { days: number; mismatched: string[] };
	}

	const KINDS = [
		'diary',
		'food',
		'weight',
		'water',
		'activity',
		'target',
		'dayCompletion',
		'profile'
	];
	const kindName: Record<string, () => string> = {
		diary: m.data_kind_diary,
		food: m.data_kind_food,
		weight: m.data_kind_weight,
		water: m.data_kind_water,
		activity: m.data_kind_activity,
		target: m.data_kind_target,
		dayCompletion: m.data_kind_dayCompletion,
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
	// A file chosen before the page is interactive would be lost silently, so the picker waits for hydration.
	let ready = $state(false);
	onMount(() => (ready = true));
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

	const date = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
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
				showToast({ message: m.data_export_done() });
			})
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
			await upload(true);
			summary = null;
			file = null;
			showToast({ message: m.data_import_done() });
			await invalidateAll();
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
	<h1 class="text-[24px] font-[750]">{m.data_title()}</h1>
	{#if problem && !confirming}<Notice>{problem}</Notice>{/if}

	<Card title={m.data_export_title()}>
		<p class="text-[15px]">{m.data_export_body()}</p>
		<Button disabled={busy} onclick={download}>{m.data_export_button()}</Button>
	</Card>

	<Card title={m.data_import_title()}>
		<p class="text-[15px]">{m.data_import_body()}</p>
		<label
			class="flex min-h-[52px] cursor-pointer items-center justify-center rounded-button border border-line bg-surface px-5 text-[17px] font-[750] focus-within:outline-3 focus-within:outline-accent"
		>
			{file ? file.name : m.data_import_choose()}
			<input
				type="file"
				accept=".zip,application/zip"
				class="sr-only"
				disabled={busy || !ready}
				onchange={choose}
			/>
		</label>
		{#if summary}
			<div class="flex flex-col gap-3" data-testid="import-preview">
				<p class="text-[14px] text-muted">
					{summary.source === 'loseit'
						? m.data_import_loseit()
						: m.data_import_preview({ date: date(summary.exportedAt ?? '') })}
					{#if summary.dateRange}
						· {m.data_import_range({ from: summary.dateRange.from, to: summary.dateRange.to })}
					{/if}
				</p>
				<table class="w-full text-left text-[14px]">
					<thead class="text-muted">
						<tr>
							<th scope="col" class="py-1 font-semibold">{m.data_import_kind()}</th>
							<th scope="col" class="py-1 text-right font-semibold">{m.data_import_new()}</th>
							<th scope="col" class="py-1 text-right font-semibold">{m.data_import_here()}</th>
							<th scope="col" class="py-1 text-right font-semibold">{m.data_import_kept()}</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each rows as r (r.kind)}
							<tr>
								<th scope="row" class="py-2 font-semibold">{kindName[r.kind]()}</th>
								<td class="py-2 text-right tabular-nums">{r.new}</td>
								<td class="py-2 text-right tabular-nums">{r.unchanged}</td>
								<td class="py-2 text-right tabular-nums">{(r.changed ?? 0) + r.skipped}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if summary.source === 'loseit'}
					{@const check = summary.reconciliation}
					{#if check && check.mismatched.length === 0}
						<p class="text-[14px] font-semibold">
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
					{#if summary.deletedInLoseIt}
						<p class="text-[14px] text-muted">
							{m.data_import_loseit_deleted({ count: String(summary.deletedInLoseIt) })}
						</p>
					{/if}
					<p class="text-[14px] text-muted">{m.data_import_activity_note()}</p>
					<Chips
						label={m.data_import_weight_unit()}
						bind:value={weightUnit}
						onchange={preview}
						options={[
							{ value: 'kg', label: 'kg' },
							{ value: 'lb', label: 'lb' }
						]}
					/>
					<label class="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
						<input type="checkbox" bind:checked={shareFoods} class="size-5" />
						{m.data_import_share()}
					</label>
					{#if missing > 0}
						<label class="flex min-h-11 items-center gap-3 text-[15px]">
							<input type="checkbox" bind:checked={trashMissing} class="size-5" />
							{m.data_import_missing({ count: String(missing) })}
						</label>
					{/if}
				{/if}
				{#each summary.warnings.filter((w) => !QUIET_WARNINGS.has(w)) as w (w)}
					<Notice tone={w === 'already_imported' ? 'warn' : 'info'}>{warning[w]?.() ?? w}</Notice>
				{/each}
				{#if nothingNew && !summary.alreadyImported}
					<p class="text-[14px] text-muted">{m.data_import_nothing()}</p>
				{/if}
				<Button disabled={busy || summary.alreadyImported || nothingNew} onclick={apply}
					>{m.data_import_button()}</Button
				>
			</div>
		{/if}
	</Card>

	<Card title={m.data_delete_title()}>
		<p class="text-[15px]">{m.data_delete_body()}</p>
		<p class="text-[14px] text-muted">{m.data_delete_backups()}</p>
		<Chips
			label={m.data_delete_shared()}
			bind:value={removeShared}
			options={[
				{ value: 'keep', label: m.data_delete_keep() },
				{ value: 'remove', label: m.data_delete_remove() }
			]}
		/>
		<p class="text-[13px] text-muted">{m.data_delete_shared_note()}</p>
		<Button
			variant="danger"
			disabled={busy}
			onclick={() => ((confirming = true), (understood = false), (problem = ''))}
			>{m.data_delete_button()}</Button
		>
	</Card>
</main>

{#if confirming}
	<Sheet title={m.data_delete_confirm_title()} onclose={() => (confirming = false)}>
		<p class="text-[15px]">{m.data_delete_body()}</p>
		<p class="text-[14px] text-muted">{m.data_delete_backups()}</p>
		{#if problem}<Notice>{problem}</Notice>{/if}
		<label class="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
			<input type="checkbox" bind:checked={understood} class="size-5 accent-[var(--bad)]" />
			{m.data_delete_confirm_check()}
		</label>
		<Button variant="danger" disabled={busy || !understood} onclick={deleteAccount}
			>{m.data_delete_confirm_button()}</Button
		>
		<Button variant="ghost" onclick={() => (confirming = false)}>{m.common_cancel()}</Button>
	</Sheet>
{/if}
