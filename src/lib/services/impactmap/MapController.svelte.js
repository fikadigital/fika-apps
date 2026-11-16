// src/lib/services/map/MapController.svelte.js
import mapboxgl from 'mapbox-gl';
import { PmTilesSource } from 'mapbox-pmtiles';
import { impactMapState } from '$lib/utils/state.svelte';
import { HexLayerManager } from './HexLayerManager.svelte.js';
import { RasterLayerManager } from './RasterLayerManager.svelte.js';
import { BridgeLayerManager } from './BridgeLayerManager.svelte.js';
import { HealthLayerManager } from './HealthLayerManager.svelte.js';
import { EduLayerManager } from './EduLayerManager.svelte.js';
import { PathLayerManager } from './PathLayerManager.svelte.js';
import { WaternetLayerManager } from './WaternetLayerManager.svelte.js';

export class MapController {
	// Initialize state as class fields
	mapLoaded = $state(false);
	styleLoaded = $state(false);
	currentDataKey = $state('');

	// Map instance
	map = null;

	// Layer managers
	hexLayerManager = null;
	rasterLayerManager = null;
	bridgeLayerManager = null;
	healthLayerManager = null;
	eduLayerManager = null;
	pathLayerManager = null;
	waternetLayerManager = null;

	constructor(container) {
		// Initialize map
		console.log('Initializing MapController');
		mapboxgl.accessToken =
			'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbTVyaGcweGswYWpzMnhxMjRyZHhtMGh0In0.4YOL9xCKxxQ0u2wZ7AlNMg';

		try {
			mapboxgl.Style.setSourceType(PmTilesSource.SOURCE_TYPE, PmTilesSource);
		} catch (err) {
			console.warn('PmTilesSource type already registered:', err);
		}

		this.map = new mapboxgl.Map({
			container: container,
			style: 'mapbox://styles/bridgestoprosperity/cm8nlprgt001j01snclz4henr',
			center: [26.19, -0.21],
			zoom: 3,
			hash: true
		});

		// Setup layer managers
		this.rasterLayerManager = new RasterLayerManager(this.map);
		this.waternetLayerManager = new WaternetLayerManager(this.map);

		// Initialize hex layer manager first
		this.hexLayerManager = new HexLayerManager(this.map);

		// Initialize path layer manager
		this.pathLayerManager = new PathLayerManager(this.map);

		// Initialize other layer managers with references to hex layer manager for reverse filtering
		this.bridgeLayerManager = new BridgeLayerManager(this.map, this.hexLayerManager);
		this.healthLayerManager = new HealthLayerManager(this.map, this.hexLayerManager);
		this.eduLayerManager = new EduLayerManager(this.map, this.hexLayerManager);

		// Set references to other managers in hex layer manager for forward filtering
		this.hexLayerManager.bridgeLayerManager = this.bridgeLayerManager;
		this.hexLayerManager.healthLayerManager = this.healthLayerManager;
		this.hexLayerManager.eduLayerManager = this.eduLayerManager;
		this.hexLayerManager.pathLayerManager = this.pathLayerManager;

		// Set path layer manager references in infrastructure managers
		this.bridgeLayerManager.pathLayerManager = this.pathLayerManager;
		this.healthLayerManager.pathLayerManager = this.pathLayerManager;
		this.eduLayerManager.pathLayerManager = this.pathLayerManager;

		// Setup event handlers
		this.setupEventHandlers();

		// Setup reactivity
		this.setupReactivity();
		// console.log the map style sheet from the map box map
	}

	get mapReady() {
		return this.mapLoaded && this.styleLoaded;
	}

	setupEventHandlers() {
		// Track when map loads
		this.map.on('load', () => {
			this.mapLoaded = true;
		});

		// Track when style loads
		this.map.on('style.load', async () => {
			console.log('Style loaded');
			this.styleLoaded = true;

			// Add navigation control
			const nav = new mapboxgl.NavigationControl({
				visualizePitch: true
			});
			this.map.addControl(nav, 'bottom-right');

			// Initialize hex layers first
			await this.hexLayerManager.initialize();

			// Waternet layer renders beneath the hex layer, so it must be inserted
			// after hex exists. No cross-filter dependency on path/bridge/health/edu,
			// so kick it off in parallel with those rather than awaiting it here.
			this.waternetLayerManager
				.initialize()
				.catch((err) => console.error('Error initializing waternet layer:', err));

			// Initialize path layers
			await this.pathLayerManager.initialize();

			// Initialize bridge layers
			await this.bridgeLayerManager.initialize();

			// Initialize health layers
			await this.healthLayerManager.initialize();

			// Initialize education layers
			await this.eduLayerManager.initialize();

			// Initial setup once style is loaded
			if (impactMapState.dataMapKey) {
				setTimeout(() => this.updateLayers(), 100);
			}
			// Global click handler that prioritizes infrastructure over hex
			this.map.on('click', (e) => {
				// Check for infrastructure clicks first (in order of priority)
				const bridgeFeatures = this.map.queryRenderedFeatures(e.point, {
					layers: ['bridge-layer', 'bridge-hover-layer']
				});

				const healthFeatures = this.map.queryRenderedFeatures(e.point, {
					layers: ['health-layer', 'health-hover-layer']
				});

				const eduFeatures = this.map.queryRenderedFeatures(e.point, {
					layers: ['edu-layer', 'edu-hover-layer']
				});

				// Handle infrastructure clicks (prevent hex handling)
				if (bridgeFeatures.length > 0) {
					console.log('Bridge clicked - preventing hex handler');
					this.bridgeLayerManager.handleBridgeClick(e);
					return; // Stop here, don't handle hex
				}

				if (healthFeatures.length > 0) {
					console.log('Health facility clicked - preventing hex handler');
					this.healthLayerManager.handleHealthClick(e);
					return; // Stop here, don't handle hex
				}

				if (eduFeatures.length > 0) {
					console.log('Education facility clicked - preventing hex handler');
					this.eduLayerManager.handleEduClick(e);
					return; // Stop here, don't handle hex
				}

				// No infrastructure clicked, check for hex
				const hexFeatures = this.map.queryRenderedFeatures(e.point, {
					layers: ['hex-layer']
				});

				if (hexFeatures.length > 0) {
					this.hexLayerManager.handleHexClick(e);
				} else if (impactMapState.filterMode) {
					// Clicked on empty area while in filter mode - reset filters
					this.hexLayerManager.resetInfrastructureFilter();
				} else if (impactMapState.reverseFilterMode) {
					// Clicked on empty area while in reverse filter mode - reset reverse filters
					this.hexLayerManager.resetReverseInfrastructureFilter();
				}
			});

			// Setup hover handlers for hex
			this.map.on('mousemove', 'hex-layer', (e) => {
				this.hexLayerManager.handleHexHover(e);
			});

			this.map.on('mouseleave', 'hex-layer', (e) => {
				this.hexLayerManager.handleHexHover(e);
			});

			// Setup hover handlers for bridges (both base and hover layers)
			this.map.on('mousemove', 'bridge-layer', (e) => {
				this.bridgeLayerManager.handleBridgeHover(e);
			});

			this.map.on('mousemove', 'bridge-hover-layer', (e) => {
				this.bridgeLayerManager.handleBridgeHover(e);
			});

			this.map.on('mouseleave', 'bridge-layer', (e) => {
				this.bridgeLayerManager.handleBridgeHover(e);
			});

			this.map.on('mouseleave', 'bridge-hover-layer', (e) => {
				this.bridgeLayerManager.handleBridgeHover(e);
			});

			// Setup hover handlers for health facilities (both base and hover layers)
			this.map.on('mousemove', 'health-layer', (e) => {
				this.healthLayerManager.handleHealthHover(e);
			});

			this.map.on('mousemove', 'health-hover-layer', (e) => {
				this.healthLayerManager.handleHealthHover(e);
			});

			this.map.on('mouseleave', 'health-layer', (e) => {
				this.healthLayerManager.handleHealthHover(e);
			});

			this.map.on('mouseleave', 'health-hover-layer', (e) => {
				this.healthLayerManager.handleHealthHover(e);
			});

			// Setup hover handlers for education facilities (both base and hover layers)
			this.map.on('mousemove', 'edu-layer', (e) => {
				this.eduLayerManager.handleEduHover(e);
			});

			this.map.on('mousemove', 'edu-hover-layer', (e) => {
				this.eduLayerManager.handleEduHover(e);
			});

			this.map.on('mouseleave', 'edu-layer', (e) => {
				this.eduLayerManager.handleEduHover(e);
			});

			this.map.on('mouseleave', 'edu-hover-layer', (e) => {
				this.eduLayerManager.handleEduHover(e);
			});
		});
	}

	setupReactivity() {
		// Log state changes for debugging
		$effect(() => {
			console.log(
				'Map tracking state change:',
				impactMapState.dataMapKey,
				'(current:',
				this.currentDataKey,
				')'
			);
		});

		// Watch for changes to impactMapState.dataMapKey
		$effect(() => {
			const dataKey = impactMapState.dataMapKey;

			// Only proceed if data key is valid and different from current
			if (dataKey && dataKey !== this.currentDataKey) {
				console.log('Data key changed to:', dataKey);

				// Update map if it's ready
				if (this.mapReady) {
					console.log('Map ready, updating visualization');
					// Use setTimeout to ensure this runs after current execution
					setTimeout(() => this.updateLayers(), 0);
				} else {
					console.log('Map not ready yet, update will happen when map loads');
				}
			}
		});
	}

	updateLayers() {
		const dataKey = impactMapState.dataMapKey;

		try {
			console.log('Updating map visualization for dataKey:', dataKey);

			// Update hex layer
			this.hexLayerManager.updateLayer(dataKey);

			// Update raster layer
			this.rasterLayerManager.updateLayer(dataKey);

			// Update current data key to track changes
			this.currentDataKey = dataKey;
			console.log('Update complete, currentDataKey is now:', this.currentDataKey);
		} catch (error) {
			console.error('Error updating map visualization:', error);
		}
		console.log('Current map style:', this.map.getStyle());
	}

	cleanup() {
		if (this.map) {
			console.log('Cleaning up map');
			this.map.remove();
		}
	}
}
