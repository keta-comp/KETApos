import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL kerak (Supabase connection pooling URI).');
  process.exit(1);
}

const file = path.resolve(process.argv[2] || 'supabase/schema.sql');
const sql = readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
console.log('ulanildi:', await client.query('select current_database() as db, version() as v').then((r) => r.rows[0].db));
await client.query(sql);

const tables = await client.query(
  `select table_name from information_schema.tables where table_schema='public' order by table_name`
);
const funcs = await client.query(
  `select p.proname as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by name`
);
console.log('jadvalalar:', tables.rows.map((r) => r.table_name).join(', '));
console.log('funksiyalar:', funcs.rows.map((r) => r.name).join(', '));
await client.end();
