<script>
	import { onMount, onDestroy } from 'svelte';
	import { MapController } from '$lib/services/impactmap/MapController.svelte.js';
	import { mapRegistry } from '$lib/services/impactmap/mapRegistry.svelte.js';

	let mapContainer;
	let mapController;

	onMount(() => {
		console.log('Mounting ImpactMap component');
		mapController = new MapController(mapContainer);
		mapRegistry.controller = mapController;
	});

	onDestroy(() => {
		if (mapController) {
			mapRegistry.controller = null;
			mapController.cleanup();
		}
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="absolute inset-0 h-full w-full"></div>
</div>
