<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { boundsOf } from '$lib/utils/impactmap/boundaryTree.js';
	import { BRIDGE_TIERS } from '$lib/utils/impactmap/areaBridges.js';

	/**
	 * A small map that draws one area's outline and zooms to it, with bridges on top.
	 * `bridgeMode` 'all' clusters the points (the counts split apart as you zoom in);
	 * 'ranked' draws each point coloured by its rank band (`properties.tier`).
	 * @type {{ feature: object | null, bridges?: object | null, bridgeMode?: 'all' | 'ranked' }}
	 */
	let { feature = null, bridges = null, bridgeMode = 'all' } = $props();

	const EMPTY = { type: 'FeatureCollection', features: [] };

	let container;
	let map;
	let ready = $state(false);

	onMount(() => {
		map = new mapboxgl.Map({
			container,
			style: 'mapbox://styles/mapbox/light-v11',
			center: [20, 2],
			zoom: 2,
			attributionControl: true
		});
		map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
		map.on('load', () => {
			// Relief shading from Mapbox's terrain data, under the water layer so lakes and rivers
			// stay on top. Stronger when zoomed out, where the relief is otherwise too subtle.
			map.addSource('terrain-dem', {
				type: 'raster-dem',
				url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
				tileSize: 512,
				maxzoom: 14
			});
			map.addLayer(
				{
					id: 'hillshade',
					type: 'hillshade',
					source: 'terrain-dem',
					paint: {
						'hillshade-exaggeration': [
							'interpolate',
							['linear'],
							['zoom'],
							4,
							0.9,
							8,
							0.65,
							12,
							0.45
						],
						'hillshade-illumination-direction': 315,
						'hillshade-shadow-color': '#3f4654',
						'hillshade-highlight-color': '#ffffff',
						'hillshade-accent-color': '#8a93a1'
					}
				},
				map.getLayer('water') ? 'water' : undefined
			);

			map.addSource('area', { type: 'geojson', data: EMPTY });
			map.addLayer({
				id: 'area-fill',
				type: 'fill',
				source: 'area',
				paint: { 'fill-color': '#009149', 'fill-opacity': 0.18 }
			});
			map.addLayer({
				id: 'area-line',
				type: 'line',
				source: 'area',
				paint: { 'line-color': '#161345', 'line-width': 2 }
			});

			// All bridges: Mapbox clusters the points itself, so the circles aggregate at wide
			// scales and break up into single bridges as the user zooms in.
			map.addSource('bridges-all', {
				type: 'geojson',
				data: EMPTY,
				cluster: true,
				clusterMaxZoom: 11,
				clusterRadius: 45
			});
			map.addLayer({
				id: 'bridge-clusters',
				type: 'circle',
				source: 'bridges-all',
				filter: ['has', 'point_count'],
				paint: {
					'circle-color': [
						'step',
						['get', 'point_count'],
						'#7cc5a3',
						100,
						'#33a37a',
						500,
						'#009149'
					],
					'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 500, 23],
					'circle-stroke-width': 2,
					'circle-stroke-color': '#ffffff'
				}
			});
			map.addLayer({
				id: 'bridge-cluster-count',
				type: 'symbol',
				source: 'bridges-all',
				filter: ['has', 'point_count'],
				layout: {
					'text-field': ['get', 'point_count_abbreviated'],
					'text-size': 12,
					'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
				},
				paint: { 'text-color': '#ffffff' }
			});
			map.addLayer({
				id: 'bridge-points',
				type: 'circle',
				source: 'bridges-all',
				filter: ['!', ['has', 'point_count']],
				paint: {
					'circle-color': '#161345',
					'circle-radius': 4,
					'circle-stroke-width': 1.5,
					'circle-stroke-color': '#ffffff'
				}
			});

			// Top-ranked bridges: no clustering, coloured by rank band, bigger for better bands.
			map.addSource('bridges-ranked', { type: 'geojson', data: EMPTY });
			map.addLayer({
				id: 'bridge-ranked',
				type: 'circle',
				source: 'bridges-ranked',
				paint: {
					'circle-color': [
						'match',
						['get', 'tier'],
						...BRIDGE_TIERS.flatMap((t, i) => [i, t.color]),
						'#6b7280'
					],
					'circle-radius': ['match', ['get', 'tier'], 0, 8, 1, 7, 2, 6, 3, 5, 4, 4, 4],
					'circle-stroke-width': 1.5,
					'circle-stroke-color': '#ffffff'
				}
			});

			// Click a cluster to zoom in until it breaks apart.
			map.on('click', 'bridge-clusters', (e) => {
				const hit = map.queryRenderedFeatures(e.point, { layers: ['bridge-clusters'] })[0];
				map
					.getSource('bridges-all')
					.getClusterExpansionZoom(hit.properties.cluster_id, (error, zoom) => {
						if (!error) map.easeTo({ center: hit.geometry.coordinates, zoom: zoom + 0.5 });
					});
			});
			map.on('mouseenter', 'bridge-clusters', () => (map.getCanvas().style.cursor = 'pointer'));
			map.on('mouseleave', 'bridge-clusters', () => (map.getCanvas().style.cursor = ''));

			ready = true;
		});
		return () => map.remove();
	});

	// Show the bridges in whichever of the two styles is asked for; the other source stays empty.
	$effect(() => {
		if (!ready) return;
		map.getSource('bridges-all').setData(bridgeMode === 'all' && bridges ? bridges : EMPTY);
		map.getSource('bridges-ranked').setData(bridgeMode === 'ranked' && bridges ? bridges : EMPTY);
	});

	// Draw the outline and zoom to it whenever the area changes.
	$effect(() => {
		if (!ready) return;
		map.getSource('area').setData(feature ?? EMPTY);
		if (feature?.geometry) {
			map.fitBounds(boundsOf(feature.geometry), { padding: 24, maxZoom: 12, duration: 600 });
		}
	});
</script>

<div bind:this={container} class="h-full min-h-[260px] w-full"></div>
