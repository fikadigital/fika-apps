<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';

	const MAPBOX_TOKEN =
		'pk.eyJ1IjoiYnJpZGdlc3RvcHJvc3Blcml0eSIsImEiOiJjbG51aHV6MDEwZDI1Mmx0MzhqcHFvb3BuIn0.wgSlMp8cyuIYVMvj_p-Ojg';

	let mapContainer;
	let map;

	onMount(() => {
		mapboxgl.accessToken = MAPBOX_TOKEN;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/bridgestoprosperity/cltoqnr9y01cg01oihr9d3yqh',
			center: [36.817223, -1.286389],
			zoom: 12
		});

		map.addControl(new mapboxgl.NavigationControl());

		return () => {
			map.remove();
		};
	});
</script>

<svelte:head>
	<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet" />
</svelte:head>

<div bind:this={mapContainer} class="map-container" />

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
