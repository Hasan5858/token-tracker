import { refresh, SNAPSHOT_PATH } from './store.ts';
const r = await refresh();
console.log(`Snapshot: ${SNAPSHOT_PATH}`);
console.log(`Upserted ${r.upserted} records in ${r.ms}ms · total rows ${r.totalRows}`);
console.log(`Antigravity transcripts: ${r.antigravity.scanned} scanned, ${r.antigravity.skipped} unchanged`);
console.table(r.bySource);
if (r.errors.length) { console.warn('Errors:'); for (const e of r.errors) console.warn('  ' + e); }
