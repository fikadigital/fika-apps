<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { PmTilesSource } from 'mapbox-pmtiles';
	import { saiMapState } from '$lib/utils/state.svelte';
	import { vizOptions } from '$lib/utils/saiMapProperties';
	import { palettes } from '$lib/utils/colorPalettes';

	let map;
	let mapContainer;
	let popup;

	export function getMap() {
		return map;
	}
	const defaultPalette = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#f03b20', '#bd0026'];

	const destinationLabels = {
		travel_time_no_sites_all_education: 'Education',
		travel_time_no_sites_all_health: 'Healthcare',
		travel_time_no_sites_semi_dense_urban: 'Market',
		travel_time_no_sites_major_roads: 'Nearest Road'
	};

	function formatMinutes(val) {
		if (val == null || val === '' || isNaN(Number(val))) return 'No data';
		const n = Math.round(Number(val));
		if (n === 0) return 'No data';
		if (n >= 60) {
			const h = Math.floor(n / 60);
			const m = n % 60;
			return m > 0 ? `${h}h ${m}min` : `${h}h`;
		}
		return `${n} min`;
	}

	function showPopup(e) {
		const properties = e.features[0].properties;
		const viz = saiMapState.selectedViz;
		const label = destinationLabels[viz] ?? viz;
		const walkingTime = formatMinutes(properties[viz]);

		const pop = properties['population'];
		const popFormatted = (pop != null && !isNaN(Number(pop)))
			? Math.round(Number(pop)).toLocaleString()
			: null;

		popup
			.setLngLat(e.lngLat)
			.setHTML(
				`<div class="sas-popup">
					<p class="sas-popup-label">Walking time to ${label}</p>
					<p class="sas-popup-value">${walkingTime}</p>
					${popFormatted ? `<p class="sas-popup-pop">Population: ${popFormatted}</p>` : ''}
				</div>`
			)
			.addTo(map);

		saiMapState.clickedData = { [viz]: properties[viz], ...properties };
	}

	// Create derived values for the visualization
	let currentVizProps = $derived.by(() => {
		const selectedViz = saiMapState.selectedViz;
		let vizName = selectedViz;

		// Map visualization columns to their base property sets
		if (selectedViz.startsWith('travel_time_no_sites_')) {
			vizName = 'travel_time_no_sites';
		} else if (selectedViz.startsWith('travel_time_') && selectedViz !== 'travel_time') {
			vizName = 'travel_time';
		} else if (selectedViz.startsWith('time_delta_no_sites_')) {
			vizName = 'time_delta_no_sites';
		}

		// Return the visualization properties or default to population if not found
		return vizOptions[vizName] || vizOptions['population'];
	});

	let currentPalette = $derived.by(() => {
		const palette = palettes[saiMapState.selectedPalette] || defaultPalette;
		return saiMapState.reversePalette ? palette.slice().reverse() : palette;
	});

	// 4-color rdylgn step scale: green (fast) → yellow → orange → red (slow)
	// Colors are rdylgn reversed: [dark-red, orange, yellow, green]
	const SAS_COLORS = ['#1a9641', '#a6d96a', '#fdae61', '#d7191c'];

	const SAS_BINS = {
		travel_time_no_sites_all_education:    [30, 45, 60],
		travel_time_no_sites_all_health:       [45, 90, 135],
		travel_time_no_sites_semi_dense_urban: [60, 120, 180],
		travel_time_no_sites_major_roads:      [60, 120, 180]
	};

	function sasColorExpression(viz) {
		const bins = SAS_BINS[viz];
		if (!bins) return null;
		const val = ['coalesce', ['to-number', ['get', viz]], 0];
		return [
			'step', val,
			SAS_COLORS[0],
			bins[0], SAS_COLORS[1],
			bins[1], SAS_COLORS[2],
			bins[2], SAS_COLORS[3]
		];
	}

	// Demographics and time delta categories should exclude 0 values from the layer
	function shouldExcludeZeros(viz) {
		return (
			viz.startsWith('travel_time') ||
			viz.startsWith('time_delta') ||
			['births', 'pregnancies', 'underweight', 'rwi',
			 'female_educational_attainment_mean', 'male_educational_attainment_mean'].includes(viz)
		);
	}

	function fillFilter(viz) {
		if (shouldExcludeZeros(viz)) {
			return ['all', ['has', viz], ['!=', ['coalesce', ['to-number', ['get', viz]], 0], 0]];
		}
		return ['has', viz];
	}

	async function initializeLayers() {
		if (!map) return;

		try {
			// Add hex6 source for zoom levels 0-6
			const hex6Url =
				'https://public-b2p-geodata.s3.us-east-1.amazonaws.com/general-pmtiles/all_countries_merged_hex6.pmtiles';
			const hex6Header = await PmTilesSource.getHeader(hex6Url);
			const hex6Bounds = [
				hex6Header.minLon,
				hex6Header.minLat,
				hex6Header.maxLon,
				hex6Header.maxLat
			];

			map.addSource('sai-hex6', {
				type: PmTilesSource.SOURCE_TYPE,
				url: hex6Url,
				minzoom: hex6Header.minZoom,
				maxzoom: hex6Header.maxZoom,
				bounds: hex6Bounds
			});

			// Add hex8 source for zoom levels 7-22
			const hex8Url =
				'https://public-b2p-geodata.s3.us-east-1.amazonaws.com/general-pmtiles/all_countries_merged_hex8.pmtiles';
			const hex8Header = await PmTilesSource.getHeader(hex8Url);
			const hex8Bounds = [
				hex8Header.minLon,
				hex8Header.minLat,
				hex8Header.maxLon,
				hex8Header.maxLat
			];

			map.addSource('sai-hex8', {
				type: PmTilesSource.SOURCE_TYPE,
				url: hex8Url,
				minzoom: 0,
				maxzoom: hex8Header.maxZoom,
				bounds: hex8Bounds
			});

			const initialColorExpr = sasColorExpression(saiMapState.selectedViz) ?? [
				'interpolate', ['linear'],
				['coalesce', ['to-number', ['get', saiMapState.selectedViz]], 0],
				currentVizProps['stop0'], currentPalette[0],
				currentVizProps['stop1'], currentPalette[1],
				currentVizProps['stop2'], currentPalette[2],
				currentVizProps['stop3'], currentPalette[3],
				currentVizProps['stop4'], currentPalette[4]
			];

			// Add hex6 fill layer with initial styling (for zoom 0-6)
			map.addLayer({
				id: 'sai-fill-hex6',
				type: 'fill',
				source: 'sai-hex6',
				'source-layer': 'hex6-impact-data',
				maxzoom: 7.5,
				filter: fillFilter(saiMapState.selectedViz),
				paint: { 'fill-color': initialColorExpr, 'fill-opacity': 0.7 }
			});

			// Add hex8 fill layer (for zoom 7-22)
			map.addLayer({
				id: 'sai-fill-hex8',
				type: 'fill',
				source: 'sai-hex8',
				'source-layer': 'hex8-impact-data',
				minzoom: 7.5,
				filter: fillFilter(saiMapState.selectedViz),
				paint: { 'fill-color': initialColorExpr, 'fill-opacity': 0.7 }
			});

			// Add line layer for zero values (hex6)
			map.addLayer({
				id: 'sai-line-hex6',
				type: 'line',
				source: 'sai-hex6',
				'source-layer': 'hex6-impact-data',
				maxzoom: 7,
				filter: [
					'all',
					['has', saiMapState.selectedViz],
					['==', ['coalesce', ['to-number', ['get', saiMapState.selectedViz]], 0], 0]
				],
				minzoom: 6,
				paint: {
					'line-color': '#bdb7af',
					'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 0.1, 6, 0.5],
					'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6, 1]
				}
			});

			// Add line layer for zero values (hex8)
			map.addLayer({
				id: 'sai-line-hex8',
				type: 'line',
				source: 'sai-hex8',
				'source-layer': 'hex8-impact-data',
				minzoom: 7,
				filter: [
					'all',
					['has', saiMapState.selectedViz],
					['==', ['coalesce', ['to-number', ['get', saiMapState.selectedViz]], 0], 0]
				],
				paint: {
					'line-color': '#bdb7af',
					'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 12, 1],
					'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1]
				}
			});

			// Add click interaction for hex6
			map.on('click', 'sai-fill-hex6', (e) => {
				if (e.features.length > 0) showPopup(e);
			});

			// Add click interaction for hex8
			map.on('click', 'sai-fill-hex8', (e) => {
				if (e.features.length > 0) showPopup(e);
			});

			// Dismiss popup when clicking empty map area
			map.on('click', (e) => {
				const features = map.queryRenderedFeatures(e.point, {
					layers: ['sai-fill-hex6', 'sai-fill-hex8']
				});
				if (features.length === 0) popup.remove();
			});

			// Add hover effects
			map.on('mouseenter', 'sai-fill-hex6', () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', 'sai-fill-hex6', () => {
				map.getCanvas().style.cursor = '';
			});

			map.on('mouseenter', 'sai-fill-hex8', () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', 'sai-fill-hex8', () => {
				map.getCanvas().style.cursor = '';
			});
		} catch (error) {
			console.error('Error in initializeLayers:', error);
		}
	}

	// Effect to update the map style when visualization or palette changes
	$effect(() => {
		const selectedViz = saiMapState.selectedViz;

		// Handle property names for visualization options
		// For travel_time_* columns, use travel_time properties
		// For travel_time_no_sites_* columns, use travel_time_no_sites properties
		// For time_delta_no_sites_* columns, use time_delta_no_sites properties
		let vizName = selectedViz;
		if (selectedViz.startsWith('travel_time_no_sites_')) {
			vizName = 'travel_time_no_sites';
		} else if (selectedViz.startsWith('travel_time_') && selectedViz !== 'travel_time') {
			vizName = 'travel_time';
		} else if (selectedViz.startsWith('time_delta_no_sites_')) {
			vizName = 'time_delta_no_sites';
		}

		// Fall back to population if the viz isn't defined
		const vizProps = vizOptions[vizName] || vizOptions['population'];
		// SAS travel-time layers use fixed hardcoded colors; only update palette for others
		if (!sasColorExpression(selectedViz)) {
			saiMapState.selectedPalette = vizProps.defaultPalette;
			saiMapState.reversePalette = vizProps.reverse;
		}

		if (map) {
			try {
				// Update filters for both hex6 and hex8 layers
				if (map.getLayer('sai-fill-hex6')) {
					map.setFilter('sai-fill-hex6', fillFilter(selectedViz));
					map.setFilter('sai-line-hex6', [
						'all',
						['has', selectedViz],
						['==', ['coalesce', ['to-number', ['get', selectedViz]], 0], 0]
					]);
				}

				if (map.getLayer('sai-fill-hex8')) {
					map.setFilter('sai-fill-hex8', fillFilter(selectedViz));
					map.setFilter('sai-line-hex8', [
						'all',
						['has', selectedViz],
						['==', ['coalesce', ['to-number', ['get', selectedViz]], 0], 0]
					]);
				}

				// Update styles
				updateFillStyle();
			} catch (error) {
				console.error('Error updating visualization:', error);
			}
		}
	});

	// Effect for handling palette changes
	$effect(() => {
		const selectedPalette = saiMapState.selectedPalette;
		const reversePalette = saiMapState.reversePalette;

		if (map) {
			try {
				if (map.getLayer('sai-fill-hex6') || map.getLayer('sai-fill-hex8')) {
					updateFillStyle();
				}
			} catch (error) {
				console.error('Error updating palette:', error);
			}
		}
	});

	// Helper function to update the fill style
	function updateFillStyle() {
		const viz = saiMapState.selectedViz;
		const sasExpr = sasColorExpression(viz);

		let colorExpr;
		if (sasExpr) {
			colorExpr = sasExpr;
		} else {
			let vizName = viz;
			if (vizName.startsWith('travel_time_no_sites_')) vizName = 'travel_time_no_sites';
			else if (vizName.startsWith('travel_time_') && vizName !== 'travel_time') vizName = 'travel_time';
			else if (vizName.startsWith('time_delta_no_sites_')) vizName = 'time_delta_no_sites';
			const vizProps = vizOptions[vizName] || vizOptions['population'];
			colorExpr = [
				'interpolate', ['linear'],
				['coalesce', ['to-number', ['get', viz]], 0],
				vizProps['stop0'], currentPalette[0],
				vizProps['stop1'], currentPalette[1],
				vizProps['stop2'], currentPalette[2],
				vizProps['stop3'], currentPalette[3],
				vizProps['stop4'], currentPalette[4]
			];
		}

		if (map.getLayer('sai-fill-hex6')) {
			map.setPaintProperty('sai-fill-hex6', 'fill-color', colorExpr);
		}

		if (map.getLayer('sai-fill-hex8')) {
			map.setPaintProperty('sai-fill-hex8', 'fill-color', colorExpr);
		}
	}

	onMount(() => {
		mapboxgl.Style.setSourceType(PmTilesSource.SOURCE_TYPE, PmTilesSource);

		mapboxgl.accessToken =
			'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbTVyaGcweGswYWpzMnhxMjRyZHhtMGh0In0.4YOL9xCKxxQ0u2wZ7AlNMg';

		popup = new mapboxgl.Popup({
			closeButton: false,
			closeOnClick: true,
			className: 'sas-popup-container',
			maxWidth: '220px'
		});

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/bridgestoprosperity/cm5rdpyp800it01rd4zgy7l5t',
			center: [26.19, -0.21],
			zoom: 3,
			hash: true
		});

		map.on('load', async () => {
			const nav = new mapboxgl.NavigationControl({
				visualizePitch: true
			});
			map.addControl(nav, 'bottom-right');
			try {
				await initializeLayers();
			} catch (error) {
				console.error('Error in map load:', error);
			}
		});
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="absolute inset-0 h-full w-full"></div>
</div>

<style>
	:global(.sas-popup-container .mapboxgl-popup-content) {
		background: rgba(22, 19, 69, 0.92);
		backdrop-filter: blur(6px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 10px 14px;
		color: white;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	:global(.sas-popup-container .mapboxgl-popup-tip) {
		border-top-color: rgba(22, 19, 69, 0.92);
	}

	:global(.sas-popup .sas-popup-label) {
		font-size: 11px;
		opacity: 0.75;
		margin-bottom: 2px;
		font-family: 'Kumbh Sans', sans-serif;
	}

	:global(.sas-popup .sas-popup-value) {
		font-size: 18px;
		font-weight: 700;
		font-family: 'Kumbh Sans', sans-serif;
	}

	:global(.sas-popup .sas-popup-pop) {
		font-size: 11px;
		opacity: 0.65;
		margin-top: 6px;
		font-family: 'Kumbh Sans', sans-serif;
	}
</style>
