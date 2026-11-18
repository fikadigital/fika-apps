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
			map.addSource('area', { type: 'geojson', data: EMPTY });
			map.addLayer({
				id: 'area-fill',
				type: 'fill',
				source: 'area',
				paint: { 'fill-color': '#009149', 'fill-opacity': 0.25 }
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
