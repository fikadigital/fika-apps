<script>
	import ImpactMap from '$lib/components/impactmap/ImpactMap.svelte';
	import ImpactMapControls from '$lib/components/impactmap/ImpactMapControls.svelte';
	import UserInitial from '$lib/components/UserInitial.svelte';
	import SideNav from '$lib/components/SideNav.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import HexDataPanel from '$lib/components/HexDataPanel.svelte';
	import PrintDialog from '$lib/components/impactmap/PrintDialog.svelte';
	import { PrintSolid } from 'svelte-awesome-icons';
	import { printState } from '$lib/utils/state.svelte.js';

	const printNavItems = [
		{
			icon: PrintSolid,
			label: 'Print & export',
			action: () => (printState.open = true),
			isActive: () => printState.open
		}
	];
</script>

<svelte:head>
	<title>Impact Map</title>
	<meta
		name="description"
		content="Explore the impact that trail bridges have on communities across 6 countries in Africa" />
	<meta property="og:image" content="https://apps.fikamap.com/waternet-magma-5.png" />
	<meta name="twitter:image" content="https://apps.fikamap.com/waternet-magma-5.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="726" />
</svelte:head>

<div class="relative h-screen w-full overflow-hidden">
	<!-- Map container -->
	<div class="absolute inset-0">
		<ImpactMap />
	</div>

	<div class="absolute left-16 top-[150px] z-40">
		<ControlPanel>
			<ImpactMapControls />
		</ControlPanel>
	</div>

	<!-- Hex Data Panel on the right side -->
	<HexDataPanel />

	<div class="absolute right-4 top-4 z-40">
		<UserInitial />
	</div>

	<SideNav items={printNavItems} />

	<PrintDialog />
</div>
