import { json } from '@sveltejs/kit';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import { impactFetch, upstreamError, BROWSER_CACHE } from '$lib/server/impactApi.js';

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
		const facilityIndex = url.searchParams.get('facilityIndex');

		if (!facilityIndex) {
			return json(
				{
					error: 'Missing facilityIndex parameter',
					details: 'facilityIndex query parameter is required'
				},
				{ status: 400 }
			);
		}

		const lng = url.searchParams.get('lng');
		const lat = url.searchParams.get('lat');
		const position =
			lng && lat ? `?lng=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}` : '';

		// Prefer the Django API when configured (the token stays server-side)
		let upstream = null;
		try {
			upstream = await impactFetch(
				`/geostore/api/education-facilities/${encodeURIComponent(parseInt(facilityIndex, 10))}/${position}`,
				{
					platform,
					request,
					label: `education facility ${facilityIndex}`
				}
			);
		} catch (apiError) {
			console.error('Impact API request failed:', apiError);
			return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
		}
		if (upstream) {
			if (upstream.status === 404) {
				return json(
					{
						error: 'Education facility not found',
						details: `No education facility found with index: ${facilityIndex}`
					},
					{ status: 404 }
				);
			}
			if (!upstream.ok) return upstreamError(upstream, json);
			return json(await upstream.json(), BROWSER_CACHE);
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

			// Check if education_facilities table exists
			const tableCheckQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'education_facilities'
                );
            `;

			const tableExists = await client.query(tableCheckQuery);

			if (!tableExists.rows[0].exists) {
				console.warn('education_facilities table does not exist');
				return json(
					{
						error: 'Table not found',
						details: 'The education_facilities table does not exist in the database'
					},
					{ status: 500 }
				);
			}

			// Query for the specific education facility by index
			const query = `
                SELECT * FROM education_facilities 
                WHERE all_education_facilities_index = $1
            `;

			// Execute the query with parameterized input for security
			const result = await client.query(query, [parseInt(facilityIndex)]);
			await client.end();

			// Check if we found the education facility
			if (result.rows.length === 0) {
				return json(
					{
						error: 'Education facility not found',
						details: `No education facility found with index: ${facilityIndex}`
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
