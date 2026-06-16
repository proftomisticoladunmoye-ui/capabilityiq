// Store selector. Uses PostgreSQL when DATABASE_URL is set (production / Neon),
// otherwise falls back to the zero-dependency JSON file store (local development).
// Both backends implement the same async interface; call `initStore()` once at boot.

import { jsonStore } from './store-json.js';

let activeStore = jsonStore;

export async function initStore() {
  if (process.env.DATABASE_URL) {
    // Lazy-load pg + the Postgres backend only when actually needed.
    const { default: pg } = await import('pg');
    const { makePgStore } = await import('./store-pg.js');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon and most managed Postgres require TLS; relax cert checking for the pooled host.
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX) || 5,
    });
    activeStore = makePgStore(pool);
  }
  await activeStore.init();
  return activeStore;
}

// Stable reference that always delegates to the active backend, so existing
// `import { store }` call-sites keep working after initStore swaps the backend.
export const store = new Proxy(
  {},
  {
    get(_t, prop) {
      const val = activeStore[prop];
      return typeof val === 'function' ? val.bind(activeStore) : val;
    },
  }
);
