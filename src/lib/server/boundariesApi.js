import { machineFetch } from '$lib/server/machineApi.js';

/**
 * Calls the Django boundaries API on behalf of a SvelteKit route, with this app's own
 * machine token. The boundaries API is read-only for machine tokens.
 *
 * BOUNDARIES_API_URL and BOUNDARIES_M2M_SECRET point it somewhere other than the impact API,
 * which is handy when the impact API runs locally but boundaries come from production.
 *
 * @param {string} path e.g. '/countries/ETH/hierarchy/'
 * @param {{ platform?: any, label: string }} opts
 */
export function boundariesFetch(path, { platform, label }) {
	return machineFetch(`/boundaries/api${path}`, {
		platform,
		label,
		tag: 'boundaries',
		urlEnv: 'BOUNDARIES_API_URL',
		secretEnv: 'BOUNDARIES_M2M_SECRET'
	});
}
