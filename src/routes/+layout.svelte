<script>
	import '../app.css';
	let { children } = $props();
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import Header from './Header.svelte';
	import SignUpBanner from '$lib/components/SignUpBanner.svelte';
	injectAnalytics();
</script>

<svelte:head>
	<title>Fika Digital</title>
	<meta name="description" content="Digital applications developed by Fika" />
	<meta property="og:image" content="https://apps.fikamap.com/fika-apps-cover.png" />
	<meta name="twitter:image" content="https://apps.fikamap.com/fika-apps-cover.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="6663" />
</svelte:head>

<div class="app">
	<SignUpBanner />
	<Header />
	<main>
		{@render children()}
	</main>
	<footer></footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
