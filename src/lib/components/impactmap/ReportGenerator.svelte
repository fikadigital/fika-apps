<script>
	import { untrack } from 'svelte';
	import { XmarkSolid } from 'svelte-awesome-icons';
	import { reportState } from '$lib/utils/state.svelte.js';
	import { mapRegistry } from '$lib/services/impactmap/mapRegistry.svelte.js';
	import { countryAt } from '$lib/utils/impactmap/countryLookup.js';
	import { fetchHierarchy, dropdownLevels } from '$lib/utils/impactmap/boundaryTree.js';

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

	// Look up the country at the centre of the map each time the popup opens. The map
	// can't move while the popup covers it, so one lookup per opening is enough.
	$effect(() => {
		if (!reportState.open) return;
		const controller = new AbortController();
		untrack(() => lookup(controller.signal));
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
			class="relative flex max-h-[90vh] min-h-[320px] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
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

			<div class="flex flex-col gap-5 overflow-y-auto p-6 pr-14">
				<p class="text-left text-lg text-secondary" aria-live="polite">
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
					<section aria-label="Choose an area">
						{#if treeStatus === 'loading'}
							<p class="text-sm text-gray-500" aria-live="polite">Loading administrative areas…</p>
						{:else if treeStatus === 'none'}
							<p class="text-sm text-gray-600">
								No administrative areas below the country are available for {country.name}.
							</p>
						{:else if treeStatus === 'error'}
							<p class="text-sm text-gray-600">
								We could not load the administrative areas for {country.name}.
							</p>
						{:else if treeStatus === 'ready' && tree}
							<p class="mb-3 text-sm text-gray-600">
								{country.name} has {tree.max_level}
								administrative {tree.max_level === 1 ? 'level' : 'levels'} below the country. Choose
								an area at any level.
							</p>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{#each levels as l (l.level)}
									{@const id = `admin-level-${l.level}`}
									<div class="flex flex-col gap-1">
										<label for={id} class="text-sm font-semibold text-secondary">
											Admin level {l.level}
										</label>
										<select
											{id}
											class="select select-bordered w-full"
											disabled={!l.enabled}
											onchange={(e) => choose(l.level, e.currentTarget.value)}>
											<option value="" selected={!l.chosen}>
												{#if l.level > 1 && !levels[l.level - 2].chosen}
													Choose level {l.level - 1} first
												{:else if !l.options.length}
													No areas
												{:else}
													All of {l.level === 1 ? country.name : levels[l.level - 2].chosen?.name}
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
					</section>
				{/if}
			</div>
		</div>
	</div>
{/if}
