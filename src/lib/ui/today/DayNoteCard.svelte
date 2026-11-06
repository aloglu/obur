<script lang="ts">
	// docs/ui.md "Day notes": a card that opens in place. A note saves itself; offline it waits on this device, and the last
	// version typed wins (docs/design.md). Tapping the text edits it; links and to-dos act on their own.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { keepInView } from '#lib/client/keep-in-view.ts';
	import { offline, submit } from '#lib/client/offline/sync.svelte.ts';
	import { clockTime } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { notePreview, setTask } from '#lib/shared/markdown.ts';
	import NoteBody from './NoteBody.svelte';

	const SAVE_AFTER_MS = 500;
	const MAX_LENGTH = 10_000;

	let { date, saved }: { date: string; saved: string } = $props();

	// An edit still waiting on this device is newer than what the server sent.
	const waiting = $derived(
		offline.items.findLast((i) => i.preview.kind === 'note' && i.preview.localDate === date)
	);
	let text = $state(
		untrack(() => (waiting?.preview.kind === 'note' ? waiting.preview.text : saved))
	);
	let open = $state(false);
	let editing = $state(false);
	let status = $state<'idle' | 'saving' | 'saved' | 'device'>('idle');
	let savedAt = $state('');
	let field = $state<HTMLTextAreaElement>();
	let editor = $state<HTMLElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;

	// It reached the server while the card was open.
	$effect(() => {
		if (status !== 'device' || waiting) return;
		savedAt = clockTime(new Date().toISOString(), page.data.timeFormat ?? 'device');
		status = 'saved';
	});

	const hasText = $derived(text.trim() !== '');
	const foot = $derived(
		status === 'saving'
			? m.note_saving()
			: status === 'saved'
				? m.note_saved({ time: savedAt })
				: status === 'device'
					? m.note_saved_device()
					: m.note_private()
	);

	async function save() {
		clearTimeout(timer);
		if (!dirty) return;
		dirty = false;
		const typed = text;
		status = 'saving';
		try {
			const result = await submit(
				`/api/v1/diary/days/${date}/note`,
				{ id: crypto.randomUUID(), text: typed, typedAt: new Date().toISOString() },
				{ kind: 'note', localDate: date, text: typed }
			);
			if (result.status === 'queued') status = 'device';
			else {
				savedAt = clockTime(new Date().toISOString(), page.data.timeFormat ?? 'device');
				status = 'saved';
			}
		} catch {
			dirty = true;
			status = 'idle';
			showToast({ message: m.note_not_saved() });
		}
	}

	function changed() {
		dirty = true;
		status = 'saving';
		clearTimeout(timer);
		timer = setTimeout(save, SAVE_AFTER_MS);
	}

	function grow() {
		if (!field) return;
		field.style.height = 'auto';
		field.style.height = `${Math.max(120, field.scrollHeight)}px`;
	}

	async function edit() {
		editing = true;
		await tick();
		grow();
		field?.focus();
		field?.setSelectionRange(text.length, text.length);
	}

	// While editing, the field and its Done stay above the keyboard, also while the card is still opening.
	$effect(() => {
		if (editing && editor) return keepInView(editor);
	});

	function toggle() {
		open = !open;
		if (open && !hasText) void edit();
		if (!open) {
			editing = false;
			void save();
		}
	}

	function tapped(event: MouseEvent) {
		if ((event.target as Element).closest('a, label')) return;
		void edit();
	}

	// Don't lose the last words when the app goes to the background or the page changes.
	function onvisibility() {
		if (document.visibilityState === 'hidden') void save();
	}
	onDestroy(() => void save());
</script>

<svelte:document onvisibilitychange={onvisibility} />

<section class="rounded-card bg-surface px-[18px] py-1 shadow-card" aria-label={m.note_title()}>
	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		class="grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)_auto_24px] items-center gap-2.5 text-left"
	>
		<span class="min-w-0">
			<b class="block text-[15px] font-[650]">{m.note_title()}</b>
			{#if !open}
				<small class="block truncate text-[13px] text-muted"
					>{hasText ? notePreview(text) : m.note_add()}</small
				>
			{/if}
		</span>
		<span class="text-[12.5px] whitespace-nowrap text-muted">
			{#if status === 'saved' || status === 'device'}{m.note_saved_short()}{/if}
		</span>
		<ChevronDown
			size={22}
			aria-hidden="true"
			class={[
				'text-muted transition-transform duration-300 ease-(--ui) motion-reduce:transition-none',
				open && 'rotate-180'
			]}
		/>
	</button>
	<div class={['collapse-row', open && 'open']}>
		<div>
			<div bind:this={editor} class="flex flex-col gap-2 pt-[3px] pb-3.5">
				{#if editing}
					<textarea
						bind:this={field}
						bind:value={text}
						maxlength={MAX_LENGTH}
						aria-label={m.note_label()}
						placeholder={m.note_placeholder()}
						oninput={() => {
							grow();
							changed();
						}}
						onblur={() => {
							editing = false;
							void save();
						}}
						class="min-h-[120px] resize-none rounded-input bg-surface2 px-3.5 py-3 text-[16px] leading-normal font-medium placeholder:text-muted focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
					></textarea>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
					<div onclick={tapped} class="min-h-6 cursor-text rounded-small py-0.5">
						{#if hasText}
							<NoteBody
								{text}
								ontask={(line, done) => {
									text = setTask(text, line, done);
									dirty = true;
									void save();
								}}
							/>
						{:else}
							<p class="text-[15px] text-muted">{m.note_tap()}</p>
						{/if}
					</div>
				{/if}
				<div class="flex min-h-9 items-center justify-between gap-3 text-[12.5px] text-muted">
					<span>{foot}</span>
					{#if editing}
						<button
							type="button"
							onmousedown={(e) => e.preventDefault()}
							onclick={() => field?.blur()}
							class="min-h-9 text-[14px] font-[650] text-accent">{m.note_done()}</button
						>
					{:else}
						<button type="button" onclick={edit} class="min-h-9 text-[14px] font-[650] text-accent"
							>{m.note_edit()}</button
						>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
