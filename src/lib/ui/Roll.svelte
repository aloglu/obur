<script lang="ts">
	// A number that rolls digit by digit when it changes (docs/ui.md, "Motion"). Only the digits that changed move, the
	// lowest first; up rolls upward, down rolls downward. A place that appears or goes away opens or closes its width as
	// it rolls, so the rest never jumps when the number gains or loses a digit. Always ends as plain text.
	let { value }: { value: string } = $props();
	let el = $state<HTMLSpanElement>();
	let shown: string | undefined;

	const numeric = (text: string) =>
		parseFloat(
			text
				.replace(/[^\d.,−-]/g, '')
				.replace(/\./g, '')
				.replace(/,/g, '.')
		);

	$effect(() => {
		const next = value;
		const node = el;
		if (!node) return;
		const previous = shown;
		shown = next;
		if (previous === undefined || previous === next) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			node.textContent = next;
			return;
		}
		const width = Math.max(previous.length, next.length);
		const from = previous.padStart(width, ' ');
		const to = next.padStart(width, ' ');
		const direction = numeric(next) >= numeric(previous) ? 1 : -1;
		const moves: Animation[] = [];
		node.textContent = '';
		for (let i = 0; i < width; i++) {
			if (from[i] === to[i]) {
				if (to[i] !== ' ') node.append(to[i]);
				continue;
			}
			const slot = document.createElement('span');
			slot.className = 'roll-slot';
			const out = document.createElement('span');
			const into = document.createElement('span');
			out.textContent = from[i].trim();
			into.textContent = to[i].trim();
			slot.append(out, into);
			node.append(slot);
			const timing = {
				duration: 420,
				delay: (width - 1 - i) * 40,
				easing: 'cubic-bezier(0.3, 0.75, 0.1, 1)',
				fill: 'both'
			} as const;
			// A digit or separator that comes or goes takes its room with it.
			if (from[i] === ' ' || to[i] === ' ') {
				const full = `${slot.getBoundingClientRect().width}px`;
				moves.push(slot.animate({ width: to[i] === ' ' ? [full, '0px'] : ['0px', full] }, timing));
			}
			moves.push(
				out.animate(
					[
						{ transform: 'translateY(0)', opacity: 1 },
						{ transform: `translateY(${-100 * direction}%)`, opacity: 0 }
					],
					timing
				),
				into.animate(
					[
						{ transform: `translateY(${100 * direction}%)`, opacity: 0 },
						{ transform: 'translateY(0)', opacity: 1 }
					],
					timing
				)
			);
		}
		Promise.all(moves.map((m) => m.finished))
			.then(() => {
				if (shown === next) node.textContent = next;
			})
			.catch(() => {});
	});
</script>

<span bind:this={el}>{value}</span>

<style>
	span :global(.roll-slot) {
		display: inline-grid;
		overflow: hidden;
		vertical-align: bottom;
	}
	span :global(.roll-slot > span) {
		grid-area: 1 / 1;
		justify-self: center;
	}
</style>
