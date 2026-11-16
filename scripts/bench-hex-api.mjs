// Compare direct pg vs the Django hex API: latency and payload equality.
// Usage: RDS_CA=/path/to/global-bundle.pem node --env-file=.env scripts/bench-hex-api.mjs [hexID ...]
import pg from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';

const { DATABASE_URL, IMPACT_API_URL, IMPACT_API_KEY } = process.env;
const hexes = process.argv.slice(2);
if (!hexes.length) hexes.push('886ada8f01fffff', '886ada8f09fffff', '886ada8f0bfffff');
const RUNS = 10;
// RDS requires SSL. Point RDS_CA at the AWS global bundle to verify the certificate.
const ssl = process.env.RDS_CA ? { ca: readFileSync(process.env.RDS_CA, 'utf8') } : undefined;

const stats = (ms) => {
	const s = [...ms].sort((a, b) => a - b);
	const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
	return { min: s[0], median: q(0.5), p90: q(0.9), max: s[s.length - 1] };
};
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join('  ');

async function time(fn) {
	const t = performance.now();
	const out = await fn();
	return [performance.now() - t, out];
}

const apiGet = async (hex) =>
	(await fetch(`${IMPACT_API_URL}/impactmap/api/hexes/${hex}/`, { headers: { 'X-API-Key': IMPACT_API_KEY } })).json();

// What the old route does: new client + table check + query per request
const pgPerRequest = async (hex) => {
	const c = new pg.Client({ connectionString: DATABASE_URL, ssl });
	await c.connect();
	await c.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hex_areas')");
	const r = await c.query('SELECT * FROM hex_areas WHERE h3_index = $1', [hex]);
	await c.end();
	return r.rows[0];
};

// Query only, on an already-open connection (lower bound for pg)
const client = new pg.Client({ connectionString: DATABASE_URL, ssl });
await client.connect();
const pgWarm = async (hex) => (await client.query('SELECT * FROM hex_areas WHERE h3_index = $1', [hex])).rows[0];

const cases = { 'pg per-request (old route)': pgPerRequest, 'pg warm connection': pgWarm, 'django api': apiGet };
const times = Object.fromEntries(Object.keys(cases).map((k) => [k, []]));
const cold = {};

for (const hex of hexes) {
	// payload equality
	const [a, b] = await Promise.all([pgWarm(hex), apiGet(hex)]);
	const diff = Object.keys({ ...a, ...b }).filter((k) => !isDeepStrictEqual(a?.[k], b?.[k]));
	console.log(`${hex}: payload ${diff.length ? 'DIFFERS in ' + diff.join(', ') : 'identical'}`);
}

for (const [name, fn] of Object.entries(cases)) {
	for (let i = 0; i < RUNS; i++) {
		for (const hex of hexes) {
			const [ms] = await time(() => fn(hex));
			if (i === 0 && hex === hexes[0]) cold[name] = ms;
			else times[name].push(ms);
		}
	}
}

console.log(`\n${RUNS} rounds x ${hexes.length} hexes (first call excluded, shown as cold)`);
for (const name of Object.keys(cases)) console.log(`${name.padEnd(28)} cold ${cold[name].toFixed(0)}ms | ${fmt(stats(times[name]))}`);
await client.end();
