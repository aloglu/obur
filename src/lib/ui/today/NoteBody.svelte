<script lang="ts">
	// A day note as elements, from shared/markdown.ts: no HTML is ever inserted.
	import { parseNote, type Inline } from '#lib/shared/markdown.ts';

	interface Props {
		text: string;
		ontask: (line: number, done: boolean) => void;
	}
	let { text, ontask }: Props = $props();
	const blocks = $derived(parseNote(text));
</script>

{#snippet inline(parts: Inline[])}
	{#each parts as part, i (i)}
		{#if part.kind === 'bold'}<b>{part.text}</b>
		{:else if part.kind === 'italic'}<i>{part.text}</i>
		{:else if part.kind === 'code'}<code
				class="rounded-[6px] bg-surface2 px-[5px] py-px font-mono text-[0.84375rem]"
				>{part.text}</code
			>
		{:else if part.kind === 'link'}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a link typed by the person, to another site -->
			<a href={part.href} target="_blank" rel="noopener noreferrer" class="text-accent underline"
				>{part.text}</a
			>
		{:else}{part.text}{/if}
	{/each}
{/snippet}

<div class="flex flex-col gap-1.5 text-[0.9375rem] leading-normal">
	{#each blocks as block, b (b)}
		{#if block.kind === 'heading'}
			{#if block.level === 1}
				<h3 class="font-display text-[1.125rem] font-[750]">{@render inline(block.content)}</h3>
			{:else}
				<h4 class="font-display text-[1rem] font-bold">{@render inline(block.content)}</h4>
			{/if}
		{:else if block.kind === 'paragraph'}
			<p>
				{#each block.lines as line, l (l)}{#if l}<br />{/if}{@render inline(line)}{/each}
			</p>
		{:else if block.kind === 'quote'}
			<blockquote class="border-l-[3px] border-line pl-2.5 text-muted">
				{@render inline(block.content)}
			</blockquote>
		{:else if block.kind === 'list'}
			<svelte:element
				this={block.ordered ? 'ol' : 'ul'}
				class={['pl-[22px]', block.ordered ? 'list-decimal' : 'list-disc']}
			>
				{#each block.items as item, i (i)}<li>{@render inline(item)}</li>{/each}
			</svelte:element>
		{:else}
			<ul>
				{#each block.items as item (item.line)}
					<li>
						<label class="flex min-h-8 cursor-pointer items-start gap-2.5">
							<input
								type="checkbox"
								checked={item.done}
								onchange={(e) => ontask(item.line, e.currentTarget.checked)}
							/>
							<span class={item.done ? 'text-muted line-through' : ''}
								>{@render inline(item.content)}</span
							>
						</label>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</div>
