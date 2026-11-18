import { json } from '@sveltejs/kit';
import { boundariesFetch } from '$lib/server/boundariesApi.js';

/**
 * A country's administrative tree (names and ids, no shapes), from the boundaries API.
 *   ?country=<ISO 3166-1 alpha-3 code, e.g. ETH>
 * Returns { country, max_level, returned_max_level, hierarchy: [{ fika_id, gid, level, name, children }] }.
 * Boundaries change when the import runs, so a browser may keep an answer for an hour.
 *
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ url, platform }) {
	const code = (url.searchParams.get('country') ?? '').toUpperCase();
	if (!/^[A-Z]{3}$/.test(code)) {
		return json(
			{ error: 'Bad country', details: 'country must be a 3-letter ISO code, such as ETH' },
			{ status: 400 }
		);
	}

	let upstream = null;
	try {
		upstream = await boundariesFetch(`/countries/${code}/hierarchy/`, {
			platform,
			label: `hierarchy ${code}`
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
		return json(
			{ error: 'Country not found', details: `No boundaries held for ${code}` },
			{ status: 404 }
		);
	}
	if (!upstream.ok) {
		return json(
			{ error: 'API error', details: `Upstream returned ${upstream.status}` },
			{ status: 502 }
		);
	}
	return json(await upstream.json(), { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
