import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, Archive, ArrowDownToLine, AudioLines, Check, ChevronDown, CircleHelp, Clock3,
  Copy, Download as DownloadIcon, FileAudio, FileVideo, Film, FolderOpen, Gauge, HardDrive,
  History, LayoutGrid, LibraryBig, ListFilter, LoaderCircle, Menu, MoreHorizontal, Music2,
  Pause, Play, Plus, Radio, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles,
  Trash2, X, Zap
} from 'lucide-react';
import {
  getGetDownloadQueryKey, getGetInsightsQueryKey, getGetSummaryQueryKey, getListDownloadsQueryKey,
  getListPresetsQueryKey, useAnalyzeVideo, useCancelDownload, useCreateDownload, useCreatePreset,
  useDeleteDownload, useDeletePreset, useGetDownload, useGetInsights, useGetSummary,
  useListDownloads, useListPresets, useStartDownload
} from '@workspace/api-client-react';
import type {
  Download, FormatOption, Preset, VideoAnalysis
} from '@workspace/api-client-react';

type Page = 'workspace' | 'library' | 'presets' | 'settings';

const navItems: { href: string; label: string; icon: typeof LayoutGrid }[] = [
  { href: '/', label: 'Workspace', icon: LayoutGrid },
  { href: '/library', label: 'Library', icon: LibraryBig },
  { href: '/presets', label: 'Presets', icon: SlidersHorizontal },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function formatDate(date?: string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function AppMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-pulsedrop">
      <div className="relative grid h-9 w-9 place-items-center rounded-[11px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[3px_3px_0_hsl(var(--foreground)/.13)]">
        <span className="absolute h-3 w-3 rounded-full bg-[hsl(var(--foreground))]" />
        <span className="absolute h-7 w-[2px] rotate-45 bg-[hsl(var(--background)/.7)]" />
      </div>
      <div>
        <div className="font-semibold tracking-[-.04em]">PulseDrop</div>
        <div className="pd-kicker text-[hsl(var(--muted-foreground))]">video utility</div>
      </div>
    </div>
  );
}

function Nav({ mobile = false }: { mobile?: boolean }) {
  const [location] = useLocation();
  return (
    <nav className={mobile ? 'grid grid-cols-4 gap-1' : 'space-y-1'} aria-label="Primary navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            data-testid={`link-nav-${label.toLowerCase()}`}
            className={`pd-focus group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              mobile ? 'flex-col gap-1 px-1 py-2 text-[10px]' : ''
            } ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.62)] hover:bg-[hsl(var(--sidebar-accent)/.65)] hover:text-[hsl(var(--sidebar-foreground))]'}`}
          >
            <Icon size={mobile ? 18 : 17} strokeWidth={active ? 2.2 : 1.7} />
            <span className={active ? 'font-medium' : ''}>{label}</span>
            {active && !mobile ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pd-noise pd-shell min-h-[100dvh] text-[hsl(var(--foreground))]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] md:flex">
        <AppMark />
        <div className="mt-14">
          <div className="pd-kicker mb-3 px-3 text-[hsl(var(--sidebar-foreground)/.36)]">Navigate</div>
          <Nav />
        </div>
        <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium"><CircleHelp size={14} /> Permission first</div>
          <p className="text-[11px] leading-4 text-[hsl(var(--sidebar-foreground)/.56)]">Only download videos you have permission to save.</p>
        </div>
        <div className="mt-5 flex items-center justify-between px-1 text-[10px] text-[hsl(var(--sidebar-foreground)/.34)]">
          <span className="pd-mono">v1.0.0</span><span>local studio</span>
        </div>
      </aside>
      <main className="min-h-[100dvh] md:pl-[238px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border)/.65)] bg-[hsl(var(--background)/.8)] px-5 backdrop-blur-xl md:px-10">
          <div className="md:hidden"><AppMark /></div>
          <div className="hidden items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] md:flex"><Radio size={13} className="text-[hsl(var(--primary))]" /> Ready when you are</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] px-3 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" /> Processing local queue</div>
            <button type="button" className="pd-focus grid h-8 w-8 place-items-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-header-menu"><Menu size={16} /></button>
          </div>
        </header>
        <div className="mx-auto max-w-[1320px] px-5 pb-28 pt-8 md:px-10 md:pt-10">{children}</div>
      </main>
      <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar)/.96)] p-1.5 shadow-xl backdrop-blur md:hidden"><Nav mobile /></div>
    </div>
  );
}

function StatStrip() {
  const summaryQuery = useGetSummary({ query: { queryKey: getGetSummaryQueryKey(), refetchInterval: 5000 } });
  const summary = summaryQuery.data;
  const items = [
    { label: 'Saved downloads', value: summary?.totalDownloads ?? '—', icon: Archive },
    { label: 'Minutes reclaimed', value: summary?.minutesSaved ?? '—', icon: Clock3 },
    { label: 'Current streak', value: summary ? `${summary.streakDays}d` : '—', icon: Zap },
  ];
  if (summaryQuery.isLoading) return <div className="grid grid-cols-3 gap-2.5 md:gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-[hsl(var(--muted)/.7)]" />)}</div>;
  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-3">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="pd-card rounded-2xl p-3.5 md:p-4" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
          <div className="mb-2 flex items-center justify-between text-[hsl(var(--muted-foreground))]"><span className="pd-kicker text-[9px]">{label}</span><Icon size={14} /></div>
          <div className="pd-mono text-xl font-medium md:text-2xl">{value}</div>
        </div>
      ))}
    </div>
  );
}

function FormatChoice({ format, selected, onSelect }: { format: FormatOption; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} data-testid={`button-format-${format.formatId}`} className={`pd-focus relative w-full rounded-xl border p-3 text-left transition-all duration-200 ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] shadow-[0_0_0_1px_hsl(var(--primary)/.18)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.38)] hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.45)]'}`}>
      {format.recommended ? <span className="absolute -top-2 right-3 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[9px] font-semibold tracking-wide">SMART PICK</span> : null}
      <div className="flex items-center gap-2.5">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${selected ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{format.hasAudio ? (format.extension === 'mp3' ? <Music2 size={15} /> : <FileVideo size={15} />) : <Film size={15} />}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{format.label}</div><div className="pd-mono mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{format.quality} · {format.sizeMb} MB</div></div>
        {selected ? <Check size={16} className="text-[hsl(var(--primary))]" /> : null}
      </div>
    </button>
  );
}

function Analyzer({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [chapterMode, setChapterMode] = useState<'full' | 'split'>('full');
  const [subtitles, setSubtitles] = useState(false);
  const analyze = useAnalyzeVideo();
  const create = useCreateDownload();

  const submitAnalyze = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    analyze.mutate({ data: { url: url.trim() } }, {
      onSuccess: (result) => {
        setAnalysis(result);
        const recommended = result.formats.find((format) => format.recommended) ?? result.formats[0];
        setSelectedFormat(recommended?.formatId ?? '');
      },
    });
  };
  const submitDownload = () => {
    if (!analysis || !selectedFormat) return;
    create.mutate({ data: { url: analysis.sourceUrl, title: analysis.title, formatId: selectedFormat, mode, chapterMode, includeSubtitles: subtitles } }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
        setUrl(''); setAnalysis(null); setSelectedFormat('');
        onCreated();
      },
    });
  };
  const selected = analysis?.formats.find((item) => item.formatId === selectedFormat);
  return (
    <section className="pd-card relative overflow-hidden rounded-[24px] p-5 md:p-7">
      <div className="pd-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><div className="pd-kicker mb-3 text-[hsl(var(--primary))]">01 / drop a source</div><h1 className="max-w-[600px] text-[clamp(2rem,5vw,4.4rem)] font-semibold leading-[.94] tracking-[-.075em]">Make the file.<br /><span className="text-[hsl(var(--muted-foreground)/.42)]">Skip the fuss.</span></h1></div>
          <div className="hidden rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] md:block"><span className="pd-mono">YOUTUBE / READY</span></div>
        </div>
        <form onSubmit={submitAnalyze} className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1"><ArrowDownToLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={18} /><input value={url} onChange={(event) => setUrl(event.target.value)} className="pd-focus h-14 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.74)] pl-12 pr-4 text-sm outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary))]" placeholder="Paste a permitted YouTube link" data-testid="input-source-url" /></div>
          <button type="submit" disabled={analyze.isPending || !url.trim()} className="pd-focus flex h-14 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55" data-testid="button-analyze">{analyze.isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />} {analyze.isPending ? 'Reading source' : 'Inspect video'}</button>
        </form>
        {analyze.isError ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-analyze-error"><X size={14} /> We couldn’t read that source. Check the link and try again.</div> : null}
        {!analysis && !analyze.isPending ? <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-1.5"><Check size={13} className="text-[hsl(var(--primary))]" /> One clear recommendation</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[hsl(var(--primary))]" /> Chapters stay organized</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[hsl(var(--primary))]" /> No account gymnastics</span></div> : null}
        {analyze.isPending ? <div className="mt-6 grid animate-pulse gap-3 sm:grid-cols-[150px_1fr]"><div className="h-24 rounded-xl bg-[hsl(var(--muted))]" /><div className="space-y-2"><div className="h-4 w-2/3 rounded bg-[hsl(var(--muted))]" /><div className="h-3 w-1/3 rounded bg-[hsl(var(--muted))]" /><div className="h-3 w-1/2 rounded bg-[hsl(var(--muted))]" /></div></div> : null}
        {analysis ? <div className="mt-7 border-t border-[hsl(var(--border))] pt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
            <div>
              <div className="flex gap-4"><div className="relative h-[100px] w-[160px] shrink-0 overflow-hidden rounded-xl bg-[hsl(var(--muted))]"><img src={analysis.thumbnailUrl} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-2 right-2 rounded bg-[hsl(var(--foreground)/.85)] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--background))]">{formatDuration(analysis.durationSeconds)}</span></div><div className="min-w-0"><div className="pd-kicker mb-2 text-[hsl(var(--muted-foreground))]">source ready</div><h2 className="line-clamp-2 text-xl font-semibold leading-tight tracking-[-.045em]">{analysis.title}</h2><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{analysis.channel} <span className="mx-1.5 opacity-40">/</span> {analysis.chapters.length} chapters detected</p></div></div>
              <div className="mt-6 rounded-xl bg-[hsl(var(--accent)/.23)] p-4"><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold"><Sparkles size={13} /> Pulse recommendation</div><p className="text-sm leading-5 text-[hsl(var(--foreground)/.76)]">{analysis.smartRecommendation}</p></div>
              <div className="mt-5"><div className="pd-kicker mb-3 text-[hsl(var(--muted-foreground))]">Output mode</div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('video')} className={`pd-focus flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${mode === 'video' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))]'}`} data-testid="button-mode-video"><FileVideo size={16} /> Video file</button><button type="button" onClick={() => setMode('audio')} className={`pd-focus flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${mode === 'audio' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))]'}`} data-testid="button-mode-audio"><AudioLines size={16} /> Audio only</button></div></div>
            </div>
            <div><div className="pd-kicker mb-3 text-[hsl(var(--muted-foreground))]">02 / choose a format</div><div className="space-y-2">{analysis.formats.map((format) => <FormatChoice key={format.formatId} format={format} selected={selectedFormat === format.formatId} onSelect={() => setSelectedFormat(format.formatId)} />)}</div><div className="mt-5 grid grid-cols-2 gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-3 text-xs"><input type="checkbox" checked={chapterMode === 'split'} onChange={(event) => setChapterMode(event.target.checked ? 'split' : 'full')} className="accent-[hsl(var(--primary))]" data-testid="input-split-chapters" /> Split chapters</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-3 text-xs"><input type="checkbox" checked={subtitles} onChange={(event) => setSubtitles(event.target.checked)} className="accent-[hsl(var(--primary))]" data-testid="input-subtitles" /> Include subtitles</label></div><button type="button" onClick={submitDownload} disabled={create.isPending || !selected} className="pd-focus mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary))] text-sm font-semibold text-[hsl(var(--secondary-foreground))] transition-transform hover:-translate-y-0.5 disabled:opacity-55" data-testid="button-start-download">{create.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <DownloadIcon size={16} />} {create.isPending ? 'Queueing file' : `Download ${selected?.extension?.toUpperCase() ?? 'file'}`}</button></div>
          </div>
        </div> : null}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: Download['status'] }) {
  const labels = { queued: 'Queued', downloading: 'Downloading', completed: 'Ready', failed: 'Needs attention', canceled: 'Canceled' };
  const colors = { queued: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]', downloading: 'bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))]', completed: 'bg-[hsl(var(--accent)/.45)] text-[hsl(var(--foreground))]', failed: 'bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]', canceled: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${colors[status]}`} data-testid={`status-download-${status}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'downloading' ? 'animate-pulse bg-[hsl(var(--primary))]' : status === 'completed' ? 'bg-[hsl(var(--foreground))]' : status === 'failed' ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--muted-foreground))]'}`} />{labels[status]}</span>;
}

function DownloadRow({ download, onSelect, onDelete, onStart, onCancel }: { download: Download; onSelect: () => void; onDelete: () => void; onStart: () => void; onCancel: () => void }) {
  return (
    <div className="group grid gap-3 border-b border-[hsl(var(--border)/.75)] py-4 first:pt-1 last:border-0 sm:grid-cols-[minmax(0,1fr)_145px_96px] sm:items-center" data-testid={`row-download-${download.id}`}>
      <button type="button" onClick={onSelect} className="pd-focus flex min-w-0 items-center gap-3 text-left" data-testid={`button-open-download-${download.id}`}><div className="h-12 w-[76px] shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--muted))]"><img src={download.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div><div className="min-w-0"><div className="truncate text-sm font-medium">{download.title}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span className="truncate">{download.channel}</span><span className="opacity-40">/</span><span className="pd-mono">{download.formatLabel}</span></div></div></button>
      <div className="flex items-center justify-between gap-2 sm:block"><StatusPill status={download.status} />{download.status === 'downloading' ? <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="pd-progress h-full rounded-full" style={{ width: `${download.progress}%` }} /></div> : null}</div>
      <div className="flex items-center justify-end gap-1 text-[hsl(var(--muted-foreground))]"><span className="mr-1 hidden text-[10px] sm:inline">{download.status === 'completed' ? formatDate(download.completedAt) : formatDate(download.createdAt)}</span>{download.status === 'downloading' ? <button type="button" onClick={onCancel} className="pd-focus rounded-lg p-2 hover:bg-[hsl(var(--muted))]" aria-label="Cancel download" data-testid={`button-cancel-download-${download.id}`}><Pause size={14} /></button> : download.status !== 'completed' ? <button type="button" onClick={onStart} className="pd-focus rounded-lg p-2 hover:bg-[hsl(var(--muted))]" aria-label="Start download" data-testid={`button-start-download-${download.id}`}><Play size={14} /></button> : null}<button type="button" onClick={onDelete} className="pd-focus rounded-lg p-2 hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]" aria-label="Delete download" data-testid={`button-delete-download-${download.id}`}><Trash2 size={14} /></button></div>
    </div>
  );
}

function RecentDownloads() {
  const queryClient = useQueryClient();
  const downloadsQuery = useListDownloads({ limit: 5 }, { query: { queryKey: getListDownloadsQueryKey({ limit: 5 }), refetchInterval: 5000 } });
  const deleteDownload = useDeleteDownload();
  const startDownload = useStartDownload();
  const cancelDownload = useCancelDownload();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailQuery = useGetDownload(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetDownloadQueryKey(selectedId ?? 0), refetchInterval: selectedId !== null ? 2500 : false } });
  const downloads = downloadsQuery.data ?? [];
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
  };
  return <section className="mt-10"><div className="mb-4 flex items-end justify-between gap-3"><div><div className="pd-kicker mb-2 text-[hsl(var(--primary))]">Your queue</div><h2 className="text-2xl font-semibold tracking-[-.055em]">Recent drops</h2></div><Link href="/library" className="pd-focus flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-view-library">View library <ChevronDown size={14} className="-rotate-90" /></Link></div>
    <div className="pd-card rounded-2xl p-4 md:p-5">{downloadsQuery.isLoading ? <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="flex animate-pulse gap-3"><div className="h-12 w-[76px] rounded-lg bg-[hsl(var(--muted))]" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 rounded bg-[hsl(var(--muted))]" /><div className="h-2 w-1/3 rounded bg-[hsl(var(--muted))]" /></div></div>)}</div> : downloadsQuery.isError ? <div className="grid place-items-center py-12 text-center"><RefreshCw size={22} className="mb-3 text-[hsl(var(--primary))]" /><p className="text-sm font-medium">Couldn’t load your queue.</p><button type="button" onClick={() => void downloadsQuery.refetch()} className="mt-3 text-xs text-[hsl(var(--primary))]" data-testid="button-retry-recent">Try again</button></div> : downloads.length === 0 ? <EmptyState compact /> : <div>{downloads.map((download) => <DownloadRow key={download.id} download={download} onSelect={() => setSelectedId(download.id)} onDelete={() => { if (window.confirm('Remove this download from your library?')) deleteDownload.mutate({ downloadId: download.id }, { onSuccess: refresh }); }} onStart={() => startDownload.mutate({ downloadId: download.id }, { onSuccess: refresh })} onCancel={() => cancelDownload.mutate({ downloadId: download.id }, { onSuccess: refresh })} />)}</div>}</div>
    {selectedId !== null && <DetailSheet download={detailQuery.data} loading={detailQuery.isLoading} onClose={() => setSelectedId(null)} />}
  </section>;
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <div className={`grid place-items-center text-center ${compact ? 'py-12' : 'min-h-[360px] py-16'}`}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--accent)/.38)] text-[hsl(var(--foreground))]"><FolderOpen size={23} /></div><h3 className="text-base font-semibold tracking-[-.03em]">No saved drops yet</h3><p className="mt-1 max-w-[290px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your finished files will collect here, with their format and source details intact.</p></div>;
}

function DetailSheet({ download, loading, onClose }: { download?: Download; loading: boolean; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.26)] p-3 backdrop-blur-sm md:items-center"><div className="pd-card pd-enter w-full max-w-[520px] rounded-2xl p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div className="pd-kicker text-[hsl(var(--primary))]">Download details</div><button type="button" onClick={onClose} className="pd-focus rounded-lg p-1.5 hover:bg-[hsl(var(--muted))]" data-testid="button-close-detail"><X size={17} /></button></div>{loading ? <div className="space-y-3 animate-pulse"><div className="h-4 w-2/3 rounded bg-[hsl(var(--muted))]" /><div className="h-3 w-1/3 rounded bg-[hsl(var(--muted))]" /><div className="h-20 rounded-xl bg-[hsl(var(--muted))]" /></div> : download ? <><div className="flex gap-3"><img src={download.thumbnailUrl} alt="" className="h-16 w-24 rounded-lg object-cover" /><div className="min-w-0"><h3 className="truncate font-semibold">{download.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{download.channel}</p><div className="mt-2"><StatusPill status={download.status} /></div></div></div><div className="mt-5 grid grid-cols-2 gap-2">{[['Format', download.formatLabel], ['Duration', formatDuration(download.durationSeconds)], ['Chapters', download.chapterMode === 'split' ? 'Split files' : 'One file'], ['Subtitles', download.includeSubtitles ? 'Included' : 'Not included']].map(([label, value]) => <div key={label} className="rounded-xl bg-[hsl(var(--muted)/.62)] p-3"><div className="pd-kicker text-[hsl(var(--muted-foreground))]">{label}</div><div className="mt-1 text-sm">{value}</div></div>)}</div>{download.fileUrl ? <a href={download.fileUrl} download={download.fileName ?? undefined} className="pd-focus mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary))] text-sm font-medium text-[hsl(var(--secondary-foreground))]" data-testid="link-download-file"><DownloadIcon size={15} /> Save file</a> : null}</> : <p className="text-sm text-[hsl(var(--muted-foreground))]">This download is no longer available.</p>}</div></div>;
}

export function WorkspacePage() {
  const [created, setCreated] = useState(0);
  const insightsQuery = useGetInsights({ query: { queryKey: getGetInsightsQueryKey() } });
  const recentActivity = insightsQuery.data?.recentActivity ?? [];
  return <><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div className="pd-enter"><p className="pd-kicker mb-2 text-[hsl(var(--muted-foreground))]">Tuesday, keep the signal</p><h1 className="text-3xl font-semibold tracking-[-.065em] md:text-4xl">Good to see you.</h1></div><StatStrip /></div><div className="pd-enter pd-enter-1"><Analyzer onCreated={() => setCreated((value) => value + 1)} /></div><div key={created} className="pd-enter pd-enter-2"><RecentDownloads /></div>{recentActivity.length > 0 ? <section className="mt-12 hidden lg:block"><div className="mb-4 flex items-center gap-2"><Activity size={15} className="text-[hsl(var(--primary))]" /><h2 className="text-sm font-semibold">A small pulse check</h2></div><div className="grid grid-cols-3 gap-3">{recentActivity.slice(0, 3).map((item) => <div key={item.id} className="border-l-2 border-[hsl(var(--accent))] pl-3"><div className="truncate text-xs font-medium">{item.title}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{item.formatLabel} · {formatDate(item.completedAt ?? item.createdAt)}</div></div>)}</div></section> : null}</>;
}

export function LibraryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | Download['status']>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const params = useMemo(() => ({ search: search || undefined, status, limit: 100 as const }), [search, status]);
  const query = useListDownloads(params, { query: { queryKey: getListDownloadsQueryKey(params), refetchInterval: 5000 } });
  const detail = useGetDownload(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetDownloadQueryKey(selectedId ?? 0) } });
  const remove = useDeleteDownload();
  const start = useStartDownload();
  const cancel = useCancelDownload();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListDownloadsQueryKey(params) });
    void queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
  };
  return <><div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><div className="pd-kicker mb-2 text-[hsl(var(--primary))]">Your archive</div><h1 className="text-4xl font-semibold tracking-[-.07em]">Library</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Everything you chose to keep, in one quiet place.</p></div><div className="pd-mono text-xs text-[hsl(var(--muted-foreground))]">{query.data?.length ?? '—'} files</div></div><div className="pd-card rounded-2xl p-4 md:p-5"><div className="mb-5 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="pd-focus h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] pl-10 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="Search titles or channels" data-testid="input-library-search" /></div><div className="flex items-center gap-2"><ListFilter size={15} className="ml-1 text-[hsl(var(--muted-foreground))]" /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="pd-focus h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] px-3 text-xs outline-none" data-testid="select-library-status"><option value="all">All statuses</option><option value="completed">Ready</option><option value="downloading">Downloading</option><option value="queued">Queued</option><option value="failed">Needs attention</option><option value="canceled">Canceled</option></select></div></div>{query.isLoading ? <div className="space-y-4 py-4">{[1, 2, 3, 4].map((i) => <div key={i} className="flex animate-pulse gap-3"><div className="h-12 w-[76px] rounded-lg bg-[hsl(var(--muted))]" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 rounded bg-[hsl(var(--muted))]" /><div className="h-2 w-1/4 rounded bg-[hsl(var(--muted))]" /></div></div>)}</div> : query.isError ? <div className="grid place-items-center py-16 text-center"><p className="text-sm font-medium">The library missed a beat.</p><button type="button" onClick={() => void query.refetch()} className="mt-2 text-xs text-[hsl(var(--primary))]" data-testid="button-retry-library">Retry</button></div> : (query.data?.length ?? 0) === 0 ? <EmptyState /> : <div>{query.data?.map((download) => <DownloadRow key={download.id} download={download} onSelect={() => setSelectedId(download.id)} onDelete={() => { if (window.confirm('Remove this download from your library?')) remove.mutate({ downloadId: download.id }, { onSuccess: refresh }); }} onStart={() => start.mutate({ downloadId: download.id }, { onSuccess: refresh })} onCancel={() => cancel.mutate({ downloadId: download.id }, { onSuccess: refresh })} />)}</div>}</div>{selectedId !== null ? <DetailSheet download={detail.data} loading={detail.isLoading} onClose={() => setSelectedId(null)} /> : null}</>;
}

export function PresetsPage() {
  const queryClient = useQueryClient();
  const query = useListPresets({ query: { queryKey: getListPresetsQueryKey() } });
  const create = useCreatePreset();
  const remove = useDeletePreset();
  const [name, setName] = useState('');
  const [formatId, setFormatId] = useState('mp4-1080');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [chapterMode, setChapterMode] = useState<'full' | 'split'>('full');
  const [subtitles, setSubtitles] = useState(false);
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ data: { name: name.trim(), formatId: formatId.trim(), mode, chapterMode, includeSubtitles: subtitles } }, { onSuccess: () => { setName(''); void queryClient.invalidateQueries({ queryKey: getListPresetsQueryKey() }); } });
  };
  return <><div className="mb-8"><div className="pd-kicker mb-2 text-[hsl(var(--primary))]">Remove decisions</div><h1 className="text-4xl font-semibold tracking-[-.07em]">Presets</h1><p className="mt-2 max-w-[520px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Name the setup you reach for most. Next time, your choice is already made.</p></div><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={save} className="pd-card h-fit rounded-2xl p-5"><div className="pd-kicker mb-4 text-[hsl(var(--muted-foreground))]">New preset</div><label className="mb-4 block text-xs font-medium">Preset name<input value={name} onChange={(event) => setName(event.target.value)} className="pd-focus mt-2 h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="My clean archive" data-testid="input-preset-name" /></label><label className="mb-4 block text-xs font-medium">Format ID<input value={formatId} onChange={(event) => setFormatId(event.target.value)} className="pd-focus mt-2 h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="mp4-1080" data-testid="input-preset-format" /></label><div className="mb-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('video')} className={`rounded-xl border p-2.5 text-xs ${mode === 'video' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))]'}`} data-testid="button-preset-video"><FileVideo size={14} className="mx-auto mb-1" />Video</button><button type="button" onClick={() => setMode('audio')} className={`rounded-xl border p-2.5 text-xs ${mode === 'audio' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))]'}`} data-testid="button-preset-audio"><AudioLines size={14} className="mx-auto mb-1" />Audio</button></div><div className="mb-4 flex gap-4 text-xs"><label className="flex items-center gap-2"><input type="radio" checked={chapterMode === 'full'} onChange={() => setChapterMode('full')} data-testid="radio-preset-full" />Single file</label><label className="flex items-center gap-2"><input type="radio" checked={chapterMode === 'split'} onChange={() => setChapterMode('split')} data-testid="radio-preset-split" />Split chapters</label></div><label className="mb-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={subtitles} onChange={(event) => setSubtitles(event.target.checked)} data-testid="input-preset-subtitles" /> Include subtitles</label><button type="submit" disabled={create.isPending || !name.trim() || !formatId.trim()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--secondary))] text-sm font-medium text-[hsl(var(--secondary-foreground))] disabled:opacity-50" data-testid="button-save-preset">{create.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Save preset</button></form><div className="pd-card rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><div className="pd-kicker text-[hsl(var(--muted-foreground))]">Saved setups</div><span className="pd-mono text-xs text-[hsl(var(--muted-foreground))]">{query.data?.length ?? '—'}</span></div>{query.isLoading ? <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />)}</div> : query.isError ? <div className="py-12 text-center text-sm">Couldn’t load presets.</div> : query.data?.length ? <div className="space-y-2">{query.data.map((preset: Preset) => <div key={preset.id} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3.5 transition-colors hover:bg-[hsl(var(--muted)/.45)]" data-testid={`card-preset-${preset.id}`}><div className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--accent)/.45)]"><Gauge size={16} /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{preset.name}</div><div className="pd-mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{preset.formatId} · {preset.mode} · {preset.chapterMode === 'split' ? 'split' : 'single'}{preset.includeSubtitles ? ' · subs' : ''}</div></div><button type="button" onClick={() => { if (window.confirm('Delete this preset?')) remove.mutate({ presetId: preset.id }, { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListPresetsQueryKey() }) }); }} className="pd-focus rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]" data-testid={`button-delete-preset-${preset.id}`}><Trash2 size={15} /></button></div>)}</div> : <div className="py-12"><EmptyState compact /></div>}</div></div></>;
}

export function SettingsPage() {
  const [notifications, setNotifications] = useState(() => localStorage.getItem('pulsedrop-notifications') !== 'off');
  const [remember, setRemember] = useState(() => localStorage.getItem('pulsedrop-remember') !== 'off');
  const [compact, setCompact] = useState(() => localStorage.getItem('pulsedrop-compact') === 'on');
  const toggle = (key: string, value: boolean, setter: (next: boolean) => void) => { setter(value); localStorage.setItem(key, value ? 'on' : 'off'); };
  return <><div className="mb-8"><div className="pd-kicker mb-2 text-[hsl(var(--primary))]">The quiet bits</div><h1 className="text-4xl font-semibold tracking-[-.07em]">Settings</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">A few preferences for how PulseDrop behaves on your desk.</p></div><div className="max-w-[720px] space-y-3"><SettingRow icon={Radio} title="Queue updates" description="Show a small notice when a file finishes." checked={notifications} onChange={(value) => toggle('pulsedrop-notifications', value, setNotifications)} testId="toggle-notifications" /><SettingRow icon={Copy} title="Remember last choice" description="Keep your last format and output mode ready on the next drop." checked={remember} onChange={(value) => toggle('pulsedrop-remember', value, setRemember)} testId="toggle-remember" /><SettingRow icon={LayoutGrid} title="Compact library rows" description="Fit more saved files on one screen." checked={compact} onChange={(value) => toggle('pulsedrop-compact', value, setCompact)} testId="toggle-compact" /></div><div className="mt-10 max-w-[720px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.38)] p-5"><div className="flex gap-3"><CircleHelp size={17} className="mt-0.5 text-[hsl(var(--primary))]" /><div><div className="text-sm font-medium">A note on permission</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">PulseDrop is for videos you own or have explicit permission to download. Respect the creator and the platform.</p></div></div></div></>;
}

function SettingRow({ icon: Icon, title, description, checked, onChange, testId }: { icon: typeof Radio; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <div className="pd-card flex items-center gap-4 rounded-2xl p-4 md:p-5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={17} /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</div></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`pd-focus relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground)/.3)]'}`} data-testid={testId}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[hsl(var(--background))] transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>;
}

export function PulseDropApp({ page }: { page: Page }) {
  return <Shell>{page === 'workspace' ? <WorkspacePage /> : page === 'library' ? <LibraryPage /> : page === 'presets' ? <PresetsPage /> : <SettingsPage />}</Shell>;
}