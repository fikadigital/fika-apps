import mapboxgl from 'mapbox-gl';

// Which country is at a point, from Mapbox's country-boundaries tileset (Tilequery API).
// Runs in the browser with the map's public token: no server of ours is involved.

const cache = new Map();

/**
 * Picks one country from a Tilequery response. Where a border is disputed the tileset
 * returns one entry per worldview; use the "all" entry, else Mapbox's default (US) view.
 * @param {{ properties: Record<string, any> }[]} features
 * @returns {{ name: string, code: string } | null}
 */
export function pickCountry(features) {
	const inView = (p) => {
		const views = String(p.worldview ?? '').split(',');
		return views.includes('all') || views.includes('US');
	};
	const hit = features.map((f) => f.properties).find(inView);
	return hit ? { name: hit.name_en, code: hit.iso_3166_1 } : null;
}

/**
 * The country at a longitude/latitude, or null over open water.
 * Throws if the request fails, so the caller can tell "no country" from "lookup broken".
 * @param {number} lng
 * @param {number} lat
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function countryAt(lng, lat, { signal } = {}) {
	const key = `${lng.toFixed(2)},${lat.toFixed(2)}`;
	if (cache.has(key)) return cache.get(key);

	const url =
		`https://api.mapbox.com/v4/mapbox.country-boundaries-v1/tilequery/${lng},${lat}.json` +
		`?limit=5&access_token=${mapboxgl.accessToken}`;
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`Country lookup failed (${res.status})`);

	const { features = [] } = await res.json();
	const country = pickCountry(features);
	cache.set(key, country);
	return country;
}
