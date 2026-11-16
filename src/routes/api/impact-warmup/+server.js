import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { impactAuthHeaders } from '$lib/server/impactAuth.js';

// Called in the background when the impact map opens: gets the machine token and
// has Django open its database connection, so the first hex click is not the
// request that pays for both. Returns nothing useful and never fails the page.

/** @type {import('./$types').RequestHandler} */
export async function GET({ platform }) {
	const apiBase = platform?.env?.IMPACT_API_URL || env.IMPACT_API_URL;
	const headers = apiBase ? await impactAuthHeaders(platform).catch(() => null) : null;
	if (!apiBase || !headers) return new Response(null, { status: 204 });
	try {
		const t0 = performance.now();
		const res = await fetch(`${apiBase.replace(/\/$/, '')}/geostore/api/ping/`, {
			headers,
			signal: AbortSignal.timeout(15000)
		});
		console.log(
			`[impact] warm-up ping: Django ${Math.round(performance.now() - t0)} ms (${res.status})`
		);
		return json({ ok: res.ok });
	} catch {
		return json({ ok: false });
	}
}
