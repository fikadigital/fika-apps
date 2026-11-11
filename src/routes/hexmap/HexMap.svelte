<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { authFetch } from '$lib/auth/clerk.svelte.js';
	import { hexMapState } from '$lib/utils/state.svelte';
	import { vizOptions } from '$lib/utils/hexMapProperties';
	import { palettes } from '$lib/utils/colorPalettes';

	// The hexes are small, so they are loaded for the part of the map in view, and only once
	// the view is small enough for the API's 20,000-hex limit to cover most of it.
	const MIN_ZOOM = 11;
	const HEX_LIMIT = 20000;

	let map;
	let mapContainer;
	let loadTimer;
	let loadId = 0; // a newer request makes an older answer irrelevant
	const defaultPalette = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#f03b20', '#bd0026'];

	// Create derived values for the visualization
	let currentVizProps = $derived(vizOptions[hexMapState.selectedViz]);
	let currentPalette = $derived.by(() => {
		const palette = palettes[hexMapState.selectedPalette] || defaultPalette;
		return hexMapState.reversePalette ? palette.slice().reverse() : palette;
	});

	// The database column behind the chosen view: population, or one travel-time column per
	// kind of destination (e.g. travel_time_all_health).
	function columnFor(viz, destination) {
		return viz === 'population' ? 'population' : `${viz}_${destination}`;
	}

	function currentBbox() {
		const b = map.getBounds();
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
		return [
			clamp(b.getWest(), -180, 179.999),
			clamp(b.getSouth(), -90, 89.999),
			clamp(b.getEast(), -179.999, 180),
			clamp(b.getNorth(), -89.999, 90)
		].map((v) => v.toFixed(5));
	}

	async function fetchHexData() {
		const query = new URLSearchParams({
			column: columnFor(hexMapState.selectedViz, hexMapState.destination),
			bbox: currentBbox().join(','),
			limit: String(HEX_LIMIT)
		});
		const response = await authFetch(`/api/hexdata?${query}`);
		if (!response.ok) {
			const detail = await response.json().catch(() => ({}));
			throw new Error(detail.error || `HTTP error! Status: ${response.status}`);
		}
		return response.json();
	}

	function toFeatures(hexes, viz) {
		return {
			type: 'FeatureCollection',
			features: hexes.map((hex) => ({
				type: 'Feature',
				// The value sits under the name of the chosen view, which the colours read.
				properties: { id: hex.id, [viz]: hex.value },
				geometry: hex.geometry
			}))
		};
	}

	function fillColor() {
		return [
			'interpolate',
			['linear'],
			['get', hexMapState.selectedViz],
			currentVizProps.stop0,
			currentPalette[0],
			currentVizProps.stop1,
			currentPalette[1],
			currentVizProps.stop2,
			currentPalette[2],
			currentVizProps.stop3,
			currentPalette[3],
			currentVizProps.stop4,
			currentPalette[4]
		];
	}

	function setHexes(featureCollection) {
		const source = map.getSource('hex-data');
		if (source) {
			source.setData(featureCollection);
			return;
		}
		map.addSource('hex-data', { type: 'geojson', data: featureCollection });
		map.addLayer({
			id: 'hex-fill',
			type: 'fill',
			source: 'hex-data',
			paint: { 'fill-color': fillColor(), 'fill-opacity': 0.7, 'fill-outline-color': '#000' }
		});
		// Registered once, here, so reloading the data does not add them again.
		map.on('click', 'hex-fill', (e) => {
			if (e.features.length > 0) hexMapState.clickedData = e.features[0].properties;
		});
		map.on('mouseenter', 'hex-fill', () => (map.getCanvas().style.cursor = 'pointer'));
		map.on('mouseleave', 'hex-fill', () => (map.getCanvas().style.cursor = ''));
	}

	async function loadHexData() {
		if (!map) return;
		if (map.getZoom() < MIN_ZOOM) {
			if (map.getSource('hex-data')) setHexes(toFeatures([], hexMapState.selectedViz));
			hexMapState.hexCount = 0;
			hexMapState.truncated = false;
			hexMapState.notice = 'Zoom in to load hexagons (zoom level 11 or closer).';
			return;
		}
		const mine = ++loadId;
		const viz = hexMapState.selectedViz;
		try {
			const result = await fetchHexData();
			if (mine !== loadId) return; // the view or the choice changed meanwhile
			setHexes(toFeatures(result.hexes, viz));
			hexMapState.hexCount = result.count;
			hexMapState.truncated = result.truncated;
			hexMapState.notice = result.truncated
				? `Showing ${result.count.toLocaleString()} hexagons; zoom in to see all of them.`
				: '';
		} catch (error) {
			if (mine !== loadId) return;
			console.error('Error loading hex data:', error);
			hexMapState.notice = `Could not load hexagons: ${error.message}`;
		}
	}

	function loadSoon() {
		clearTimeout(loadTimer);
		loadTimer = setTimeout(loadHexData, 400); // wait for the map to stop moving
	}

	// Update the fill style when visualization or palette changes
	function updateFillStyle() {
		if (map && map.getLayer('hex-fill')) {
			map.setPaintProperty('hex-fill', 'fill-color', fillColor());
		}
	}

	// Effect to reload when the visualization or destination changes
	$effect(() => {
		const selectedViz = hexMapState.selectedViz;
		hexMapState.destination; // read, so a new destination reloads too

		// Set default palette based on the selected visualization
		hexMapState.selectedPalette = vizOptions[selectedViz].defaultPalette;
		hexMapState.reversePalette = vizOptions[selectedViz].reversePalette;

		if (map && map.loaded()) {
			loadHexData();
		}
	});

	// Effect to update the palette when it changes
	$effect(() => {
		if (map && map.getLayer('hex-fill')) {
			updateFillStyle();
		}
	});

	onMount(() => {
		mapboxgl.accessToken =
			'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbTVyaGcweGswYWpzMnhxMjRyZHhtMGh0In0.4YOL9xCKxxQ0u2wZ7AlNMg';

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/bridgestoprosperity/cm5rdpyp800it01rd4zgy7l5t',
			center: [30.06, -1.95], // Kigali: close enough that hexagons load at once
			zoom: MIN_ZOOM,
			hash: true
		});

		map.on('load', loadHexData);
		map.on('moveend', loadSoon);
	});

	onDestroy(() => {
		clearTimeout(loadTimer);
		if (map) {
			map.remove();
		}
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="absolute inset-0 h-full w-full"></div>
</div>
