<script>
	import { onMount } from 'svelte';
	import TopNav from '$lib/components/TopNav.svelte';
	import AppCard from '$lib/components/HomePageCard.svelte';
	import TiltCard from '$lib/components/TiltCard.svelte';

	// Images for top header
	import tile1 from '$lib/images/app-screenshots/sites-bolivia.png';
	import tile8 from '$lib/images/app-screenshots/sites-sat-central-america.png';
	import tile2 from '$lib/images/app-screenshots/sites-single-sat.png';
	import tile4 from '$lib/images/app-screenshots/civ-map-only.png';
	import tile3 from '$lib/images/app-screenshots/fikamap-maponly.png';
	import tile13 from '$lib/images/app-screenshots/waternet-magma-7.png';
	import tile6 from '$lib/images/app-screenshots/waternet-blue-1.png';
	import tile10 from '$lib/images/app-screenshots/waternet-kenya.png';
	import tile5 from '$lib/images/app-screenshots/waternet-magma-1.png';
	import tile11 from '$lib/images/app-screenshots/waternet-viridis-1.png';
	import tile9 from '$lib/images/app-screenshots/waternet-magma-5.png';
	import tile12 from '$lib/images/app-screenshots/waternet-magma-6.png';
	import tile7 from '$lib/images/app-screenshots/waternet-vector-ethiopia.png';
	import waternetVectorEthiopia from '$lib/images/app-screenshots/waternet-vector-ethiopia.png';
	import civAppImage from '$lib/images/app-screenshots/civ-maponly-flood.png';
	import fikaMapAppImage from '$lib/images/app-screenshots/fikamap-maponly.png';
	import bridgeSitesAppImage from '$lib/images/app-screenshots/sites-zoom-sat.png';
	import waternetAppImage from '$lib/images/app-screenshots/waternet-magma-4.png';
	import bridgeCostImage from '$lib/images/app-screenshots/bridge-cost.jpg';
	import bridgeTypeImage from '$lib/images/app-screenshots/bridge-type.jpg';
	import rntiBudgetImage from '$lib/images/app-screenshots/rnti-budget.jpg';
	import fikaImpactImage from '$lib/images/app-screenshots/fika-impact-map1.png';
	import fikaCollectImage from '$lib/images/app-screenshots/fika-collect-1.jpg';

	// Supported-by logos
	import adfLogo from '$lib/images/supported-by/adf.png';
	import bplLogo from '$lib/images/supported-by/bpl.png';
	import ciscofLogo from '$lib/images/supported-by/ciscof.png';
	import gwLogo from '$lib/images/supported-by/gw.png';
	import mbLogo from '$lib/images/supported-by/mb.png';
	import pjmfLogo from '$lib/images/supported-by/pjmf.png';
	import sahajLogo from '$lib/images/supported-by/sahaj.png';

	const supportedByLogos = [
		{ src: adfLogo, alt: 'Autodesk Foundation' },
		{ src: bplLogo, alt: 'Better Planet Laboratory' },
		{ src: ciscofLogo, alt: 'Cisco Foundation' },
		{ src: gwLogo, alt: 'GiveWell' },
		{ src: mbLogo, alt: 'Mapbox' },
		{ src: pjmfLogo, alt: 'Patrick J. McGovern Foundation' },
		{ src: sahajLogo, alt: 'Sahaj Software' }
	];

	let isLoaded = $state(false);
	let heroSection = $state();
	let heroVisible = $state(false);

	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					heroVisible = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.3 }
		);
		if (heroSection) observer.observe(heroSection);
		return () => observer.disconnect();
	});

	// Define grid items for better maintainability
	const gridItems = [
		{
			src: tile1,
			alt: 'tile 1',
			className: `slide-from-left animation-delay-300 col-start-1 row-start-1 col-span-2 min-[800px]:col-start-1 min-[800px]:row-start-1 min-[800px]:col-span-2`
		},
		{
			src: tile2,
			alt: 'tile 2',
			className: `slide-from-bottom animation-delay-100 col-start-3 row-start-1 min-[800px]:col-start-3 min-[800px]:row-start-1`
		},
		{
			src: tile3,
			alt: 'tile 3',
			className: `slide-from-top animation-delay-300 col-start-4 row-start-1 row-span-2 min-[800px]:col-start-4 min-[800px]:row-start-1 min-[800px]:row-span-2`
		},
		{
			src: tile4,
			alt: 'tile 4',
			className: `slide-from-left animation-delay-0 col-start-1 row-start-3 row-span-1 min-[800px]:col-start-5 min-[800px]:row-start-1`
		},
		{
			src: tile5,
			alt: 'tile 5',
			className: `slide-from-top animation-delay-100 col-start-2 row-start-4 min-[800px]:col-start-1 min-[800px]:row-start-2`
		},
		{
			src: tile6,
			alt: 'Tile 6',
			className: `slide-from-right animation-delay-300 col-start-3 row-start-4 col-span-2 min-[800px]:col-start-5 min-[800px]:row-start-2`
		},
		{
			src: tile7,
			alt: 'Tile 7',
			className: `slide-from-left animation-delay-200 hidden min-[800px]:block min-[800px]:col-start-1 min-[800px]:row-start-3 min-[800px]:row-span-2`
		},
		{
			src: tile8,
			alt: 'Tile 8',
			className: `slide-from-bottom animation-delay-300 hidden min-[800px]:block min-[800px]:col-start-2 min-[800px]:row-start-3 min-[800px]:row-span-2`
		},
		{
			src: tile9,
			alt: 'Tile 9',
			className: `slide-from-left animation-delay-100 hidden min-[800px]:block min-[800px]:col-start-3 min-[800px]:row-start-4`
		},
		{
			src: tile10,
			alt: 'Tile 10',
			className: `slide-from-right animation-delay-200 hidden min-[800px]:block min-[800px]:col-start-4 min-[800px]:row-start-4`
		},
		{
			src: tile11,
			alt: 'Tile 11',
			className: `slide-from-top hidden min-[800px]:block min-[800px]:col-start-5 min-[800px]:row-start-3 min-[800px]:row-span-2`
		}
	];

	const appCards = [
		{
			image: fikaImpactImage,
			alt: 'Fika Impact Map Prototype',
			title: 'Fika Impact Map',
			description:
				'Prototype of a map application allowing user to visualize impact of trail bridges on communities across seven countries in Africa',
			href: 'https://apps.fikamap.com/impactmap',
			learn: 'https://public-b2p-geodata.s3.us-east-1.amazonaws.com/research/AGU_2025_poster.pdf'
		},
		{
			image: waternetAppImage,
			alt: 'Waterway Explorer example',
			title: 'Waterways Data Explorer App',
			description: 'An application allowing you to explore waterways data created by Waternet',
			href: '/waternet',
			learn:
				'https://medium.com/fika-blog/waternet-ai-powered-global-water-mapping-triples-known-waterways-bc3095783661'
		},
		
		{
			image: bridgeSitesAppImage,
			alt: 'map of ethiopia',
			title: 'Bridges Built Worldwide',
			description: 'Locations of bridges built by Fika around the world',
			href: 'https://bridge-locations-map.vercel.app/',
			learn: 'https://fika.org/our-impact/'
		},
				{
			image: fikaCollectImage,
			alt: 'Fika Collect App Screenshot',
			title: 'Fika Collect',
			description:
				'Fika Collect is an Android application designed to collect information about the transportation barriers impacting access to critical infrastructure primarily in a rural context.',
			href: 'https://play.google.com/store/apps/details?id=com.fikacollect',
			learn: ''
		},
		{
			image: fikaMapAppImage,
			alt: 'Rwanda Impact Map Prototype',
			title: 'Rwanda Impact Map',
			description:
				'Prototype of a map application allowing user to visualize impact of trail bridges on communities around Rwanda',
			href: 'https://map.fikamap.com/',
			learn: ''
		},
		{
			image: civAppImage,
			alt: "Côte d'Ivoire",
			title: "Côte d'Ivoire Bridge Impact Assessment",
			description:
				"Analysis done to determine where bridges are needed to support new schools built in Côte d'Ivoire",
			href: 'https://fikadigital.github.io/civ-map/home/',
			learn: ''
		},
		{
			image: waternetVectorEthiopia,
			alt: 'map of ethiopia',
			title: 'Safe Access Index Proof of Concept',
			description:
				'Proof of concept application visualizing the travel time of communities to their nearest major road',
			href: '/saipoc',
			learn: ''
		},
		{
			image: bridgeCostImage,
			alt: 'Bridge Cost Estimator screenshot',
			title: 'Bridge Cost Estimator',
			description: 'Estimate the cost of building a trailbridge based on site conditions and design parameters',
			href: 'https://bridgedesignv3.streamlit.app/Bridge_Price_Estimation',
			learn: ''
		},
		{
			image: rntiBudgetImage,
			alt: 'RNTI Planner screenshot',
			title: 'RNTI Planner',
			description: 'Plan rural network transportation infrastructure budgets and prioritize bridge investments across a region',
			href: 'https://bridgedesignv3.streamlit.app/RNTI_Budget_Calculator',
			learn: ''
		},
		{
			image: bridgeTypeImage,
			alt: 'Bridge Type Recommendation Engine screenshot',
			title: 'Bridge Type Recommendation Engine',
			description: 'Get a recommended bridge type based on site-specific conditions and engineering constraints',
			href: 'https://bridgedesignv3.streamlit.app/Bridge_Type_Recommender',
			learn: ''
		}
	];

	$effect(() => {
		isLoaded = true;
	});
</script>

<div class="background-texture flex min-h-screen flex-col">
	<div class="mx-auto w-full">
		<header class="flex w-full flex-col">
			<TopNav />
			<div
				class="relative w-screen [aspect-ratio:3/4] min-[800px]:w-full min-[800px]:[aspect-ratio:16/9]">
				<div class="absolute inset-0">
					<div class="h-full sm:min-[800px]:px-6 min-[800px]:px-4 lg:min-[800px]:px-8">
						<div
							class="grid h-full grid-cols-4 grid-rows-4 gap-2 min-[800px]:grid-cols-5 min-[800px]:grid-rows-4 [&>*]:transition-all [&>*]:duration-300">
							<div
								class="fika-slide col-span-3 col-start-1 row-start-2 flex items-center justify-center rounded-md min-[800px]:col-span-2 min-[800px]:col-start-2 min-[800px]:row-start-2">
								<span class="title-text relative z-10">Fika</span>
							</div>

							<div
								class="apps-slide col-span-3 col-start-2 row-start-3 flex items-center justify-center rounded-md min-[800px]:col-span-2 min-[800px]:col-start-3 min-[800px]:row-start-3">
								<span class="title-text relative z-10">Digital</span>
							</div>

							{#each gridItems as item}
								<div class={item.className}>
									<TiltCard src={item.src} alt={item.alt} className="h-full w-full object-cover">
										<span class="relative z-10"></span>
									</TiltCard>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</header>

		<section
			bind:this={heroSection}
			class="px-4 py-16 sm:min-[800px]:px-6 min-[800px]:px-4 lg:min-[800px]:px-8 md:py-24">
			<div class="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-center md:gap-16">
				<h1
					class="hero-init text-4xl font-bold leading-tight text-secondary md:flex-1 md:text-5xl lg:text-6xl"
					class:hero-slide-left={heroVisible}>
					Data & AI models delivering rural access at scale
				</h1>
				<div class="flex flex-col gap-6 md:flex-1">
					<p
						class="hero-init text-lg leading-relaxed text-gray-600 md:text-xl"
						class:hero-fade-up={heroVisible}
						class:animation-delay-200={heroVisible}>
						Rural communities experience outsized negative effects when a lack of basic
						infrastructure prevents them from reaching important destinations.
					</p>
					<p
						class="hero-init text-lg leading-relaxed text-gray-600 md:text-xl"
						class:hero-fade-up={heroVisible}
						class:animation-delay-400={heroVisible}>
						Our Digital group conducts research, produces data, and develops products to
						close data gaps and transform rural access. The technology we build scales our work
						as we aim to transform rural access solutions around the world.
					</p>
					<a
						href="https://apps.fikadigital.org/sign-up"
						class="hero-init btn btn-lg mt-2 self-start border-none bg-primary px-10 text-white transition-transform hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg"
						class:hero-fade-up={heroVisible}
						class:animation-delay-600={heroVisible}>
						Sign Up
					</a>
				</div>
			</div>
		</section>

		<div class="px-4 sm:min-[800px]:px-6 min-[800px]:px-4 lg:min-[800px]:px-8">
			<div class="grid grid-cols-1 gap-8 py-8 md:grid-cols-2 md:gap-10 xl:grid-cols-3 xl:gap-12">
				{#each appCards as card}
					<div class="w-full">
						<AppCard {...card} />
					</div>
				{/each}
			</div>
		</div>

		<section class="border-t border-gray-100 px-4 py-16 sm:min-[800px]:px-6 min-[800px]:px-4 lg:min-[800px]:px-8">
			<div class="mx-auto max-w-6xl">
				<h2 class="text-center text-sm font-semibold uppercase tracking-wide text-gray-500">
					Supported By
				</h2>
				<div class="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
					{#each supportedByLogos as logo}
						<img
							src={logo.src}
							alt={logo.alt}
							class="h-12 w-auto object-contain grayscale transition duration-300 hover:grayscale-0 md:h-16" />
					{/each}
				</div>
			</div>
		</section>
	</div>
</div>

<br />
<br />

<style>
	.calc-grid {
		height: calc(100vh - 64px); /* Adjust 64px to match your TopNav height */
	}
	.fika-slide {
		animation: fikaSlide 1.5s ease-out forwards;
		opacity: 0;
		background-color: #fcfaf2;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		outline: 6px solid #009149;
		outline-offset: -6px;
		/* curve corners */
		border-radius: 10px;
	}

	.apps-slide {
		animation: appsSlide 1.5s ease-out forwards;
		opacity: 0;
		background-color: #fcfaf2;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		outline: 6px solid #009149;
		outline-offset: -6px;
		border-radius: 10px;
	}

	.slide-from-top {
		animation: slideFromTop 0.8s ease-out forwards;
		opacity: 0;
	}

	.slide-from-right {
		animation: slideFromRight 0.8s ease-out forwards;
		opacity: 0;
	}

	.slide-from-bottom {
		animation: slideFromBottom 0.8s ease-out forwards;
		opacity: 0;
	}

	.slide-from-left {
		animation: slideFromLeft 0.8s ease-out forwards;
		opacity: 0;
	}

	.animation-delay-100 {
		animation-delay: 100ms;
	}

	.animation-delay-200 {
		animation-delay: 200ms;
	}

	.animation-delay-300 {
		animation-delay: 300ms;
	}

	.animation-delay-400 {
		animation-delay: 400ms;
	}

	.animation-delay-600 {
		animation-delay: 600ms;
	}

	.hero-init {
		opacity: 0;
	}

	.hero-slide-left {
		animation: heroSlideLeft 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.hero-fade-up {
		animation: heroFadeUp 0.8s ease-out forwards;
	}

	@keyframes heroSlideLeft {
		from {
			transform: translateX(-60px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes heroFadeUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.title-text {
		font-size: clamp(6rem, 10vw, 10rem);
		font-weight: 700;
		line-height: 0.8;
	}

	/* .title-container {
		background-color: #f5f2e8;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	} */

	.background-texture {
		background-color: #ffffff;
		/* background-image: url('https://www.transparenttextures.com/patterns/bedge-grunge.png'); */
	}

	@keyframes fikaSlide {
		from {
			transform: translateX(-100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes appsSlide {
		from {
			transform: translateX(100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideFromTop {
		from {
			transform: translateY(-100px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes slideFromRight {
		from {
			transform: translateX(100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideFromBottom {
		from {
			transform: translateY(100px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes slideFromLeft {
		from {
			transform: translateX(-100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
