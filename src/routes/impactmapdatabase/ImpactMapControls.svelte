<script>
	import { impactMapDatabaseState } from '$lib/utils/state.svelte';
	import { palettes } from '$lib/utils/colorPalettes';
	import ColorPaletteBar from '$lib/components/ColorPaletteBar.svelte';
	import { vizOptions } from '$lib/utils/hexMapProperties';

	// Add reactivity for state tracking
	$effect(() => {
		console.log('State changed:', JSON.stringify(impactMapDatabaseState, null, 2));
	});

	// Available color palettes
	const availablePalettes = [
		{ value: 'viridis', label: 'Viridis' },
		{ value: 'inferno', label: 'Inferno' },
		{ value: 'magma', label: 'Magma' },
		{ value: 'plasma', label: 'Plasma' },
		{ value: 'blues', label: 'Blues' },
		{ value: 'greens', label: 'Greens' }
	];
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto">
	<h2 class="text-xl font-bold text-primary">Impact Map</h2>

	{#if impactMapDatabaseState.dataCount > 0}
		<p class="text-sm text-gray-600">
			Showing {impactMapDatabaseState.dataCount.toLocaleString()} bridges in view{impactMapDatabaseState.dataCount >=
			20000
				? ' (the most the API sends at once; zoom in to see them all)'
				: ''}
		</p>
	{/if}

	<!-- Color palette selector -->
	<div class="form-control">
		<label class="label">
			<span class="label-text font-semibold">Color Palette</span>
		</label>
		<select
			class="select select-bordered w-full"
			bind:value={impactMapDatabaseState.selectedPalette}>
			{#each availablePalettes as palette}
				<option value={palette.value}>{palette.label}</option>
			{/each}
		</select>

		<!-- Color palette preview -->
		<div class="mt-2">
			<ColorPaletteBar palette={palettes[impactMapDatabaseState.selectedPalette]} />
		</div>
	</div>

	<!-- Satellite imagery toggle -->
	<div class="form-control">
		<label class="label cursor-pointer">
			<span class="label-text font-semibold">Satellite Imagery</span>
			<input
				type="checkbox"
				class="toggle toggle-primary"
				bind:checked={impactMapDatabaseState.satelliteImagery} />
		</label>
	</div>

	<!-- Hex Data Layer - Simplified for focusing on just showing outlines -->
	<div class="form-control">
		<label class="label cursor-pointer">
			<span class="label-text font-semibold">Show Hex Grid</span>
			<input
				type="checkbox"
				class="toggle toggle-primary"
				bind:checked={impactMapDatabaseState.showHexLayer} />
		</label>
	</div>
</div>
