<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { authFetch } from '$lib/auth/clerk.svelte.js';
	import { impactMapDatabaseState } from '$lib/utils/state.svelte';
	import { palettes } from '$lib/utils/colorPalettes';
	import { vizOptions } from '$lib/utils/hexMapProperties';

	let map;
	let mapContainer;
	let postgresData = [];
	let hexData = [];
	let mapLoaded = false;

	// What is loaded is what is in view: the API serves at most 20,000 of either, and the
	// hexagons are small, so they only load once the view is close enough.
	const BRIDGE_LIMIT = 20000;
	const HEX_LIMIT = 20000;
	const MIN_HEX_ZOOM = 11;
	let loadTimer;
	let firstLoad = true;
	let bridgeRequest = 0;
	let hexRequest = 0;

	function currentBbox() {
		const b = map.getBounds();
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
		return [
			clamp(b.getWest(), -180, 179.999),
			clamp(b.getSouth(), -90, 89.999),
			clamp(b.getEast(), -179.999, 180),
			clamp(b.getNorth(), -89.999, 90)
		]
			.map((v) => v.toFixed(5))
			.join(',');
	}

	// Load the bridges in view from the impact API
	async function loadPostgresData() {
		const mine = ++bridgeRequest;
		try {
			// Only the first load covers the map with the spinner; later ones are quiet
			if (firstLoad) impactMapDatabaseState.loadingData = true;
			impactMapDatabaseState.error = null;

			const response = await authFetch(`/api/bridges?bbox=${currentBbox()}&limit=${BRIDGE_LIMIT}`);
			if (!response.ok) {
				const detail = await response.json().catch(() => ({}));
				throw new Error(detail.error || `HTTP ${response.status}`);
			}
			const collection = await response.json();
			if (mine !== bridgeRequest) return; // the view moved on

			// Shape each bridge the way the rest of this page expects
			postgresData = collection.features.map((f) => ({
				id: f.id,
				bridge_index: f.properties.bridge_index,
				bridge_type: f.properties.type,
				name: `Bridge ${f.properties.bridge_index}`,
				geometry: f.geometry,
				longitude: f.geometry.coordinates[0],
				latitude: f.geometry.coordinates[1]
			}));
			impactMapDatabaseState.dataCount = postgresData.length;
			impactMapDatabaseState.enableClustering = true;

			if (map && mapLoaded) {
				updateMapData();
			}
		} catch (error) {
			if (mine === bridgeRequest) {
				impactMapDatabaseState.error = `Error loading bridges: ${error.message}`;
			}
		} finally {
			if (mine === bridgeRequest) impactMapDatabaseState.loadingData = false;
		}
	}

	// Load the hexagons in view from the impact API (close-up views only)
	async function loadHexData() {
		if (!map || !mapLoaded) return;
		const mine = ++hexRequest;
		if (!impactMapDatabaseState.showHexLayer) return;
		if (map.getZoom() < MIN_HEX_ZOOM) {
			hexData = [];
			if (map.getSource('hex-data')) {
				map.getSource('hex-data').setData({ type: 'FeatureCollection', features: [] });
			}
			return;
		}
		try {
			const column = impactMapDatabaseState.hexDataViz || 'population';
			const response = await authFetch(
				`/api/hexdata?column=${encodeURIComponent(column)}&bbox=${currentBbox()}&limit=${HEX_LIMIT}`
			);
			if (!response.ok) {
				const detail = await response.json().catch(() => ({}));
				throw new Error(detail.error || `HTTP ${response.status}`);
			}
			const result = await response.json();
			if (mine !== hexRequest) return;
			hexData = result.hexes.map((hex) => ({ ...hex, column }));
			updateHexLayer();
		} catch (error) {
			if (mine !== hexRequest) return;
			console.error(`Error loading hex data: ${error.message}`);
			impactMapDatabaseState.error = `Error loading hex data: ${error.message}`;
		}
	}

	// Reload both once the map has stopped moving
	function loadSoon() {
		clearTimeout(loadTimer);
		loadTimer = setTimeout(() => {
			firstLoad = false;
			loadPostgresData();
			loadHexData();
		}, 400);
	}

	// Helper function to parse PostGIS binary format
	function parsePostGISBinary(hexString, item) {
		// Check if it's a hex string (like from PostGIS)
		if (typeof hexString === 'string' && hexString.startsWith('0101')) {
			// Use the extracted latitude/longitude fields
			if (item.latitude !== undefined && item.longitude !== undefined) {
				const lon = parseFloat(item.longitude);
				const lat = parseFloat(item.latitude);
				return [lon, lat];
			}

			// Fallback to Rwanda default if needed
			return [30.0, -2.0]; // Center of Rwanda approximate
		}
		return null;
	}

	// Function to convert PostgreSQL data to GeoJSON
	function dataToGeoJSON(data) {
		return {
			type: 'FeatureCollection',
			features: data.map((item) => {
				// Check if we have direct geometry data from PostGIS or need to extract coordinates
				let coordinates = [];

				if (item.geometry) {
					// Check if geometry is already in GeoJSON format
					if (typeof item.geometry === 'object' && item.geometry.type === 'Point') {
						coordinates = item.geometry.coordinates;
					}
					// Check if it's a PostGIS binary format
					else if (typeof item.geometry === 'string' && item.geometry.startsWith('0101')) {
						const parsed = parsePostGISBinary(item.geometry, item);
						if (parsed) {
							coordinates = parsed;
						} else if (item.longitude && item.latitude) {
							coordinates = [parseFloat(item.longitude), parseFloat(item.latitude)];
						}
					}
					// Other formats
					else {
						// Try to extract coordinates from various formats
						if (item.longitude && item.latitude) {
							coordinates = [parseFloat(item.longitude), parseFloat(item.latitude)];
						} else {
							// If we can't extract coordinates, use a default
							coordinates = [0, 0];
						}
					}
				} else if (item.longitude && item.latitude) {
					coordinates = [parseFloat(item.longitude), parseFloat(item.latitude)];
				} else {
					// No coordinates found
					coordinates = [0, 0];
				}

				return {
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates
					},
					properties: {
						// Core properties we know will exist
						id: item.id || item.ogc_fid,
						name: item.name || `Bridge ${item.bridge_index || item.ogc_fid || item.id}`,
						// Any other properties that might exist
						...item
					}
				};
			})
		};
	}

	// The hexagons from the API are already real outlines with one value each
	function hexDataToGeoJSON(data) {
		return {
			type: 'FeatureCollection',
			features: data.map((hex) => ({
				type: 'Feature',
				properties: { id: hex.id, [hex.column]: hex.value },
				geometry: hex.geometry
			}))
		};
	}

	// Function to update the hex layer - simplified to focus on just showing outlines
	function updateHexLayer() {
		if (!map || !mapLoaded || hexData.length === 0) return;

		// Create GeoJSON from hex data
		const geojsonData = hexDataToGeoJSON(hexData);

		console.log('Hex features count:', geojsonData.features.length);

		// Add or update the hex data source
		if (map.getSource('hex-data')) {
			console.log('Updating existing hex layer source');
			map.getSource('hex-data').setData(geojsonData);

			// Set visibility based on showHexLayer
			map.setLayoutProperty(
				'hex-fill',
				'visibility',
				impactMapDatabaseState.showHexLayer ? 'visible' : 'none'
			);

			map.setLayoutProperty(
				'hex-outline',
				'visibility',
				impactMapDatabaseState.showHexLayer ? 'visible' : 'none'
			);
		} else {
			// Add source
			console.log('Creating new hex layer source and layers');
			map.addSource('hex-data', {
				type: 'geojson',
				data: geojsonData
			});

			// Add a simple fill layer with minimal styling
			map.addLayer({
				id: 'hex-fill',
				type: 'fill',
				source: 'hex-data',
				layout: {
					visibility: impactMapDatabaseState.showHexLayer ? 'visible' : 'none'
				},
				paint: {
					'fill-color': '#ff3388', // Changed to more visible magenta
					'fill-opacity': 0.5 // Increased opacity
				}
			});

			// Add outline layer to highlight hex boundaries
			map.addLayer({
				id: 'hex-outline',
				type: 'line',
				source: 'hex-data',
				layout: {
					visibility: impactMapDatabaseState.showHexLayer ? 'visible' : 'none'
				},
				paint: {
					'line-color': '#ff3388', // Changed to more visible magenta
					'line-width': 2, // Thicker lines
					'line-opacity': 1 // Full opacity
				}
			});

			// Add click interaction for debugging
			map.on('click', 'hex-fill', (e) => {
				if (e.features.length > 0) {
					const properties = e.features[0].properties;
					console.log('Selected hex feature:', properties);
				}
			});

			// Add hover effect
			map.on('mouseenter', 'hex-fill', () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', 'hex-fill', () => {
				map.getCanvas().style.cursor = '';
			});
		}
	}

	// Update map data when data changes or filters are applied
	function updateMapData() {
		if (!map || !mapLoaded || postgresData.length === 0) return;

		// The bridges have no year or subtype to filter on: every one is a predicted bridge
		const filteredData = postgresData;

		// Convert to GeoJSON
		const geojsonData = dataToGeoJSON(filteredData);

		// Update or add the source
		if (map.getSource('bridges')) {
			map.getSource('bridges').setData(geojsonData);
		} else {
			map.addSource('bridges', {
				type: 'geojson',
				data: geojsonData,
				cluster: impactMapDatabaseState.enableClustering,
				clusterMaxZoom: 14, // Increase max zoom level for clustering
				clusterRadius: 60, // Larger radius to group more points
				maxzoom: 16, // Maximum zoom level to cache
				buffer: 128, // Larger tile buffer for smoother clustering
				tolerance: 0.5 // Simplify geometries slightly for performance
			});

			// Add heatmap layer (shows density of bridges)
			map.addLayer({
				id: 'bridges-heat',
				type: 'heatmap',
				source: 'bridges',
				maxzoom: 9,
				paint: {
					// Increase the heatmap weight based on people served
					'heatmap-weight': 0.8, // Fixed weight since we don't have people_served
					// Increase the heatmap color weight by zoom level
					'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 3],
					// Color ramp for heatmap from B2P colors
					'heatmap-color': [
						'interpolate',
						['linear'],
						['heatmap-density'],
						0,
						'rgba(0, 145, 73, 0)',
						0.2,
						'rgba(0, 145, 73, 0.2)',
						0.4,
						'rgba(0, 145, 73, 0.4)',
						0.6,
						'rgba(0, 145, 73, 0.6)',
						0.8,
						'rgba(0, 145, 73, 0.8)',
						1,
						'rgba(0, 145, 73, 1)'
					],
					// Adjust the heatmap radius by zoom level
					'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 20, 9, 30],
					// Decrease opacity as zoom increases
					'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0.5]
				}
			});

			// If clustering is enabled, add cluster layers
			if (impactMapDatabaseState.enableClustering) {
				// Add cluster circles
				map.addLayer({
					id: 'clusters',
					type: 'circle',
					source: 'bridges',
					filter: ['has', 'point_count'],
					paint: {
						'circle-color': [
							'step',
							['get', 'point_count'],
							'#009149', // B2P green for small clusters
							100,
							'#007238', // Darker green for medium clusters
							500,
							'#00572B', // Darker for large clusters
							1000,
							'#004020', // Even darker for very large clusters
							5000,
							'#003018' // Darkest for massive clusters
						],
						'circle-radius': [
							'interpolate',
							['exponential', 0.8],
							['get', 'point_count'],
							20,
							18, // Few points
							100,
							22, // Small cluster
							500,
							28, // Medium cluster
							1000,
							32, // Large cluster
							5000,
							40 // Massive cluster
						],
						'circle-stroke-width': 1,
						'circle-stroke-color': '#fff'
					}
				});

				// Add cluster count labels
				map.addLayer({
					id: 'cluster-count',
					type: 'symbol',
					source: 'bridges',
					filter: ['has', 'point_count'],
					layout: {
						'text-field': '{point_count_abbreviated}',
						'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
						'text-size': [
							'interpolate',
							['linear'],
							['get', 'point_count'],
							20,
							12, // Small clusters: smaller text
							100,
							14, // Medium clusters: medium text
							1000,
							16 // Large clusters: larger text
						],
						'text-allow-overlap': false,
						'text-ignore-placement': false
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.2)',
						'text-halo-width': 1.5
					}
				});
			}

			// Add circle layer (individual bridges)
			map.addLayer({
				id: 'bridges-layer',
				type: 'circle',
				source: 'bridges',
				filter: impactMapDatabaseState.enableClustering ? ['!', ['has', 'point_count']] : ['all'],
				minzoom: 5,
				paint: {
					// Fixed circle radius since we don't have people_served
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 8],
					'circle-color': '#009149', // B2P primary color
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 1,
					'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 0.9]
				}
			});

			// Add click interaction for bridge details
			map.on('click', 'bridges-layer', (e) => {
				if (e.features.length > 0) {
					impactMapDatabaseState.highlightedFeature = e.features[0].properties;
					// console.log map style sheet
					console.log('Map style sheet:', map.getStyle());
				}
			});

			// Add click interaction for clusters
			if (impactMapDatabaseState.enableClustering) {
				map.on('click', 'clusters', (e) => {
					const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
					const clusterId = features[0].properties.cluster_id;

					map.getSource('bridges').getClusterExpansionZoom(clusterId, (err, zoom) => {
						if (err) return;

						map.easeTo({
							center: features[0].geometry.coordinates,
							zoom: zoom
						});
					});
				});
			}

			// Add hover effects
			map.on('mouseenter', 'bridges-layer', () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', 'bridges-layer', () => {
				map.getCanvas().style.cursor = '';
			});

			// Add hover effect for clusters
			if (impactMapDatabaseState.enableClustering) {
				map.on('mouseenter', 'clusters', () => {
					map.getCanvas().style.cursor = 'pointer';
				});

				map.on('mouseleave', 'clusters', () => {
					map.getCanvas().style.cursor = '';
				});
			}
		}
	}

	// Effect to update data when filter changes
	$effect(() => {
		const _ = [
			impactMapDatabaseState.filterByYear,
			impactMapDatabaseState.yearRange,
			impactMapDatabaseState.selectedLayer
		];

		if (map && mapLoaded) {
			updateMapData();
		}
	});

	// Effect to toggle hex layer visibility
	$effect(() => {
		console.log('Hex layer visibility changed:', impactMapDatabaseState.showHexLayer);
		if (map && mapLoaded) {
			try {
				if (map.getLayer('hex-fill')) {
					const hexVisibility = impactMapDatabaseState.showHexLayer ? 'visible' : 'none';
					console.log('Setting hex-fill visibility to:', hexVisibility);
					map.setLayoutProperty('hex-fill', 'visibility', hexVisibility);

					if (map.getLayer('hex-outline')) {
						map.setLayoutProperty('hex-outline', 'visibility', hexVisibility);
					}
				} else {
					console.log("Hex fill layer doesn't exist yet");
					// If hexData is loaded but layer doesn't exist, try to create it
					if (hexData.length > 0) {
						console.log('Have hex data but no layer - creating layer now');
						updateHexLayer();
					} else if (impactMapDatabaseState.showHexLayer) {
						console.log('No hex data yet - trying to load it now');
						loadHexData();
					}
				}
			} catch (e) {
				console.error('Error toggling hex layer visibility:', e);
			}
		}
	});

	// Effect to reload hex data when visualization changes
	$effect(() => {
		if (
			impactMapDatabaseState.showHexLayer &&
			impactMapDatabaseState.hexDataViz &&
			map &&
			mapLoaded
		) {
			loadHexData();
		}
	});

	// Effect to update hex layer style when palette is reversed
	$effect(() => {
		if (map && mapLoaded && map.getLayer('hex-fill') && hexData.length > 0) {
			updateHexLayer();
		}
	});

	// Effect to update satellite layer visibility
	$effect(() => {
		if (map && mapLoaded) {
			const satVisibility = impactMapDatabaseState.satelliteImagery ? 'visible' : 'none';
			try {
				// Only change visibility if the layer exists
				if (map.getLayer('satellite')) {
					map.setLayoutProperty('satellite', 'visibility', satVisibility);
				}
			} catch (error) {
				// Satellite layer not available
			}
		}
	});

	onMount(() => {
		// Initialize Mapbox
		mapboxgl.accessToken =
			'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbTJ1d2Rka3cwNTM5MmxxMWExZmo2OG1tIn0.B6fDwi43tGjtDzyFSrncxQ';

		// Create map without hash to avoid conflict with SvelteKit router
		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/bridgestoprosperity/cm4kippxv01k101slb7hs8mvr',
			center: [26.19, -0.21], // Central Africa as default
			zoom: 4,
			hash: false // Disable hash to avoid conflict with SvelteKit
		});

		map.on('load', () => {
			// Set mapLoaded flag
			mapLoaded = true;
			console.log('Map loaded and ready');

			// Add navigation controls
			map.addControl(new mapboxgl.NavigationControl(), 'top-right');

			// Add fullscreen control
			map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

			// Initialize satellite layer visibility if it exists
			try {
				if (map.getLayer('satellite')) {
					map.setLayoutProperty(
						'satellite',
						'visibility',
						impactMapDatabaseState.satelliteImagery ? 'visible' : 'none'
					);
				}
			} catch (error) {
				// Satellite layer not found or not ready
			}

			// Load bridge data from PostgreSQL
			loadPostgresData();

			// Load hex data after a short delay to ensure map is fully initialized
			setTimeout(() => {
				console.log('Loading hex data after map initialization');
				loadHexData();
			}, 1000);
		});
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

	{#if impactMapDatabaseState.loadingData}
		<div class="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>
	{/if}

	{#if impactMapDatabaseState.error}
		<div
			class="absolute bottom-4 right-4 z-50 max-w-md rounded-lg bg-error p-4 text-white shadow-lg">
			<p class="font-semibold">Error loading data</p>
			<p>{impactMapDatabaseState.error}</p>
		</div>
	{/if}

	{#if impactMapDatabaseState.highlightedFeature}
		<div class="absolute bottom-4 right-4 z-40 max-w-md rounded-lg bg-white p-4 shadow-lg">
			<h3 class="mb-2 text-lg font-bold">{impactMapDatabaseState.highlightedFeature.name}</h3>

			{#if impactMapDatabaseState.highlightedFeature.bridge_type}
				<p>
					<span class="font-semibold">Type:</span>
					{impactMapDatabaseState.highlightedFeature.bridge_type}
				</p>
			{/if}

			{#if impactMapDatabaseState.highlightedFeature.year_completed}
				<p>
					<span class="font-semibold">Completed:</span>
					{impactMapDatabaseState.highlightedFeature.year_completed}
				</p>
			{/if}

			{#if impactMapDatabaseState.highlightedFeature.bridge_index}
				<p>
					<span class="font-semibold">Bridge Index:</span>
					{impactMapDatabaseState.highlightedFeature.bridge_index}
				</p>
			{/if}

			{#if impactMapDatabaseState.highlightedFeature.exit_point_index}
				<p>
					<span class="font-semibold">Exit Point Index:</span>
					{impactMapDatabaseState.highlightedFeature.exit_point_index}
				</p>
			{/if}

			{#if impactMapDatabaseState.highlightedFeature.id}
				<p><span class="font-semibold">ID:</span> {impactMapDatabaseState.highlightedFeature.id}</p>
			{/if}

			<button
				class="btn btn-circle btn-sm absolute right-2 top-2"
				on:click={() => (impactMapDatabaseState.highlightedFeature = null)}>
				✕
			</button>
		</div>
	{/if}
</div>
