import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError, BROWSER_CACHE } from '$lib/server/impactApi.js';

/**
 * One education facility's row, including the hexes it serves, from the impact API.
 *   ?facilityIndex=<n>[&lng=&lat=]
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const facilityIndex = url.searchParams.get('facilityIndex');
	if (!facilityIndex) {
		return json(
			{
				error: 'Missing facilityIndex parameter',
				details: 'facilityIndex query parameter is required'
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
			`/geostore/api/education-facilities/${encodeURIComponent(parseInt(facilityIndex, 10))}/${position}`,
			{ platform, request, label: `education facility ${facilityIndex}` }
		);
	} catch (apiError) {
		console.error('Impact API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'IMPACT_API_URL is not set, so there is no education facility data source'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 404) {
		return json(
			{
				error: 'Education facility not found',
				details: `No education facility found with index: ${facilityIndex}`
			},
			{ status: 404 }
		);
	}
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json(), BROWSER_CACHE);
}
