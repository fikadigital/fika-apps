import { env } from '$env/dynamic/private';

// Credentials for calling the Django impact API from the SvelteKit server.
// Prefers a Clerk machine token (IMPACT_M2M_SECRET = this app's machine secret);
// falls back to the shared API key (IMPACT_API_KEY). Server-only: nothing here
// reaches the browser.

// JWT tokens are checked by Django offline (no Clerk call per request) but cannot be
// revoked before they expire, so keep them short.
const LIFETIME_SECONDS = 600;
const REFRESH_BEFORE_MS = 60_000; // renew a minute before expiry

/** @type {{ token: string, expiresAt: number } | null} */
let cached = null;
/** @type {Promise<string> | null} */
let inflight = null;

async function fetchToken(machineSecret) {
	const started = performance.now();
	const res = await fetch('https://api.clerk.com/v1/m2m_tokens', {
		method: 'POST',
		headers: { Authorization: `Bearer ${machineSecret}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ token_format: 'jwt', seconds_until_expiration: LIFETIME_SECONDS }),
		signal: AbortSignal.timeout(10000)
	});
	if (!res.ok) throw new Error(`Clerk token request failed (${res.status})`);
	const body = await res.json();
	cached = { token: body.token, expiresAt: Date.now() + LIFETIME_SECONDS * 1000 };
	console.log(
		`[impact] new machine token from Clerk in ${Math.round(performance.now() - started)} ms (valid ${LIFETIME_SECONDS}s)`
	);
	return body.token;
}

async function machineToken(machineSecret) {
	if (cached && Date.now() < cached.expiresAt - REFRESH_BEFORE_MS) return cached.token;
	// One refresh at a time, so a burst of clicks makes one Clerk call.
	inflight ??= fetchToken(machineSecret).finally(() => (inflight = null));
	return inflight;
}

/** This app's machine secret. CLERK_PIPELINE_MACHINE_SECRET is the name the shared .env
 * uses for the same value. */
function machineSecretOf(platform) {
	return (
		platform?.env?.IMPACT_M2M_SECRET ||
		env.IMPACT_M2M_SECRET ||
		platform?.env?.CLERK_PIPELINE_MACHINE_SECRET ||
		env.CLERK_PIPELINE_MACHINE_SECRET
	);
}

/** Headers to send to the impact API, or null when no credential is configured. */
export async function impactAuthHeaders(platform) {
	const machineSecret = machineSecretOf(platform);
	if (machineSecret) {
		return { Authorization: `Bearer ${await machineToken(machineSecret)}` };
	}
	const apiKey = platform?.env?.IMPACT_API_KEY || env.IMPACT_API_KEY;
	return apiKey ? { 'X-API-Key': apiKey } : null;
}

/** Fetch the first machine token now, so the first real request does not wait for
 * Clerk. Safe to call without a machine secret, and never throws. */
export async function warmImpactAuth() {
	const machineSecret = machineSecretOf();
	if (!machineSecret) return;
	try {
		await machineToken(machineSecret);
	} catch (e) {
		console.warn('Impact API token warm-up failed; it will be retried on the first request');
	}
}
