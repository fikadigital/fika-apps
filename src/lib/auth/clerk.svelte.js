import { browser } from '$app/environment';
import { PUBLIC_CLERK_PUBLISHABLE_KEY } from '$env/static/public';

// Reads the Clerk session shared with the Fika Digital platform (same Clerk instance).
export const clerkState = $state({ loaded: false, user: null });

let clerkInstance = null;

export async function initClerk() {
	if (!browser || clerkState.loaded) return;
	const { Clerk } = await import('@clerk/clerk-js');
	const clerk = new Clerk(PUBLIC_CLERK_PUBLISHABLE_KEY);
	await clerk.load();
	clerkInstance = clerk;
	const sync = () => (clerkState.user = clerk.user ?? null);
	clerk.addListener(sync);
	sync();
	clerkState.loaded = true;
}

/** The signed-in user's short-lived Clerk session token, or null if nobody is
 * signed in (or Clerk has not loaded). Never throws. */
export async function sessionToken() {
	try {
		return (await clerkInstance?.session?.getToken()) ?? null;
	} catch {
		return null;
	}
}

/** fetch() that adds the signed-in user's Clerk session token, when there is one.
 * The server forwards it to the impact API; without it the app's own token is used. */
export async function authFetch(input, init = {}) {
	const token = await sessionToken();
	if (!token) return fetch(input, init);
	return fetch(input, {
		...init,
		headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
	});
}
