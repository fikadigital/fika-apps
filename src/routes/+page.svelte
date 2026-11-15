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
	import bridgeDesignToolImage from '$lib/images/app-screenshots/bridge-design-tool.jpg';
	import fikaImpactImage from '$lib/images/app-screenshots/fika-impact-map1.png';
	import fikaCollectImage from '$lib/images/app-screenshots/fika-collect-1.jpg';


	let isLoaded = $state(false);

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
			href: '/impactmap',
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
			description: 'Locations of bridges built by Bridges to Prosperity around the world',
			href: 'https://bridge-locations-map.vercel.app/',
			learn: 'https://bridgestoprosperity.org/our-impact/'
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
			href: 'https://bridgestoprosperity.github.io/civ-map/home/',
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
			image: bridgeDesignToolImage,
			alt: 'Bridge design tool app screenshot',
			title: 'Bridge Design Tools',
			description: 'A suite of tools designed to support the building and design of trailbridges',
			href: 'https://bridgedesignv3.streamlit.app/Updated_Bridge_Design_Helper',
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
								<span class="title-text relative z-10">Apps</span>
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

		<div class="px-4 sm:min-[800px]:px-6 min-[800px]:px-4 lg:min-[800px]:px-8">
			<div class="grid grid-cols-1 gap-8 py-8 md:grid-cols-2 md:gap-10 xl:grid-cols-3 xl:gap-12">
				{#each appCards as card}
					<div class="w-full">
						<AppCard {...card} />
					</div>
				{/each}
			</div>
		</div>
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
