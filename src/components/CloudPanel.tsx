import { useState, useEffect } from 'react';
import { Cloud, X, Upload, Database, Check, AlertCircle, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { getNeonUrl, saveNeonUrl, testNeonConnection } from '@/lib/db';

type Props = {
  open: boolean;
  autoSync: boolean;
  onToggleAutoSync: (v: boolean) => void;
  onSyncNow: () => void;
  onClose: () => void;
  isNeon: boolean;
  onRefreshData?: () => void;
};

export default function CloudPanel({
  open,
  autoSync,
  onToggleAutoSync,
  onSyncNow,
  onClose,
  isNeon,
  onRefreshData,
}: Props) {
  const [neonUrl, setNeonUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (open) {
      setNeonUrl(getNeonUrl());
      setTestResult(null);
    }
  }, [open]);

  const handleSaveAndConnect = async () => {
    saveNeonUrl(neonUrl);
    setTesting(true);
    const res = await testNeonConnection(neonUrl);
    setTesting(false);
    setTestResult(res);
    if (res.success && onRefreshData) {
      onRefreshData();
    }
  };

  const copySqlSchema = async () => {
    const sql = `CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pastes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'plaintext',
  tab_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pastes_tab_order ON pastes (tab_order ASC);`;

    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && <div className="fixed inset-0 z-40 bg-[rgba(64,44,85,0.2)] backdrop-blur-[1px] sm:hidden" onClick={onClose} />}

      <div
        className={[
          'fixed z-50 bg-white shadow-2xl',
          'inset-x-0 bottom-0 rounded-t-[2rem] border-t border-[var(--border)]',
          'sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:h-full sm:w-[420px] sm:rounded-l-[2rem] sm:rounded-t-none sm:border-l sm:border-t-0',
          'flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto no-scrollbar',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        ].join(' ')}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--border)] sm:hidden" />

        <div className="flex items-center justify-between border-b border-[rgba(228,214,247,0.7)] pb-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="font-display font-bold text-lg m-0">Cloud & Database Sync</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm flex-grow">
          {/* Active Status Badge */}
          <div className="p-3.5 rounded-2xl bg-white/80 border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${isNeon ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`}
              />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)] m-0">
                  {isNeon ? 'Neon PostgreSQL Connected' : 'Local Storage Mode'}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] m-0">
                  {isNeon ? 'Synced to your cloud serverless database' : 'Data persists in your browser cache'}
                </p>
              </div>
            </div>
            <Database className="w-5 h-5 text-[var(--muted-foreground)] opacity-50" />
          </div>

          {/* Neon DB Connection String Input */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[rgba(228,214,247,0.7)]">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)]">
                Neon Database URL
              </label>
              <a
                href="https://console.neon.tech"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                Neon Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] m-0">
              Paste your Neon connection string (pooled recommended, e.g. <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">postgresql://...</code>):
            </p>
            <textarea
              value={neonUrl}
              onChange={(e) => setNeonUrl(e.target.value)}
              placeholder="postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-[var(--border)] rounded-xl font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveAndConnect}
                disabled={testing}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white rounded-xl shadow-sm transition-all hover:opacity-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--rose))' }}
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {testing ? 'Testing...' : 'Save & Connect Neon'}
              </button>
              {neonUrl && (
                <button
                  onClick={() => {
                    setNeonUrl('');
                    saveNeonUrl('');
                    if (onRefreshData) onRefreshData();
                  }}
                  className="px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] border border-[var(--border)] rounded-xl hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Schema quick copy */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[rgba(228,214,247,0.7)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--foreground)]">Neon SQL Schema</span>
              <button
                onClick={copySqlSchema}
                className="text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1 hover:underline"
              >
                {copiedSql ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedSql ? 'Copied SQL!' : 'Copy SQL Table Script'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] m-0">
              ClipMaster Pro auto-creates the <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">pastes</code> table if needed, or you can run this script directly in the Neon SQL Editor.
            </p>
          </div>

          {/* Netlify Deployment Guide */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col gap-1.5">
            <p className="font-bold text-xs text-amber-900 m-0 flex items-center gap-1.5">
              🚀 Deploying on Netlify
            </p>
            <ul className="text-[11px] text-amber-800/90 pl-3 list-disc space-y-1 m-0">
              <li>Deploy this repository straight to Netlify with default settings (build command: <code className="bg-amber-100/80 px-1 rounded">npm run build</code>, publish: <code className="bg-amber-100/80 px-1 rounded">dist</code>).</li>
              <li>In Netlify under <strong>Site configuration &gt; Environment variables</strong>, add:</li>
            </ul>
            <div className="mt-1 p-2 bg-white/80 rounded-lg border border-amber-200 font-mono text-[10px] text-slate-800 select-all">
              VITE_NEON_DATABASE_URL=postgresql://...
            </div>
          </div>

          {/* Auto-Sync settings */}
          <div className="pt-2 border-t border-[rgba(228,214,247,0.7)]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => onToggleAutoSync(e.target.checked)}
                className="w-4 h-4 accent-[var(--primary)] rounded"
              />
              <span className="font-semibold text-[rgba(64,44,85,0.8)]">Enable Auto-Sync</span>
            </label>
            <p className="text-[11px] text-[var(--muted-foreground)] ml-7 mt-0.5">
              Saves the current tab automatically when typing pauses.
            </p>
          </div>

          <button
            onClick={onSyncNow}
            className="mt-2 w-full py-3 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
            style={{ background: 'linear-gradient(90deg, var(--primary), var(--rose))' }}
          >
            <Upload className="w-4 h-4" />
            Sync Now
          </button>
        </div>
      </div>
    </>
  );
}
