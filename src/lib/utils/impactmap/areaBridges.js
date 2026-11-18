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

// Requests are shared: asking for something already fetched, or already on its way, returns the
// same result. A failed request is forgotten so that "Try again" really tries again.
const requests = new Map();
/** The answers that have arrived, by url, so they can be read without waiting. */
const resolved = new Map();

function shared(url) {
	if (!requests.has(url)) {
		const request = fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`Bridges request failed (${res.status})`);
				return res.json();
			})
			.then((data) => {
				resolved.set(url, data);
				return data;
			})
			.catch((error) => {
				requests.delete(url);
				throw error;
			});
		requests.set(url, request);
	}
	return requests.get(url);
}

/** Lets a caller stop waiting without cancelling the request that others may share. */
function until(promise, signal) {
	if (!signal) return promise;
	return new Promise((resolve, reject) => {
		const abort = () => reject(new DOMException('Aborted', 'AbortError'));
		if (signal.aborted) return abort();
		signal.addEventListener('abort', abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

// The server ranks bridges 1..N whatever N is, so one request for the top 1000 answers every
// choice on the spectrum; the browser slices it.
const RANKED_POOL = 1000;
const areaUrl = (area) => `/api/areas/bridges?area=${encodeURIComponent(area)}&limit=20000`;
const rankedUrl = (area, weight) =>
	`/api/areas/bridges/ranked?area=${encodeURIComponent(area)}&top=${RANKED_POOL}&weight=${weight}`;

/** The first `top` ranks of a ranked response, each with a `tier` (rank band) for colouring. */
function sliceRanked(data, top) {
	return {
		...data,
		top,
		features: data.features
			.filter((f) => f.properties.rank <= top)
			.map((f) => ({ ...f, properties: { ...f.properties, tier: tierOf(f.properties.rank) } }))
	};
}

/**
 * Every bridge in the area, as a GeoJSON FeatureCollection with `count` and `truncated`.
 * @param {string} area a fika_id below the country level
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function fetchAreaBridges(area, { signal } = {}) {
	return until(shared(areaUrl(area)), signal);
}

/**
 * The top `top` bridges in the area. The first call for an area and weighting asks the server for
 * the top 1000; later calls, for any `top`, are answered from that without another request.
 * @param {string} area a fika_id below the country level
 * @param {number} top 1 to 1000
 * @param {'none' | 'population'} weight
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchRankedBridges(area, top, weight, { signal } = {}) {
	return sliceRanked(await until(shared(rankedUrl(area, weight)), signal), top);
}

/** Starts fetching the ranked bridges in the background, so a later choice is instant. */
export function warmRankedBridges(area, weight) {
	shared(rankedUrl(area, weight)).catch(() => {});
}

/** The ranked bridges if they are already here, else null. Never starts a request. */
export function cachedRankedBridges(area, top, weight) {
	const data = resolved.get(rankedUrl(area, weight));
	return data ? sliceRanked(data, top) : null;
}
