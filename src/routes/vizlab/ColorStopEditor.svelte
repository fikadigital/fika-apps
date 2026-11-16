<script>
	import { palettes } from '$lib/utils/colorPalettes';
	import { parseColor, toRgbaString, seedStops, cleanStops } from '$lib/utils/vizlab/layers';
	import ColorPaletteBar from '$lib/components/ColorPaletteBar.svelte';

	// valueMode: 'number' (editable stop position), 'label' (category name, fixed), 'none'
	let {
		stops = $bindable(),
		paletteName = $bindable('Custom'),
		valueMode = 'number',
		rangeMin = 0,
		rangeMax = 1
	} = $props();

	let previewColors = $derived(
		valueMode === 'number' ? cleanStops(stops).map((s) => s.color) : stops.map((s) => s.color)
	);

	function applyPalette(name) {
		paletteName = name;
		if (name === 'Custom') return;
		const colors = palettes[name];
		if (valueMode === 'number') {
			stops = seedStops(colors, rangeMin, rangeMax);
		} else {
			stops = stops.map((s, i) => {
				const { hex, alpha } = parseColor(colors[i % colors.length]);
				return { ...s, color: toRgbaString(hex, alpha) };
			});
		}
	}

	function setColor(i, hex) {
		const { alpha } = parseColor(stops[i].color);
		stops[i].color = toRgbaString(hex, alpha);
		paletteName = 'Custom';
	}

	function setAlpha(i, alpha) {
		const { hex } = parseColor(stops[i].color);
		stops[i].color = toRgbaString(hex, alpha);
		paletteName = 'Custom';
	}

	function setValue(i, v) {
		stops[i].value = v === '' ? '' : Number(v);
		paletteName = 'Custom';
	}

	function addStop() {
		const sorted = cleanStops(stops);
		const last = sorted[sorted.length - 1];
		const value = last ? Number(last.value) + (rangeMax - rangeMin) / 10 : rangeMin;
		stops.push({
			value: Math.round(value * 100) / 100,
			color: last?.color ?? 'rgba(255, 255, 255, 1)'
		});
		paletteName = 'Custom';
	}

	function removeStop(i) {
		stops.splice(i, 1);
		paletteName = 'Custom';
	}

	function reverse() {
		const colors = stops.map((s) => s.color).reverse();
		stops.forEach((s, i) => (s.color = colors[i]));
		paletteName = 'Custom';
	}
</script>

<div class="flex flex-col gap-2">
	<ColorPaletteBar colors={previewColors.length ? previewColors : undefined} name="preview" />

	<select
		class="select select-bordered select-sm w-full bg-transparent font-mono"
		value={paletteName}
		onchange={(e) => applyPalette(e.currentTarget.value)}>
		<option value="Custom">Custom</option>
		{#each Object.keys(palettes) as name}
			<option value={name}>{name}</option>
		{/each}
	</select>

	<div class="flex flex-col gap-1">
		{#each stops as stop, i (i)}
			{@const c = parseColor(stop.color)}
			<div class="flex items-center gap-1">
				<input
					type="color"
					class="h-7 w-8 shrink-0 cursor-pointer rounded border border-gray-300 bg-transparent p-0"
					value={c.hex}
					oninput={(e) => setColor(i, e.currentTarget.value)}
					aria-label="Stop color" />
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					class="range range-xs min-w-0 flex-1"
					value={c.alpha}
					oninput={(e) => setAlpha(i, Number(e.currentTarget.value))}
					aria-label="Stop opacity"
					title="Opacity: {Math.round(c.alpha * 100)}%" />
				<span class="w-8 shrink-0 text-right font-mono text-[10px]">
					{Math.round(c.alpha * 100)}%
				</span>
				{#if valueMode === 'number'}
					<input
						type="number"
						class="input input-xs input-bordered w-16 shrink-0 bg-transparent font-mono"
						value={stop.value}
						oninput={(e) => setValue(i, e.currentTarget.value)}
						aria-label="Stop value" />
				{:else if valueMode === 'label'}
					<span class="w-16 shrink-0 truncate font-mono text-xs" title={stop.value}
						>{stop.value}</span>
				{/if}
				<button
					class="btn btn-ghost btn-xs px-1"
					title="Make transparent"
					onclick={() => setAlpha(i, 0)}>
					&#9638;
				</button>
				{#if valueMode === 'number'}
					<button
						class="btn btn-ghost btn-xs px-1"
						title="Remove stop"
						disabled={stops.length <= 1}
						onclick={() => removeStop(i)}>
						&times;
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<div class="flex gap-2">
		{#if valueMode === 'number'}
			<button class="btn btn-outline btn-xs" onclick={addStop}>+ Add stop</button>
		{/if}
		<button class="btn btn-outline btn-xs" onclick={reverse}>Reverse</button>
	</div>
</div>
