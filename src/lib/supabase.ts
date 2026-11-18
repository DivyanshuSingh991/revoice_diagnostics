/**
 * Lightweight native fetch-based Supabase REST client.
 * Zero npm dependency required - fixes Vite import-analysis error completely!
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

interface PostgrestFilterBuilder {
  upsert: (payload: any, options?: { onConflict?: string }) => Promise<{ data: any; error: any }>;
  insert: (payload: any) => Promise<{ data: any; error: any }>;
  select: (columns?: string) => Promise<{ data: any; error: any }>;
}

export const supabase = {
  from(tableName: string): PostgrestFilterBuilder {
    if (!isSupabaseConfigured) {
      console.warn(`[Supabase] Not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable cloud database sync.`);
      return {
        async upsert() { return { data: null, error: 'Supabase credentials not configured' }; },
        async insert() { return { data: null, error: 'Supabase credentials not configured' }; },
        async select() { return { data: null, error: 'Supabase credentials not configured' }; }
      };
    }

    return {
      async upsert(payload: any, options?: { onConflict?: string }) {
        try {
          let url = `${SUPABASE_URL}/rest/v1/${tableName}`;
          if (options?.onConflict) {
            url += `?on_conflict=${encodeURIComponent(options.onConflict)}`;
          }

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Supabase Error on ${tableName} upsert]:`, errBody);
            return { data: null, error: errBody };
          }

          const data = await res.json().catch(() => null);
          return { data, error: null };
        } catch (err: any) {
          console.error(`[Supabase Network Error on ${tableName} upsert]:`, err);
          return { data: null, error: err?.message || err };
        }
      },

      async insert(payload: any) {
        try {
          const url = `${SUPABASE_URL}/rest/v1/${tableName}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Supabase Error on ${tableName} insert]:`, errBody);
            return { data: null, error: errBody };
          }

          const data = await res.json().catch(() => null);
          return { data, error: null };
        } catch (err: any) {
          console.error(`[Supabase Network Error on ${tableName} insert]:`, err);
          return { data: null, error: err?.message || err };
        }
      },

      async select(columns = '*') {
        try {
          const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=${encodeURIComponent(columns)}`;
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          });

          if (!res.ok) {
            const errBody = await res.text();
            return { data: null, error: errBody };
          }

          const data = await res.json();
          return { data, error: null };
        } catch (err: any) {
          return { data: null, error: err?.message || err };
        }
      }
    };
  }
};

if (isSupabaseConfigured) {
  console.log('[Supabase Native Client] Configured for:', SUPABASE_URL);
} else {
  console.info('[Supabase Native Client] Running in local-only mode (No VITE_SUPABASE_URL provided in .env)');
}
