import { PmTilesSource } from 'mapbox-pmtiles';

const PMTILES_URL =
	'https://data.source.coop/fika/waternet/pmtiles/waterway_model_outputs_20m_vector.pmtiles';

// All-blue ramp by stream_order: small streams = light blue, major rivers = deep blue
const STREAM_ORDER_BLUES = [
	'#dceefc', // 0 (smallest / unclassified)
	'#c3e0fa',
	'#a6d0f5',
	'#85bdf0',
	'#63a8ea',
	'#4691e0',
	'#2f79d1',
	'#1f63bd',
	'#154ea3',
	'#0d3b82' // largest mainstem rivers
];

export class WaternetLayerManager {
	constructor(map) {
		this.map = map;
	}

	async initialize() {
		if (!this.map) {
			console.warn('Map not available for initializing waternet layer');
			return;
		}

		this.cleanupExistingLayer();

		try {
			const header = await PmTilesSource.getHeader(PMTILES_URL);
			const bounds = [header.minLon, header.minLat, header.maxLon, header.maxLat];

			if (!this.map.getSource('waterways')) {
				this.map.addSource('waterways', {
					type: PmTilesSource.SOURCE_TYPE,
					url: PMTILES_URL,
					minzoom: header.minZoom,
					maxzoom: header.maxZoom,
					bounds
				});
			}

			if (!this.map.getLayer('vector-waternet')) {
				this.map.addLayer(
					{
						id: 'vector-waternet',
						source: 'waterways',
						'source-layer': 'waterways',
						type: 'line',
						minzoom: 9,
						maxzoom: 22,
						filter: [
							'all',
							['!=', ['get', 'intersects_lake'], true],
							['any', ['==', ['get', 'stream_order'], 1], ['>=', ['zoom'], 4]]
						],
						layout: {
							'line-join': 'round',
							'line-cap': 'round',
							visibility: 'visible'
						},
						paint: {
							'line-width': [
								'interpolate',
								['linear'],
								['zoom'],
								10,
								[
									'match',
									['get', 'stream_order'],
									[1],
									0.7,
									[2],
									1.4,
									[3],
									2.1,
									[4],
									2.8,
									[5],
									3.5,
									[6],
									4.2,
									[7],
									4.9,
									[8],
									5.6,
									6.3
								],
								12,
								[
									'match',
									['get', 'stream_order'],
									[1],
									1,
									[2],
									2,
									[3],
									3,
									[4],
									4,
									[5],
									5,
									[6],
									6,
									[7],
									7,
									[8],
									8,
									9
								],
								16,
								[
									'match',
									['get', 'stream_order'],
									[1],
									2,
									[2],
									4,
									[3],
									6,
									[4],
									8,
									[5],
									10,
									[6],
									12,
									[7],
									14,
									[8],
									16,
									18
								]
							],
							'line-color': [
								'match',
								['get', 'stream_order'],
								[0],
								STREAM_ORDER_BLUES[0],
								[1],
								STREAM_ORDER_BLUES[1],
								[2],
								STREAM_ORDER_BLUES[2],
								[3],
								STREAM_ORDER_BLUES[3],
								[4],
								STREAM_ORDER_BLUES[4],
								[5],
								STREAM_ORDER_BLUES[5],
								[6],
								STREAM_ORDER_BLUES[6],
								[7],
								STREAM_ORDER_BLUES[7],
								[8],
								STREAM_ORDER_BLUES[8],
								STREAM_ORDER_BLUES[9]
							],
							'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10, 0.8]
						}
					},
					'hex-layer'
				);
			}
		} catch (error) {
			console.error('Error initializing waternet vector layer:', error);
		}
	}

	cleanupExistingLayer() {
		if (this.map.getLayer('vector-waternet')) {
			this.map.removeLayer('vector-waternet');
		}
		if (this.map.getSource('waterways')) {
			this.map.removeSource('waterways');
		}
	}
}
