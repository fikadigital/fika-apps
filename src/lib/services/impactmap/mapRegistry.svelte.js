// Lets components outside the map (the report generator, say) reach the live map.
// ImpactMap.svelte sets `controller` when the map is created and clears it on destroy.
export const mapRegistry = $state({ controller: null });
