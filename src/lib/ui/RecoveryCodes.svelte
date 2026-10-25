<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';

	let { codes, ondone }: { codes: string[]; ondone: () => void } = $props();
	let saved = $state(false);
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(codes.join('\n'));
		copied = true;
	}

	function download() {
		const blob = new Blob([`obur recovery codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'obur-recovery-codes.txt';
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<div class="flex flex-col gap-3">
	<h2 class="text-[19px] font-bold">{m.codes_title()}</h2>
	<p class="text-[14px] text-muted">{m.codes_body()}</p>
	<ol
		class="grid grid-cols-1 gap-1.5 rounded-small bg-surface2 p-3 font-mono text-[15px] tabular-nums min-[360px]:grid-cols-2"
		aria-label={m.codes_title()}
	>
		{#each codes as code (code)}<li>{code}</li>{/each}
	</ol>
	<div class="flex gap-2">
		<Button variant="ghost" onclick={copy}>{copied ? m.common_copied() : m.common_copy()}</Button>
		<Button variant="ghost" onclick={download}>{m.codes_download()}</Button>
	</div>
	<label class="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
		<input type="checkbox" bind:checked={saved} class="size-5 accent-accent" />
		{m.codes_saved()}
	</label>
	<Button wide disabled={!saved} onclick={ondone}>{m.common_continue()}</Button>
</div>
