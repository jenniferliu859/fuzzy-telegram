import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, X, Cloud, Copy, Download, Trash2, Loader2, AlertCircle, Check,
  Zap, AlignJustify, FileText, ChevronUp, ChevronDown, Layers, Eraser, ClipboardCopy,
  Search, Upload,
} from 'lucide-react';
import {
  type Paste,
  dbFetchPastes,
  dbCreatePaste,
  dbUpdatePaste,
  dbDeletePaste,
  dbImportPastes,
} from '@/lib/db';
import Floaters from '@/components/Floaters';
import CloudPanel from '@/components/CloudPanel';
import SegmentCard from '@/components/SegmentCard';

const SEGMENT_MARKER = (n: number) => `--- [Paste #${n}] ---`;
const SEGMENT_REGEX = /--- \[Paste #\d+\] ---/g;

function getFragments(text: string): string[] {
  return text
    .split(SEGMENT_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_') || 'paste';
}

function parseAllTabs(text: string): { title: string; content: string }[] {
  const headerRegex = /={5,}\s*(.+?)\s*\(Tab\s+\d+\)\s*={5,}/g;
  const headers: { title: string; end: number; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    headers.push({ title: match[1].trim(), end: headerRegex.lastIndex, index: match.index });
  }
  if (headers.length === 0) return [];
  const result: { title: string; content: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const contentStart = headers[i].end;
    const contentEnd = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const raw = text.slice(contentStart, contentEnd).trim();
    const content = raw.includes('--- [Paste #') ? raw : `${SEGMENT_MARKER(1)}\n\n${raw}`;
    result.push({ title: headers[i].title, content });
  }
  return result;
}

export default function App() {
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNeon, setIsNeon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef<string>('');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const active = pastes.find((p) => p.id === activeId) ?? null;

  const showStatus = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setStatus({ msg, type });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus(null), 2800);
  }, []);

  const fetchPastes = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr, isNeon: connected } = await dbFetchPastes();
    setIsNeon(connected);
    if (fetchErr) {
      setError(fetchErr);
    } else {
      setError(null);
    }
    setPastes(data);
    if (data.length > 0 && !activeId) {
      setActiveId(data[0].id);
    }
    setLoading(false);
  }, [activeId]);

  useEffect(() => {
    fetchPastes();
  }, [fetchPastes]);

  const updatePaste = useCallback(
    async (id: string, patch: Partial<Paste>) => {
      setPastes((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p))
      );
      const { error: updateErr } = await dbUpdatePaste(id, patch);
      if (updateErr) {
        showStatus(`Sync warning: ${updateErr}`, 'error');
      }
    },
    [showStatus]
  );

  const importTabs = async () => {
    const parsed = parseAllTabs(importText.trim());
    if (parsed.length === 0) {
      showStatus('No tabs found — paste the copied “Copy All Tabs” text', 'error');
      return;
    }
    setImporting(true);
    let startOrder = pastes.length;
    const rows = parsed.map((t) => ({
      title: t.title,
      content: t.content,
      language: 'plaintext',
      tab_order: startOrder++,
    }));
    const { data: newPastes, error: importErr } = await dbImportPastes(rows);
    if (importErr) {
      showStatus(`Import notice: ${importErr}`, 'info');
    }
    if (newPastes.length > 0) {
      setPastes((prev) => [...prev, ...newPastes]);
      setActiveId(newPastes[0].id);
      showStatus(`Imported ${newPastes.length} tab${newPastes.length === 1 ? '' : 's'}!`, 'success');
    }
    setImportOpen(false);
    setImportText('');
    setImporting(false);
  };

  const createPaste = async () => {
    const title = `Tab ${pastes.length + 1}`;
    const freshContent = `${SEGMENT_MARKER(1)}\n\n`;
    const { data: newPaste, error: createErr } = await dbCreatePaste({
      title,
      content: freshContent,
      language: 'plaintext',
      tab_order: pastes.length,
    });
    if (createErr) {
      showStatus(`Created locally (${createErr})`, 'info');
    } else {
      showStatus('New tab created!', 'success');
    }
    if (newPaste) {
      setPastes((prev) => [...prev, newPaste]);
      setActiveId(newPaste.id);
      lastValueRef.current = freshContent;
    }
  };

  const deletePaste = async (id: string) => {
    const { error: delErr } = await dbDeletePaste(id);
    if (delErr) {
      showStatus(`Delete warning: ${delErr}`, 'error');
    } else {
      showStatus('Tab deleted', 'info');
    }
    setPastes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activeId === id) setActiveId(next.length ? next[0].id : null);
      return next;
    });
  };

  const handleEditorInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!active) return;
    const ta = e.target;
    let next = ta.value;
    const prev = lastValueRef.current;

    // Auto-segment: if a large paste is detected, insert a new marker
    if (next.length > prev.length + 5) {
      const totalMarkers = (next.match(/\[Paste #\d+\]/g) || []).length;
      const marker = `\n\n${SEGMENT_MARKER(totalMarkers + 1)}\n\n`;
      const cursor = ta.selectionStart;
      next = next.slice(0, cursor) + marker + next.slice(cursor);
      showStatus('Auto-marked segment!', 'info');
    }

    lastValueRef.current = next;
    ta.value = next;
    setPastes((prev) => prev.map((p) => (p.id === active.id ? { ...p, content: next } : p)));

    if (autoSync) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updatePaste(active.id, { content: next }), 1500);
    }
  };

  const handleEditorBlur = () => {
    if (active && lastValueRef.current !== active.content) {
      updatePaste(active.id, { content: lastValueRef.current });
    }
  };

  const startRename = (p: Paste) => {
    setRenamingId(p.id);
    setRenameValue(p.title);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim();
    if (title) await updatePaste(renamingId, { title });
    setRenamingId(null);
  };

  const clearTab = () => {
    if (!active) return;
    const cleared = `${SEGMENT_MARKER(1)}\n\n`;
    lastValueRef.current = cleared;
    if (editorRef.current) editorRef.current.value = cleared;
    setPastes((prev) => prev.map((p) => (p.id === active.id ? { ...p, content: cleared } : p)));
    updatePaste(active.id, { content: cleared });
    showStatus('Tab cleared!', 'info');
  };

  const copyAllTabs = async () => {
    if (pastes.length === 0) return;
    const combined = pastes
      .map(
        (p, i) =>
          `========== ${p.title} (Tab ${i + 1}) ==========\n\n${p.content}`
      )
      .join('\n\n\n');
    try {
      await navigator.clipboard.writeText(combined);
      showStatus(`Copied all ${pastes.length} tab${pastes.length === 1 ? '' : 's'}!`, 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const copyAll = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
      showStatus('Full content copied!', 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const copyClean = async () => {
    if (!active) return;
    try {
      const clean = getFragments(active.content).join('\n');
      await navigator.clipboard.writeText(clean);
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 1500);
      showStatus('Clean copy done!', 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const copyCleanSpaced = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(getFragments(active.content).join('\n\n').trim());
      showStatus('Clean copy (blank line) done!', 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const copyCleanNoNewlines = async () => {
    if (!active) return;
    try {
      const joined = getFragments(active.content)
        .map((f) => f.replace(/\s+/g, ' ').trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      await navigator.clipboard.writeText(joined);
      showStatus('Clean copy (single line) done!', 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const copyFragment = async (i: number) => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(getFragments(active.content)[i]);
      showStatus('Segment copied!', 'success');
    } catch { showStatus('Copy failed', 'error'); }
  };

  const downloadTab = () => {
    if (!active) return;
    downloadText(`${sanitizeFilename(active.title)}.txt`, active.content);
    showStatus('Tab downloaded as .txt', 'success');
  };

  const downloadFragment = (i: number) => {
    if (!active) return;
    const frags = getFragments(active.content);
    downloadText(`${sanitizeFilename(active.title)}-seg${i + 1}.txt`, frags[i] ?? '');
    showStatus('Segment downloaded as .txt', 'success');
  };

  const downloadAllTabs = () => {
    if (pastes.length === 0) return;
    const combined = pastes
      .map(
        (p, i) =>
          `========== ${p.title} (Tab ${i + 1}) ==========

${p.content}`
      )
      .join('\n\n\n');
    downloadText('all-tabs.txt', combined);
    showStatus(`Downloaded ${pastes.length} tab${pastes.length === 1 ? '' : 's'} as .txt`, 'success');
  };

  const syncNow = () => {
    if (active) {
      updatePaste(active.id, { content: lastValueRef.current });
      showStatus(isNeon ? 'Synced to Neon PostgreSQL!' : 'Saved to local cache!', 'success');
    }
  };

  const jumpToSegment = (i: number) => {
    document.getElementById(`seg-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTop = () => editorRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => editorRef.current?.scrollTo({ top: editorRef.current.scrollHeight, behavior: 'smooth' });

  const fragments = active ? getFragments(active.content) : [];

  const searchResults = searchQuery.trim()
    ? pastes
        .map((p) => ({
          paste: p,
          frags: getFragments(p.content)
            .map((f, i) => ({ text: f, index: i }))
            .filter((f) => f.text.toLowerCase().includes(searchQuery.trim().toLowerCase())),
        }))
        .filter((r) => r.frags.length > 0)
    : [];
  const filteredTabs = searchQuery.trim()
    ? pastes.filter((p) => p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : pastes;

  // Set lastValueRef when switching tabs
  useEffect(() => {
    if (active) {
      lastValueRef.current = active.content;
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative z-10 min-h-screen px-4 pb-28 sm:px-6 sm:pb-28 md:px-10 md:pb-28">
      <Floaters />

      {/* Floating scroll nav */}
      <div className="fixed bottom-5 right-4 flex flex-col gap-2 z-40 opacity-60 hover:opacity-100 transition-opacity sm:bottom-8 sm:right-8">
        <button
          onClick={scrollToTop}
          className="p-3 text-white rounded-full shadow-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--rose))' }}
          title="Jump to Top"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={scrollToBottom}
          className="p-3 text-white rounded-full shadow-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--secondary), var(--primary))' }}
          title="Jump to Bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <CloudPanel
        open={panelOpen}
        autoSync={autoSync}
        onToggleAutoSync={setAutoSync}
        onSyncNow={syncNow}
        onClose={() => setPanelOpen(false)}
        isNeon={isNeon}
        onRefreshData={fetchPastes}
      />

      <main className="max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <header
          className="relative rounded-[2rem] border border-[rgba(228,214,247,0.7)] bg-white/70 backdrop-blur-sm p-5 sm:p-8 shadow-xl flex flex-col gap-5"
        >
          {/* Sticker decorations */}
          <div
            className="pony-sticker pony-pop-in"
            style={{
              width: 44, height: 44,
              background: 'linear-gradient(145deg,#FFDA82,#FFB020)',
              color: '#5B3B00',
              transform: 'rotate(-14deg)',
              top: '-1rem', left: '-0.75rem',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5B3B00" stroke="#5B3B00" strokeWidth={2.25}>
              <path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.8l-6.2 3.5L7 14.2 2 9.3l7.1-.7z" />
            </svg>
          </div>
          <div
            className="pony-sticker pony-pop-in hidden sm:flex"
            style={{
              width: 56, height: 56,
              background: 'linear-gradient(145deg,#FFFFFF,#F1E6FF)',
              color: '#402C55',
              transform: 'rotate(8deg)',
              top: '-1.25rem', right: '-1rem',
            }}
          >
            <svg viewBox="0 0 64 40" style={{ width: '70%', height: '70%' }} fill="none">
              <path d="M4 38a28 28 0 0 1 56 0" stroke="#FF7FB4" strokeWidth={6} strokeLinecap="round" />
              <path d="M12 38a20 20 0 0 1 40 0" stroke="#FFC24B" strokeWidth={6} strokeLinecap="round" />
              <path d="M20 38a12 12 0 0 1 24 0" stroke="#4FB6E0" strokeWidth={6} strokeLinecap="round" />
            </svg>
          </div>

          {/* Title row */}
          <div className="flex items-center gap-3">
            <div
              className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--rose))' }}
            >
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight m-0">
                ClipMaster <span style={{ color: 'var(--primary)' }}>Pro</span>
              </h1>
              <p className="text-[var(--muted-foreground)] font-medium text-sm mt-0.5 m-0">
                Smart cloud-sync scrapbook with tabs for your clipboard.
              </p>
            </div>
          </div>

          {/* Action pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm bg-white border border-[var(--border)] text-[rgba(64,44,85,0.7)] shadow-sm transition-all hover:shadow-md"
            >
              <Cloud className="w-4 h-4" style={{ color: 'var(--secondary)' }} />
              Cloud Options
            </button>
            <button
              onClick={copyClean}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(184,95,204,0.1)', color: 'var(--primary)' }}
            >
              {copiedClean ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedClean ? 'Copied!' : 'Copy Clean'}
            </button>
            <button
              onClick={copyCleanSpaced}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(79,182,224,0.15)', color: 'var(--secondary-foreground)' }}
            >
              <AlignJustify className="w-4 h-4" />
              Copy Clean (1 space)
            </button>
            <button
              onClick={copyCleanNoNewlines}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(63,207,158,0.15)', color: 'var(--mint-foreground)' }}
            >
              <FileText className="w-4 h-4" />
              Copy (no newlines)
            </button>
            <button
              onClick={downloadTab}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white shadow-md transition-all hover:scale-105"
              style={{ background: 'linear-gradient(90deg, var(--accent), #ffb830)' }}
            >
              <Download className="w-4 h-4" />
              Download .txt
            </button>
            <button
              onClick={downloadAllTabs}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white shadow-md transition-all hover:scale-105"
              style={{ background: 'linear-gradient(90deg, var(--secondary), var(--mint))' }}
            >
              <Layers className="w-4 h-4" />
              Download All Tabs
            </button>
            <button
              onClick={copyAllTabs}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white shadow-md transition-all hover:scale-105"
              style={{ background: 'linear-gradient(90deg, var(--mint), var(--secondary))' }}
            >
              <ClipboardCopy className="w-4 h-4" />
              Copy All Tabs
            </button>
            <button
              onClick={clearTab}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(232,87,122,0.12)', color: 'var(--destructive)' }}
            >
              <Eraser className="w-4 h-4" />
              Clear Tab
            </button>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white shadow-md transition-all hover:scale-105"
              style={{ background: 'linear-gradient(90deg, var(--primary), var(--rose))' }}
            >
              {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedAll ? 'Copied!' : 'Copy All'}
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white shadow-md transition-all hover:scale-105"
              style={{ background: 'linear-gradient(90deg, var(--accent), var(--secondary))' }}
            >
              <Upload className="w-4 h-4" />
              Import Tabs
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tabs and segments…"
              className="w-full pl-11 pr-10 py-3 text-sm bg-white/80 border border-[var(--border)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgba(184,95,204,0.3)] placeholder:text-[var(--muted-foreground)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Search results panel */}
        {searchQuery.trim() && (
          <div className="rounded-[1.5rem] bg-white/70 border border-[var(--border)] p-5 shadow-md">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
                No matching segments found.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {searchResults.map((r) => (
                  <div key={r.paste.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: r.paste.id === activeId ? 'var(--primary)' : 'var(--border)' }}
                      />
                      <button
                        onClick={() => { setActiveId(r.paste.id); setSearchQuery(''); }}
                        className="text-sm font-bold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors text-left"
                      >
                        {r.paste.title}
                      </button>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {r.frags.length} match{r.frags.length === 1 ? '' : 'es'}
                      </span>
                    </div>
                    {r.frags.map((f) => (
                      <button
                        key={f.index}
                        onClick={() => { setActiveId(r.paste.id); setSearchQuery(''); }}
                        className="text-left px-3 py-2 rounded-xl bg-white/60 border border-[var(--border)] text-xs text-[var(--muted-foreground)] hover:border-[rgba(184,95,204,0.4)] hover:bg-white transition-all"
                      >
                        <span className="font-mono text-[10px] text-[var(--primary)] mr-2">#{f.index + 1}</span>
                        {f.text.slice(0, 120)}{f.text.length > 120 ? '…' : ''}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import modal */}
        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !importing && setImportOpen(false)}>
            <div
              className="w-full max-w-2xl bg-white rounded-[1.75rem] shadow-2xl p-6 sm:p-8 flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="grid place-items-center w-9 h-9 rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}
                  >
                    <Upload className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">Import Tabs</h2>
                </div>
                <button
                  onClick={() => !importing && setImportOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                Paste the text you copied with “Copy All Tabs” to recreate all tabs here.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your copied tabs here…"
                spellCheck={false}
                className="w-full h-48 p-4 bg-white/90 border-2 border-[var(--border)] rounded-2xl outline-none font-mono text-sm text-[rgba(64,44,85,0.9)] resize-none focus:shadow-[0_0_0_4px_rgba(184,95,204,0.18)] focus:border-[rgba(184,95,204,0.5)] placeholder:text-[rgba(124,104,146,0.6)] transition-all"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setImportOpen(false)}
                  disabled={importing}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={importTabs}
                  disabled={importing || !importText.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(90deg, var(--accent), var(--secondary))' }}
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing…' : 'Import Tabs'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {loading && pastes.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading tabs…
            </div>
          ) : filteredTabs.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">No tabs match “{searchQuery}”.</div>
          ) : (
            filteredTabs.map((p) => {
              const isActive = p.id === activeId;
              return (
                <div
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={[
                    'group relative flex items-center gap-2 pl-3 pr-2 py-2.5 rounded-2xl cursor-pointer whitespace-nowrap transition-all border',
                    isActive
                      ? 'bg-white border-[rgba(184,95,204,0.3)] text-[var(--foreground)] shadow-md'
                      : 'bg-white/40 border-transparent text-[var(--muted-foreground)] hover:bg-white/70',
                  ].join(' ')}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: isActive ? 'var(--primary)' : 'var(--border)' }}
                  />
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-28 px-2 py-1 text-sm bg-white border border-[rgba(184,95,204,0.5)] rounded-lg focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(p);
                      }}
                      className="text-sm font-semibold max-w-[160px] truncate"
                      title={`${p.title} (double-click to rename)`}
                    >
                      {p.title}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePaste(p.id);
                    }}
                    className="ml-1 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[rgba(232,87,122,0.1)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}

          {/* New tab button */}
          <button
            onClick={createPaste}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--rose))' }}
            title="New tab"
          >
            <Plus className="w-4 h-4" />
            New Tab
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-[rgba(232,87,122,0.1)] border border-[rgba(232,87,122,0.3)] text-[var(--destructive)] text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Editor + Segments grid */}
        {active ? (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 sm:gap-8">
            {/* Master input */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {active.title} — Master Input
                  </span>
                  <button onClick={scrollToTop} className="p-1 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={scrollToBottom} className="p-1 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  {active.content.length.toLocaleString()} chars · {fragments.length} segment{fragments.length === 1 ? '' : 's'}
                </span>
              </div>
              <textarea
                ref={editorRef}
                key={active.id}
                defaultValue={active.content}
                onChange={handleEditorInput}
                onBlur={handleEditorBlur}
                placeholder="Paste items here to auto-index them..."
                spellCheck={false}
                className="w-full h-[50vh] sm:h-[55vh] p-5 sm:p-8 bg-white/90 border-2 border-[var(--border)] rounded-[1.75rem] outline-none font-mono text-sm text-[rgba(64,44,85,0.9)] resize-none shadow-sm transition-all focus:shadow-[0_0_0_4px_rgba(184,95,204,0.18)] focus:border-[rgba(184,95,204,0.5)] placeholder:text-[rgba(124,104,146,0.6)]"
              />
            </section>

            {/* Segmented library */}
            <section className="flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Segmented Library
              </span>
              <div className="flex flex-col gap-5 h-[50vh] sm:h-[55vh] overflow-y-auto pr-1 pt-2">
                {fragments.length === 0 ? (
                  <div className="m-auto text-center p-8 border-2 border-dashed border-[var(--border)] rounded-[1.75rem] text-[var(--muted-foreground)]">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--primary)' }} />
                    <p className="text-sm">No segments detected yet.</p>
                  </div>
                ) : (
                  fragments.map((f, i) => (
                    <SegmentCard
                      key={i}
                      index={i}
                      total={fragments.length}
                      fragment={f}
                      onCopy={() => copyFragment(i)}
                      onJump={jumpToSegment}
                      onDownload={() => downloadFragment(i)}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-white/60 border border-[var(--border)] flex items-center justify-center mb-4 shadow-md">
                {loading ? <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" /> : <FileText className="w-8 h-8 text-[var(--muted-foreground)]" />}
              </div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {loading ? 'Loading your tabs…' : 'No tab selected'}
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {pastes.length === 0 ? 'Create your first tab to get started.' : 'Select a tab above or create a new one.'}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="flex flex-col gap-3 justify-between items-center border-t border-[rgba(228,214,247,0.7)] pt-6">
          {/* Status pill */}
          <div
            className={[
              'status-pill',
              status ? 'show' : '',
              status ? status.type : '',
            ].join(' ')}
          >
            {status?.type === 'success' && <Check className="w-3.5 h-3.5" />}
            {status?.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
            {status?.type === 'info' && <Zap className="w-3.5 h-3.5" />}
            <span>{status?.msg ?? 'Status'}</span>
          </div>
          <button
            onClick={() => active && deletePaste(active.id)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--muted-foreground)] rounded-xl hover:text-[var(--destructive)] hover:bg-[rgba(232,87,122,0.1)] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Current Tab
          </button>
        </footer>
      </main>
    </div>
  );
}
