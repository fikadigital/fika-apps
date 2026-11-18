<script>
	import { BRIDGE_TIERS, bandLabel } from '$lib/utils/impactmap/areaBridges.js';

	/**
	 * A row of coloured bands, one per "top N" choice, with the number above each. Picking a
	 * band selects that many bridges; the bands up to it stay solid, the rest fade. Picking the
	 * chosen band again clears it.
	 * @type {{ selected: number | null, onselect: (top: number | null) => void }}
	 */
	let { selected, onselect } = $props();
</script>

<div role="group" aria-label="Number of top-ranked bridges to show" class="flex w-full gap-0.5">
	{#each BRIDGE_TIERS as tier, i (tier.top)}
		{@const chosen = selected === tier.top}
		{@const solid = selected === null || tier.top <= selected}
		<button
			type="button"
			class="group flex min-w-0 flex-1 flex-col items-stretch gap-1"
			aria-pressed={chosen}
			title="Top {tier.top} bridges ({bandLabel(i)})"
			onclick={() => onselect(chosen ? null : tier.top)}>
			<span class="text-center text-xs font-semibold {chosen ? 'text-secondary' : 'text-gray-600'}">
				{tier.top}
			</span>
			<span
				class="block h-3.5 transition-opacity group-hover:opacity-100 {i === 0
					? 'rounded-l-md'
					: ''} {i === BRIDGE_TIERS.length - 1 ? 'rounded-r-md' : ''} {chosen
					? 'ring-2 ring-secondary ring-offset-1'
					: ''}"
				style:background-color={tier.color}
				style:opacity={solid ? 1 : 0.3}>
			</span>
		</button>
	{/each}
</div>
