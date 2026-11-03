<script>
	import { vizLabState } from '$lib/utils/state.svelte.js';
	import { palettes } from '$lib/utils/colorPalettes';
	import { parseColor, toRgbaString, seedStops, findProperty } from '$lib/utils/vizlab/layers';
	import ColorStopEditor from './ColorStopEditor.svelte';

	const stylePresets = [
		{ label: 'Waternet', url: 'mapbox://styles/bridgestoprosperity/cm4kippxv01k101slb7hs8mvr' },
		{ label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
		{ label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
		{ label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
		{ label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
		{ label: 'Blank', url: 'blank' }
	];

	let v = $derived(vizLabState.vector);
	let r = $derived(vizLabState.raster);

	let numericProps = $derived(v.properties.filter((p) => p.type === 'number'));
	let selectedInfo = $derived(findProperty(v, v.property));

	function applyStyle(url) {
		vizLabState.mapStyleUrl = url;
		vizLabState.appliedStyleUrl = url;
	}

	function loadVector() {
		v.appliedUrl = v.url.trim();
		v.appliedSourceLayer = v.sourceLayer.trim();
		v.properties = [];
		v.loadNonce++;
	}

	function loadRaster() {
		r.appliedUrl = r.url.trim();
		r.loadNonce++;
	}

	function buildCategories(info) {
		const colors = palettes[v.paletteName === 'Custom' ? 'tableau10' : v.paletteName];
		return (info?.values ?? []).map((value, i) => {
			const { hex, alpha } = parseColor(colors[i % colors.length]);
			return { value, color: toRgbaString(hex, alpha) };
		});
	}

	// Re-seed stops/categories so they fit the newly selected property.
	function onPropertyChange() {
		const info = findProperty(v, v.property);
		if (!info) return;
		if (v.mode === 'categorical') {
			v.categories = buildCategories(info);
		} else if (info.type === 'number') {
			const colors = v.stops.map((s) => s.color);
			const max = info.max > info.min ? info.max : info.min + 1;
			v.stops = colors.map((color, i) => ({
				color,
				value:
					Math.round((info.min + ((max - info.min) * i) / Math.max(colors.length - 1, 1)) * 100) /
					100
			}));
		}
		v.filterProperty = info.type === 'number' ? v.property : v.filterProperty;
		v.filterMin = info.type === 'number' ? info.min : v.filterMin;
	}

	function onModeChange() {
		if (v.mode === 'categorical') v.categories = buildCategories(selectedInfo);
		else if (v.mode === 'gradient' && selectedInfo?.type !== 'number' && numericProps.length) {
			v.property = numericProps[0].name;
			onPropertyChange();
		}
	}

	function setSolidColor(hex) {
		v.solidColor = toRgbaString(hex, parseColor(v.solidColor).alpha);
	}
	function setSolidAlpha(alpha) {
		v.solidColor = toRgbaString(parseColor(v.solidColor).hex, alpha);
	}

	function resetRasterRange() {
		r.stops = seedStops(palettes[r.paletteName] ?? palettes.inferno, r.minValue, r.maxValue);
	}
</script>

<div class="flex flex-col gap-3 text-sm">
	<!-- Basemap -->
	<details open class="collapse collapse-arrow border border-base-300 bg-white/60">
		<summary class="collapse-title min-h-0 py-2 font-bold">Basemap</summary>
		<div class="collapse-content flex flex-col gap-2">
			<label class="text-xs" for="style-url">Map style URL</label>
			<div class="flex gap-1">
				<input
					id="style-url"
					type="text"
					class="input input-sm input-bordered min-w-0 flex-1 bg-transparent font-mono text-xs"
					placeholder="mapbox://styles/... or https://.../style.json"
					bind:value={vizLabState.mapStyleUrl}
					onkeydown={(e) => e.key === 'Enter' && applyStyle(vizLabState.mapStyleUrl.trim())} />
				<button
					class="btn btn-primary btn-sm"
					onclick={() => applyStyle(vizLabState.mapStyleUrl.trim())}>Apply</button>
			</div>
			<div class="flex flex-wrap gap-1">
				{#each stylePresets as preset}
					<button class="btn btn-outline btn-xs" onclick={() => applyStyle(preset.url)}>
						{preset.label}
					</button>
				{/each}
			</div>
			{#if vizLabState.styleError}
				<p class="text-xs text-error">{vizLabState.styleError}</p>
			{/if}

			<label class="label cursor-pointer py-0">
				<span>Satellite imagery</span>
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm [--tglbg:#e8e8e8]"
					bind:checked={vizLabState.satellite.visible} />
			</label>
			{#if vizLabState.satellite.visible}
				<label class="label cursor-pointer py-0">
					<span>Black and white</span>
					<input
						type="checkbox"
						class="toggle toggle-sm [--tglbg:#e8e8e8]"
						bind:checked={vizLabState.satellite.blackAndWhite} />
				</label>
			{/if}
		</div>
	</details>

	<!-- Vector -->
	<details open class="collapse collapse-arrow border border-base-300 bg-white/60">
		<summary class="collapse-title min-h-0 py-2 font-bold">Vector data</summary>
		<div class="collapse-content flex flex-col gap-2">
			<label class="label cursor-pointer py-0">
				<span>Visible</span>
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm [--tglbg:#e8e8e8]"
					bind:checked={v.visible} />
			</label>

			<label class="text-xs" for="vec-url"
				>Vector tiles (.pmtiles, {'{z}/{x}/{y}'} URL, TileJSON or mapbox://)</label>
			<input
				id="vec-url"
				type="text"
				class="input input-sm input-bordered w-full bg-transparent font-mono text-xs"
				bind:value={v.url} />
			<label class="text-xs" for="vec-layer">Source layer</label>
			<div class="flex gap-1">
				<input
					id="vec-layer"
					type="text"
					class="input input-sm input-bordered min-w-0 flex-1 bg-transparent font-mono text-xs"
					bind:value={v.sourceLayer} />
				<button class="btn btn-primary btn-sm" onclick={loadVector}>Load</button>
			</div>
			{#if v.error}
				<p class="text-xs text-error">{v.error}</p>
			{/if}

			{#if v.visible}
				<div class="divider my-0"></div>

				<span class="text-xs">Style</span>
				<div class="join w-full">
					{#each [['gradient', 'Gradient'], ['categorical', 'Categories'], ['solid', 'Solid']] as [mode, label]}
						<button
							class="btn join-item btn-xs flex-1"
							class:btn-primary={v.mode === mode}
							onclick={() => {
								v.mode = mode;
								onModeChange();
							}}>{label}</button>
					{/each}
				</div>

				{#if v.mode !== 'solid'}
					<label class="text-xs" for="vec-prop">
						Style by property {v.properties.length ? '' : '(pan the map over data to detect)'}
					</label>
					<select
						id="vec-prop"
						class="select select-bordered select-sm w-full bg-transparent font-mono"
						bind:value={v.property}
						onchange={onPropertyChange}>
						{#if !findProperty(v, v.property)}
							<option value={v.property}>{v.property}</option>
						{/if}
						{#each v.mode === 'gradient' ? numericProps : v.properties as p}
							<option value={p.name}>{p.name} ({p.type})</option>
						{/each}
					</select>
				{/if}

				{#if v.mode === 'gradient'}
					<ColorStopEditor
						bind:stops={v.stops}
						bind:paletteName={v.paletteName}
						rangeMin={selectedInfo?.min ?? v.stops[0]?.value ?? 0}
						rangeMax={selectedInfo?.max ?? v.stops[v.stops.length - 1]?.value ?? 1} />
				{:else if v.mode === 'categorical'}
					{#if v.categories.length}
						<ColorStopEditor
							bind:stops={v.categories}
							bind:paletteName={v.paletteName}
							valueMode="label" />
					{:else}
						<p class="text-xs">No values detected yet for this property.</p>
					{/if}
					<button
						class="btn btn-outline btn-xs"
						onclick={() => (v.categories = buildCategories(selectedInfo))}>
						Refresh categories
					</button>
				{:else}
					<div class="flex items-center gap-1">
						<input
							type="color"
							class="h-7 w-8 cursor-pointer rounded border border-gray-300 bg-transparent p-0"
							value={parseColor(v.solidColor).hex}
							oninput={(e) => setSolidColor(e.currentTarget.value)} />
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							class="range range-xs flex-1"
							value={parseColor(v.solidColor).alpha}
							oninput={(e) => setSolidAlpha(Number(e.currentTarget.value))} />
						<span class="w-8 text-right font-mono text-[10px]">
							{Math.round(parseColor(v.solidColor).alpha * 100)}%
						</span>
					</div>
				{/if}

				<span class="text-xs">Layer opacity</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					class="range range-xs"
					bind:value={v.opacity} />

				<div class="divider my-0"></div>
				<span class="text-xs">Line width</span>
				<div class="join w-full">
					<button
						class="btn join-item btn-xs flex-1"
						class:btn-primary={v.widthMode === 'constant'}
						onclick={() => (v.widthMode = 'constant')}>Constant</button>
					<button
						class="btn join-item btn-xs flex-1"
						class:btn-primary={v.widthMode === 'property'}
						onclick={() => (v.widthMode = 'property')}>By property</button>
				</div>
				{#if v.widthMode === 'constant'}
					<input
						type="range"
						min="0.1"
						max="10"
						step="0.1"
						class="range range-xs"
						bind:value={v.constantWidth} />
				{:else}
					<select
						class="select select-bordered select-sm w-full bg-transparent font-mono"
						bind:value={v.widthProperty}>
						{#if !numericProps.some((p) => p.name === v.widthProperty)}
							<option value={v.widthProperty}>{v.widthProperty}</option>
						{/if}
						{#each numericProps as p}
							<option value={p.name}>{p.name}</option>
						{/each}
					</select>
					<div class="flex items-center gap-2 text-xs">
						<span>min px</span>
						<input
							type="number"
							step="0.1"
							min="0"
							class="input input-xs input-bordered w-16 bg-transparent"
							bind:value={v.widthMin} />
						<span>max px</span>
						<input
							type="number"
							step="0.1"
							min="0"
							class="input input-xs input-bordered w-16 bg-transparent"
							bind:value={v.widthMax} />
					</div>
				{/if}

				<div class="divider my-0"></div>
				<label class="label cursor-pointer py-0">
					<span>Filter by minimum value</span>
					<input
						type="checkbox"
						class="toggle toggle-sm [--tglbg:#e8e8e8]"
						bind:checked={v.filterEnabled} />
				</label>
				{#if v.filterEnabled}
					{@const fInfo = findProperty(v, v.filterProperty)}
					<select
						class="select select-bordered select-sm w-full bg-transparent font-mono"
						bind:value={v.filterProperty}>
						{#if !numericProps.some((p) => p.name === v.filterProperty)}
							<option value={v.filterProperty}>{v.filterProperty}</option>
						{/if}
						{#each numericProps as p}
							<option value={p.name}>{p.name}</option>
						{/each}
					</select>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min={fInfo?.min ?? 0}
							max={fInfo?.max ?? 12}
							step={fInfo && fInfo.max - fInfo.min > 20 ? (fInfo.max - fInfo.min) / 100 : 1}
							class="range range-xs flex-1"
							bind:value={v.filterMin} />
						<span class="w-10 text-right font-mono text-xs">{v.filterMin}</span>
					</div>
				{/if}

				<div class="font-mono text-xs font-bold text-gray-800">
					Hovered {v.property}: {v.hoverValue}
				</div>
			{/if}
		</div>
	</details>

	<!-- Raster -->
	<details open class="collapse collapse-arrow border border-base-300 bg-white/60">
		<summary class="collapse-title min-h-0 py-2 font-bold">Raster data</summary>
		<div class="collapse-content flex flex-col gap-2">
			<label class="label cursor-pointer py-0">
				<span>Visible</span>
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm [--tglbg:#e8e8e8]"
					bind:checked={r.visible} />
			</label>

			<label class="text-xs" for="ras-url">Raster tile URL ({'{z}/{x}/{y}'})</label>
			<div class="flex gap-1">
				<input
					id="ras-url"
					type="text"
					class="input input-sm input-bordered min-w-0 flex-1 bg-transparent font-mono text-xs"
					bind:value={r.url} />
				<button class="btn btn-primary btn-sm" onclick={loadRaster}>Load</button>
			</div>
			<p class="text-[10px] leading-tight text-gray-600">
				Color mapping reads the red channel (0–255) of each tile, so tiles should be single-band
				encoded.
			</p>

			{#if r.visible}
				<div class="flex items-center gap-2 text-xs">
					<span>range</span>
					<input
						type="number"
						class="input input-xs input-bordered w-16 bg-transparent"
						bind:value={r.minValue} />
					<span>to</span>
					<input
						type="number"
						class="input input-xs input-bordered w-16 bg-transparent"
						bind:value={r.maxValue} />
					<button class="btn btn-outline btn-xs" onclick={resetRasterRange} title="Re-space stops">
						Spread
					</button>
				</div>

				<ColorStopEditor
					bind:stops={r.stops}
					bind:paletteName={r.paletteName}
					rangeMin={Number(r.minValue)}
					rangeMax={Number(r.maxValue)} />

				<span class="text-xs">Layer opacity</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					class="range range-xs"
					bind:value={r.opacity} />
			{/if}
		</div>
	</details>
</div>
