<script lang="ts">
	import type { Snippet } from 'svelte';

	let { tone = 'warn', children }: { tone?: 'warn' | 'bad' | 'info'; children: Snippet } = $props();
</script>

<div
	role={tone === 'info' ? 'status' : 'alert'}
	class={[
		'rounded-small px-3.5 py-3 text-[14px] font-medium',
		tone === 'warn' && 'bg-warn-soft text-warn',
		tone === 'bad' && 'bg-warn-soft text-bad',
		tone === 'info' && 'bg-soft text-text'
	]}
>
	{@render children()}
</div>
