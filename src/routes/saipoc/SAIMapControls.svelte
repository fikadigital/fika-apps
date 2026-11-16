<script>
	import { saiMapState } from '$lib/utils/state.svelte.js';

	const destinations = [
		{
			value: 'travel_time_no_sites_all_education',
			label: 'Education',
			description: 'Walking time to the nearest school'
		},
		{
			value: 'travel_time_no_sites_all_health',
			label: 'Healthcare',
			description: 'Walking time to the nearest health facility'
		},
		{
			value: 'travel_time_no_sites_semi_dense_urban',
			label: 'Market',
			description: 'Walking time to the nearest market or population center'
		},
		{
			value: 'travel_time_no_sites_major_roads',
			label: 'Nearest Road',
			description: 'Walking time to the nearest major road'
		}
	];

	const SAS_COLORS = ['#1a9641', '#a6d96a', '#fdae61', '#d7191c'];

	const SAS_BINS = {
		travel_time_no_sites_all_education:    [30, 45, 60],
		travel_time_no_sites_all_health:       [45, 90, 135],
		travel_time_no_sites_semi_dense_urban: [60, 120, 180],
		travel_time_no_sites_major_roads:      [60, 120, 180]
	};

	function formatMin(m) {
		if (m >= 60) {
			const h = Math.floor(m / 60);
			const rem = m % 60;
			return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
		}
		return `${m} min`;
	}

	let legendItems = $derived.by(() => {
		const bins = SAS_BINS[saiMapState.selectedViz];
		if (!bins) return [];
		return [
			{ color: SAS_COLORS[0], label: `< ${formatMin(bins[0])}` },
			{ color: SAS_COLORS[1], label: `${formatMin(bins[0])} – ${formatMin(bins[1])}` },
			{ color: SAS_COLORS[2], label: `${formatMin(bins[1])} – ${formatMin(bins[2])}` },
			{ color: SAS_COLORS[3], label: `> ${formatMin(bins[2])}` }
		];
	});
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="border-b border-white/20 pb-3">
		<p class="text-base font-bold leading-tight">Safe Access Scorecard</p>
		<p class="mt-0.5 text-xs font-normal opacity-70">
			Prototype — Walking time to essential services
		</p>
	</div>

	<!-- Destination selector -->
	<div>
		<p class="mb-2 text-sm font-semibold">Walking time to:</p>
		<div class="flex flex-col gap-2">
			{#each destinations as dest}
				<button
					class="destination-btn w-full rounded-lg border px-3 py-2 text-left transition-all"
					class:active={saiMapState.selectedViz === dest.value}
					onclick={() => (saiMapState.selectedViz = dest.value)}>
					<p class="text-sm font-semibold leading-tight">{dest.label}</p>
					<p class="mt-0.5 text-xs opacity-70">{dest.description}</p>
				</button>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="border-t border-white/20 pt-3">
		<p class="mb-2 text-sm font-semibold">Walking time</p>
		<div class="space-y-1.5">
			{#each legendItems as item}
				<div class="flex items-center gap-2">
					<div class="legend-swatch shrink-0" style="background: {item.color};"></div>
					<span class="text-xs opacity-80">{item.label}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.destination-btn {
		background-color: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.destination-btn:hover {
		background-color: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.destination-btn.active {
		background-color: rgba(0, 145, 73, 0.3);
		border-color: #009149;
	}

	.legend-swatch {
		width: 14px;
		height: 14px;
		border-radius: 3px;
	}
</style>
