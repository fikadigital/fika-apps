<script>
	import { saiMapState } from '$lib/utils/state.svelte.js';

	let { getMap } = $props();

	let currentStep = $state(0);
	let transitioning = $state(false);

	const steps = [
		{
			title: 'Measuring What Actually Matters',
			narrative:
				'For hundreds of millions of people in rural communities, daily life is shaped by how long it takes to reach a school, a clinic, a market, or the nearest road. The Safe Access Scorecard maps that reality — using walking time as the measure.',
			detail:
				'Each hexagonal cell represents a community area. Color shows estimated walking time to the nearest school, accounting for terrain, river crossings, and the paths people actually take.',
			camera: { center: [25, 0], zoom: 3, pitch: 0, bearing: 0, speed: 0.7 },
			metric: 'travel_time_no_sites_all_education'
		},
		{
			title: 'Connected Communities',
			narrative:
				'In parts of East Africa, children reach school in under 30 minutes on foot. These communities have relatively good access — close enough that distance alone is not the main barrier to attendance.',
			detail:
				'Yellow and light-orange areas indicate shorter walks. For context, 86–97% of school trips in Africa are made entirely on foot — so even these shorter walks happen every day, in every season.',
			camera: { center: [36.8, -1.3], zoom: 7, pitch: 20, bearing: 0, speed: 0.6 },
			metric: 'travel_time_no_sites_all_education'
		},
		{
			title: 'The Access Gap',
			narrative:
				'Across much of rural central and southern Africa, the picture changes. Dark red areas represent communities where the nearest school is a multi-hour walk away. These are not edge cases — they reflect everyday life for millions of children.',
			detail:
				'A two-hour walk each way to school means four hours of travel daily. For girls especially, these distances translate directly into lower enrollment and higher dropout rates.',
			camera: { center: [28, -8], zoom: 6, pitch: 25, bearing: 10, speed: 0.6 },
			metric: 'travel_time_no_sites_all_education'
		},
		{
			title: 'The Same Distance, Higher Stakes',
			narrative:
				'Switch to healthcare and the map looks similar — but the consequences are different. A long walk to a market is an inconvenience. A long walk to a health clinic during a difficult pregnancy or a child\'s illness is a different matter.',
			detail:
				'The SAS tracks walking time to four destinations: schools, health facilities, markets, and the nearest road. Each tells a different part of the story about how connected a community really is.',
			camera: { center: [28, -8], zoom: 6, pitch: 25, bearing: 10, speed: 0.8 },
			metric: 'travel_time_no_sites_all_health'
		},
		{
			title: 'Explore the Data',
			narrative:
				'The Safe Access Scorecard gives governments, investors, and civil society a comparable, credible basis for understanding rural access — and for making the case for where investment is needed most.',
			detail:
				'Use the panel on the left to switch between destinations. Click any hexagon to see its walking time and population. This prototype covers all countries globally.',
			camera: { center: [20, 5], zoom: 3.5, pitch: 0, bearing: 0, speed: 0.6 },
			metric: 'travel_time_no_sites_all_education'
		}
	];

	async function goToStep(stepIndex) {
		if (transitioning || stepIndex < 0 || stepIndex >= steps.length) return;
		transitioning = true;

		try {
			const step = steps[stepIndex];
			const map = getMap?.();

			if (step.metric) {
				saiMapState.selectedViz = step.metric;
			}

			if (map && step.camera) {
				await Promise.race([
					new Promise((resolve) => {
						map.once('moveend', resolve);
						map.flyTo({
							center: step.camera.center,
							zoom: step.camera.zoom,
							pitch: step.camera.pitch ?? 0,
							bearing: step.camera.bearing ?? 0,
							speed: step.camera.speed ?? 0.6,
							essential: true
						});
					}),
					new Promise((resolve) => setTimeout(resolve, 5000))
				]);
			}

			currentStep = stepIndex;
		} catch (error) {
			console.error('Error in goToStep:', error);
		} finally {
			transitioning = false;
		}
	}

	function nextStep() {
		if (currentStep < steps.length - 1) goToStep(currentStep + 1);
	}

	function prevStep() {
		if (currentStep > 0) goToStep(currentStep - 1);
	}

	function exitTour() {
		saiMapState.tourActive = false;
		saiMapState.selectedViz = 'travel_time_no_sites_all_education';
		const map = getMap?.();
		if (map) {
			map.flyTo({ center: [26.19, -0.21], zoom: 3, pitch: 0, bearing: 0, speed: 0.8 });
		}
	}

	$effect(() => {
		if (saiMapState.tourActive) {
			currentStep = 0;
			transitioning = false;
			const map = getMap?.();
			const step = steps[0];
			if (map && step.camera) {
				saiMapState.selectedViz = step.metric;
				map.flyTo({
					center: step.camera.center,
					zoom: step.camera.zoom,
					pitch: step.camera.pitch ?? 0,
					bearing: step.camera.bearing ?? 0,
					speed: step.camera.speed ?? 0.7,
					essential: true
				});
			}
		}
	});
</script>

{#if saiMapState.tourActive}
	<div class="tour-overlay">
		<div class="tour-card">
			<div class="step-counter">
				<span>Step {currentStep + 1} of {steps.length}</span>
				<button onclick={exitTour} class="exit-btn">Exit Tour</button>
			</div>

			<div class="progress-bar">
				<div class="progress-fill" style="width: {((currentStep + 1) / steps.length) * 100}%"></div>
			</div>

			<div class="step-content">
				<h2 class="step-title">{steps[currentStep].title}</h2>
				<p class="step-narrative">{steps[currentStep].narrative}</p>
				<p class="step-detail">{steps[currentStep].detail}</p>
			</div>

			<div class="step-nav">
				<button
					onclick={prevStep}
					disabled={currentStep === 0 || transitioning}
					class="nav-btn prev-btn">
					Previous
				</button>

				<div class="dots">
					{#each steps as _, i}
						<button
							onclick={() => goToStep(i)}
							class="dot"
							class:active={i === currentStep}
							class:completed={i < currentStep}
							disabled={transitioning}
							aria-label="Go to step {i + 1}">
						</button>
					{/each}
				</div>

				{#if currentStep < steps.length - 1}
					<button onclick={nextStep} disabled={transitioning} class="nav-btn next-btn">
						Next
					</button>
				{:else}
					<button onclick={exitTour} class="nav-btn next-btn finish-btn">
						Explore Map
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.tour-overlay {
		position: absolute;
		bottom: 32px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 60;
		pointer-events: none;
	}

	.tour-card {
		width: 520px;
		max-width: 90vw;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 20px 24px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
		pointer-events: auto;
		animation: slideUp 0.4s ease-out;
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.step-counter {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.step-counter span {
		font-size: 11px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-family: 'Source Code Pro', monospace;
	}

	.exit-btn {
		font-size: 11px;
		color: #9ca3af;
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: all 0.2s;
		font-family: 'Kumbh Sans', sans-serif;
	}

	.exit-btn:hover {
		color: #374151;
		background: rgba(0, 0, 0, 0.04);
	}

	.progress-bar {
		height: 3px;
		background: #e5e7eb;
		border-radius: 2px;
		margin-bottom: 16px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #009149;
		border-radius: 2px;
		transition: width 0.5s ease;
	}

	.step-content {
		margin-bottom: 16px;
	}

	.step-title {
		font-size: 18px;
		font-weight: 700;
		color: #111827;
		margin: 0 0 8px;
		font-family: 'Kumbh Sans', sans-serif;
		line-height: 1.3;
	}

	.step-narrative {
		font-size: 14px;
		color: #374151;
		line-height: 1.6;
		margin: 0 0 8px;
	}

	.step-detail {
		font-size: 12px;
		color: #6b7280;
		line-height: 1.5;
		margin: 0;
		font-style: italic;
	}

	.step-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.nav-btn {
		padding: 8px 20px;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		font-family: 'Kumbh Sans', sans-serif;
		min-width: 90px;
	}

	.nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.prev-btn {
		background: #f3f4f6;
		color: #374151;
	}

	.prev-btn:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.next-btn {
		background: #009149;
		color: white;
	}

	.next-btn:hover:not(:disabled) {
		background: #007a3d;
	}

	.finish-btn {
		background: #161345;
		color: white;
	}

	.finish-btn:hover:not(:disabled) {
		background: #1e1a5e;
	}

	.dots {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: #d1d5db;
		cursor: pointer;
		padding: 0;
		transition: all 0.3s;
	}

	.dot.active {
		background: #009149;
		transform: scale(1.3);
	}

	.dot.completed {
		background: #86efac;
	}

	.dot:hover:not(:disabled) {
		background: #009149;
		opacity: 0.7;
	}
</style>
