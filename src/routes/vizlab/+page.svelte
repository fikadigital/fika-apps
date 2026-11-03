<script>
	import VizLabMap from './VizLabMap.svelte';
	import VizLabControls from './VizLabControls.svelte';
	import SideNav from '$lib/components/SideNav.svelte';
	import { generalState } from '$lib/utils/state.svelte';
</script>

<svelte:head>
	<title>Viz Lab</title>
	<meta
		name="description"
		content="An experimental playground for styling vector and raster map data" />
</svelte:head>

<div class="relative h-screen w-full overflow-hidden">
	<div class="absolute inset-0">
		<VizLabMap />
	</div>

	<!-- Controls: wider than the shared ControlPanel so color-stop rows fit -->
	<div
		class="absolute bottom-4 left-16 top-[100px] z-40 flex w-[360px] max-w-[calc(100vw-5rem)] flex-col rounded-r-xl border border-white/40 bg-white/85 shadow-lg backdrop-blur transition-transform duration-300"
		class:-translate-x-[420px]={!generalState.controlPanelOpen}>
		<div class="flex shrink-0 items-center justify-between px-3 pt-2">
			<p class="text-lg font-bold">Viz Lab</p>
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => (generalState.controlPanelOpen = false)}
				aria-label="Close panel">&times;</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto p-2">
			<VizLabControls />
		</div>
	</div>

	<SideNav />
</div>
