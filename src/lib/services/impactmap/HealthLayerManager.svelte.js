import { authFetch } from '$lib/auth/clerk.svelte.js';
import healthIcon from '$lib/images/map-icons/health-icon-bubble.png';
import { impactMapState } from '$lib/utils/state.svelte';

export class HealthLayerManager {
	constructor(map, hexLayerManager = null) {
		this.map = map;
		this.hoveredHealthId = null;
		this.hexLayerManager = hexLayerManager;
		this.pathLayerManager = null; // Will be set by MapController
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing health layers');
			return;
		}

		try {
			// Add vector tile source using Mapbox tileset
			console.log('Adding health vector tile source');
			this.map.addSource('health-source', {
				type: 'vector',
				url: 'mapbox://bridgestoprosperity.4gfnl483',
				minzoom: 0,
				maxzoom: 22
			});

			// Load health icon from static folder
			this.map.loadImage(healthIcon, (error, image) => {
				if (error) {
					console.error('Error loading health icon:', error);
					return;
				}

				// Add the image to the map if it doesn't already exist
				if (!this.map.hasImage('health-icon-bubble')) {
					this.map.addImage('health-icon-bubble', image);
				}

				// Add health layer with circles behind waterway layer
				this.map.addLayer(
					{
						id: 'health-layer',
						type: 'circle',
						source: 'health-source',
						'source-layer': 'health_facilities',
						minzoom: 7.8,
						maxzoom: 22,
						layout: {},
						paint: {
							'circle-color': [
								'match',
								['get', 'category'],
								['district hospital', 'reference hospital', 'provincial hospital'],
								'#b43d2d',
								['family health posts', 'health post'],
								'rgba(255, 255, 255, 0)',
								'#d76e61'
							],
							'circle-radius': ['interpolate', ['exponential', 1.2], ['zoom'], 3, 0.1, 15, 5],
							'circle-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1],
							'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.1, 15, 5],
							'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1],
							'circle-stroke-color': '#b43d2d'
						}
					},
					'waterway'
				);

				// Add hover layer - initially hidden, shows only the hovered health facility
				this.map.addLayer(
					{
						id: 'health-hover-layer',
						type: 'symbol',
						source: 'health-source',
						'source-layer': 'health_facilities',
						minzoom: 7.8,
						maxzoom: 22,
						layout: {
							'icon-image': 'health-icon-bubble',
							'icon-size': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.02, 14.5, 0.15],
							'icon-allow-overlap': true,
							'icon-ignore-placement': true
						},
						paint: {
							'icon-opacity': 1,
							'icon-translate': [0, 5]
						},
						filter: ['==', 'all_health_facilities_index', ''] // Initially hide all health facilities
					},
					'waterway'
				);
			});
		} catch (error) {
			console.error('Error initializing health layers:', error);
		}
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('health-hover-layer')) {
			this.map.removeLayer('health-hover-layer');
		}

		if (this.map.getLayer('health-layer')) {
			this.map.removeLayer('health-layer');
		}

		if (this.map.getSource('health-source')) {
			this.map.removeSource('health-source');
		}
	}

	handleHealthHover(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['health-layer', 'health-hover-layer']
		});

		if (features.length > 0) {
			// Change cursor to pointer
			this.map.getCanvas().style.cursor = 'pointer';

			const healthId = features[0].properties.all_health_facilities_index;

			if (
				(impactMapState.filterMode && impactMapState.highlightedHealthFacilities.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing health facility filtering
				// Just keep the current state - health facilities should stay as pins if they're already highlighted
				return;
			} else {
				// Normal hover mode: hide hovered facility from base layer and show in hover layer
				this.map.setFilter('health-layer', ['!=', 'all_health_facilities_index', healthId]);
				this.map.setFilter('health-hover-layer', ['==', 'all_health_facilities_index', healthId]);
			}
		} else {
			// Reset cursor
			this.map.getCanvas().style.cursor = '';

			if (
				(impactMapState.filterMode && impactMapState.highlightedHealthFacilities.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing health facility filtering
				// Keep the current state
				return;
			} else {
				// Normal mode: reset to default state
				this.map.setFilter('health-layer', null);
				this.map.setFilter('health-hover-layer', ['==', 'all_health_facilities_index', '']);
			}
		}
	}

	async handleHealthClick(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['health-layer', 'health-hover-layer']
		});

		if (features.length) {
			const feature = features[0];
			const facilityIndex = feature.properties.all_health_facilities_index;
			const [lng, lat] = feature.geometry?.coordinates ?? [];
			// The index is shared by facilities in different countries: say where the click was.
			const where = Number.isFinite(lng) && Number.isFinite(lat) ? `&lng=${lng}&lat=${lat}` : '';
			console.log('Clicked health facility feature:', feature.properties);

			// Query the database for this health facility and its served hexes
			try {
				const response = await authFetch(
					`/api/health-facility-details?facilityIndex=${encodeURIComponent(facilityIndex)}${where}`
				);

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Error fetching health facility data:', errorData);
					return;
				}

				const facilityData = await response.json();
				console.log('Health facility data from database:', facilityData);

				// Trigger reverse filtering through HexLayerManager
				if (this.hexLayerManager) {
					this.hexLayerManager.applyReverseInfrastructureFilter(facilityData, 'health');
				}

				// Display paths for selected health facility
				if (this.pathLayerManager && facilityIndex) {
					await this.pathLayerManager.displayPathsForDestination(facilityIndex);
					this.pathLayerManager.updatePathStyling('health');
					impactMapState.pathsVisible = true;
					impactMapState.pathDestinationType = 'health';
				}
			} catch (error) {
				console.error('Failed to fetch health facility data:', error);
			}
		}
	}

	highlightHealthFacilities(facilityIds) {
		if (!this.map.getLayer('health-layer')) return;

		if (facilityIds && facilityIds.length > 0) {
			// Create filter expression for highlighted health facilities using individual equality checks
			// This avoids the argument limit issue with the 'in' operator
			let highlightFilter;
			if (facilityIds.length === 1) {
				highlightFilter = ['==', ['get', 'all_health_facilities_index'], facilityIds[0]];
			} else {
				// Use 'any' with multiple equality checks for multiple facility IDs
				const equalityChecks = facilityIds.map((id) => [
					'==',
					['get', 'all_health_facilities_index'],
					id
				]);
				highlightFilter = ['any', ...equalityChecks];
			}

			// Hide circles for highlighted health facilities, fade others
			this.map.setPaintProperty('health-layer', 'circle-opacity', [
				'case',
				highlightFilter,
				0, // Hide circles for highlighted health facilities (showing as pins)
				0.2 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('health-layer', 'circle-stroke-opacity', [
				'case',
				highlightFilter,
				0, // Hide strokes for highlighted health facilities (showing as pins)
				0.2 // Fade other circle strokes
			]);

			// Show icon pins for highlighted health facilities only
			this.map.setFilter('health-hover-layer', highlightFilter);
		}
	}

	highlightSelectedHealthFacility(facilityIds) {
		if (!this.map.getLayer('health-layer')) return;

		if (facilityIds && facilityIds.length > 0) {
			// Create filter expression for selected health facility
			let selectFilter;
			if (facilityIds.length === 1) {
				selectFilter = ['==', ['get', 'all_health_facilities_index'], facilityIds[0]];
			} else {
				const equalityChecks = facilityIds.map((id) => [
					'==',
					['get', 'all_health_facilities_index'],
					id
				]);
				selectFilter = ['any', ...equalityChecks];
			}

			// Hide circles for selected health facility, fade others
			this.map.setPaintProperty('health-layer', 'circle-opacity', [
				'case',
				selectFilter,
				0, // Hide circles for selected health facility (showing as pin)
				0.3 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('health-layer', 'circle-stroke-opacity', [
				'case',
				selectFilter,
				0, // Hide strokes for selected health facility (showing as pin)
				0.3 // Fade other circle strokes
			]);

			// Show icon pin for selected health facility only
			this.map.setFilter('health-hover-layer', selectFilter);
		}
	}

	fadeAllFacilities() {
		if (!this.map.getLayer('health-layer')) return;

		// Fade all health facilities to 20% opacity
		this.map.setPaintProperty('health-layer', 'circle-opacity', 0.2);
		this.map.setPaintProperty('health-layer', 'circle-stroke-opacity', 0.2);

		// Hide all icon pins
		this.map.setFilter('health-hover-layer', ['==', 'all_health_facilities_index', '']);
	}

	resetFilter() {
		if (!this.map.getLayer('health-layer')) return;

		// Reset circles to original opacity
		this.map.setPaintProperty('health-layer', 'circle-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Reset circle strokes to original opacity
		this.map.setPaintProperty('health-layer', 'circle-stroke-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Hide all icon pins
		this.map.setFilter('health-hover-layer', ['==', 'all_health_facilities_index', '']);
	}
}
