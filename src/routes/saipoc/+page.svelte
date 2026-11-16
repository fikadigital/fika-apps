<script>
	import SAIMap from './SAIMap.svelte';
	import SAIMapControls from './SAIMapControls.svelte';
	import SASTour from './SASTour.svelte';
	import SideNav from '$lib/components/SideNav.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import { saiMapState } from '$lib/utils/state.svelte.js';
	import { PlaySolid } from 'svelte-awesome-icons';

	let saiMapRef;

	function startTour() {
		saiMapState.tourActive = true;
	}
</script>

<svelte:head>
	<title>Safe Access Scorecard</title>
	<meta
		name="description"
		content="Fika's Safe Access Scorecard — interactive prototype measuring walking time to essential services for rural communities" />
	<meta property="og:image" content="https://apps.fikamap.com/waternet-magma-5.png" />
	<meta name="twitter:image" content="https://apps.fikamap.com/waternet-magma-5.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="726" />
</svelte:head>

<div class="relative h-screen w-full overflow-hidden">
	<div class="absolute inset-0">
		<SAIMap bind:this={saiMapRef} />
	</div>

	{#if !saiMapState.tourActive}
		<div class="top-right-buttons">
			<button onclick={startTour} class="start-tour-btn">
				<PlaySolid size="14" />
				<span>Start Tour</span>
			</button>
		</div>
	{/if}

	{#if !saiMapState.tourActive}
		<div class="absolute left-16 top-[150px] z-40" style="max-height: calc(100vh - 170px); display: flex; flex-direction: column;">
			<ControlPanel>
				<SAIMapControls />
			</ControlPanel>
		</div>
	{/if}

	<SASTour getMap={() => saiMapRef?.getMap?.()} />

	<SideNav />
</div>

<style>
	.top-right-buttons {
		position: absolute;
		top: 20px;
		right: 20px;
		z-index: 45;
	}

	.start-tour-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: rgba(0, 145, 73, 0.95);
		backdrop-filter: blur(8px);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		font-family: 'Kumbh Sans', sans-serif;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(0, 145, 73, 0.3);
	}

	.start-tour-btn:hover {
		background: rgba(0, 122, 61, 0.98);
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(0, 145, 73, 0.4);
	}

	.start-tour-btn:active {
		transform: translateY(0);
	}
</style>
