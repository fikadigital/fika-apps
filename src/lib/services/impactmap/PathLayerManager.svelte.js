import { authFetch } from '$lib/auth/clerk.svelte.js';
import { impactMapState } from '$lib/utils/state.svelte';

export class PathLayerManager {
	constructor(map) {
		this.map = map;
		this.currentPaths = [];
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing path layers');
			return;
		}

		try {
			console.log('Initializing path layers');

			// Add path source - initially empty
			this.map.addSource('path-source', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: []
				}
			});

			// Add path layer with dynamic styling based on path_type
			this.map.addLayer(
				{
					id: 'path-layer',
					type: 'line',
					source: 'path-source',
					layout: {
						'line-cap': 'square',
						'line-round-limit': 1
					},
					paint: {
						'line-color': [
							'case',
							['==', ['get', 'path_type'], 'education'],
							'#C88534',
							['==', ['get', 'path_type'], 'health'],
							'#A64535',
							['==', ['get', 'path_type'], 'market'],
							'#6E3A86',
							['==', ['get', 'path_type'], 'bridge'],
							'#FF6B6B',
							'#FF6B6B' // fallback color
						],
						'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.1, 15, 3],
						'line-dasharray': [0.2, 2],
						'line-offset': [
							'case',
							['==', ['get', 'path_type'], 'health'],
							2,
							['==', ['get', 'path_type'], 'market'],
							-2,
							['==', ['get', 'path_type'], 'education'],
							0,
							-1 // fallback for bridge/other
						]
					}
				},
				'waterway'
			);

			// Add path highlight layer
			this.map.addLayer(
				{
					id: 'path-highlight-layer',
					type: 'line',
					source: 'path-source',
					layout: {
						'line-cap': 'square',
						'line-round-limit': 1
					},
					paint: {
						'line-color': [
							'case',
							['==', ['get', 'path_type'], 'education'],
							'#C88534',
							['==', ['get', 'path_type'], 'health'],
							'#A64535',
							['==', ['get', 'path_type'], 'market'],
							'#6E3A86',
							['==', ['get', 'path_type'], 'bridge'],
							'#FF6B6B',
							'#FF6B6B' // fallback color
						],
						'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.2, 15, 5],
						'line-dasharray': [0.2, 2],
						'line-offset': [
							'case',
							['==', ['get', 'path_type'], 'health'],
							1,
							['==', ['get', 'path_type'], 'market'],
							-1,
							['==', ['get', 'path_type'], 'education'],
							0,
							-1 // fallback for bridge/other
						],
						'line-opacity': 1
					},
					filter: ['==', ['get', 'highlighted'], true]
				},
				'waterway'
			);
		} catch (error) {
			console.error('Error initializing path layers:', error);
		}
	}

	async displayPathsForHex(h3Index) {
		if (!h3Index) {
			console.warn('No h3_index provided for path display');
			return;
		}

		try {
			console.log('Fetching paths for hex:', h3Index);

			// Query paths for the selected hex
			const response = await authFetch(`/api/paths?h3_index=${encodeURIComponent(h3Index)}`);

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Error fetching path data:', errorData);
				return;
			}

			const pathData = await response.json();
			console.log('Path data received:', pathData);

			// Update current paths
			this.currentPaths = pathData.paths || [];

			// Convert path data to GeoJSON features
			const features = this.currentPaths.map((path, index) => {
				let geometry;

				// Use the GeoJSON geometry returned by ST_AsGeoJSON
				if (path.geojson_geometry) {
					try {
						geometry = JSON.parse(path.geojson_geometry);
					} catch (e) {
						console.warn('Failed to parse geojson_geometry:', e);
						geometry = {
							type: 'LineString',
							coordinates: []
						};
					}
				} else {
					console.warn('No geojson_geometry found for path:', path);
					geometry = {
						type: 'LineString',
						coordinates: []
					};
				}

				return {
					type: 'Feature',
					properties: {
						h3_index: path.h3_index,
						destination_index: path.destination_index,
						path_id: `${path.h3_index}-${path.destination_index}`,
						highlighted: false,
						path_type: path.path_type || 'default'
					},
					geometry: geometry
				};
			});

			// Update the map source with new path data
			this.map.getSource('path-source').setData({
				type: 'FeatureCollection',
				features: features
			});

			console.log(`Displayed ${features.length} paths for hex ${h3Index}`);
		} catch (error) {
			console.error('Failed to display paths for hex:', error);
		}
	}

	async displayPathsForDestination(destinationIndex) {
		if (!destinationIndex) {
			console.warn('No destination_index provided for path display');
			return;
		}

		try {
			console.log('Fetching paths for destination:', destinationIndex);

			// Query paths for the selected destination
			const response = await authFetch(
				`/api/paths?destination_index=${encodeURIComponent(destinationIndex)}`
			);

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Error fetching path data:', errorData);
				return;
			}

			const pathData = await response.json();
			console.log('Path data received:', pathData);

			// Update current paths
			this.currentPaths = pathData.paths || [];

			// Convert path data to GeoJSON features
			const features = this.currentPaths.map((path, index) => {
				let geometry;

				// Use the GeoJSON geometry returned by ST_AsGeoJSON
				if (path.geojson_geometry) {
					try {
						geometry = JSON.parse(path.geojson_geometry);
					} catch (e) {
						console.warn('Failed to parse geojson_geometry:', e);
						geometry = {
							type: 'LineString',
							coordinates: []
						};
					}
				} else {
					console.warn('No geojson_geometry found for path:', path);
					geometry = {
						type: 'LineString',
						coordinates: []
					};
				}

				return {
					type: 'Feature',
					properties: {
						h3_index: path.h3_index,
						destination_index: path.destination_index,
						path_id: `${path.h3_index}-${path.destination_index}`,
						highlighted: false,
						path_type: path.path_type || 'default'
					},
					geometry: geometry
				};
			});

			// Update the map source with new path data
			this.map.getSource('path-source').setData({
				type: 'FeatureCollection',
				features: features
			});

			console.log(`Displayed ${features.length} paths for destination ${destinationIndex}`);
		} catch (error) {
			console.error('Failed to display paths for destination:', error);
		}
	}

	highlightPath(pathId) {
		if (!this.map.getSource('path-source')) return;

		// Get current data
		const currentData = this.map.getSource('path-source')._data;

		// Update highlighted property
		const updatedFeatures = currentData.features.map((feature) => ({
			...feature,
			properties: {
				...feature.properties,
				highlighted: feature.properties.path_id === pathId
			}
		}));

		// Update the source with highlighted path
		this.map.getSource('path-source').setData({
			type: 'FeatureCollection',
			features: updatedFeatures
		});
	}

	clearHighlight() {
		if (!this.map.getSource('path-source')) return;

		// Get current data
		const currentData = this.map.getSource('path-source')._data;

		// Clear all highlights
		const updatedFeatures = currentData.features.map((feature) => ({
			...feature,
			properties: {
				...feature.properties,
				highlighted: false
			}
		}));

		// Update the source
		this.map.getSource('path-source').setData({
			type: 'FeatureCollection',
			features: updatedFeatures
		});
	}

	clearPaths() {
		if (!this.map.getSource('path-source')) return;

		// Clear all paths
		this.map.getSource('path-source').setData({
			type: 'FeatureCollection',
			features: []
		});

		this.currentPaths = [];
		console.log('Cleared all paths');
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('path-highlight-layer')) {
			this.map.removeLayer('path-highlight-layer');
		}

		if (this.map.getLayer('path-layer')) {
			this.map.removeLayer('path-layer');
		}

		if (this.map.getSource('path-source')) {
			this.map.removeSource('path-source');
		}
	}

	// Method to update path styling based on destination type
	updatePathStyling(destinationType = 'default') {
		// This method is kept for compatibility with existing layer managers
		// but the styling is now handled automatically by the path_type property from the database
		console.log(`Path styling updated for destination type: ${destinationType}`);
	}
}
