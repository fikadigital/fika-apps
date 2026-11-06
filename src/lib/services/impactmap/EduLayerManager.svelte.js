import { authFetch } from '$lib/auth/clerk.svelte.js';
import eduIcon from '$lib/images/map-icons/edu-icon-bubble.png';
import { impactMapState } from '$lib/utils/state.svelte';

export class EduLayerManager {
	constructor(map, hexLayerManager = null) {
		this.map = map;
		this.hoveredEduId = null;
		this.hexLayerManager = hexLayerManager;
		this.pathLayerManager = null; // Will be set by MapController
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing education layers');
			return;
		}

		try {
			// Add vector tile source using Mapbox tileset
			this.map.addSource('edu-source', {
				type: 'vector',
				url: 'mapbox://bridgestoprosperity.4gfnl483',
				minzoom: 0,
				maxzoom: 22
			});

			// Load education icon from static folder
			this.map.loadImage(eduIcon, (error, image) => {
				if (error) {
					console.error('Error loading education icon:', error);
					return;
				}

				// Add the image to the map if it doesn't already exist
				if (!this.map.hasImage('edu-icon-bubble')) {
					this.map.addImage('edu-icon-bubble', image);
				}

				// Add education layer with circles behind waterway layer
				this.map.addLayer(
					{
						id: 'edu-layer',
						type: 'circle',
						source: 'edu-source',
						'source-layer': 'education_facilities',
						minzoom: 7.8,
						maxzoom: 22,
						layout: {},
						paint: {
							'circle-color': [
								'case',
								['==', ['get', 'is_a_level'], true],
								'#d48216',
								['==', ['get', 'is_o_level'], true],
								'#e39c40',
								['==', ['get', 'is_preschool'], true],
								'rgba(226, 156, 64, 0)',
								['==', ['get', 'is_primary'], true],
								'rgba(226, 156, 64, 0)',
								['==', ['get', 'is_primary'], false],
								'#e39c40',
								'#e39c40'
							],
							'circle-radius': ['interpolate', ['exponential', 1.2], ['zoom'], 3, 0.1, 15, 5],
							'circle-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1],
							'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.1, 15, 5],
							'circle-stroke-color': '#d48216',
							'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 11, 1]
						}
					},
					'waterway'
				);

				// Add hover layer - initially hidden, shows only the hovered education facility
				this.map.addLayer(
					{
						id: 'edu-hover-layer',
						type: 'symbol',
						source: 'edu-source',
						'source-layer': 'education_facilities',
						minzoom: 7.8,
						maxzoom: 22,
						layout: {
							'icon-image': 'edu-icon-bubble',
							'icon-size': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.02, 14.5, 0.15],
							'icon-allow-overlap': true,
							'icon-ignore-placement': true
						},
						paint: {
							'icon-opacity': 1,
							'icon-translate': [0, 5]
						},
						filter: ['==', 'all_education_facilities_index', ''] // Initially hide all education facilities
					},
					'waterway'
				);
			});
		} catch (error) {
			console.error('Error initializing education layers:', error);
		}
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('edu-hover-layer')) {
			this.map.removeLayer('edu-hover-layer');
		}

		if (this.map.getLayer('edu-layer')) {
			this.map.removeLayer('edu-layer');
		}

		if (this.map.getSource('edu-source')) {
			this.map.removeSource('edu-source');
		}
	}

	handleEduHover(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['edu-layer', 'edu-hover-layer']
		});

		if (features.length > 0) {
			// Change cursor to pointer
			this.map.getCanvas().style.cursor = 'pointer';

			const eduId = features[0].properties.all_education_facilities_index;

			if (
				(impactMapState.filterMode && impactMapState.highlightedEducationFacilities.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing education facility filtering
				// Just keep the current state - education facilities should stay as pins if they're already highlighted
				return;
			} else {
				// Normal hover mode: hide hovered facility from base layer and show in hover layer
				this.map.setFilter('edu-layer', ['!=', 'all_education_facilities_index', eduId]);
				this.map.setFilter('edu-hover-layer', ['==', 'all_education_facilities_index', eduId]);
			}
		} else {
			// Reset cursor
			this.map.getCanvas().style.cursor = '';

			if (
				(impactMapState.filterMode && impactMapState.highlightedEducationFacilities.length > 0) ||
				impactMapState.reverseFilterMode
			) {
				// In filter mode or reverse filter mode: don't change existing education facility filtering
				// Keep the current state
				return;
			} else {
				// Normal mode: reset to default state
				this.map.setFilter('edu-layer', null);
				this.map.setFilter('edu-hover-layer', ['==', 'all_education_facilities_index', '']);
			}
		}
	}

	async handleEduClick(e) {
		const features = this.map.queryRenderedFeatures(e.point, {
			layers: ['edu-hover-layer']
		});

		if (features.length) {
			const feature = features[0];
			const facilityIndex = feature.properties.all_education_facilities_index;
			const [lng, lat] = feature.geometry?.coordinates ?? [];
			// The index is shared by facilities in different countries: say where the click was.
			const where = Number.isFinite(lng) && Number.isFinite(lat) ? `&lng=${lng}&lat=${lat}` : '';
			console.log('Clicked education facility feature:', feature.properties);

			// Query the database for this education facility and its served hexes
			try {
				const response = await authFetch(
					`/api/education-facility-details?facilityIndex=${encodeURIComponent(facilityIndex)}${where}`
				);

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Error fetching education facility data:', errorData);
					return;
				}

				const facilityData = await response.json();
				console.log('Education facility data from database:', facilityData);

				// Trigger reverse filtering through HexLayerManager
				if (this.hexLayerManager) {
					this.hexLayerManager.applyReverseInfrastructureFilter(facilityData, 'education');
				}

				// Display paths for selected education facility
				if (this.pathLayerManager && facilityIndex) {
					await this.pathLayerManager.displayPathsForDestination(facilityIndex);
					this.pathLayerManager.updatePathStyling('education');
					impactMapState.pathsVisible = true;
					impactMapState.pathDestinationType = 'education';
				}
			} catch (error) {
				console.error('Failed to fetch education facility data:', error);
			}
		}
	}

	highlightEducationFacilities(facilityIds) {
		if (!this.map.getLayer('edu-layer')) return;

		if (facilityIds && facilityIds.length > 0) {
			// Create filter expression for highlighted education facilities using individual equality checks
			// This avoids the argument limit issue with the 'in' operator
			let highlightFilter;
			if (facilityIds.length === 1) {
				highlightFilter = ['==', ['get', 'all_education_facilities_index'], facilityIds[0]];
			} else {
				// Use 'any' with multiple equality checks for multiple facility IDs
				const equalityChecks = facilityIds.map((id) => [
					'==',
					['get', 'all_education_facilities_index'],
					id
				]);
				highlightFilter = ['any', ...equalityChecks];
			}

			// Hide circles for highlighted education facilities, fade others
			this.map.setPaintProperty('edu-layer', 'circle-opacity', [
				'case',
				highlightFilter,
				0, // Hide circles for highlighted education facilities (showing as pins)
				0.2 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('edu-layer', 'circle-stroke-opacity', [
				'case',
				highlightFilter,
				0, // Hide strokes for highlighted education facilities (showing as pins)
				0.2 // Fade other circle strokes
			]);

			// Show icon pins for highlighted education facilities only
			this.map.setFilter('edu-hover-layer', highlightFilter);
		}
	}

	highlightSelectedEducationFacility(facilityIds) {
		if (!this.map.getLayer('edu-layer')) return;

		if (facilityIds && facilityIds.length > 0) {
			// Create filter expression for selected education facility
			let selectFilter;
			if (facilityIds.length === 1) {
				selectFilter = ['==', ['get', 'all_education_facilities_index'], facilityIds[0]];
			} else {
				const equalityChecks = facilityIds.map((id) => [
					'==',
					['get', 'all_education_facilities_index'],
					id
				]);
				selectFilter = ['any', ...equalityChecks];
			}

			// Hide circles for selected education facility, fade others
			this.map.setPaintProperty('edu-layer', 'circle-opacity', [
				'case',
				selectFilter,
				0, // Hide circles for selected education facility (showing as pin)
				0.3 // Fade other circles
			]);

			// Also fade the circle strokes
			this.map.setPaintProperty('edu-layer', 'circle-stroke-opacity', [
				'case',
				selectFilter,
				0, // Hide strokes for selected education facility (showing as pin)
				0.3 // Fade other circle strokes
			]);

			// Show icon pin for selected education facility only
			this.map.setFilter('edu-hover-layer', selectFilter);
		}
	}

	fadeAllFacilities() {
		if (!this.map.getLayer('edu-layer')) return;

		// Fade all education facilities to 20% opacity
		this.map.setPaintProperty('edu-layer', 'circle-opacity', 0.2);
		this.map.setPaintProperty('edu-layer', 'circle-stroke-opacity', 0.2);

		// Hide all icon pins
		this.map.setFilter('edu-hover-layer', ['==', 'all_education_facilities_index', '']);
	}

	resetFilter() {
		if (!this.map.getLayer('edu-layer')) return;

		// Reset circles to original opacity
		this.map.setPaintProperty('edu-layer', 'circle-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Reset circle strokes to original opacity
		this.map.setPaintProperty('edu-layer', 'circle-stroke-opacity', [
			'interpolate',
			['linear'],
			['zoom'],
			9,
			0.1,
			11,
			1
		]);

		// Hide all icon pins
		this.map.setFilter('edu-hover-layer', ['==', 'all_education_facilities_index', '']);
	}
}
