import { impactDataMap } from '$lib/utils/impactmap/impactDataMap';
import { ColorUtils } from './ColorUtils.svelte.js';
import { impactMapState } from '$lib/utils/state.svelte';
import { sessionToken } from '$lib/auth/clerk.svelte.js';

export class HexLayerManager {
	constructor(map, layerManagers = {}) {
		this.map = map;
		this.colorUtils = new ColorUtils();
		this.hoverTimeout = null;
		this.currentHoveredId = null;

		// Store references to other layer managers for filtering
		this.bridgeLayerManager = layerManagers.bridgeLayerManager;
		this.healthLayerManager = layerManagers.healthLayerManager;
		this.eduLayerManager = layerManagers.eduLayerManager;
		this.pathLayerManager = layerManagers.pathLayerManager;
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing hex layers');
			return;
		}

		try {
			console.log('Initializing hex layers with Mapbox Vector Tiles');

			const hexColorExpression = this.colorUtils.getHexColorExpression();
			if (!hexColorExpression) {
				console.warn('No valid hex color expression');
				return;
			}

			// Add vector tile source using Mapbox tileset
			this.map.addSource('hex-source', {
				type: 'vector',
				url: 'mapbox://bridgestoprosperity.hex8-demographic',
				minzoom: 0,
				maxzoom: 22
			});

			// Add hex8 fill layer (for zoom 7.5+) behind waterway layer
			this.map.addLayer(
				{
					id: 'hex-layer',
					type: 'fill',
					source: 'hex-source',
					'source-layer': 'hex8-demographic', // Default to demographic source layer
					minzoom: 0,
					maxzoom: 22,
					filter: ['!=', ['get', 'population'], 0], // Default filter, will be updated when layer updates
					paint: {
						'fill-color': hexColorExpression,
						'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.2, 0.8]
					}
				},
				'waterway'
			);

			// Add hex hover outline layer - initially hidden
			this.map.addLayer(
				{
					id: 'hex-hover-layer',
					type: 'line',
					source: 'hex-source',
					'source-layer': 'hex8-demographic',
					minzoom: 0,
					maxzoom: 22,
					paint: {
						'line-color': '#249EA0',
						'line-width': 3,
						'line-opacity': 1
					},
					filter: ['==', ['id'], null] // Initially hide all hexes
				},
				'waterway'
			);
		} catch (error) {
			console.error('Error initializing hex layers:', error);
		}
	}

	updateLayer(dataKey) {
		if (!dataKey || !impactDataMap[dataKey]) {
			console.warn('Invalid data key for hex layer:', dataKey);
			return;
		}

		// Define the tilesets and their corresponding data keys with unique source layers
		const tilesets = {
			'mapbox://bridgestoprosperity.demographic_hex_tiles_may2025': {
				sourceLayer: 'hex8-demographic',
				dataKeys: [
					'population',
					'births',
					'pregnancies',
					'rwi',
					'underweight',
					'female_educational_attainment_mean',
					'male_educational_attainment_mean'
				]
			},
			'mapbox://bridgestoprosperity.travel_time_hex_tiles_may2025': {
				sourceLayer: 'hex8-travel-time',
				dataKeys: [
					'travel_time_health_posts',
					'travel_time_major_roads',
					'travel_time_secondary_schools',
					'travel_time_health_centers',
					'travel_time_semi_dense_urban',
					'travel_time_all_health',
					'travel_time_major_hospitals',
					'travel_time_primary_schools',
					'travel_time_all_education'
				]
			},
			'mapbox://bridgestoprosperity.tt_no_bridges_hex_tiles_may2025': {
				sourceLayer: 'hex8-travel-time-no-bridges',
				dataKeys: [
					'travel_time_no_sites_all_health',
					'travel_time_no_sites_secondary_schools',
					'travel_time_no_sites_health_centers',
					'travel_time_no_sites_major_roads',
					'travel_time_no_sites_primary_schools',
					'travel_time_no_sites_semi_dense_urban',
					'travel_time_no_sites_all_education',
					'travel_time_no_sites_major_hospitals',
					'travel_time_no_sites_health_posts'
				]
			},
			'mapbox://bridgestoprosperity.time_delta_hex_tiles_may2025': {
				sourceLayer: 'hex8-time-delta',
				dataKeys: [
					'time_delta_no_sites_all_education',
					'time_delta_no_sites_semi_dense_urban',
					'time_delta_no_sites_secondary_schools',
					'time_delta_no_sites_all_health',
					'time_delta_no_sites_health_centers',
					'time_delta_no_sites_major_roads',
					'time_delta_no_sites_major_hospitals',
					'time_delta_no_sites_health_posts',
					'time_delta_no_sites_primary_schools'
				]
			}
		};

		// Find which tileset contains this dataKey
		let hexSource = null;
		let sourceLayer = null;
		for (const [url, tilesetInfo] of Object.entries(tilesets)) {
			if (tilesetInfo.dataKeys.includes(dataKey)) {
				hexSource = url;
				sourceLayer = tilesetInfo.sourceLayer;
				break;
			}
		}

		if (!hexSource) {
			console.error(`Data key '${dataKey}' not found in any tileset`);
			return;
		}

		const currentSource = this.map.getSource('hex-source');
		const currentSourceUrl = currentSource?.url;

		// Check if we need to update the source
		if (!currentSource || currentSourceUrl !== hexSource) {
			console.log(`Switching from source ${currentSourceUrl} to ${hexSource}`);

			// Remove existing layer and source
			this.cleanupExistingLayer();

			// Add new source
			this.map.addSource('hex-source', {
				type: 'vector',
				url: hexSource,
				minzoom: 0,
				maxzoom: 22
			});

			this.map.addLayer(
				{
					id: 'hex-layer',
					type: 'fill',
					source: 'hex-source',
					'source-layer': sourceLayer,
					minzoom: 0,
					maxzoom: 22,
					// filter for any 0 values
					filter: ['!=', ['get', dataKey], 0],
					paint: {
						'fill-color': this.colorUtils.getHexColorExpression(dataKey),
						'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.2, 0.8]
					}
				},
				'waterway'
			);

			// Add hex hover outline layer for new tileset
			this.map.addLayer(
				{
					id: 'hex-hover-layer',
					type: 'line',
					source: 'hex-source',
					'source-layer': sourceLayer,
					minzoom: 0,
					maxzoom: 22,
					paint: {
						'line-color': '#A4EED0',
						'line-width': 3,
						'line-opacity': 1
					},
					filter: ['==', ['id'], null] // Initially hide all hexes
				},
				'waterway'
			);
		} else {
			// Check if source layer has changed - if so, we need to recreate the layer
			const currentLayer = this.map.getLayer('hex-layer');
			if (currentLayer && currentLayer['source-layer'] !== sourceLayer) {
				// Source layer changed, need to recreate the layer
				this.cleanupExistingLayer();

				// Add new source (same URL but we need to ensure it's fresh)
				this.map.addSource('hex-source', {
					type: 'vector',
					url: hexSource,
					minzoom: 0,
					maxzoom: 22
				});

				this.map.addLayer(
					{
						id: 'hex-layer',
						type: 'fill',
						source: 'hex-source',
						'source-layer': sourceLayer,
						minzoom: 0,
						maxzoom: 22,
						filter: ['!=', ['get', dataKey], 0],
						paint: {
							'fill-color': this.colorUtils.getHexColorExpression(dataKey),
							'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.2, 0.8]
						}
					},
					'waterway'
				);

				// Add hex hover outline layer for new tileset
				this.map.addLayer(
					{
						id: 'hex-hover-layer',
						type: 'line',
						source: 'hex-source',
						'source-layer': sourceLayer,
						minzoom: 0,
						maxzoom: 22,
						paint: {
							'line-color': '#A4EED0',
							'line-width': 3,
							'line-opacity': 1
						},
						filter: ['==', ['id'], null] // Initially hide all hexes
					},
					'waterway'
				);
			} else {
				// Same source layer, just update paint and filter
				this.map.setPaintProperty(
					'hex-layer',
					'fill-color',
					this.colorUtils.getHexColorExpression(dataKey)
				);

				// Apply appropriate filter based on data type
				this.map.setFilter('hex-layer', ['!=', ['get', dataKey], 0]);
			}
		}
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('hex-hover-layer')) {
			this.map.removeLayer('hex-hover-layer');
		}

		if (this.map.getLayer('hex-layer')) {
			this.map.removeLayer('hex-layer');
		}

		if (this.map.getSource('hex-source')) {
			this.map.removeSource('hex-source');
		}
	}

	handleHexHover(e) {
		// Clear any existing timeout
		if (this.hoverTimeout) {
			clearTimeout(this.hoverTimeout);
			this.hoverTimeout = null;
		}

		// Check if there are any bridge features at this location
		const bridgeFeatures = this.map.queryRenderedFeatures(e.point, {
			layers: ['bridge-layer', 'bridge-hover-layer']
		});

		// If bridges are being hovered, don't show hex hover
		if (bridgeFeatures.length > 0) {
			// Clear current hover if bridges take precedence
			this.currentHoveredId = null;
			this.map.setFilter('hex-hover-layer', ['==', ['id'], null]);
			return;
		}

		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['hex-layer', 'hex-hover-layer']
		});

		if (features.length > 0) {
			// Change cursor immediately
			this.map.getCanvas().style.cursor = 'pointer';

			const feature = features[0];
			const featureId = feature.id;

			// Only update if it's a different hex
			if (featureId !== this.currentHoveredId) {
				// Debounce the hover effect - wait 50ms after mouse stops moving
				this.hoverTimeout = setTimeout(() => {
					this.currentHoveredId = featureId;
					// Show outline for the hovered hex
					this.map.setFilter('hex-hover-layer', ['==', ['id'], featureId]);
				}, 50);
			}
		} else {
			// Reset cursor immediately
			this.map.getCanvas().style.cursor = '';

			// Clear current hover immediately when leaving hex area
			this.currentHoveredId = null;
			this.map.setFilter('hex-hover-layer', ['==', ['id'], null]);
		}
	}

	async handleHexClick(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['hex-layer']
		});

		if (features.length) {
			// A facility or bridge is selected: clear that selection, then carry on and show the
			// card for the hex that was clicked (one click, not two).
			if (impactMapState.reverseFilterMode) {
				this.resetReverseInfrastructureFilter();
			}

			const feature = features[0];
			let hexID = feature.properties.h3_index;

			// Get click coordinates and convert to lat/lng
			const clickCoords = this.map.unproject(e.point);
			console.log('Clicked hex feature ID:', hexID);

			// Query the database for this hex
			try {
				// Signed in: send the Clerk session token (the server forwards it to the API).
				const token = await sessionToken();
				const response = await fetch(`/api/hex-areas?hexID=${encodeURIComponent(hexID)}`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Error fetching hex data:', errorData);
					return;
				}

				const hexData = await response.json();
				console.log('Hex area data loaded for:', hexData.h3_index);

				// Add click coordinates to hex data before setting state
				hexData.clickCoordinates = {
					lat: clickCoords.lat,
					lng: clickCoords.lng
				};

				// Update global state
				impactMapState.selectedHexData = hexData;
				impactMapState.filterMode = true;
				impactMapState.hexDataPanelOpen = true;

				// Extract infrastructure IDs from hex data
				this.applyInfrastructureFilter(hexData);

				// Display paths for selected hex
				if (this.pathLayerManager && hexData.h3_index) {
					await this.pathLayerManager.displayPathsForHex(hexData.h3_index);
					impactMapState.pathsVisible = true;
				}
			} catch (error) {
				console.error('Failed to fetch hex data:', error);
			}
		} else {
			// Clicked on empty area - reset filters
			this.resetInfrastructureFilter();
		}

		// Log the paint values
		const paintValues = this.map.getPaintProperty('hex-layer', 'fill-color');
	}

	applyInfrastructureFilter(hexData) {
		// Extract all bridge IDs from various bridge usage arrays
		const bridgeIds = new Set();

		// Collect bridge IDs from all the bridge usage arrays
		Object.keys(hexData).forEach((key) => {
			if (key.startsWith('bridges_used_for_') && Array.isArray(hexData[key])) {
				hexData[key].forEach((bridgeId) => {
					// Convert to number since bridge_index in the map data is a number
					const numericId = parseInt(bridgeId, 10);
					if (!isNaN(numericId)) {
						bridgeIds.add(numericId);
					}
				});
			}
		});

		// Convert bridge IDs to array
		const bridgeIdsArray = Array.from(bridgeIds);

		// Extract health and education facility IDs and convert to numbers
		const healthIds = (hexData.health_destinations || []).map((id) => {
			const numericId = parseInt(id, 10);
			return isNaN(numericId) ? id : numericId;
		});
		const eduIds = (hexData.edu_destinations || []).map((id) => {
			const numericId = parseInt(id, 10);
			return isNaN(numericId) ? id : numericId;
		});

		console.log('Filtering infrastructure:', {
			bridges: bridgeIdsArray,
			health: healthIds,
			education: eduIds
		});

		// Update state
		impactMapState.highlightedBridges = bridgeIdsArray;
		impactMapState.highlightedHealthFacilities = healthIds;
		impactMapState.highlightedEducationFacilities = eduIds;

		// Apply filters to layer managers
		if (this.bridgeLayerManager) {
			this.bridgeLayerManager.highlightBridges(bridgeIdsArray);
		}

		if (this.healthLayerManager) {
			this.healthLayerManager.highlightHealthFacilities(healthIds);
		}

		if (this.eduLayerManager) {
			this.eduLayerManager.highlightEducationFacilities(eduIds);
		}

		// Highlight the selected hex
		this.highlightSelectedHex(hexData.h3_index);
	}

	resetInfrastructureFilter() {
		console.log('Resetting infrastructure filters');

		// Reset state
		impactMapState.selectedHexData = null;
		impactMapState.filterMode = false;
		impactMapState.highlightedBridges = [];
		impactMapState.highlightedHealthFacilities = [];
		impactMapState.highlightedEducationFacilities = [];
		impactMapState.hexDataPanelOpen = false;

		// Reset path state
		impactMapState.pathsVisible = false;
		impactMapState.selectedPaths = [];
		impactMapState.pathHighlightId = null;

		// Reset filters on layer managers
		if (this.bridgeLayerManager) {
			this.bridgeLayerManager.resetFilter();
		}

		if (this.healthLayerManager) {
			this.healthLayerManager.resetFilter();
		}

		if (this.eduLayerManager) {
			this.eduLayerManager.resetFilter();
		}

		// Clear paths
		if (this.pathLayerManager) {
			this.pathLayerManager.clearPaths();
		}

		// Reset hex layer styling
		this.resetHexHighlight();
	}

	highlightSelectedHex(hexId) {
		if (!this.map.getLayer('hex-layer')) return;

		// Fade all hexes to 20% opacity and highlight the selected one
		this.map.setPaintProperty('hex-layer', 'fill-opacity', [
			'case',
			['==', ['get', 'h3_index'], hexId],
			0.6, // Selected hex more visible
			0.2 // Other hexes faded
		]);

		// Fill the selected hex with the hover outline color
		const originalColorExpression = this.map.getPaintProperty('hex-layer', 'fill-color');
		this.map.setPaintProperty('hex-layer', 'fill-color', [
			'case',
			['==', ['get', 'h3_index'], hexId],
			'#A4EED0', // Same color as hex hover outline
			originalColorExpression // Keep original color for other hexes
		]);
	}

	resetHexHighlight() {
		if (!this.map.getLayer('hex-layer')) return;

		// Reset hex opacity to original
		this.map.setPaintProperty('hex-layer', 'fill-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			8,
			0,
			8.2,
			0.8
		]);

		// Reset hex color to original
		this.map.setPaintProperty(
			'hex-layer',
			'fill-color',
			this.colorUtils.getHexColorExpression(impactMapState.dataMapKey)
		);
	}

	// Reverse filtering: highlight hexes that are served by selected infrastructure
	applyReverseInfrastructureFilter(infrastructureData, infrastructureType) {
		// Extract H3 indices based on infrastructure type
		let h3_indices = [];

		if (infrastructureType === 'bridge') {
			// For bridges, combine the specified categories into one array
			const categories = [
				'used_by_h3_for_semi_dense_urban_optimal',
				'used_by_h3_for_all_health_facilities_optimal',
				'used_by_h3_for_all_education_facilities_fixed'
			];

			categories.forEach((category) => {
				if (infrastructureData[category] && Array.isArray(infrastructureData[category])) {
					h3_indices = h3_indices.concat(infrastructureData[category]);
				}
			});

			// Remove duplicates
			h3_indices = [...new Set(h3_indices)];
		} else {
			// For health and education facilities, use the existing h3_indices field
			h3_indices = infrastructureData.h3_indices || [];
		}

		// Update state
		impactMapState.selectedInfrastructureData = infrastructureData;
		impactMapState.selectedInfrastructureType = infrastructureType;
		impactMapState.reverseFilterMode = true;
		impactMapState.highlightedHexes = h3_indices;

		// Apply visual filtering to hexes
		if (h3_indices && h3_indices.length > 0) {
			this.highlightServedHexes(h3_indices);
		}

		// Apply filtering to infrastructure layers
		this.applyReverseInfrastructureFiltering(infrastructureData, infrastructureType);
	}

	highlightServedHexes(hexIds) {
		if (!this.map.getLayer('hex-layer')) return;

		if (hexIds && hexIds.length > 0) {
			// Create filter expression for highlighted hexes using match
			const highlightFilter = ['match', ['get', 'h3_index'], hexIds, true, false];

			// Fade all hexes except highlighted ones
			this.map.setPaintProperty('hex-layer', 'fill-opacity', [
				'case',
				highlightFilter,
				0.8, // Highlighted hexes more visible
				0.1 // Other hexes faded
			]);

			// Keep original color for highlighted hexes, fade others
			const originalColorExpression = this.colorUtils.getHexColorExpression(
				impactMapState.dataMapKey
			);
			this.map.setPaintProperty('hex-layer', 'fill-color', [
				'case',
				highlightFilter,
				originalColorExpression, // Keep original color for highlighted hexes
				'#cccccc' // Gray out other hexes
			]);
		}
	}

	applyReverseInfrastructureFiltering(infrastructureData, infrastructureType) {
		// Convert bridges_used array to numbers if they exist
		const bridgesUsed = (infrastructureData.bridges_used || []).map((id) => {
			const numericId = parseInt(id, 10);
			return isNaN(numericId) ? id : numericId;
		});

		switch (infrastructureType) {
			case 'bridge':
				// Highlight selected bridge (convert to number if needed)
				if (this.bridgeLayerManager) {
					const bridgeId = parseInt(infrastructureData.bridge_index, 10);
					this.bridgeLayerManager.highlightSelectedBridge([bridgeId]);
				}

				// Highlight health destinations served by this bridge
				const healthDestinations = (infrastructureData.health_destinations || []).map((id) => {
					const numericId = parseInt(id, 10);
					return isNaN(numericId) ? id : numericId;
				});

				if (healthDestinations.length > 0 && this.healthLayerManager) {
					this.healthLayerManager.highlightSelectedHealthFacility(healthDestinations);
				} else if (this.healthLayerManager) {
					this.healthLayerManager.fadeAllFacilities();
				}

				// Highlight education destinations served by this bridge
				const eduDestinations = (infrastructureData.edu_destinations || []).map((id) => {
					const numericId = parseInt(id, 10);
					return isNaN(numericId) ? id : numericId;
				});

				if (eduDestinations.length > 0 && this.eduLayerManager) {
					this.eduLayerManager.highlightSelectedEducationFacility(eduDestinations);
				} else if (this.eduLayerManager) {
					this.eduLayerManager.fadeAllFacilities();
				}
				break;

			case 'health':
				// Fade all education facilities first
				if (this.eduLayerManager) {
					this.eduLayerManager.fadeAllFacilities();
				}
				// Highlight selected health facility (convert to number if needed)
				if (this.healthLayerManager) {
					const facilityId = parseInt(infrastructureData.all_health_facilities_index, 10);
					this.healthLayerManager.highlightSelectedHealthFacility([facilityId]);
				}
				// Highlight associated bridges if any
				if (bridgesUsed.length > 0 && this.bridgeLayerManager) {
					this.bridgeLayerManager.highlightBridges(bridgesUsed);
				} else if (this.bridgeLayerManager) {
					this.bridgeLayerManager.fadeAllBridges();
				}
				break;

			case 'education':
				// Fade all health facilities first
				if (this.healthLayerManager) {
					this.healthLayerManager.fadeAllFacilities();
				}
				// Highlight selected education facility (convert to number if needed)
				if (this.eduLayerManager) {
					const facilityId = parseInt(infrastructureData.all_education_facilities_index, 10);
					this.eduLayerManager.highlightSelectedEducationFacility([facilityId]);
				}
				// Highlight associated bridges if any
				if (bridgesUsed.length > 0 && this.bridgeLayerManager) {
					this.bridgeLayerManager.highlightBridges(bridgesUsed);
				} else if (this.bridgeLayerManager) {
					this.bridgeLayerManager.fadeAllBridges();
				}
				break;
		}
	}

	resetReverseInfrastructureFilter() {
		console.log('Resetting reverse infrastructure filters');

		// Reset state
		impactMapState.selectedInfrastructureData = null;
		impactMapState.selectedInfrastructureType = null;
		impactMapState.reverseFilterMode = false;
		impactMapState.highlightedHexes = [];

		// Reset path state
		impactMapState.pathsVisible = false;
		impactMapState.selectedPaths = [];
		impactMapState.pathHighlightId = null;

		// Reset hex styling
		this.resetHexHighlight();

		// Reset infrastructure highlighting
		if (this.bridgeLayerManager) {
			this.bridgeLayerManager.resetFilter();
		}
		if (this.healthLayerManager) {
			this.healthLayerManager.resetFilter();
		}
		if (this.eduLayerManager) {
			this.eduLayerManager.resetFilter();
		}

		// Clear paths
		if (this.pathLayerManager) {
			this.pathLayerManager.clearPaths();
		}
	}
}
