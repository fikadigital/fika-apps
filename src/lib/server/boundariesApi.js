import { env } from '$env/dynamic/private';
import { impactAuthHeaders } from '$lib/server/impactAuth.js';

/**
 * Calls the Django boundaries API on behalf of a SvelteKit route, with this app's own
 * machine token (see impactAuth.js). The boundaries API is read-only for machine tokens.
 *
 * BOUNDARIES_API_URL points it somewhere other than IMPACT_API_URL, which is handy when
 * the impact API runs locally but boundaries should come from production.
 *
 * Returns the upstream Response, or null when the API is not configured.
 *
 * @param {string} path e.g. '/countries/ETH/hierarchy/'
 * @param {{ platform?: any, label: string }} opts
 */
export async function boundariesFetch(path, { platform, label }) {
	const apiBase =
		platform?.env?.BOUNDARIES_API_URL ||
		env.BOUNDARIES_API_URL ||
		platform?.env?.IMPACT_API_URL ||
		env.IMPACT_API_URL;
	if (!apiBase) return null;

	const headers = await impactAuthHeaders(platform).catch(() => null);
	if (!headers) return null;

	const t0 = performance.now();
	const res = await fetch(`${apiBase.replace(/\/$/, '')}/boundaries/api${path}`, {
		headers: { ...headers, 'Accept-Encoding': 'gzip' },
		signal: AbortSignal.timeout(40000)
	});
	console.log(
		`[boundaries] ${label}: app token, Django ${Math.round(performance.now() - t0)} ms (${res.status})`
	);
	return res;
}
