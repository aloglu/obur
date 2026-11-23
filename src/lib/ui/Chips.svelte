<script lang="ts" generics="T extends string">
	// A segmented control for two to four options filled in once (radio group semantics, docs/ui.md "Choices"). Equal
	// widths, never stacked; the highlight slides to the chosen option. One Tab stop; the arrow keys choose (H22).
	import { radioKeys } from '#lib/client/radio-keys.ts';
	interface Option {
		value: T;
		label: string;
		disabled?: boolean;
	}
	interface Props {
		label: string;
		options: Option[];
		value: T;
		onchange?: (value: T) => void;
		/** The row around it already says what this is. */
		hideLabel?: boolean;
	}
	let { label, options, value = $bindable(), onchange, hideLabel = false }: Props = $props();
	const at = $derived(options.findIndex((o) => o.value === value));
	/** The Tab stop: the chosen option, or the first that can be chosen when none is. */
	const stop = $derived(
		at >= 0 && !options[at].disabled ? at : options.findIndex((o) => !o.disabled)
	);
</script>

<fieldset class="flex flex-col gap-1.5">
	<legend class={hideLabel ? 'sr-only' : 'mb-1.5 text-[0.8125rem] font-[650] text-muted'}
		>{label}</legend
	>
	<div
		class="tray relative grid auto-cols-[minmax(0,1fr)] grid-flow-col rounded-input bg-surface2 p-1"
		role="radiogroup"
		aria-label={label}
		style:--count={options.length}
		style:--at={at}
	>
		{#if at >= 0}<span class="thumb" aria-hidden="true"></span>{/if}
		{#each options as option, i (option.value)}
			<button
				type="button"
				role="radio"
				aria-checked={value === option.value}
				tabindex={i === stop ? 0 : -1}
				disabled={option.disabled}
				onkeydown={(e) => radioKeys(e)}
				onclick={() => {
					value = option.value;
					onchange?.(option.value);
				}}
				class={[
					'relative z-1 min-h-11 min-w-0 rounded-small px-2 py-1.5 text-[min(0.9375rem,20px)] leading-tight font-semibold break-words transition-colors disabled:opacity-40',
					value === option.value ? 'text-text' : 'text-muted'
				]}
			>
				{option.label}
			</button>
		{/each}
	</div>
</fieldset>

<style>
	.thumb {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc((100% - 8px) / var(--count));
		border-radius: var(--radius-small);
		background: var(--surface);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
		transform: translateX(calc(100% * var(--at)));
		transition: transform 380ms var(--travel);
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
