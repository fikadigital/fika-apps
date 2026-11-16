import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError } from '$lib/server/impactApi.js';

/**
 * The hexes in a map view, each with one value to colour it by, from the impact API.
 *   ?column=<name>&bbox=minLon,minLat,maxLon,maxLat[&limit=n]
 * `column` and the box are checked by the API (it answers 400 with the allowed columns);
 * the limit is capped there at 20,000. Returns { column, count, truncated, hexes: [{ id, value, geometry }] }.
 * The old version of this route read a table, hex_data, that no longer exists.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const query = new URLSearchParams();
	for (const name of ['column', 'bbox', 'limit']) {
		const value = url.searchParams.get(name);
		if (value) query.set(name, value);
	}

	let upstream = null;
	try {
		upstream = await impactFetch(`/geostore/api/hex-values/?${query}`, {
			platform,
			request,
			label: `hex values ${query.get('column') ?? ''}`
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
	if (upstream.status === 400) return json(await upstream.json(), { status: 400 });
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json());
}
