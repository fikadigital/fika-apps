import { json } from '@sveltejs/kit';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import { impactAuthHeaders } from '$lib/server/impactAuth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, platform, request }) {
	try {
		// Get database connection string
		const connectionString = platform?.env?.DATABASE_URL || env.DATABASE_URL;

		// Require a database connection
		if (!connectionString) {
			return json(
				{
					error: 'Database connection missing',
					details: 'No connection string provided'
				},
				{ status: 500 }
			);
		}

		// Parse query parameters
		const hexID = url.searchParams.get('hexID');

		if (!hexID) {
			return json(
				{
					error: 'Missing hexID parameter',
					details: 'hexID query parameter is required'
				},
				{ status: 400 }
			);
		}

		// Prefer the Django API when configured (key stays server-side)
		const apiBase = platform?.env?.IMPACT_API_URL || env.IMPACT_API_URL;
		const t0 = performance.now();
		// Tier 1: a signed-in user's Clerk session token, forwarded as sent by their
		// browser. Tier 2: this app's own machine token (see impactAuth.js).
		const userAuth = request.headers.get('authorization');
		const forwardUser = !!apiBase && /^bearer\s+\S+/i.test(userAuth || '');
		const authHeaders = !apiBase
			? null
			: forwardUser
				? { Authorization: userAuth }
				: await impactAuthHeaders(platform).catch(() => null);
		const authMs = Math.round(performance.now() - t0);
		if (apiBase && authHeaders) {
			try {
				const t1 = performance.now();
				const hexUrl = `${apiBase.replace(/\/$/, '')}/geostore/api/hexes/${encodeURIComponent(hexID)}/`;
				let credential = forwardUser ? 'user token' : 'app token';
				let res = await fetch(hexUrl, { headers: authHeaders, signal: AbortSignal.timeout(30000) });
				if (res.status === 401 && forwardUser) {
					// The map is public for now, so a rejected user token (expired, or from
					// another Clerk app) falls back to the app credential. Remove this once
					// everyone has to sign in.
					const appHeaders = await impactAuthHeaders(platform).catch(() => null);
					if (appHeaders) {
						console.log('[impact] user token rejected by Django (401); using the app token');
						credential = 'app token (fallback)';
						res = await fetch(hexUrl, { headers: appHeaders, signal: AbortSignal.timeout(30000) });
					}
				}
				console.log(
					`[impact] hex ${hexID}: ${credential}, credential ${authMs} ms, Django ${Math.round(performance.now() - t1)} ms (${res.status}), total ${Math.round(performance.now() - t0)} ms`
				);
				if (res.status === 404) {
					return json(
						{ error: 'Hex not found', details: `No hex found with ID: ${hexID}` },
						{ status: 404 }
					);
				}
				if (!res.ok) {
					console.error('Impact API error:', res.status);
					return json(
						{ error: 'API error', details: `Upstream returned ${res.status}` },
						{ status: 502 }
					);
				}
				return json(await res.json());
			} catch (apiError) {
				console.error('Impact API request failed:', apiError);
				return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
			}
		}

		try {
			// Create client and connect
			const client = new pg.Client({
				connectionString,
				statement_timeout: 30000,
				connectionTimeoutMillis: 30000
			});

			// Proper error handling for connection
			try {
				await client.connect();
			} catch (connectError) {
				console.error('Failed to connect to database:', connectError);
				return json(
					{
						error: 'Database connection failed',
						details: connectError.message
					},
					{ status: 500 }
				);
			}

			// Check if hex_areas table exists
			const tableCheckQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'hex_areas'
                );
            `;

			const tableExists = await client.query(tableCheckQuery);

			if (!tableExists.rows[0].exists) {
				console.warn('hex_areas table does not exist');
				return json(
					{
						error: 'Table not found',
						details: 'The hex_areas table does not exist in the database'
					},
					{ status: 500 }
				);
			}

			// Query for the specific hex by hexID
			const query = `
                SELECT * FROM hex_areas 
                WHERE h3_index = $1
            `;

			// Execute the query with parameterized input for security
			const result = await client.query(query, [hexID]);
			await client.end();

			// Check if we found the hex
			if (result.rows.length === 0) {
				return json(
					{
						error: 'Hex not found',
						details: `No hex found with ID: ${hexID}`
					},
					{ status: 404 }
				);
			}

			return json(result.rows[0]);
		} catch (dbError) {
			console.error('Database error:', dbError);
			// Return error for client to handle
			return json(
				{
					error: 'Database error',
					details: dbError.message
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Server error:', error);
		return json(
			{
				error: 'Server error',
				details: error.message
			},
			{ status: 500 }
		);
	}
}
