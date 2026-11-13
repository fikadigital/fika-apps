import { json } from '@sveltejs/kit';
import { getPool, getNumericColumns } from '$lib/server/hexAreas';

// hex_values is keyed by the z8 tile containing each hex centroid
const TILE_ZOOM = 8;

const FLAG_HAS_IDS = 1;

/**
 * Binary layout (little-endian):
 *   bytes 0-3   uint32  count
 *   bytes 4-7   uint32  flags (bit 0: ids included)
 *   [if ids]    count × uint64   H3 cell index
 *   then        count × float32  value (NaN = null)
 * The 8-byte header keeps the uint64 block 8-byte aligned so the client can view it directly.
 */
function encodeTile(rows, includeIds) {
	const count = rows.length;
	const buffer = new ArrayBuffer(8 + (includeIds ? count * 8 : 0) + count * 4);
	const view = new DataView(buffer);
	view.setUint32(0, count, true);
	view.setUint32(4, includeIds ? FLAG_HAS_IDS : 0, true);

	let offset = 8;
	if (includeIds) {
		for (let i = 0; i < count; i++, offset += 8) {
			view.setBigUint64(offset, BigInt(`0x${rows[i].h3_index}`), true);
		}
	}
	for (let i = 0; i < count; i++, offset += 4) {
		view.setFloat32(offset, rows[i].v ?? NaN, true);
	}
	return buffer;
}

// Returns every hex whose centroid falls in the given z8 web mercator tile, with its value for
// one numeric column, in the binary format above. Pass ids=1 to include the H3 ids; the client
// fetches them once per tile and reuses them for every column.
/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const z = Number(url.searchParams.get('z'));
	const x = Number(url.searchParams.get('x'));
	const y = Number(url.searchParams.get('y'));
	const column = url.searchParams.get('column');

	const max = 2 ** TILE_ZOOM;
	if (
		z !== TILE_ZOOM ||
		![x, y].every(Number.isInteger) ||
		x < 0 ||
		x >= max ||
		y < 0 ||
		y >= max
	) {
		return json(
			{ error: `Invalid tile coordinates (only z=${TILE_ZOOM} is supported)` },
			{ status: 400 }
		);
	}

	try {
		const columns = await getNumericColumns();
		if (!columns.includes(column)) {
			return json({ error: `Unknown column: ${column}` }, { status: 400 });
		}

		const includeIds = url.searchParams.get('ids') === '1';

		// column is whitelisted above, so interpolating the identifier is safe.
		// Every hex in the tile is returned (nulls included) in h3_index order, so a values-only
		// response lines up with ids fetched earlier for the same tile.
		const { rows } = await getPool().query(
			`SELECT ${includeIds ? 'h3_index,' : ''} "${column}"::float8 AS v
			 FROM hex_values
			 WHERE tile_x = $1 AND tile_y = $2
			 ORDER BY h3_index`,
			[x, y]
		);

		return new Response(encodeTile(rows, includeIds), {
			headers: {
				'content-type': 'application/octet-stream',
				'cache-control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('Error fetching hex tile values:', error);
		return json({ error: 'Database error', details: error.message }, { status: 500 });
	}
}
