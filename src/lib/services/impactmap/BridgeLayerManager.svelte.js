import { authFetch } from '$lib/auth/clerk.svelte.js';
import bridgeIcon from '$lib/images/map-icons/bridge-icon-bubble.png';
import { impactMapState } from '$lib/utils/state.svelte';

export class BridgeLayerManager {
	constructor(map, hexLayerManager = null) {
		this.map = map;
		this.hoveredBridgeId = null;
		this.hexLayerManager = hexLayerManager;
		this.pathLayerManager = null; // Will be set by MapController
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing bridge layers');
			return;
		}

		try {
			// Add vector tile source using Mapbox tileset
			this.map.addSource('bridge-source', {
				type: 'vector',
				url: 'mapbox://bridgestoprosperity.ac38d6t8',
				minzoom: 0,
				maxzoom: 22
			});

			// Load bridge icon from static folder
			this.map.loadImage(bridgeIcon, (error, image) => {
				if (error) {
					console.error('Error loading bridge icon:', error);
					return;
				}

				// Add the image to the map if it doesn't already exist
				if (!this.map.hasImage('bridge-icon-bubble')) {
					this.map.addImage('bridge-icon-bubble', image);
				}

				// Add bridge layer with circles behind waterway layer
				this.map.addLayer(
					{
						id: 'bridge-layer',
						type: 'circle',
						source: 'bridge-source',
						'source-layer': 'all_bridges_tiny',
						minzoom: 7.8,
						maxzoom: 22,
						paint: {
							'circle-color': '#7897e7',
							'circle-radius': ['interpolate', ['exponential', 1.2], ['zoom'], 3, 0.1, 15, 6],
							'circle-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1],
							'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 15, 7.5],
							'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1],
							'circle-stroke-color': '#3d5ba9'
						}
					},
					'waterway'
				);

				// Add hover layer - initially hidden, shows only the hovered bridge
				this.map.addLayer(
					{
						id: 'bridge-hover-layer',
						type: 'symbol',
						source: 'bridge-source',
						'source-layer': 'all_bridges_tiny',
						minzoom: 7.8,
						maxzoom: 22,
						layout: {
							'icon-image': 'bridge-icon-bubble',
							'icon-size': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.05, 14.5, 0.1],
							'icon-allow-overlap': true,
							'icon-ignore-placement': true
						},
						paint: {
							'icon-opacity': 1,
							'icon-translate': [0, 5]
						},
						filter: ['==', 'bridge_index', ''] // Initially hide all bridges
					},
					'waterway'
				);
			});
		} catch (error) {
			console.error('Error initializing bridge layers:', error);
		}
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('bridge-hover-layer')) {
			this.map.removeLayer('bridge-hover-layer');
		}

		if (this.map.getLayer('bridge-layer')) {
			this.map.removeLayer('bridge-layer');
		}

		if (this.map.getSource('bridge-source')) {
			this.map.removeSource('bridge-source');
		}
	}

	handleBridgeHover(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['bridge-layer', 'bridge-hover-layer']
		});

		if (features.length > 0) {
			// Change cursor to pointer
			this.map.getCanvas().style.cursor = 'pointer';

			const bridgeIndex = features[0].properties.bridge_index;

			if (
				(impactMapState.filterMode && impactMapState.highlightedBridges.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing bridge filtering
				// Just keep the current state - bridges should stay as pins if they're already highlighted
				return;
			} else {
				// Normal hover mode: hide hovered bridge from base layer and show in hover layer
				this.map.setFilter('bridge-layer', ['!=', 'bridge_index', bridgeIndex]);
				this.map.setFilter('bridge-hover-layer', ['==', 'bridge_index', bridgeIndex]);
			}
		} else {
			// Reset cursor
			this.map.getCanvas().style.cursor = '';

			if (
				(impactMapState.filterMode && impactMapState.highlightedBridges.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing bridge filtering
				// Keep the current state
				return;
			} else {
				// Normal mode: reset to default state
				this.map.setFilter('bridge-layer', null);
				this.map.setFilter('bridge-hover-layer', ['==', 'bridge_index', '']);
			}
		}
	}

	async handleBridgeClick(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['bridge-hover-layer']
		});

		if (features.length) {
			const feature = features[0];
			const bridgeIndex = feature.properties.bridge_index;
			const [lng, lat] = feature.geometry?.coordinates ?? [];
			// The index is shared by facilities in different countries: say where the click was.
			const where = Number.isFinite(lng) && Number.isFinite(lat) ? `&lng=${lng}&lat=${lat}` : '';
			console.log('Clicked bridge feature:', feature.properties);

			// Query the database for this bridge and its served hexes
			try {
				const response = await authFetch(
					`/api/bridge-details?bridgeIndex=${encodeURIComponent(bridgeIndex)}${where}`
				);

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Error fetching bridge data:', errorData);
					return;
				}

				const bridgeData = await response.json();
				console.log('Bridge data from database:', bridgeData);

				// Trigger reverse filtering through HexLayerManager
				if (this.hexLayerManager) {
					this.hexLayerManager.applyReverseInfrastructureFilter(bridgeData, 'bridge');
				}

				// Display paths for selected bridge
				if (this.pathLayerManager && bridgeIndex) {
					await this.pathLayerManager.displayPathsForDestination(bridgeIndex);
					this.pathLayerManager.updatePathStyling('bridge');
					impactMapState.pathsVisible = true;
					impactMapState.pathDestinationType = 'bridge';
				}
			} catch (error) {
				console.error('Failed to fetch bridge data:', error);
			}
		} else {
			console.log('No bridge feature found at click location');
		}
	}

	highlightBridges(bridgeIds) {
		if (!this.map.getLayer('bridge-layer')) return;

		if (bridgeIds && bridgeIds.length > 0) {
			// Create filter expression for highlighted bridges using individual equality checks
			// This avoids the argument limit issue with the 'in' operator
			let highlightFilter;
			if (bridgeIds.length === 1) {
				highlightFilter = ['==', ['get', 'bridge_index'], bridgeIds[0]];
			} else {
				// Use 'any' with multiple equality checks for multiple bridge IDs
				const equalityChecks = bridgeIds.map((id) => ['==', ['get', 'bridge_index'], id]);
				highlightFilter = ['any', ...equalityChecks];
			}

			// Hide circles for highlighted bridges, fade others
			this.map.setPaintProperty('bridge-layer', 'circle-opacity', [
				'case',
				highlightFilter,
				0, // Hide circles for highlighted bridges (showing as pins)
				0.2 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('bridge-layer', 'circle-stroke-opacity', [
				'case',
				highlightFilter,
				0, // Hide strokes for highlighted bridges (showing as pins)
				0.2 // Fade other circle strokes
			]);

			// Show icon pins for highlighted bridges only
			this.map.setFilter('bridge-hover-layer', highlightFilter);
		}
	}

	highlightSelectedBridge(bridgeIds) {
		if (!this.map.getLayer('bridge-layer')) return;

		if (bridgeIds && bridgeIds.length > 0) {
			// Create filter expression for selected bridge
			let selectFilter;
			if (bridgeIds.length === 1) {
				selectFilter = ['==', ['get', 'bridge_index'], bridgeIds[0]];
			} else {
				const equalityChecks = bridgeIds.map((id) => ['==', ['get', 'bridge_index'], id]);
				selectFilter = ['any', ...equalityChecks];
			}

			// Hide circles for selected bridge, fade others
			this.map.setPaintProperty('bridge-layer', 'circle-opacity', [
				'case',
				selectFilter,
				0, // Hide circles for selected bridge (showing as pin)
				0.3 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('bridge-layer', 'circle-stroke-opacity', [
				'case',
				selectFilter,
				0, // Hide strokes for selected bridge (showing as pin)
				0.3 // Fade other circle strokes
			]);

			// Show icon pin for selected bridge only
			this.map.setFilter('bridge-hover-layer', selectFilter);
		}
	}

	fadeAllBridges() {
		if (!this.map.getLayer('bridge-layer')) return;

		// Fade all bridges to 20% opacity
		this.map.setPaintProperty('bridge-layer', 'circle-opacity', 0.2);
		this.map.setPaintProperty('bridge-layer', 'circle-stroke-opacity', 0.2);

		// Hide all icon pins
		this.map.setFilter('bridge-hover-layer', ['==', 'bridge_index', '']);
	}

	resetFilter() {
		if (!this.map.getLayer('bridge-layer')) return;

		// Reset circles to original opacity
		this.map.setPaintProperty('bridge-layer', 'circle-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Reset circle strokes to original opacity
		this.map.setPaintProperty('bridge-layer', 'circle-stroke-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Hide all icon pins
		this.map.setFilter('bridge-hover-layer', ['==', 'bridge_index', '']);
	}
}
