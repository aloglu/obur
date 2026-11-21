<script lang="ts">
	// docs/ui.md "Day notes": a card that opens in place. A note saves itself; one that couldn't be saved says so and is
	// sent again with the next change, and the last version typed wins (docs/design.md). Tapping the text edits it;
	// links and to-dos act on their own.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { save as send } from '#lib/client/api.ts';
	import { clockTime } from '#lib/client/prefs.ts';
	import { showToast } from '#lib/client/toast.svelte.ts';
	import { notePreview, setTask } from '#lib/shared/markdown.ts';
	import NoteBody from './NoteBody.svelte';

	const SAVE_AFTER_MS = 500;
	const MAX_LENGTH = 10_000;

	let { date, saved }: { date: string; saved: string } = $props();

	let text = $state(untrack(() => saved));
	let open = $state(false);
	let editing = $state(false);
	// kept: the server kept a newer note typed on another device, and the card now shows that one. unsaved: the last
	// save failed; the text stays here and goes with the next change.
	let status = $state<'idle' | 'saving' | 'saved' | 'unsaved' | 'kept'>('idle');
	let savedAt = $state('');
	let field = $state<HTMLTextAreaElement>();
	// Opening straight into typing skips the height animation, so the field is already in place when it gets focus and
	// iOS scrolls it above the keyboard by itself, smoothly. A field still growing ends up behind the keyboard.
	let instant = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;
	// When the words waiting to be saved were typed: a retry sent later keeps that time, so it never counts as newer
	// than an edit made on another device in between (A22).
	let typedAt = '';

	// A newer note arrived with the page's data (typed on another device): shown unless words here wait to be saved.
	$effect(() => {
		const next = saved;
		untrack(() => {
			if (!dirty && status !== 'saving' && next !== text) text = next;
		});
	});

	/** The server's answer: saved as typed, or it kept a newer note from another device, which the card shows. */
	function settled(kept: string, typed: string) {
		if (kept !== typed) {
			text = kept;
			status = 'kept';
			return;
		}
		savedAt = clockTime(new Date().toISOString(), page.data.timeFormat ?? 'device');
		status = 'saved';
	}

	const hasText = $derived(text.trim() !== '');
	const foot = $derived(
		status === 'saving'
			? m.note_saving()
			: status === 'saved'
				? m.note_saved({ time: savedAt })
				: status === 'unsaved'
					? m.note_unsaved()
					: status === 'kept'
						? m.note_kept_newer()
						: m.note_private()
	);

	async function save() {
		clearTimeout(timer);
		if (!dirty) return;
		dirty = false;
		const typed = text;
		status = 'saving';
		try {
			const result = await send<{ text: string }>(`/api/v1/diary/days/${date}/note`, {
				id: crypto.randomUUID(),
				text: typed,
				typedAt
			});
			// Typed again meanwhile: the next save answers for it.
			if (!dirty) settled(result.text, typed);
		} catch {
			dirty = true;
			status = 'unsaved';
			showToast({ message: m.note_not_saved() });
		}
	}

	function changed() {
		dirty = true;
		typedAt = new Date().toISOString();
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

	function toggle() {
		open = !open;
		instant = open && !hasText;
		if (instant) void edit();
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
			<b class="block text-[0.9375rem] font-[650]">{m.note_title()}</b>
			{#if !open}
				<small class="block truncate text-[0.8125rem] text-muted"
					>{hasText ? notePreview(text) : m.note_add()}</small
				>
			{/if}
		</span>
		<span class="text-[0.78125rem] whitespace-nowrap text-muted">
			{#if status === 'saved'}{m.note_saved_short()}{:else if status === 'unsaved'}{m.note_unsaved_short()}{/if}
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
	<div class={['collapse-row', open && 'open', instant && 'instant']}>
		<div>
			<div class="flex flex-col gap-2 pt-[3px] pb-3.5">
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
						class="min-h-[120px] resize-none rounded-input bg-surface2 px-3.5 py-3 text-[1rem] leading-normal font-medium placeholder:text-muted focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
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
									typedAt = new Date().toISOString();
									void save();
								}}
							/>
						{:else}
							<p class="text-[0.9375rem] text-muted">{m.note_tap()}</p>
						{/if}
					</div>
				{/if}
				<div class="flex min-h-9 items-center justify-between gap-3 text-[0.78125rem] text-muted">
					<span>{foot}</span>
					{#if editing}
						<button
							type="button"
							onmousedown={(e) => e.preventDefault()}
							onclick={() => field?.blur()}
							class="min-h-9 text-[0.875rem] font-[650] text-accent">{m.note_done()}</button
						>
					{:else}
						<button
							type="button"
							onclick={edit}
							class="min-h-9 text-[0.875rem] font-[650] text-accent">{m.note_edit()}</button
						>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
