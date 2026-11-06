import { warmImpactAuth } from '$lib/server/impactAuth.js';

// Runs once when the server starts: get the impact API's machine token ahead of
// the first click. (Not awaited, so startup is not delayed.)
warmImpactAuth();
