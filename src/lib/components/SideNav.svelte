<script>
	import { SlidersSolid, MapSolid, HouseSolid, CircleInfoSolid } from 'svelte-awesome-icons';
	import b2pLogo from '$lib/images/b2plogo.png';
	import { generalState } from '$lib/utils/state.svelte';

	// Accept additional items through props with a default empty array
	let { items = [] } = $props();

	// Define default navigation items
	const defaultItems = [
		{
			icon: HouseSolid,
			label: 'Home',
			action: () => (window.location.href = '/')
		},
		{
			icon: SlidersSolid,
			label: 'Controls',
			action: () => (generalState.controlPanelOpen = !generalState.controlPanelOpen),
			isActive: () => generalState.controlPanelOpen
		},
		{
			icon: CircleInfoSolid,
			label: 'Info',
			action: () => (window.location.href = 'https://public-b2p-geodata.s3.us-east-1.amazonaws.com/research/AGU_2025_poster.pdf')
		}
	];

	// Combine default items with any additional items passed as props
	const navItems = $derived([...defaultItems, ...items]);
</script>

<aside class="fixed left-0 top-0 z-50 h-screen w-16 bg-white/30 backdrop-blur-sm">
	<div class="relative h-full">
		<!-- Logo Section -->
		<div class="flex h-20 items-center justify-center border-b border-gray-700/30">
			<a
				href="https://fika.org"
				target="_blank"
				class="flex items-center justify-center">
				<img src={b2pLogo} alt="B2P Logo" class="h-10 w-10 transition-transform hover:scale-110" />
			</a>
		</div>

		<nav class="mt-6 flex flex-col items-center gap-4">
			{#each navItems as item}
				<button
					class="group relative flex h-12 w-12 items-center justify-center text-secondary transition-all hover:scale-110"
					class:bg-foggy={item.isActive?.()}
					class:rounded-xl={item.isActive?.()}
					onclick={item.action}>
					<item.icon class="h-6 w-6" />
					<span
						class="absolute left-full ml-4 hidden rounded-md bg-gray-900 px-2 py-1 text-sm text-white group-hover:block">
						{item.label}
					</span>
				</button>
			{/each}
		</nav>
	</div>
</aside>

<style>
	.bg-foggy {
		backdrop-filter: blur(10px);
		background: radial-gradient(circle, #16143c2e 0%, rgba(0, 181, 112, 0) 100%);
	}
</style>
