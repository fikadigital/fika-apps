import { browser } from '$app/environment';
import { PUBLIC_CLERK_PUBLISHABLE_KEY } from '$env/static/public';

// Reads the Clerk session shared with the Fika Digital platform (same Clerk instance).
export const clerkState = $state({ loaded: false, user: null });

export async function initClerk() {
	if (!browser || clerkState.loaded) return;
	const { Clerk } = await import('@clerk/clerk-js');
	const clerk = new Clerk(PUBLIC_CLERK_PUBLISHABLE_KEY);
	await clerk.load();
	const sync = () => (clerkState.user = clerk.user ?? null);
	clerk.addListener(sync);
	sync();
	clerkState.loaded = true;
}
