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
	selectedViz: 'travel_time_no_sites_major_roads',
	selectedPalette: 'inferno',
	reversePalette: true,
	satelliteImagery: false,
	clickedData: {}
});

const hexMapState = $state({
	selectedViz: 'population',
	// Which kind of destination the travel-time views refer to (ignored for population).
	destination: 'all_health',
	// What the last load showed: how many hexes, whether the API cut the list short, or why
	// nothing was loaded (e.g. zoomed out too far).
	hexCount: 0,
	truncated: false,
	notice: '',
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

const printState = $state({
	open: false,
	tab: 'layout', // 'layout' | 'map-only'
	title: '',
	template: 'a4-landscape', // key in pageTemplates
	format: 'pdf', // 'pdf' | 'png' | 'jpg'
	width: 1100, // px, used by the map-only tab
	height: 800,
	dpi: 300, // 96 | 150 | 300
	setScale: false,
	includeAttribution: true,
	includeLegend: true,
	includeSelectedHex: true
});

export {
	printState,
	generalState,
	waternetMapState,
	saiMapState,
	hexMapState,
	impactMapDatabaseState,
	impactMapState,
	zambiaMapState
};
