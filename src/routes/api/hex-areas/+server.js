import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError } from '$lib/server/impactApi.js';

/**
 * One hex's full attribute row, from the impact API.
 *   ?hexID=<h3_index>
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const hexID = url.searchParams.get('hexID');
	if (!hexID) {
		return json(
			{ error: 'Missing hexID parameter', details: 'hexID query parameter is required' },
			{ status: 400 }
		);
	}

	let upstream = null;
	try {
		upstream = await impactFetch(`/geostore/api/hexes/${encodeURIComponent(hexID)}/`, {
			platform,
			request,
			label: `hex ${hexID}`
		});
	} catch (apiError) {
		console.error('Impact API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'IMPACT_API_URL is not set, so there is no hex data source'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 404) {
		return json(
			{ error: 'Hex not found', details: `No hex found with ID: ${hexID}` },
			{ status: 404 }
		);
	}
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json());
}
