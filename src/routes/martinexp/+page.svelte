<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';

	const MAPBOX_TOKEN =
		'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbG51aHV6MDEwZDI1Mmx0MzhqcHFvb3BuIn0.wgSlMp8cyuIYVMvj_p-Ojg';

	const MARTIN_URL = 'http://98.81.113.158:3000';

	let mapContainer;
	let map;

	// The column the map should request. Mutate this from a dropdown later.
	let currentColumn = 'rwi';

	onMount(() => {
		mapboxgl.accessToken = MAPBOX_TOKEN;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/light-v11',
			center: [26.19, -0.21],
			zoom: 4,
			hash: true,
			transformRequest: (url, resourceType) => {
				if (resourceType === 'Tile' && url.includes('/hex_tiles/')) {
					const sep = url.includes('?') ? '&' : '?';
					return { url: `${url}${sep}column=${encodeURIComponent(currentColumn)}` };
				}
				return { url };
			}
		});

		map.addControl(new mapboxgl.NavigationControl());

		map.on('load', () => {
			map.addSource('martin-hex', {
				type: 'vector',
				tiles: [`${MARTIN_URL}/hex_tiles/{z}/{x}/{y}`],
				minzoom: 8,
				maxzoom: 22
			});

			map.addLayer({
				id: 'hex-fill',
				type: 'fill',
				source: 'martin-hex',
				'source-layer': 'hex_tiles',
				minzoom: 8,
				maxzoom: 22,
				paint: {
					'fill-color': [
						'interpolate',
						['linear'],
						['coalesce', ['to-number', ['get', 'value']], 0],
						-0.778, '#d7191c',
						-0.389, '#fdae61',
						0,      '#ffffbf',
						0.166,  '#a6d96a',
						0.332,  '#1a9641'
					],
					'fill-opacity': 0.8
				}
			});

			map.addLayer({
				id: 'hex-outline',
				type: 'line',
				source: 'martin-hex',
				'source-layer': 'hex_tiles',
				minzoom: 8,
				maxzoom: 22,
				paint: {
					'line-color': '#ffffff',
					'line-opacity': 0.15,
					'line-width': 0.5
				}
			});

			map.on('click', 'hex-fill', (e) => {
				const features = map.queryRenderedFeatures(e.point, { layers: ['hex-fill'] });
				if (!features.length) return;
				const feature = features[0];
				const description = `properties: ${JSON.stringify(feature.properties)}`;
				new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(description).addTo(map);
			});
		});

		return () => {
			map?.remove();
		};
	});
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
	.map-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		height: 100vh;
		z-index: 0;
	}
</style>
