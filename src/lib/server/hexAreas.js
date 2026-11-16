import pg from 'pg';
import { env } from '$env/dynamic/private';

const NUMERIC_TYPES = new Set([
	'bigint',
	'integer',
	'smallint',
	'double precision',
	'real',
	'numeric'
]);
const EXCLUDED_COLUMNS = new Set(['tile_x', 'tile_y']);

let pool;
let numericColumnsPromise;

export function getPool() {
	if (!pool) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
		pool = new pg.Pool({
			connectionString: env.DATABASE_URL,
			max: 6,
			statement_timeout: 30000,
			connectionTimeoutMillis: 30000
		});
	}
	return pool;
}

/**
 * Numeric columns on the hex_values materialized view (see src/routes/tile-join/hex_values.sql)
 * that can be styled. Used both to populate the UI and as a whitelist, since column identifiers
 * can't be passed as query parameters. Reads pg_attribute because information_schema doesn't
 * list materialized views.
 * @returns {Promise<string[]>}
 */
export function getNumericColumns() {
	if (!numericColumnsPromise) {
		numericColumnsPromise = getPool()
			.query(
				`SELECT attname AS column_name, format_type(atttypid, atttypmod) AS data_type
				 FROM pg_attribute
				 WHERE attrelid = 'public.hex_values'::regclass AND attnum > 0 AND NOT attisdropped
				 ORDER BY attnum`
			)
			.then(({ rows }) =>
				rows
					.filter((r) => NUMERIC_TYPES.has(r.data_type) && !EXCLUDED_COLUMNS.has(r.column_name))
					.map((r) => r.column_name)
			)
			.catch((error) => {
				numericColumnsPromise = undefined;
				throw error;
			});
	}
	return numericColumnsPromise;
}
