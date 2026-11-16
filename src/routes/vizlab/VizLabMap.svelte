<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { PmTilesSource } from 'mapbox-pmtiles';
	import { vizLabState } from '$lib/utils/state.svelte';
	import {
		buildRasterPaint,
		buildVectorColor,
		buildVectorWidth,
		buildVectorFilter,
		summarizeProperties
	} from '$lib/utils/vizlab/layers';

	const VECTOR_SOURCE = 'vizlab-vector-src';
	const VECTOR_LAYER = 'vizlab-vector';
	const RASTER_SOURCE = 'vizlab-raster-src';
	const RASTER_LAYER = 'vizlab-raster';
	const SAT_SOURCE = 'vizlab-sat-src';
	const SAT_LAYER = 'vizlab-sat';

	const BLANK_STYLE = {
		version: 8,
		sources: {},
		layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#1b1b1f' } }]
	};

	let map;
	let mapContainer;
	let ready = $state(false);
	let currentStyleUrl = '';
	let lastGoodStyleUrl = '';
	let pendingStyle = false;
	let vectorToken = 0;
	let discoverTimer;

	function resolveStyle(url) {
		return url === 'blank' ? BLANK_STYLE : url;
	}

	function firstExisting(...ids) {
		return ids.find((id) => map.getLayer(id));
	}

	function addSatellite() {
		if (map.getLayer(SAT_LAYER)) return;
		if (!map.getSource(SAT_SOURCE)) {
			map.addSource(SAT_SOURCE, {
				type: 'raster',
				url: 'mapbox://mapbox.satellite',
				tileSize: 256
			});
		}
		map.addLayer(
			{ id: SAT_LAYER, type: 'raster', source: SAT_SOURCE },
			firstExisting(RASTER_LAYER, VECTOR_LAYER)
		);
	}

	function addRaster() {
		const r = vizLabState.raster;
		if (map.getLayer(RASTER_LAYER)) map.removeLayer(RASTER_LAYER);
		if (map.getSource(RASTER_SOURCE)) map.removeSource(RASTER_SOURCE);
		if (!r.appliedUrl) return;
		map.addSource(RASTER_SOURCE, {
			type: 'raster',
			tiles: [r.appliedUrl],
			tileSize: Number(r.tileSize),
			maxzoom: Number(r.maxZoom)
		});
		map.addLayer(
			{ id: RASTER_LAYER, type: 'raster', source: RASTER_SOURCE },
			firstExisting(VECTOR_LAYER)
		);
	}

	async function addVector() {
		const v = vizLabState.vector;
		const token = ++vectorToken;
		if (map.getLayer(VECTOR_LAYER)) map.removeLayer(VECTOR_LAYER);
		if (map.getSource(VECTOR_SOURCE)) map.removeSource(VECTOR_SOURCE);
		if (!v.appliedUrl) return;
		v.error = '';

		try {
			const url = v.appliedUrl;
			let sourceSpec;
			if (url.split('?')[0].endsWith('.pmtiles')) {
				const header = await PmTilesSource.getHeader(url);
				sourceSpec = {
					type: PmTilesSource.SOURCE_TYPE,
					url,
					minzoom: header.minZoom,
					maxzoom: header.maxZoom,
					bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat]
				};
			} else if (url.includes('{z}')) {
				sourceSpec = { type: 'vector', tiles: [url] };
			} else {
				sourceSpec = { type: 'vector', url };
			}
			if (token !== vectorToken) return; // superseded by a newer load or style swap

			map.addSource(VECTOR_SOURCE, sourceSpec);
			map.addLayer({
				id: VECTOR_LAYER,
				type: 'line',
				source: VECTOR_SOURCE,
				'source-layer': v.appliedSourceLayer,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {}
			});
			updateLayers();
		} catch (error) {
			console.error('Error loading vector source:', error);
			v.error = error?.message ?? 'Could not load vector source';
		}
	}

	function updateLayers() {
		if (!map || !ready) return;
		const { satellite, vector, raster } = vizLabState;

		if (map.getLayer(SAT_LAYER)) {
			map.setLayoutProperty(SAT_LAYER, 'visibility', satellite.visible ? 'visible' : 'none');
			map.setPaintProperty(SAT_LAYER, 'raster-saturation', satellite.blackAndWhite ? -1 : 0);
		} else if (satellite.visible) {
			addSatellite();
		}

		if (map.getLayer(RASTER_LAYER)) {
			map.setLayoutProperty(RASTER_LAYER, 'visibility', raster.visible ? 'visible' : 'none');
			for (const [key, value] of Object.entries(buildRasterPaint(raster))) {
				map.setPaintProperty(RASTER_LAYER, key, value);
			}
		}

		if (map.getLayer(VECTOR_LAYER)) {
			map.setLayoutProperty(VECTOR_LAYER, 'visibility', vector.visible ? 'visible' : 'none');
			map.setPaintProperty(VECTOR_LAYER, 'line-color', buildVectorColor(vector));
			map.setPaintProperty(VECTOR_LAYER, 'line-width', buildVectorWidth(vector));
			map.setPaintProperty(VECTOR_LAYER, 'line-opacity', vector.opacity);
			map.setFilter(VECTOR_LAYER, buildVectorFilter(vector));
		}
	}

	// Read the attribute names/types/ranges from whatever is currently rendered.
	function discoverProperties() {
		if (!map || !map.getLayer(VECTOR_LAYER) || !vizLabState.vector.visible) return;
		const features = map.queryRenderedFeatures({ layers: [VECTOR_LAYER] });
		if (!features.length) return;
		const next = summarizeProperties(features, vizLabState.vector.properties);
		if (JSON.stringify(next) !== JSON.stringify(vizLabState.vector.properties)) {
			vizLabState.vector.properties = next;
		}
	}

	async function addDataLayers() {
		addRaster();
		await addVector();
		if (vizLabState.satellite.visible) addSatellite();
		ready = true;
		updateLayers();
	}

	function startStyleLoad(url) {
		pendingStyle = true;
		ready = false;
		vectorToken++; // cancel in-flight vector loads against the old style
		vizLabState.styleError = '';
		map.setStyle(resolveStyle(url));
	}

	// Style URL changes
	$effect(() => {
		const url = vizLabState.appliedStyleUrl;
		if (!map || url === currentStyleUrl) return;
		currentStyleUrl = url;
		startStyleLoad(url);
	});

	// Data source reloads
	$effect(() => {
		vizLabState.vector.loadNonce;
		if (map && map.isStyleLoaded()) addVector().then(updateLayers);
	});
	$effect(() => {
		vizLabState.raster.loadNonce;
		if (map && map.isStyleLoaded()) {
			addRaster();
			updateLayers();
		}
	});

	// Paint/layout updates: reading `ready` first so the effect re-runs once the map is up.
	$effect(() => {
		ready;
		updateLayers();
	});

	onMount(() => {
		mapboxgl.Style.setSourceType(PmTilesSource.SOURCE_TYPE, PmTilesSource);
		mapboxgl.accessToken =
			'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbTJ1d2Rka3cwNTM5MmxxMWExZmo2OG1tIn0.B6fDwi43tGjtDzyFSrncxQ';

		const { vector, raster } = vizLabState;
		vector.appliedUrl = vector.url;
		vector.appliedSourceLayer = vector.sourceLayer;
		raster.appliedUrl = raster.url;
		currentStyleUrl = vizLabState.appliedStyleUrl;
		lastGoodStyleUrl = currentStyleUrl;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: resolveStyle(currentStyleUrl),
			center: [26.19, -0.21],
			zoom: 4,
			hash: true
		});

		map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

		map.on('style.load', () => {
			pendingStyle = false;
			lastGoodStyleUrl = currentStyleUrl;
			vizLabState.mapStyleUrl = currentStyleUrl;
			addDataLayers();
		});

		map.on('error', (e) => {
			if (!pendingStyle) return;
			pendingStyle = false;
			vizLabState.styleError = e.error?.message ?? 'Could not load map style';
			currentStyleUrl = lastGoodStyleUrl;
			vizLabState.appliedStyleUrl = lastGoodStyleUrl;
			vizLabState.mapStyleUrl = lastGoodStyleUrl;
			map.setStyle(resolveStyle(lastGoodStyleUrl));
		});

		map.on('idle', () => {
			clearTimeout(discoverTimer);
			discoverTimer = setTimeout(discoverProperties, 150);
		});

		map.on('mousemove', VECTOR_LAYER, (e) => {
			map.getCanvas().style.cursor = 'crosshair';
			const prop = vizLabState.vector.property;
			const value = e.features?.[0]?.properties?.[prop];
			vizLabState.vector.hoverValue = value === undefined ? '' : String(value);
		});
		map.on('mouseleave', VECTOR_LAYER, () => {
			vizLabState.vector.hoverValue = '';
			map.getCanvas().style.cursor = '';
		});
	});

	onDestroy(() => {
		clearTimeout(discoverTimer);
		if (map) map.remove();
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="absolute inset-0 h-full w-full"></div>
</div>
