import { json } from '@sveltejs/kit';
import { boundariesFetch } from '$lib/server/boundariesApi.js';

/**
 * One area's outline as a GeoJSON Feature, from the boundaries API.
 *   ?id=<fika_id or gid, e.g. eth-adm1-00008 or ET02>
 * Boundaries change when the import runs, so a browser may keep an answer for an hour.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform }) {
	const id = url.searchParams.get('id') ?? '';
	if (!/^[A-Za-z0-9._-]{2,40}$/.test(id)) {
		return json(
			{ error: 'Bad id', details: 'id must be a fika_id or gid, such as eth-adm1-00008' },
			{ status: 400 }
		);
	}

	let upstream = null;
	try {
		upstream = await boundariesFetch(`/shapes/${encodeURIComponent(id)}/?format=geojson`, {
			platform,
			label: `shape ${id}`
		});
	} catch (apiError) {
		console.error('Boundaries API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'IMPACT_API_URL (or BOUNDARIES_API_URL) and a machine secret are required'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 404) {
		return json({ error: 'Area not found', details: `No area with id ${id}` }, { status: 404 });
	}
	if (!upstream.ok) {
		return json(
			{ error: 'API error', details: `Upstream returned ${upstream.status}` },
			{ status: 502 }
		);
	}
	return json(await upstream.json(), { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
