<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { PmTilesSource } from 'mapbox-pmtiles';

	let { data } = $props();

	const STYLE_URL = 'mapbox://styles/bridgestoprosperity/cms9v97vc004w01sx1zbp7420';
	const PMTILES_URL = 'https://public-b2p-geodata.s3.amazonaws.com/general-pmtiles/h3_only.pmtiles';
	const SOURCE_ID = 'h3-only';
	const SOURCE_LAYER = 'h3_only';
	const LAYER_ID = 'h3-only-fill';

	// Values are fetched from the DB in z8 web mercator tiles (~16k hexes each near the equator)
	const DATA_ZOOM = 8;
	const MAX_CONCURRENT_REQUESTS = 4;

	const NO_DATA_COLOR = '#bdbdbd';
	// YlGnBu
	const RAMP = ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'];

	const GROUPS = [
		{
			label: 'Population & demographics',
			test: (c) =>
				c === 'population' ||
				c === 'births' ||
				c === 'pregnancies' ||
				/^(pop|females|males)_/.test(c)
		},
		{
			label: 'Wealth, health & education',
			test: (c) => c === 'rwi' || c === 'underweight' || c.includes('educational_attainment')
		},
		{ label: 'Travel time (no sites)', test: (c) => c.startsWith('travel_time_no_sites_') },
		{ label: 'Travel time', test: (c) => c.startsWith('travel_time_') },
		{ label: 'Time delta (no sites)', test: (c) => c.startsWith('time_delta_') },
		{ label: 'Other', test: () => true }
	];

	const columnGroups = (() => {
		const remaining = [...data.columns];
		return GROUPS.map(({ label, test }) => {
			const cols = remaining.filter(test);
			cols.forEach((c) => remaining.splice(remaining.indexOf(c), 1));
			return { label, cols };
		}).filter((g) => g.cols.length);
	})();

	const formatLabel = (c) => c.replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase());
	const formatValue = (v) =>
		v == null
			? 'no data'
			: Math.abs(v) >= 1000
				? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
				: new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(v);

	let column = $state(data.columns.includes('population') ? 'population' : data.columns[0]);
	let stops = $state(null); // [{ value, color }] or null while no scale computed
	let pending = $state(0);
	let loadError = $state(data.columnsError);
	let hover = $state(null);
	let zoomTooLow = $state(false);

	let map;
	let mapContainer;
	let dataBounds;
	let generation = 0; // bumped on column change so stale responses are ignored
	let appliedTiles = new Set(); // tile keys whose values are in feature-state for current column
	const tileCache = new Map(); // `${column}/${x}/${y}` -> Promise<{ ids, values }>
	const tileIds = new Map(); // `${x}/${y}` -> string[] of H3 ids, shared by every column

	function tilesInView() {
		const n = 2 ** DATA_ZOOM;
		const b = map.getBounds();
		const west = Math.max(b.getWest(), dataBounds[0]);
		const south = Math.max(b.getSouth(), dataBounds[1]);
		const east = Math.min(b.getEast(), dataBounds[2]);
		const north = Math.min(b.getNorth(), dataBounds[3]);
		if (west > east || south > north) return [];

		const lonToX = (lon) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
		const latToY = (lat) => {
			const r = (lat * Math.PI) / 180;
			const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
			return Math.min(n - 1, Math.max(0, Math.floor(y)));
		};

		const tiles = [];
		for (let x = lonToX(west); x <= lonToX(east); x++) {
			for (let y = latToY(north); y <= latToY(south); y++) tiles.push(`${x}/${y}`);
		}
		return tiles;
	}

	// Decodes the binary format documented in src/routes/api/hex-tile-values/+server.js
	async function requestTile(col, tile, withIds) {
		const [x, y] = tile.split('/');
		const params = new URLSearchParams({ z: DATA_ZOOM, x, y, column: col, ids: withIds ? 1 : 0 });
		const res = await fetch(`/api/hex-tile-values?${params}`);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.details || body.error || res.statusText);
		}

		const buffer = await res.arrayBuffer();
		const header = new DataView(buffer, 0, 8);
		const count = header.getUint32(0, true);
		const hasIds = (header.getUint32(4, true) & 1) === 1;

		let offset = 8;
		let ids = null;
		if (hasIds) {
			const raw = new BigUint64Array(buffer, offset, count);
			ids = new Array(count);
			for (let i = 0; i < count; i++) ids[i] = raw[i].toString(16);
			offset += count * 8;
		}
		const values = new Float32Array(buffer, offset, count);
		return { ids, values };
	}

	function fetchTile(col, tile) {
		const key = `${col}/${tile}`;
		if (!tileCache.has(key)) {
			const request = (async () => {
				const cachedIds = tileIds.get(tile);
				let result = await requestTile(col, tile, !cachedIds);
				// A count mismatch means hex_values was refreshed since the ids were cached
				if (!result.ids && result.values.length !== cachedIds.length) {
					result = await requestTile(col, tile, true);
				}
				if (result.ids) tileIds.set(tile, result.ids);
				return { ids: result.ids ?? cachedIds, values: result.values };
			})();
			request.catch(() => tileCache.delete(key));
			tileCache.set(key, request);
		}
		return tileCache.get(key);
	}

	function applyTile({ ids, values }) {
		for (let i = 0; i < ids.length; i++) {
			if (Number.isNaN(values[i])) continue;
			map.setFeatureState(
				{ source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: ids[i] },
				{ v: values[i] }
			);
		}
	}

	async function loadView() {
		if (!map?.getSource(SOURCE_ID)) return;
		// Source has minzoom 8; with roundZoom tiles appear from ~7.5
		zoomTooLow = map.getZoom() < DATA_ZOOM - 0.5;
		if (zoomTooLow) return;

		const gen = generation;
		const col = column;
		const queue = tilesInView().filter((t) => !appliedTiles.has(t));
		appliedTiles = new Set([...appliedTiles, ...queue]);
		pending += queue.length;

		const worker = async () => {
			while (queue.length) {
				const tile = queue.shift();
				try {
					const result = await fetchTile(col, tile);
					if (gen === generation) applyTile(result);
				} catch (error) {
					console.error(`Failed to load ${col} for tile ${tile}:`, error);
					if (gen === generation) {
						appliedTiles.delete(tile);
						loadError = error.message;
					}
				} finally {
					if (gen === generation) pending--;
				}
			}
		};
		await Promise.all(Array.from({ length: MAX_CONCURRENT_REQUESTS }, worker));

		if (gen === generation && !stops) rescaleToView();
	}

	// Quantile breaks over the values for the tiles currently in view
	async function rescaleToView() {
		const col = column;
		const results = await Promise.allSettled(tilesInView().map((t) => fetchTile(col, t)));
		if (col !== column) return;

		const all = [];
		for (const r of results) {
			if (r.status !== 'fulfilled') continue;
			for (const v of r.value.values) if (!Number.isNaN(v)) all.push(v);
		}
		if (!all.length) return;
		const sorted = Float32Array.from(all).sort();

		const next = [];
		RAMP.forEach((color, i) => {
			const q = sorted[Math.round((i / (RAMP.length - 1)) * (sorted.length - 1))];
			// interpolate needs strictly ascending stops; skewed columns repeat values (e.g. many 0s)
			if (!next.length || q > next[next.length - 1].value) next.push({ value: q, color });
		});
		stops = next;
		updatePaint();
	}

	function updatePaint() {
		if (!map?.getLayer(LAYER_ID)) return;
		const hasValue = ['==', ['typeof', ['feature-state', 'v']], 'number'];
		let color = NO_DATA_COLOR;
		if (stops?.length === 1) {
			color = ['case', hasValue, stops[0].color, NO_DATA_COLOR];
		} else if (stops) {
			color = [
				'case',
				hasValue,
				[
					'interpolate',
					['linear'],
					['feature-state', 'v'],
					...stops.flatMap((s) => [s.value, s.color])
				],
				NO_DATA_COLOR
			];
		}
		map.setPaintProperty(LAYER_ID, 'fill-color', color);
		map.setPaintProperty(LAYER_ID, 'fill-opacity', ['case', hasValue, 0.85, 0.2]);
	}

	function onColumnChange() {
		generation++;
		appliedTiles = new Set();
		pending = 0;
		stops = null;
		loadError = null;
		hover = null;
		map.removeFeatureState({ source: SOURCE_ID, sourceLayer: SOURCE_LAYER });
		updatePaint();
		loadView();
	}

	onMount(() => {
		mapboxgl.Style.setSourceType(PmTilesSource.SOURCE_TYPE, PmTilesSource);
		mapboxgl.accessToken = data.mapboxToken;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: STYLE_URL,
			center: [26.19, -0.21],
			zoom: 8,
			hash: true
		});

		map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

		map.on('load', async () => {
			try {
				const header = await PmTilesSource.getHeader(PMTILES_URL);
				dataBounds = [header.minLon, header.minLat, header.maxLon, header.maxLat];
				map.addSource(SOURCE_ID, {
					type: PmTilesSource.SOURCE_TYPE,
					url: PMTILES_URL,
					minzoom: header.minZoom,
					maxzoom: header.maxZoom,
					bounds: dataBounds,
					promoteId: 'h3_index'
				});

				map.addLayer({
					id: LAYER_ID,
					type: 'fill',
					source: SOURCE_ID,
					'source-layer': SOURCE_LAYER,
					paint: { 'fill-color': NO_DATA_COLOR, 'fill-opacity': 0.2 }
				});
				updatePaint();

				if (column) loadView();
				map.on('moveend', loadView);
			} catch (error) {
				console.error('Error loading h3_only PMTiles layer:', error);
				loadError = error.message;
			}
		});

		map.on('mousemove', LAYER_ID, (e) => {
			const feature = e.features?.[0];
			if (!feature) return;
			map.getCanvas().style.cursor = 'crosshair';
			const state = map.getFeatureState({
				source: SOURCE_ID,
				sourceLayer: SOURCE_LAYER,
				id: feature.id
			});
			hover = { id: feature.id, value: state.v };
		});
		map.on('mouseleave', LAYER_ID, () => {
			map.getCanvas().style.cursor = '';
			hover = null;
		});
	});

	onDestroy(() => {
		map?.remove();
	});
</script>

<div class="relative h-screen w-full overflow-hidden">
	<div bind:this={mapContainer} class="absolute inset-0 h-full w-full"></div>

	<!-- Same placement as the other map pages: clears the header/side nav and sits above the map -->
	<div
		class="card absolute left-4 top-[150px] z-40 w-72 max-w-[calc(100%-2rem)] bg-base-100 shadow-lg sm:left-16 sm:w-80">
		<div class="card-body gap-3 p-4">
			<label class="form-control w-full">
				<span class="label-text mb-1 font-semibold">Style hexes by</span>
				<select
					class="select select-bordered select-sm w-full"
					value={column}
					onchange={(e) => {
						column = e.currentTarget.value;
						onColumnChange();
					}}
					disabled={!data.columns.length}>
					{#each columnGroups as group}
						<optgroup label={group.label}>
							{#each group.cols as col}
								<option value={col}>{formatLabel(col)}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>

			{#if stops}
				<div>
					<div
						class="h-3 w-full rounded"
						style="background: linear-gradient(to right, {stops.map((s) => s.color).join(', ')})">
					</div>
					<div class="mt-1 flex justify-between text-xs">
						{#each stops as stop}
							<span>{formatValue(stop.value)}</span>
						{/each}
					</div>
					<div class="mt-1 flex items-center gap-2 text-xs opacity-70">
						<span class="inline-block h-3 w-3 rounded-sm" style="background: {NO_DATA_COLOR}"
						></span>
						No data / not loaded
					</div>
				</div>
				<button class="btn btn-outline btn-xs" onclick={rescaleToView}
					>Rescale to current view</button>
			{/if}

			{#if zoomTooLow}
				<p class="text-sm">Zoom in to level 8 or closer to see hexes.</p>
			{/if}

			{#if pending > 0}
				<p class="flex items-center gap-2 text-sm">
					<span class="loading loading-spinner loading-xs"></span>
					Loading {pending} tile{pending === 1 ? '' : 's'}…
				</p>
			{/if}

			{#if loadError}
				<p class="text-sm text-error">{loadError}</p>
			{/if}

			{#if hover}
				<div class="rounded bg-base-200 p-2 font-mono text-xs">
					<div>{hover.id}</div>
					<div>{formatLabel(column)}: {formatValue(hover.value)}</div>
				</div>
			{/if}
		</div>
	</div>
</div>
