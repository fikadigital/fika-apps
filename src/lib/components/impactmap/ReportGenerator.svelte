<script>
	import { untrack } from 'svelte';
	import { XmarkSolid } from 'svelte-awesome-icons';
	import { reportState } from '$lib/utils/state.svelte.js';
	import { mapRegistry } from '$lib/services/impactmap/mapRegistry.svelte.js';
	import { countryAt } from '$lib/utils/impactmap/countryLookup.js';
	import { fetchHierarchy, fetchShape, dropdownLevels } from '$lib/utils/impactmap/boundaryTree.js';
	import {
		fetchAreaBridges,
		fetchRankedBridges,
		cachedRankedBridges,
		warmRankedBridges
	} from '$lib/utils/impactmap/areaBridges.js';
	import AreaMap from './AreaMap.svelte';
	import BridgeSpectrum from './BridgeSpectrum.svelte';
	import FilterSection from './FilterSection.svelte';

	/** @type {'idle' | 'loading' | 'ready' | 'error'} */
	let status = $state('idle');
	/** @type {{ name: string, code: string, code3: string } | null} */
	let country = $state(null);

	/** @type {'idle' | 'loading' | 'ready' | 'none' | 'error'} */
	let treeStatus = $state('idle');
	/** @type {import('$lib/utils/impactmap/boundaryTree.js').BoundaryTree | null} */
	let tree = $state(null);
	/** The ISO code of the country `tree` belongs to. */
	let treeCode = null;
	/** The fika_id chosen at level 1, 2, ... for the country in `tree`. */
	let selected = $state([]);

	const levels = $derived(tree ? dropdownLevels(tree, selected) : []);

	// The admin level card can be folded away; its header then summarises the choice.
	let levelsOpen = $state(false);
	const levelSummary = $derived(
		levels
			.filter((l) => l.chosen)
			.map((l) => l.chosen.name)
			.join(' › ') || (country ? `${country.name} (whole country)` : '')
	);

	// The outline shown in the map card: the deepest area chosen, else the whole country.
	/** @type {'idle' | 'loading' | 'ready' | 'error'} */
	let shapeStatus = $state('idle');
	let shape = $state(null);
	const shapeId = $derived(tree ? (reportState.region?.fika_id ?? tree.country?.fika_id) : null);
	const areaLabel = $derived(
		reportState.region
			? `${reportState.region.name} (admin level ${reportState.region.level})`
			: country
				? `${country.name} (whole country)`
				: ''
	);

	// Bridges for the chosen area: every bridge (clustered on the map), or the top N by rank.
	// Bridges are only available below the country level, so nothing loads for the whole country.
	let bridgesOpen = $state(true);
	/** @type {'idle' | 'loading' | 'ready' | 'error'} */
	let bridgeStatus = $state('idle');
	/** What the map draws, set in one go so its mode and data never disagree. */
	let bridgeLayer = $state(null);
	/** Bumped by the "Try again" button so the loading effect runs once more. */
	let bridgeAttempt = $state(0);
	/** True when the API gave up because the area is too large to answer in time. */
	let bridgeTooLarge = $state(false);

	$effect(() => {
		const area = reportState.region?.fika_id ?? null;
		const top = reportState.bridgeTop;
		const weight = reportState.bridgeWeight;
		void bridgeAttempt;
		bridgeTooLarge = false;
		if (!area) {
			bridgeLayer = null;
			bridgeStatus = 'idle';
			return;
		}
		// A band picked after the top 1000 has arrived needs no request at all.
		const instant = top ? cachedRankedBridges(area, top, weight) : null;
		if (instant) {
			bridgeLayer = { mode: 'ranked', data: instant };
			bridgeStatus = 'ready';
			return;
		}
		bridgeLayer = null;
		const controller = new AbortController();
		const { signal } = controller;
		bridgeStatus = 'loading';
		(top ? fetchRankedBridges(area, top, weight, { signal }) : fetchAreaBridges(area, { signal }))
			.then((data) => {
				bridgeLayer = { mode: top ? 'ranked' : 'all', data };
				bridgeStatus = 'ready';
				// With all the bridges drawn, fetch the ranking quietly so the first band is instant.
				if (!top) warmRankedBridges(area, weight);
			})
			.catch((error) => {
				if (error.name === 'AbortError') return;
				console.error('Bridges failed:', error);
				bridgeTooLarge = error.status === 504;
				bridgeStatus = 'error';
			});
		return () => controller.abort();
	});

	const bridgeSummary = $derived.by(() => {
		if (!bridgeLayer) return '';
		const n = bridgeLayer.data.features.length.toLocaleString();
		if (bridgeLayer.mode === 'ranked') {
			const how = reportState.bridgeWeight === 'population' ? 'by population' : 'by hex count';
			return `Top ${reportState.bridgeTop} bridges, ranked ${how} (${n} shown)`;
		}
		return `${n} bridges${bridgeLayer.data.truncated ? ' (more exist than are shown)' : ''}`;
	});

	// What the map card says while it has nothing to draw yet.
	const mapMessage = $derived.by(() => {
		if (treeStatus === 'loading') return 'Loading administrative areas…';
		if (treeStatus === 'none' && !tree) return `No boundaries are held for ${country?.name}.`;
		if (treeStatus === 'error') return 'We could not load the boundaries for this country.';
		if (shapeStatus === 'loading') return 'Loading outline…';
		if (shapeStatus === 'error') return 'We could not load the outline of this area.';
		return '';
	});

	$effect(() => {
		const id = shapeId;
		if (!id) {
			shape = null;
			shapeStatus = 'idle';
			return;
		}
		const controller = new AbortController();
		shapeStatus = 'loading';
		fetchShape(id, { signal: controller.signal })
			.then((feature) => {
				shape = feature;
				shapeStatus = feature ? 'ready' : 'error';
			})
			.catch((error) => {
				if (error.name === 'AbortError') return;
				console.error('Area outline failed:', error);
				shapeStatus = 'error';
			});
		return () => controller.abort();
	});

	// Look up the country at the centre of the map each time the popup opens. The map
	// can't move while the popup covers it, so one lookup per opening is enough.
	$effect(() => {
		if (!reportState.open) return;
		const controller = new AbortController();
		untrack(() => {
			// Each time the popup opens, the admin level section starts folded.
			levelsOpen = false;
			lookup(controller.signal);
		});
		return () => controller.abort();
	});

	async function lookup(signal) {
		const map = mapRegistry.controller?.map;
		if (!map) {
			status = 'error';
			return;
		}
		status = 'loading';
		try {
			const { lng, lat } = map.getCenter().wrap();
			country = await countryAt(lng, lat, { signal });
			status = 'ready';
		} catch (error) {
			if (error.name === 'AbortError') return;
			console.error('Country lookup failed:', error);
			status = 'error';
			return;
		}
		await loadTree(signal);
	}

	async function loadTree(signal) {
		if (!country?.code3) {
			tree = null;
			treeStatus = 'idle';
			selected = [];
			reportState.region = null;
			return;
		}
		// Same country as last time: keep the tree and what the user picked.
		if (treeCode === country.code3 && treeStatus === 'ready') return;
		treeCode = country.code3;
		treeStatus = 'loading';
		selected = [];
		reportState.region = null;
		try {
			const result = await fetchHierarchy(country.code3, { signal });
			tree = result;
			treeStatus = result && result.max_level > 0 ? 'ready' : 'none';
		} catch (error) {
			if (error.name === 'AbortError') return;
			console.error('Boundaries lookup failed:', error);
			tree = null;
			treeStatus = 'error';
		}
	}

	function choose(level, fikaId) {
		selected = fikaId ? [...selected.slice(0, level - 1), fikaId] : selected.slice(0, level - 1);
		// The deepest area chosen is the region the report will be about.
		const deepest = dropdownLevels(tree, selected)
			.filter((l) => l.chosen)
			.at(-1);
		reportState.region = deepest
			? {
					level: deepest.level,
					fika_id: deepest.chosen.fika_id,
					gid: deepest.chosen.gid,
					name: deepest.chosen.name
				}
			: null;
	}

	function close() {
		reportState.open = false;
	}

	function handleKeydown(e) {
		if (reportState.open && e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if reportState.open}
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && close()}>
		<div
			class="relative flex max-h-[90vh] min-h-[320px] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="report-generator-title">
			<h2 id="report-generator-title" class="sr-only">Report generator</h2>

			<button
				class="btn btn-ghost btn-sm absolute right-3 top-3"
				onclick={close}
				aria-label="Close report generator">
				<XmarkSolid />
			</button>

			<div class="flex flex-col gap-5 overflow-y-auto p-6">
				<p class="pr-10 text-left text-lg text-secondary" aria-live="polite">
					{#if status === 'loading'}
						<span class="text-gray-500">Finding where you are zoomed in…</span>
					{:else if status === 'ready' && country}
						You are currently zoomed in to <strong>{country.name}</strong>
					{:else if status === 'ready'}
						<span class="text-gray-600">You are not currently zoomed in to a country.</span>
					{:else if status === 'error'}
						<span class="text-gray-600">We could not work out which country you are in.</span>
					{/if}
				</p>

				{#if country}
					<div class="grid grid-cols-1 gap-5 md:grid-cols-[22rem_minmax(0,1fr)]">
						<!-- Filters: slides vertically when its sections outgrow the card -->
						<aside
							aria-label="Filters"
							class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 shadow-sm md:h-[min(36rem,62vh)]">
							<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
								<h3 class="text-sm font-semibold text-secondary">Filters</h3>
							</div>
							<div class="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50/50 p-3">
								<FilterSection
									title="Admin level"
									id="admin-level-body"
									summary={levelSummary}
									bind:open={levelsOpen}>
									{#if treeStatus === 'loading'}
										<p class="text-sm text-gray-500" aria-live="polite">
											Loading administrative areas…
										</p>
									{:else if treeStatus === 'none'}
										<p class="text-sm text-gray-600">
											No administrative areas below the country are available for {country.name}.
										</p>
									{:else if treeStatus === 'error'}
										<p class="text-sm text-gray-600">
											We could not load the administrative areas for {country.name}.
										</p>
									{:else if treeStatus === 'ready' && tree}
										<p class="mb-3 text-xs text-gray-600">
											{country.name} has {tree.max_level}
											administrative {tree.max_level === 1 ? 'level' : 'levels'} below the country. Choose
											an area at any level.
										</p>
										<div class="flex flex-col gap-3">
											{#each levels as l (l.level)}
												{@const id = `admin-level-${l.level}`}
												<div class="flex flex-col gap-1">
													<label for={id} class="text-sm font-semibold text-secondary">
														Admin level {l.level}
													</label>
													<select
														{id}
														class="select select-bordered select-sm w-full"
														disabled={!l.enabled}
														onchange={(e) => choose(l.level, e.currentTarget.value)}>
														<option value="" selected={!l.chosen}>
															{#if l.level > 1 && !levels[l.level - 2].chosen}
																Choose level {l.level - 1} first
															{:else if !l.options.length}
																No areas
															{:else}
																All of {l.level === 1
																	? country.name
																	: levels[l.level - 2].chosen?.name}
															{/if}
														</option>
														{#each l.options as option (option.fika_id)}
															<option
																value={option.fika_id}
																selected={option.fika_id === l.chosen?.fika_id}>
																{option.name}
															</option>
														{/each}
													</select>
												</div>
											{/each}
										</div>
									{/if}
								</FilterSection>

								<FilterSection
									title="Bridge selection criteria"
									id="bridge-criteria-body"
									summary={reportState.bridgeTop ? `Top ${reportState.bridgeTop}` : 'All bridges'}
									bind:open={bridgesOpen}>
									{#if !reportState.region}
										<p class="text-xs text-gray-600">
											Choose an admin area first. Bridges are shown for an area, not for a whole
											country.
										</p>
									{:else}
										<p class="mb-2 text-xs text-gray-600">
											Show only the highest-ranked bridges in {reportState.region.name}. Pick how
											many.
										</p>
										<BridgeSpectrum
											selected={reportState.bridgeTop}
											onselect={(top) => (reportState.bridgeTop = top)} />
										{#if bridgeStatus === 'loading'}
											<p
												class="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-700"
												aria-live="polite">
												<span class="loading loading-spinner loading-xs"></span>
												Loading bridges…
											</p>
										{:else if bridgeStatus === 'error'}
											<p class="mt-2 text-xs font-semibold text-red-700" aria-live="polite">
												{bridgeTooLarge
													? 'This area is too large to load bridges. Choose a smaller area.'
													: 'Bridges could not be loaded.'}
											</p>
										{:else if bridgeSummary}
											<p class="mt-2 text-xs font-semibold text-secondary" aria-live="polite">
												{bridgeSummary}
											</p>
										{/if}

										<p class="mb-1 mt-4 text-xs font-semibold text-secondary">Rank by</p>
										<div
											class="join w-full"
											role="group"
											aria-label="What to weight the ranking by">
											{#each [['none', 'Hex count'], ['population', 'Population']] as [value, label] (value)}
												<button
													type="button"
													class="btn join-item btn-sm flex-1 {reportState.bridgeWeight === value
														? 'btn-secondary'
														: 'btn-outline'}"
													aria-pressed={reportState.bridgeWeight === value}
													onclick={() => (reportState.bridgeWeight = value)}>
													{label}
												</button>
											{/each}
										</div>

										{#if reportState.bridgeTop}
											<button
												type="button"
												class="link mt-3 text-xs text-secondary"
												onclick={() => (reportState.bridgeTop = null)}>
												Show all bridges
											</button>
										{/if}
									{/if}
								</FilterSection>
							</div>
						</aside>

						<section
							aria-label="Selected area map"
							class="flex flex-col overflow-hidden rounded-lg border border-gray-200 shadow-sm md:h-[min(36rem,62vh)]">
							<div class="border-b border-gray-200 bg-gray-50 px-3 py-2">
								<p class="text-xs uppercase tracking-wide text-gray-500">Selected area</p>
								<p class="text-sm font-semibold text-secondary">{areaLabel}</p>
								{#if bridgeSummary}
									<p class="text-xs text-gray-600">{bridgeSummary}</p>
								{/if}
							</div>
							<div class="relative h-80 md:h-auto md:flex-1">
								<AreaMap
									feature={shape}
									bridges={bridgeLayer?.data}
									bridgeMode={bridgeLayer?.mode} />
								{#if bridgeStatus === 'loading'}
									<p
										class="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow"
										aria-live="polite">
										<span class="loading loading-spinner loading-xs"></span>
										Loading bridges…
									</p>
								{:else if bridgeStatus === 'error'}
									<p
										class="absolute left-2 right-14 top-2 max-w-sm rounded-lg bg-white/95 px-3 py-2 text-xs text-gray-700 shadow">
										{#if bridgeTooLarge}
											<strong>This area is too large for the server to load bridges for.</strong>
											Choose a smaller area, such as an admin level 2 district.
										{:else}
											We could not load the bridges for this area.
											<button
												type="button"
												class="link ml-1 text-secondary"
												onclick={() => bridgeAttempt++}>
												Try again
											</button>
										{/if}
									</p>
								{/if}
								{#if mapMessage}
									<div
										class="absolute inset-0 flex items-center justify-center bg-white/70 p-4 text-center text-sm text-gray-600"
										aria-live="polite">
										{mapMessage}
									</div>
								{/if}
							</div>
						</section>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
