import { neon } from '@neondatabase/serverless';

export type Paste = {
  id: string;
  title: string;
  content: string;
  language: string;
  tab_order: number;
  created_at: string;
  updated_at: string;
};

const LOCAL_STORAGE_KEY = 'clipmaster_pastes_cache';
const NEON_URL_STORAGE_KEY = 'clipmaster_neon_url';

export function getNeonUrl(): string {
  try {
    const customUrl = localStorage.getItem(NEON_URL_STORAGE_KEY);
    if (customUrl && customUrl.trim()) {
      return customUrl.trim();
    }
  } catch {
    // localStorage might not be available
  }
  return (import.meta.env.VITE_NEON_DATABASE_URL || '').trim();
}

export function saveNeonUrl(url: string) {
  try {
    if (url.trim()) {
      localStorage.setItem(NEON_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(NEON_URL_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to save Neon URL to storage', err);
  }
}

export function isNeonConfigured(): boolean {
  const url = getNeonUrl();
  return Boolean(url && url.startsWith('postgres'));
}

function getLocalPastes(): Paste[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  // Default seed tab
  const seed: Paste = {
    id: 'tab-1-seed',
    title: 'Tab 1',
    content: '--- [Paste #1] ---\n\nWelcome to ClipMaster Pro with NeonDB!\n\nPaste clipboard items here and they will be auto-indexed into segments.',
    language: 'plaintext',
    tab_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  saveLocalPastes([seed]);
  return [seed];
}

function saveLocalPastes(pastes: Paste[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pastes));
  } catch (err) {
    console.error('Failed to cache pastes locally', err);
  }
}

let tableEnsured = false;
async function ensureNeonTable(sql: ReturnType<typeof neon>) {
  if (tableEnsured) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS pastes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'plaintext',
        tab_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    tableEnsured = true;
  } catch (err) {
    console.warn('Could not auto-create pastes table in Neon, assuming it exists', err);
  }
}

export async function testNeonConnection(customUrl?: string): Promise<{ success: boolean; message: string }> {
  const targetUrl = customUrl ? customUrl.trim() : getNeonUrl();
  if (!targetUrl || !targetUrl.startsWith('postgres')) {
    return { success: false, message: 'Please enter a valid postgresql:// connection string' };
  }
  try {
    const sql = neon(targetUrl);
    const result = await sql`SELECT 1 as test, NOW() as server_time;`;
    if (result && result.length > 0) {
      return { success: true, message: 'Successfully connected to Neon PostgreSQL!' };
    }
    return { success: false, message: 'Connected but received no response' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Neon connection failed: ${msg}` };
  }
}

export async function dbFetchPastes(): Promise<{ data: Paste[]; error: string | null; isNeon: boolean }> {
  const neonUrl = getNeonUrl();
  if (neonUrl && neonUrl.startsWith('postgres')) {
    try {
      const sql = neon(neonUrl);
      await ensureNeonTable(sql);
      const rows = await sql`
        SELECT id, title, content, language, tab_order, 
               created_at::text, updated_at::text 
        FROM pastes 
        ORDER BY tab_order ASC;
      `;
      const pastes: Paste[] = (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        title: String(r.title ?? 'Untitled'),
        content: String(r.content ?? ''),
        language: String(r.language ?? 'plaintext'),
        tab_order: Number(r.tab_order ?? 0),
        created_at: String(r.created_at ?? new Date().toISOString()),
        updated_at: String(r.updated_at ?? new Date().toISOString()),
      }));

      // If Neon is empty, populate with local cache or seed
      if (pastes.length === 0) {
        const local = getLocalPastes();
        if (local.length > 0) {
          const imported = await dbImportPastes(local);
          if (imported.data.length > 0) {
            return { data: imported.data, error: null, isNeon: true };
          }
        }
      }

      saveLocalPastes(pastes);
      return { data: pastes, error: null, isNeon: true };
    } catch (err: unknown) {
      console.warn('Neon DB fetch failed, using local fallback:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { data: getLocalPastes(), error: `Neon DB error (${errorMsg}). Using offline cache.`, isNeon: false };
    }
  }

  // Neon not configured: use local storage
  return { data: getLocalPastes(), error: null, isNeon: false };
}

export async function dbCreatePaste(item: {
  title: string;
  content: string;
  language: string;
  tab_order: number;
}): Promise<{ data: Paste | null; error: string | null }> {
  const neonUrl = getNeonUrl();
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `paste-${Date.now()}`;
  const now = new Date().toISOString();

  const newPaste: Paste = {
    id: newId,
    title: item.title,
    content: item.content,
    language: item.language,
    tab_order: item.tab_order,
    created_at: now,
    updated_at: now,
  };

  if (neonUrl && neonUrl.startsWith('postgres')) {
    try {
      const sql = neon(neonUrl);
      await ensureNeonTable(sql);
      const rows = await sql`
        INSERT INTO pastes (id, title, content, language, tab_order, created_at, updated_at)
        VALUES (${newPaste.id}, ${newPaste.title}, ${newPaste.content}, ${newPaste.language}, ${newPaste.tab_order}, NOW(), NOW())
        RETURNING id, title, content, language, tab_order, created_at::text, updated_at::text;
      `;
      if (rows && rows[0]) {
        const r = rows[0] as Record<string, unknown>;
        const created: Paste = {
          id: String(r.id),
          title: String(r.title),
          content: String(r.content),
          language: String(r.language),
          tab_order: Number(r.tab_order),
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
        };
        const current = getLocalPastes();
        saveLocalPastes([...current, created]);
        return { data: created, error: null };
      }
    } catch (err: unknown) {
      console.error('Neon insert failed, saving locally:', err);
      const current = getLocalPastes();
      saveLocalPastes([...current, newPaste]);
      const msg = err instanceof Error ? err.message : String(err);
      return { data: newPaste, error: `Neon sync failed: ${msg}` };
    }
  }

  const current = getLocalPastes();
  saveLocalPastes([...current, newPaste]);
  return { data: newPaste, error: null };
}

export async function dbUpdatePaste(
  id: string,
  patch: Partial<Paste>
): Promise<{ error: string | null }> {
  const neonUrl = getNeonUrl();
  const current = getLocalPastes();
  const updatedLocal = current.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
  saveLocalPastes(updatedLocal);

  if (neonUrl && neonUrl.startsWith('postgres')) {
    try {
      const sql = neon(neonUrl);
      const target = updatedLocal.find((p) => p.id === id);
      if (target) {
        await sql`
          UPDATE pastes
          SET title = ${target.title},
              content = ${target.content},
              language = ${target.language},
              tab_order = ${target.tab_order},
              updated_at = NOW()
          WHERE id = ${id};
        `;
      }
      return { error: null };
    } catch (err: unknown) {
      console.error('Neon update failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  }

  return { error: null };
}

export async function dbDeletePaste(id: string): Promise<{ error: string | null }> {
  const neonUrl = getNeonUrl();
  const current = getLocalPastes();
  saveLocalPastes(current.filter((p) => p.id !== id));

  if (neonUrl && neonUrl.startsWith('postgres')) {
    try {
      const sql = neon(neonUrl);
      await sql`DELETE FROM pastes WHERE id = ${id};`;
      return { error: null };
    } catch (err: unknown) {
      console.error('Neon delete failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  }

  return { error: null };
}

export async function dbImportPastes(
  rows: { title: string; content: string; language: string; tab_order: number }[]
): Promise<{ data: Paste[]; error: string | null }> {
  const createdList: Paste[] = [];
  let lastError: string | null = null;

  for (const item of rows) {
    const res = await dbCreatePaste(item);
    if (res.data) {
      createdList.push(res.data);
    }
    if (res.error) {
      lastError = res.error;
    }
  }

  return { data: createdList, error: lastError };
}
