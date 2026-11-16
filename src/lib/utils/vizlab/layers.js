// Pure helpers for the Viz Lab page: color parsing and Mapbox expression builders.

export function parseColor(input) {
	const fallback = { hex: '#000000', alpha: 1 };
	if (!input || typeof input !== 'string') return fallback;
	const str = input.trim();

	if (str.startsWith('#')) {
		let h = str.slice(1);
		if (h.length === 3 || h.length === 4) {
			h = h
				.split('')
				.map((c) => c + c)
				.join('');
		}
		if (h.length !== 6 && h.length !== 8) return fallback;
		const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
		return { hex: '#' + h.slice(0, 6).toLowerCase(), alpha: Math.round(alpha * 100) / 100 };
	}

	const m = str.match(/rgba?\(([^)]+)\)/i);
	if (m) {
		const [r, g, b, a] = m[1].split(',').map((s) => parseFloat(s.trim()));
		const toHex = (n) =>
			Math.max(0, Math.min(255, Math.round(n)))
				.toString(16)
				.padStart(2, '0');
		return {
			hex: '#' + toHex(r) + toHex(g) + toHex(b),
			alpha: a === undefined || Number.isNaN(a) ? 1 : Math.max(0, Math.min(1, a))
		};
	}
	return fallback;
}

export function toRgbaString(hex, alpha) {
	const h = hex.replace('#', '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Spread a palette's colors evenly across [min, max] as editable stops.
export function seedStops(colors, min, max) {
	const n = colors.length;
	return colors.map((c, i) => {
		const { hex, alpha } = parseColor(c);
		const value = n === 1 ? min : min + ((max - min) * i) / (n - 1);
		return { value: Math.round(value * 100) / 100, color: toRgbaString(hex, alpha) };
	});
}

// Mapbox interpolate requires strictly ascending, unique stop inputs.
export function cleanStops(stops) {
	const seen = new Set();
	return [...stops]
		.filter((s) => Number.isFinite(Number(s.value)))
		.sort((a, b) => Number(a.value) - Number(b.value))
		.filter((s) => {
			const v = Number(s.value);
			if (seen.has(v)) return false;
			seen.add(v);
			return true;
		});
}

export function buildRasterPaint(raster) {
	const stops = cleanStops(raster.stops);
	const paint = {
		'raster-opacity': raster.opacity,
		'raster-color-mix': [256, 0, 0, 0],
		'raster-color-range': [Number(raster.minValue), Number(raster.maxValue)]
	};
	if (stops.length >= 2) {
		paint['raster-color'] = [
			'interpolate',
			['linear'],
			['raster-value'],
			...stops.flatMap((s) => [Number(s.value), s.color])
		];
	} else if (stops.length === 1) {
		paint['raster-color'] = [
			'interpolate',
			['linear'],
			['raster-value'],
			Number(stops[0].value),
			stops[0].color,
			Number(stops[0].value) + 1,
			stops[0].color
		];
	}
	return paint;
}

export function findProperty(vector, name) {
	return vector.properties.find((p) => p.name === name);
}

export function buildVectorColor(vector) {
	if (vector.mode === 'solid' || !vector.property) return vector.solidColor;

	if (vector.mode === 'categorical') {
		const cats = vector.categories.filter((c) => c.value !== '');
		if (!cats.length) return vector.solidColor;
		return [
			'match',
			['to-string', ['get', vector.property]],
			...cats.flatMap((c) => [String(c.value), c.color]),
			vector.solidColor
		];
	}

	const stops = cleanStops(vector.stops);
	if (!stops.length) return vector.solidColor;
	if (stops.length === 1) return stops[0].color;
	return [
		'interpolate',
		['linear'],
		['to-number', ['get', vector.property], Number(stops[0].value)],
		...stops.flatMap((s) => [Number(s.value), s.color])
	];
}

const ZOOM_SCALE = [
	[4, 0.15],
	[8, 0.5],
	[12, 1],
	[16, 2]
];

export function buildVectorWidth(vector) {
	let base;
	if (vector.widthMode === 'property' && vector.widthProperty) {
		const info = findProperty(vector, vector.widthProperty);
		let min = info?.min ?? 1;
		let max = info?.max ?? 12;
		if (max <= min) max = min + 1;
		base = [
			'interpolate',
			['linear'],
			['to-number', ['get', vector.widthProperty], min],
			min,
			Number(vector.widthMin),
			max,
			Number(vector.widthMax)
		];
	} else {
		base = Number(vector.constantWidth);
	}
	return [
		'interpolate',
		['linear'],
		['zoom'],
		...ZOOM_SCALE.flatMap(([z, f]) => [z, ['*', f, base]])
	];
}

export function buildVectorFilter(vector) {
	if (!vector.filterEnabled || !vector.filterProperty) return null;
	return ['>=', ['to-number', ['get', vector.filterProperty], 0], Number(vector.filterMin)];
}

// Collect property names/types/ranges from a list of rendered features.
export function summarizeProperties(features, previous = []) {
	const map = new Map(previous.map((p) => [p.name, { ...p, values: [...p.values] }]));
	for (const f of features) {
		for (const [name, raw] of Object.entries(f.properties ?? {})) {
			if (raw === null || raw === undefined) continue;
			let entry = map.get(name);
			if (!entry) {
				entry = {
					name,
					type: typeof raw === 'number' ? 'number' : 'string',
					min: Infinity,
					max: -Infinity,
					values: []
				};
				map.set(name, entry);
			}
			if (typeof raw === 'number') {
				if (raw < entry.min) entry.min = raw;
				if (raw > entry.max) entry.max = raw;
			} else if (entry.type === 'number') {
				entry.type = 'string';
			}
			const s = String(raw);
			if (entry.values.length < 30 && !entry.values.includes(s)) entry.values.push(s);
		}
	}
	return [...map.values()].map((e) => ({
		...e,
		min: Number.isFinite(e.min) ? e.min : 0,
		max: Number.isFinite(e.max) ? e.max : 0
	}));
}
