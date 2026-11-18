import { json } from '@sveltejs/kit';
import { areaBridgesFetch } from '$lib/server/areaBridgesApi.js';

// A level 1 area or deeper, e.g. eth-adm1-00008. The whole country (adm0) is refused here
// because the API takes about 30 s to fail on it.
const AREA = /^[a-z]{3}-adm[1-9][0-9]*-[0-9]{5}$/;
const TYPE = /^[A-Za-z0-9_.-]{1,40}$/;

/**
 * The bridges inside one area, as GeoJSON points, from the geostore API.
 *   ?area=<fika_id>[&type=<bridge_type>][&limit=<1-20000>]
 * Returns { type, area, count, truncated, features }. Bridges change when the pipeline
 * reloads the data, so a browser may keep an answer for ten minutes.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform }) {
	const area = url.searchParams.get('area') ?? '';
	if (!AREA.test(area)) {
		return json(
			{
				error: 'Bad area',
				details: 'area must be a fika_id below the country level, such as eth-adm1-00008'
			},
			{ status: 400 }
		);
	}

	const query = new URLSearchParams();
	const type = url.searchParams.get('type');
	if (type) {
		if (!TYPE.test(type)) return json({ error: 'Bad type' }, { status: 400 });
		query.set('type', type);
	}
	const limit = Number(url.searchParams.get('limit') ?? 20000);
	if (!Number.isInteger(limit) || limit < 1 || limit > 20000) {
		return json(
			{ error: 'Bad limit', details: 'limit must be a whole number from 1 to 20000' },
			{ status: 400 }
		);
	}
	query.set('limit', String(limit));

	let upstream = null;
	try {
		upstream = await areaBridgesFetch(`/areas/${area}/bridges/?${query}`, {
			platform,
			label: `bridges ${area}`
		});
	} catch (apiError) {
		console.error('Bridges API request failed:', apiError);
		return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
	}

	if (!upstream) {
		return json(
			{
				error: 'Not configured',
				details: 'BRIDGES_API_URL (or IMPACT_API_URL) and a machine secret are required'
			},
			{ status: 503 }
		);
	}
	if (upstream.status === 404) {
		return json({ error: 'Area not found', details: `No area ${area}` }, { status: 404 });
	}
	if (upstream.status === 400) return json(await upstream.json(), { status: 400 });
	if (upstream.status === 504 || upstream.status === 500) {
		// The API gives up after about 30 s on a very large area and answers 504 (or 500).
		return json(
			{
				error: 'Area too large',
				details: 'The API could not answer for this area in time. Try a smaller area.'
			},
			{ status: 504 }
		);
	}
	if (!upstream.ok) {
		return json(
			{ error: 'API error', details: `Upstream returned ${upstream.status}` },
			{ status: 502 }
		);
	}
	return json(await upstream.json(), { headers: { 'Cache-Control': 'public, max-age=600' } });
}
