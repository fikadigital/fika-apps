import { json } from '@sveltejs/kit';
import { impactFetch, upstreamError } from '$lib/server/impactApi.js';

/**
 * Bridge points for a map view, from the impact API, as a GeoJSON FeatureCollection.
 *   ?bbox=minLon,minLat,maxLon,maxLat[&type=...][&limit=n]
 * The API caps a list at 20,000 bridges (the main map draws all of them from tiles), so a
 * view is asked for, not the whole table. The old version of this route queried the database
 * directly and filled in made-up values (country, year, people served).
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform, request }) {
	const query = new URLSearchParams();
	for (const name of ['bbox', 'type', 'limit']) {
		const value = url.searchParams.get(name);
		if (value) query.set(name, value);
	}

	let upstream = null;
	try {
		upstream = await impactFetch(`/geostore/api/bridges/?${query}`, {
			platform,
			request,
			label: 'bridges in view'
		});
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
	if (upstream.status === 400) return json(await upstream.json(), { status: 400 });
	if (!upstream.ok) return upstreamError(upstream, json);
	return json(await upstream.json());
}
