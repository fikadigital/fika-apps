const generalState = $state({
	controlPanelOpen: true
});

const waternetMapState = $state({
	visibility: {
		vectorData: false,
		rasterData: true,
		satelliteImagery: false
	},
	style: {
		selectedPalette: 'inferno',
		satStyle: 'Color',
		vectorStyle: 'Stream Order',
		streamOrderThreshold: 12,
		streamOrderValue: ''
	}
});

const saiMapState = $state({
	selectedViz: 'travel_time_no_sites_all_education',
	selectedPalette: 'ylorrd',
	reversePalette: false,
	satelliteImagery: false,
	clickedData: {},
	tourActive: false
});

const hexMapState = $state({
	selectedViz: 'population',
	selectedPalette: 'magma',
	reversePalette: true,
	satelliteImagery: false,
	clickedData: {}
});

const impactMapDatabaseState = $state({
	selectedLayer: 'bridges',
	selectedPalette: 'viridis',
	satelliteImagery: false,
	highlightedFeature: null,
	filterByYear: false,
	yearRange: [2010, 2024],
	loadingData: false,
	error: null,
	enableClustering: false,
	dataCount: 0,
	showHexLayer: true,
	hexDataViz: 'population',
	hexReversePalette: true
});

const impactMapState = $state({
	menuState: 'Relative Wealth Index',
	dataName: 'rwi',
	satelliteImagery: false,
	clickedData: {},
	dataMapKey: 'Relative Wealth Index', // Key to the selected data in impactDataMap
	selectedHexData: null, // Currently selected hex data from API
	filterMode: false, // Whether infrastructure filtering is active
	highlightedBridges: [], // Array of bridge IDs to highlight
	highlightedHealthFacilities: [], // Array of health facility IDs to highlight
	highlightedEducationFacilities: [], // Array of education facility IDs to highlight
	// Reverse filtering (infrastructure to hex)
	reverseFilterMode: false, // Whether reverse infrastructure filtering is active
	selectedInfrastructureData: null, // Currently selected infrastructure data from API
	selectedInfrastructureType: null, // 'bridge', 'health', or 'education'
	highlightedHexes: [], // Array of hex IDs to highlight when infrastructure is selected
	// Path visualization
	pathsVisible: false, // Whether paths are currently displayed
	selectedPaths: [], // Array of current path data
	pathHighlightId: null, // ID of currently highlighted path
	pathDestinationType: 'default', // Type of destination for path styling ('health', 'education', 'bridge', 'default')
	// Hex data panel
	hexDataPanelOpen: false // Whether the hex data analysis panel is open
});

const zambiaMapState = $state({
	selectedMetric: 'population',
	selectedHexData: null,
	selectedBridgeData: null,
	selectedDestinationData: null,
	filterMode: false,
	clickedFeatureType: null, // 'hex', 'bridge', or 'destination'
	highlightedBridges: [],
	highlightedDestinations: [],
	highlightedHexes: [],
	pathsVisible: false,
	dataPanelOpen: false,
	walkthroughActive: false
});

const vizLabState = $state({
	mapStyleUrl: 'mapbox://styles/bridgestoprosperity/cm4kippxv01k101slb7hs8mvr',
	appliedStyleUrl: 'mapbox://styles/bridgestoprosperity/cm4kippxv01k101slb7hs8mvr',
	styleError: '',
	satellite: { visible: false, blackAndWhite: false },
	vector: {
		visible: true,
		url: 'https://data.source.coop/fika/waternet/pmtiles/waterway_model_outputs_20m_vector.pmtiles',
		sourceLayer: 'waterways',
		appliedUrl: '',
		appliedSourceLayer: '',
		loadNonce: 0,
		error: '',
		properties: [], // [{ name, type: 'number' | 'string', min, max, values }]
		property: 'stream_order',
		mode: 'gradient', // 'gradient' | 'categorical' | 'solid'
		paletteName: 'Custom',
		stops: [
			{ value: 1, color: 'rgba(147, 236, 221, 1)' },
			{ value: 4, color: 'rgba(102, 169, 218, 1)' },
			{ value: 8, color: 'rgba(106, 17, 177, 1)' },
			{ value: 12, color: 'rgba(159, 35, 126, 1)' }
		],
		categories: [], // [{ value, color }]
		solidColor: 'rgba(0, 145, 73, 1)',
		opacity: 1,
		widthMode: 'property', // 'constant' | 'property'
		constantWidth: 1.5,
		widthProperty: 'stream_order',
		widthMin: 0.5,
		widthMax: 8,
		filterEnabled: true,
		filterProperty: 'stream_order',
		filterMin: 1,
		hoverValue: ''
	},
	raster: {
		visible: true,
		url: 'https://public-b2p-geodata.s3.amazonaws.com/waternet-raster-tiles/{z}/{x}/{y}.png',
		appliedUrl: '',
		loadNonce: 0,
		tileSize: 256,
		maxZoom: 10,
		minValue: 0,
		maxValue: 256,
		paletteName: 'inferno',
		stops: [
			{ value: 38, color: 'rgba(0, 0, 5, 0)' },
			{ value: 64, color: 'rgba(87, 16, 110, 1)' },
			{ value: 128, color: 'rgba(188, 55, 84, 1)' },
			{ value: 192, color: 'rgba(249, 142, 9, 1)' },
			{ value: 217, color: 'rgba(252, 255, 164, 1)' }
		],
		opacity: 1
	}
});

export {
	generalState,
	vizLabState,
	waternetMapState,
	saiMapState,
	hexMapState,
	impactMapDatabaseState,
	impactMapState,
	zambiaMapState
};
