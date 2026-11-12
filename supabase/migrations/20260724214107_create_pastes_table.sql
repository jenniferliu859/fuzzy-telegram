/*
# Create pastes table (single-tenant, no auth)

1. New Tables
- `pastes`
  - `id` (uuid, primary key)
  - `title` (text, not null) — short label shown on the tab
  - `content` (text, not null, default empty string) — the paste body
  - `language` (text, default 'plaintext') — used for syntax hint / label
  - `tab_order` (int, default 0) — ordering of tabs in the UI
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now()) — touched on every edit
2. Security
- Enable RLS on `pastes`.
- Allow anon + authenticated full CRUD because the data is intentionally shared/public (no sign-in screen).
3. Notes
- Single-tenant app: no user_id, no auth.uid() checks.
- `updated_at` is maintained by the client on update.
*/

CREATE TABLE IF NOT EXISTS pastes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'plaintext',
  tab_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pastes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pastes" ON pastes;
CREATE POLICY "anon_select_pastes" ON pastes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pastes" ON pastes;
CREATE POLICY "anon_insert_pastes" ON pastes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pastes" ON pastes;
CREATE POLICY "anon_update_pastes" ON pastes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pastes" ON pastes;
CREATE POLICY "anon_delete_pastes" ON pastes FOR DELETE
  TO anon, authenticated USING (true);
