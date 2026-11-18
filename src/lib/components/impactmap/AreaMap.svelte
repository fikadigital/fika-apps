<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { boundsOf } from '$lib/utils/impactmap/boundaryTree.js';

	/**
	 * A small map that draws one area's outline and zooms to it.
	 * @type {{ feature: object | null }}
	 */
	let { feature = null } = $props();

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
			ready = true;
		});
		return () => map.remove();
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
