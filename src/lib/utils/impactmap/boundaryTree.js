// A country's administrative tree, and the dropdowns built from it.
// The tree comes from /api/boundaries/hierarchy and is fetched once per country.

const cache = new Map();

/**
 * @typedef {{ fika_id: string, gid: string, level: number, name: string, children: BoundaryNode[] }} BoundaryNode
 * @typedef {{ country: object, max_level: number, hierarchy: BoundaryNode[] }} BoundaryTree
 */

/**
 * The tree for a country (ISO alpha-3 code), or null when no boundaries are held for it.
 * Throws if the request fails, so the caller can tell "none" from "broken".
 * @param {string} code3
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<BoundaryTree | null>}
 */
export async function fetchHierarchy(code3, { signal } = {}) {
	if (cache.has(code3)) return cache.get(code3);
	const res = await fetch(`/api/boundaries/hierarchy?country=${encodeURIComponent(code3)}`, {
		signal
	});
	if (res.status === 404) {
		cache.set(code3, null);
		return null;
	}
	if (!res.ok) throw new Error(`Boundaries request failed (${res.status})`);
	const tree = await res.json();
	cache.set(code3, tree);
	return tree;
}

/**
 * One entry per dropdown, level 1 down to the country's deepest level. A dropdown holds the
 * children of the area chosen in the one above it, and stays disabled until that is chosen.
 * @param {BoundaryTree} tree
 * @param {string[]} selected the fika_id chosen at level 1, 2, ... (may be shorter than the levels)
 * @returns {{ level: number, options: BoundaryNode[], chosen: BoundaryNode | null, enabled: boolean }[]}
 */
export function dropdownLevels(tree, selected) {
	const levels = [];
	let nodes = tree.hierarchy;
	for (let level = 1; level <= tree.max_level; level++) {
		const options = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
		const chosen = options.find((n) => n.fika_id === selected[level - 1]) ?? null;
		const enabled = options.length > 0 && (level === 1 || levels[level - 2].chosen !== null);
		levels.push({ level, options, chosen, enabled });
		nodes = chosen?.children ?? [];
	}
	return levels;
}
