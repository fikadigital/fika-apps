// Bridges inside an admin area, fetched through /api/areas/bridges.
// An area is one below the country level; the whole country is not supported.

/** The rank bands of the "top N" spectrum: ranks 1-25, 26-50, 51-100, 101-500, 501-1000. */
export const BRIDGE_TIERS = [
	{ top: 25, color: '#b91c1c' },
	{ top: 50, color: '#ea580c' },
	{ top: 100, color: '#eab308' },
	{ top: 500, color: '#16a34a' },
	{ top: 1000, color: '#2563eb' }
];

/** Index of the band a rank falls in (0 = the best band). */
export function tierOf(rank) {
	const i = BRIDGE_TIERS.findIndex((t) => rank <= t.top);
	return i === -1 ? BRIDGE_TIERS.length - 1 : i;
}

/** "Ranks 26-50" for band 1, and so on. */
export function bandLabel(index) {
	const from = index === 0 ? 1 : BRIDGE_TIERS[index - 1].top + 1;
	return `Ranks ${from}–${BRIDGE_TIERS[index].top}`;
}

const cache = new Map();

async function getJson(url, signal) {
	if (cache.has(url)) return cache.get(url);
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`Bridges request failed (${res.status})`);
	const data = await res.json();
	cache.set(url, data);
	return data;
}

/**
 * Every bridge in the area, as a GeoJSON FeatureCollection with `count` and `truncated`.
 * @param {string} area a fika_id below the country level
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function fetchAreaBridges(area, { signal } = {}) {
	return getJson(`/api/areas/bridges?area=${encodeURIComponent(area)}&limit=20000`, signal);
}

/**
 * The top `top` bridges in the area, each with a `tier` (rank band) added for colouring.
 * @param {string} area a fika_id below the country level
 * @param {number} top 1 to 1000
 * @param {'none' | 'population'} weight
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchRankedBridges(area, top, weight, { signal } = {}) {
	const data = await getJson(
		`/api/areas/bridges/ranked?area=${encodeURIComponent(area)}&top=${top}&weight=${weight}`,
		signal
	);
	return {
		...data,
		features: data.features.map((f) => ({
			...f,
			properties: { ...f.properties, tier: tierOf(f.properties.rank) }
		}))
	};
}
