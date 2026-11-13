import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError, BROWSER_CACHE } from '$lib/server/impactApi.js';

/**
 * One bridge's full row, from the impact API.
 *   ?bridgeIndex=<n>[&lng=&lat=]
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const bridgeIndex = url.searchParams.get('bridgeIndex');
	if (!bridgeIndex) {
		return json(
			{
				error: 'Missing bridgeIndex parameter',
				details: 'bridgeIndex query parameter is required'
			},
			{ status: 400 }
		);
	}

	const lng = url.searchParams.get('lng');
	const lat = url.searchParams.get('lat');
	const position =
		lng && lat ? `?lng=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}` : '';

	let upstream = null;
	try {
		upstream = await impactFetch(
			`/geostore/api/bridges/${encodeURIComponent(parseInt(bridgeIndex, 10))}/${position}`,
			{ platform, request, label: `bridge ${bridgeIndex}` }
		);
	} catch (apiError) {
		console.error('Impact API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'IMPACT_API_URL is not set, so there is no bridge data source'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 404) {
		return json(
			{ error: 'Bridge not found', details: `No bridge found with index: ${bridgeIndex}` },
			{ status: 404 }
		);
	}
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json(), BROWSER_CACHE);
}
