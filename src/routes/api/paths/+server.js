import { json } from '@sveltejs/kit';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import { impactFetch, upstreamError } from '$lib/server/impactApi.js';

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
		const h3Index = url.searchParams.get('h3_index');
		const destinationIndex = url.searchParams.get('destination_index');

		// Validate parameters
		if (!h3Index && !destinationIndex) {
			return json(
				{
					error: 'Missing required parameters',
					details: 'Either h3_index or destination_index parameter is required'
				},
				{ status: 400 }
			);
		}

		const pathQuery = new URLSearchParams();
		if (h3Index) pathQuery.set('h3_index', h3Index);
		if (destinationIndex) pathQuery.set('destination_index', destinationIndex);
		// Prefer the Django API when configured (the token stays server-side)
		let upstream = null;
		try {
			upstream = await impactFetch(`/geostore/api/paths/?${pathQuery}`, {
				platform,
				request,
				label: `paths ${h3Index ? 'hex ' + h3Index : 'destination ' + destinationIndex}`
			});
		} catch (apiError) {
			console.error('Impact API request failed:', apiError);
			return json({ error: 'API request failed', details: apiError.message }, { status: 502 });
		}
		if (upstream) {
			if (upstream.status === 400) {
				return json(await upstream.json(), { status: 400 });
			}
			if (!upstream.ok) return upstreamError(upstream, json);
			return json(await upstream.json());
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

			// Check if all_paths table exists
			const tableCheckQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'all_paths'
                );
            `;

			const tableExists = await client.query(tableCheckQuery);

			if (!tableExists.rows[0].exists) {
				console.warn('all_paths table does not exist');
				return json(
					{
						error: 'Table not found',
						details: 'The all_paths table does not exist in the database'
					},
					{ status: 500 }
				);
			}

			let query, params;

			if (h3Index && destinationIndex) {
				// Query specific path by both h3_index and destination_index
				query = `
                    SELECT *, ST_AsGeoJSON(geometry) as geojson_geometry FROM all_paths 
                    WHERE h3_index = $1 AND destination_index = $2
                `;
				params = [h3Index, destinationIndex];
			} else if (h3Index) {
				// Query all paths for a specific hex
				query = `
                    SELECT *, ST_AsGeoJSON(geometry) as geojson_geometry FROM all_paths 
                    WHERE h3_index = $1
                `;
				params = [h3Index];
			} else if (destinationIndex) {
				// Query all paths to a specific destination
				query = `
                    SELECT *, ST_AsGeoJSON(geometry) as geojson_geometry FROM all_paths 
                    WHERE destination_index = $1
                `;
				params = [destinationIndex];
			}

			// Execute the query with parameterized input for security
			const result = await client.query(query, params);
			await client.end();

			// Log first row for debugging geometry format
			if (result.rows.length > 0) {
				console.log('Sample path data structure:', {
					columns: Object.keys(result.rows[0]),
					sampleRow: result.rows[0]
				});
			}

			// Return the results
			return json({
				paths: result.rows,
				count: result.rows.length
			});
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
