import { env } from '$env/dynamic/private';
import { impactAuthHeaders, machineAuthHeaders } from '$lib/server/impactAuth.js';

/**
 * Calls one of the Django API's areas of functionality on behalf of a SvelteKit route, with
 * this app's own machine token. Each caller names the environment variables that may point it
 * somewhere else, so a local impact API can sit beside a production (or staging) one:
 *   <urlEnv>     the base address; falls back to IMPACT_API_URL
 *   <secretEnv>  its own machine secret; falls back to the impact API's credential
 *
 * Returns the upstream Response, or null when no address or credential is configured.
 *
 * @param {string} path appended to the base address, e.g. '/boundaries/api/countries/ETH/hierarchy/'
 * @param {{ platform?: any, label: string, tag: string, urlEnv: string, secretEnv: string, timeoutMs?: number }} opts
 */
export async function machineFetch(
	path,
	{ platform, label, tag, urlEnv, secretEnv, timeoutMs = 40000 }
) {
	const apiBase =
		platform?.env?.[urlEnv] || env[urlEnv] || platform?.env?.IMPACT_API_URL || env.IMPACT_API_URL;
	if (!apiBase) return null;

	const ownSecret = platform?.env?.[secretEnv] || env[secretEnv];
	const headers = await (
		ownSecret ? machineAuthHeaders(ownSecret) : impactAuthHeaders(platform)
	).catch(() => null);
	if (!headers) return null;

	const t0 = performance.now();
	const res = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
		headers: { ...headers, 'Accept-Encoding': 'gzip' },
		signal: AbortSignal.timeout(timeoutMs)
	});
	console.log(
		`[${tag}] ${label}: app token, Django ${Math.round(performance.now() - t0)} ms (${res.status})`
	);
	return res;
}
