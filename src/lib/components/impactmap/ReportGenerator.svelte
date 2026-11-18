<script>
	import { untrack } from 'svelte';
	import { XmarkSolid } from 'svelte-awesome-icons';
	import { reportState } from '$lib/utils/state.svelte.js';
	import { mapRegistry } from '$lib/services/impactmap/mapRegistry.svelte.js';
	import { countryAt } from '$lib/utils/impactmap/countryLookup.js';

	/** @type {'idle' | 'loading' | 'ready' | 'error'} */
	let status = $state('idle');
	/** @type {{ name: string, code: string } | null} */
	let country = $state(null);

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
		}
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

			<div class="p-6 pr-14">
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
			</div>
		</div>
	</div>
{/if}
