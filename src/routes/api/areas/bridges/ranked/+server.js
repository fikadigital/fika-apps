import { json } from '@sveltejs/kit';
import { areaBridgesFetch } from '$lib/server/areaBridgesApi.js';

const AREA = /^[a-z]{3}-adm[1-9][0-9]*-[0-9]{5}$/;
const TYPE = /^[A-Za-z0-9_.-]{1,40}$/;

/**
 * The top-ranked bridges inside one area, from the geostore API.
 *   ?area=<fika_id>&top=<1-1000>[&weight=none|population][&type=<bridge_type>]
 * Each feature carries rank, score, hexes_served, population_served and minutes_saved.
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
	const top = Number(url.searchParams.get('top'));
	if (!Number.isInteger(top) || top < 1 || top > 1000) {
		return json(
			{ error: 'Bad top', details: 'top must be a whole number from 1 to 1000' },
			{ status: 400 }
		);
	}
	const weight = url.searchParams.get('weight') ?? 'none';
	if (weight !== 'none' && weight !== 'population') {
		return json(
			{ error: 'Bad weight', details: 'weight must be none or population' },
			{ status: 400 }
		);
	}

	const query = new URLSearchParams({ top: String(top), weight });
	const type = url.searchParams.get('type');
	if (type) {
		if (!TYPE.test(type)) return json({ error: 'Bad type' }, { status: 400 });
		query.set('type', type);
	}

	let upstream = null;
	try {
		upstream = await areaBridgesFetch(`/areas/${area}/bridges/ranked/?${query}`, {
			platform,
			label: `ranked ${area} top ${top} ${weight}`
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
	if (!upstream.ok) {
		return json(
			{ error: 'API error', details: `Upstream returned ${upstream.status}` },
			{ status: 502 }
		);
	}
	return json(await upstream.json(), { headers: { 'Cache-Control': 'public, max-age=600' } });
}
