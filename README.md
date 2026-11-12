# ClipMaster Pro

Smart clipboard segmenting & cloud scratchpad, configured for **Neon PostgreSQL** and **Netlify** deployment.

## Features

- **Auto-segmenting**: Paste multiple snippets and automatically organize them into tagged, searchable segment cards.
- **Tabs**: Maintain multiple scratchpads simultaneously with quick rename, duplicate, export, and delete.
- **Export & Sync**: Copy single segments, clean text without markers, download `.txt` files per tab or segment, or copy/download all tabs.
- **Neon PostgreSQL**: Powered by `@neondatabase/serverless` for fast, serverless database persistence.
- **Offline / Local Fallback**: Seamlessly works out-of-the-box in local storage mode if database credentials are not yet configured.

---

## 1. Neon Database Setup

1. Create a free account or project at [console.neon.tech](https://console.neon.tech).
2. In the **SQL Editor**, run the contents of `neon-schema.sql`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";

   CREATE TABLE IF NOT EXISTS pastes (
     id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
     title TEXT NOT NULL,
     content TEXT NOT NULL DEFAULT '',
     language TEXT NOT NULL DEFAULT 'plaintext',
     tab_order INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_pastes_tab_order ON pastes (tab_order ASC);
   ```
3. Copy your Neon PostgreSQL connection string (use the **Pooled** connection string).

---

## 2. Netlify Deployment

1. Push this repository to GitHub or connect it in Netlify.
2. Netlify build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Under **Site configuration > Environment variables**, add:
   - **Key**: `VITE_NEON_DATABASE_URL`
   - **Value**: `postgresql://[user]:[password]@[neon-hostname]/neondb?sslmode=require`
4. Deploy the site!

---

## Local Development

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:3000`. You can also configure your Neon URL directly in the **Cloud Options** drawer in the UI.
