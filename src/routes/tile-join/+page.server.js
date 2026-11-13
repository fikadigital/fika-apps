import { env } from '$env/dynamic/private';
import { getNumericColumns } from '$lib/server/hexAreas';

export async function load() {
	let columns = [];
	let columnsError = null;
	try {
		columns = await getNumericColumns();
	} catch (error) {
		console.error('Failed to load hex_areas columns:', error);
		columnsError = error.message;
	}

	return {
		mapboxToken: env.MAPBOX_ACCESS_TOKEN,
		columns,
		columnsError
	};
}
