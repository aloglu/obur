<script lang="ts">
	// The recovery codes, shown only now: a warning card, the codes, then "I've saved these codes" as its own row. Continue
	// waits for it.
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import { m } from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';
	import Notice from './Notice.svelte';

	let { codes, ondone }: { codes: string[]; ondone: () => void } = $props();
	let saved = $state(false);
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(codes.join('\n'));
			copied = true;
		} catch {
			// The browser refused the clipboard: the codes stay on screen and Download still works (G29).
		}
	}

	function download() {
		const blob = new Blob([`obur recovery codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'obur-recovery-codes.txt';
		a.click();
		// Safari starts the download after the click returns: the address must still work then (G29).
		setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
	}
</script>

<Notice title={m.codes_warning_title()}>{m.codes_body()}</Notice>
<div class="flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card">
	<ol
		class="grid grid-cols-1 gap-2 font-mono text-[0.9375rem] tabular-nums min-[360px]:grid-cols-2"
		aria-label={m.codes_title()}
	>
		{#each codes as code (code)}<li>{code}</li>{/each}
	</ol>
	<div class="grid grid-cols-2 gap-2">
		<Button variant="ghost" onclick={copy}
			><Copy size={18} aria-hidden="true" />{copied ? m.common_copied() : m.common_copy()}</Button
		>
		<Button variant="ghost" onclick={download}
			><Download size={18} aria-hidden="true" />{m.codes_download()}</Button
		>
	</div>
</div>
<label
	class="flex min-h-14 items-center gap-3 rounded-input bg-surface px-4 text-[0.9375rem] font-semibold shadow-card"
>
	<input type="checkbox" bind:checked={saved} />
	{m.codes_saved()}
</label>
<Button wide disabled={!saved} onclick={ondone}>{m.common_continue()}</Button>
