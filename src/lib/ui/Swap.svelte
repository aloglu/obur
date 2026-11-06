<script lang="ts">
	// A label that changes in its own slot: the new words slide in as the old ones fade (docs/ui.md, "Motion").
	let { a, b, showB }: { a: string; b: string; showB: boolean } = $props();
</script>

<span class="swap">
	<span aria-hidden={showB} class:off={showB}>{a}</span>
	<span aria-hidden={!showB} class:off={!showB}>{b}</span>
</span>

<style>
	.swap {
		display: inline-grid;
	}
	.swap > span {
		grid-area: 1 / 1;
		transition:
			opacity 220ms,
			transform 300ms var(--ui);
	}
	.off {
		opacity: 0;
		transform: translateY(6px);
	}
	@media (prefers-reduced-motion: reduce) {
		.swap > span {
			transition: none;
		}
	}
</style>
