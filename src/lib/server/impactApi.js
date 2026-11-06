import { env } from '$env/dynamic/private';
import { impactAuthHeaders } from '$lib/server/impactAuth.js';

/**
 * Calls the Django impact API on behalf of a SvelteKit route.
 *
 * Tier 1: a signed-in user's Clerk session token, forwarded as their browser sent it.
 * Tier 2: this app's own machine token (see impactAuth.js).
 *
 * Returns the upstream Response, or null when the API is not configured, so the
 * caller can fall back to its own database code.
 *
 * @param {string} path e.g. '/geostore/api/paths/?h3_index=...'
 * @param {{ platform?: any, request?: Request, label: string }} opts
 */
export async function impactFetch(path, { platform, request, label }) {
	const apiBase = platform?.env?.IMPACT_API_URL || env.IMPACT_API_URL;
	if (!apiBase) return null;

	const userAuth = request?.headers.get('authorization') || '';
	const forwardUser = /^bearer\s+\S+/i.test(userAuth);
	const headers = forwardUser
		? { Authorization: userAuth }
		: await impactAuthHeaders(platform).catch(() => null);
	if (!headers) return null;

	const url = `${apiBase.replace(/\/$/, '')}${path}`;
	const t0 = performance.now();
	let credential = forwardUser ? 'user token' : 'app token';
	// A little longer than Django's own 30 s database limit, so its error reaches us.
	let res = await fetch(url, { headers, signal: AbortSignal.timeout(40000) });

	if (res.status === 401 && forwardUser) {
		// The map is public for now, so a rejected user token (expired, or from another
		// Clerk app) falls back to the app credential. Remove once sign-in is required.
		const appHeaders = await impactAuthHeaders(platform).catch(() => null);
		if (appHeaders) {
			console.log('[impact] user token rejected by Django (401); using the app token');
			credential = 'app token (fallback)';
			res = await fetch(url, { headers: appHeaders, signal: AbortSignal.timeout(40000) });
		}
	}
	const cache = res.headers.get('x-geostore-cache');
	console.log(
		`[impact] ${label}: ${credential}, Django ${Math.round(performance.now() - t0)} ms (${res.status})${cache ? `, cache ${cache}` : ''}`
	);
	return res;
}

/** The JSON error a route returns for an upstream failure. */
export function upstreamError(res, json) {
	if (res.status === 501) {
		return json(
			{ error: 'Not available', details: 'This lookup is switched off on the API for now' },
			{ status: 501 }
		);
	}
	if (res.status === 504) {
		return json(
			{ error: 'Lookup too slow', details: 'The API gave up waiting for the database' },
			{ status: 504 }
		);
	}
	return json({ error: 'API error', details: `Upstream returned ${res.status}` }, { status: 502 });
}

/** Lets the browser keep a successful answer for a few minutes too, so a repeat click on
 * the same facility or bridge does not leave the machine. Same lifetime as the API's. */
export const BROWSER_CACHE = { headers: { 'Cache-Control': 'private, max-age=300' } };
