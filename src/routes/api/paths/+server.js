import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError } from '$lib/server/impactApi.js';

/**
 * The paths from a hex, optionally to one destination, from the impact API.
 *   ?h3_index=<h3>[&destination_index=<n>]
 * The API answers 501 for a destination on its own until all_paths is indexed on it.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const h3Index = url.searchParams.get('h3_index');
	const destinationIndex = url.searchParams.get('destination_index');

	if (!h3Index && !destinationIndex) {
		return json(
			{
				error: 'Missing required parameters',
				details: 'Either h3_index or destination_index parameter is required'
			},
			{ status: 400 }
		);
	}

	const pathQuery = new URLSearchParams();
	if (h3Index) pathQuery.set('h3_index', h3Index);
	if (destinationIndex) pathQuery.set('destination_index', destinationIndex);

	let upstream = null;
	try {
		upstream = await impactFetch(`/geostore/api/paths/?${pathQuery}`, {
			platform,
			request,
			label: `paths ${h3Index ? 'hex ' + h3Index : 'destination ' + destinationIndex}`
		});
	} catch (apiError) {
		console.error('Impact API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'IMPACT_API_URL is not set, so there is no path data source'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 400) return json(await upstream.json(), { status: 400 });
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json());
}
