import { machineFetch } from '$lib/server/machineApi.js';

/**
 * Calls the Django geostore API's bridges-in-an-area endpoints on behalf of a SvelteKit route.
 *
 * BRIDGES_API_URL and BRIDGES_M2M_SECRET point it somewhere other than the impact API. These
 * endpoints live on the staging API before production, so locally they usually differ.
 *
 * @param {string} path e.g. '/areas/eth-adm1-00008/bridges/?limit=20000'
 * @param {{ platform?: any, label: string }} opts
 */
export function areaBridgesFetch(path, { platform, label }) {
	return machineFetch(`/geostore/api${path}`, {
		platform,
		label,
		tag: 'bridges',
		urlEnv: 'BRIDGES_API_URL',
		secretEnv: 'BRIDGES_M2M_SECRET',
		timeoutMs: 60000
	});
}
