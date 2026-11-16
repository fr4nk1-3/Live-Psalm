import React from 'react';
import { 
  Tv, 
  MonitorPlay, 
  Search, 
  Settings, 
  Zap, 
  BookOpen, 
  Download, 
  Upload, 
  Flame, 
  Save, 
  Sliders,
  Radio,
  Layers
} from 'lucide-react';

interface HeaderProps {
  serviceTitle: string;
  onOpenSearch: () => void;
  onOpenQuickMode: () => void;
  onOpenSermonMode: () => void;
  onOpenSettings: () => void;
  onOpenStreaming?: () => void;
  onOpenAudienceOutput: () => void;
  onOpenStageOutput: () => void;
  onOpenLedOutput?: () => void;
  onExportPackage: () => void;
  onImportPackage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isAudienceActive: boolean;
  isStageActive: boolean;
  isLedActive?: boolean;
  isSaved: boolean;
  onOpenSlideDesigner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serviceTitle,
  onOpenSearch,
  onOpenQuickMode,
  onOpenSermonMode,
  onOpenSettings,
  onOpenStreaming,
  onOpenAudienceOutput,
  onOpenStageOutput,
  onOpenLedOutput,
  onExportPackage,
  onImportPackage,
  isAudienceActive,
  isStageActive,
  isLedActive = false,
  isSaved,
  onOpenSlideDesigner
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [displayCount, setDisplayCount] = React.useState<number>(1);

  React.useEffect(() => {
    try {
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.invoke('get-connected-displays').then((displays: any[]) => {
          if (Array.isArray(displays)) {
            setDisplayCount(displays.length);
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Browser preview mode fallback
    }
  }, []);

  return (
    <header className="h-14 bg-[#0d131f] border-b border-[#26334a] px-3.5 flex items-center justify-between gap-3 select-none shrink-0 z-30">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-md shrink-0">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent whitespace-nowrap">
              LIVE PSALMS
            </span>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider whitespace-nowrap">
              PRO
            </span>
            <span
              className={`hidden lg:flex text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider items-center gap-1 whitespace-nowrap ${
                displayCount > 1
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : 'bg-slate-800/90 text-slate-400 border-slate-700'
              }`}
              title={displayCount > 1 ? `${displayCount} displays connected` : 'Single display (Borderless mode)'}
            >
              <Tv className={`w-2.5 h-2.5 ${displayCount > 1 ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{displayCount > 1 ? `${displayCount} Screens` : '1 Screen'}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
            <span className="truncate max-w-[175px] text-slate-300">{serviceTitle}</span>
            <span className="text-slate-600">•</span>
            {isSaved ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 whitespace-nowrap">
                <Save className="w-2.5 h-2.5" /> Saved
              </span>
            ) : (
              <span className="text-[10px] text-amber-400 font-semibold whitespace-nowrap">Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Global Search Bar Trigger */}
      <div className="flex-1 min-w-[100px] max-w-xs 2xl:max-w-md">
        <button
          onClick={onOpenSearch}
          className="w-full h-8 px-2.5 bg-[#162032] hover:bg-[#1e2b42] border border-[#26334a] hover:border-indigo-500/50 rounded-lg text-slate-400 hover:text-slate-200 flex items-center justify-between gap-2 text-xs transition-all shadow-inner group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Search Songs, Scriptures, Media...</span>
          </div>
          <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-semibold bg-[#0d131f] border border-[#26334a] rounded text-slate-400 shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Quick Action Tools */}
      <div className="flex items-center gap-1 xl:gap-1.5 shrink-0 overflow-x-auto max-w-full">
        <button
          onClick={onOpenQuickMode}
          className="h-8 px-2.5 bg-[#182338] hover:bg-indigo-600/20 border border-[#26334a] hover:border-indigo-500/40 rounded-lg text-indigo-300 font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap"
          title="Quick presentation mode"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Quick Mode</span>
        </button>

        <button
          onClick={onOpenSermonMode}
          className="h-8 px-2.5 bg-[#182338] hover:bg-purple-600/20 border border-[#26334a] hover:border-purple-500/40 rounded-lg text-purple-300 font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap"
          title="Sermon Outline Builder"
        >
          <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Sermon Mode</span>
        </button>

        <button
          onClick={onOpenSlideDesigner}
          className="h-8 px-2.5 bg-[#182338] hover:bg-emerald-600/20 border border-[#26334a] hover:border-emerald-500/40 rounded-lg text-emerald-300 font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap"
          title="Interactive Visual Slide Designer"
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Slide Canvas</span>
        </button>

        {/* Display Output Windows Controls */}
        <div className="h-5 w-px bg-[#26334a] mx-0.5" />

        <button
          onClick={onOpenAudienceOutput}
          className={`h-8 px-2.5 rounded-lg border font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap ${
            isAudienceActive
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(239,68,68,0.28)]'
              : 'bg-[#182338] border-[#26334a] text-slate-300 hover:border-slate-500'
          }`}
          title={isAudienceActive ? 'Click to Disable & Close Audience Output' : 'Open Audience Screen (Projector / Main Output)'}
        >
          <Tv className={`w-3.5 h-3.5 shrink-0 ${isAudienceActive ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
          <span>Audience</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isAudienceActive ? 'bg-rose-500 glow-live' : 'bg-slate-600'}`} />
        </button>

        <button
          onClick={onOpenStageOutput}
          className={`h-8 px-2.5 rounded-lg border font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap ${
            isStageActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.28)]'
              : 'bg-[#182338] border-[#26334a] text-slate-300 hover:border-slate-500'
          }`}
          title={isStageActive ? 'Click to Disable & Close Stage Display' : 'Open Stage Display (Confidence Monitor for Worship Leaders / Pastors)'}
        >
          <MonitorPlay className={`w-3.5 h-3.5 shrink-0 ${isStageActive ? 'text-amber-400' : 'text-slate-400'}`} />
          <span>Stage</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isStageActive ? 'bg-amber-500' : 'bg-slate-600'}`} />
        </button>

        {onOpenLedOutput && (
          <button
            onClick={onOpenLedOutput}
            className={`h-8 px-2.5 rounded-lg border font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap ${
              isLedActive
                ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.28)]'
                : 'bg-[#182338] border-[#26334a] text-slate-300 hover:border-slate-500'
            }`}
            title={isLedActive ? 'Click to Disable & Close LED Wall Output' : 'Open LED Wall Display Output'}
          >
            <Layers className={`w-3.5 h-3.5 shrink-0 ${isLedActive ? 'text-sky-400' : 'text-slate-400'}`} />
            <span>LED Wall</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isLedActive ? 'bg-sky-500' : 'bg-slate-600'}`} />
          </button>
        )}

        {onOpenStreaming && (
          <button
            onClick={onOpenStreaming}
            className="h-8 px-2.5 bg-[#182338] hover:bg-rose-600/20 border border-[#26334a] hover:border-rose-500/50 rounded-lg text-rose-300 font-semibold text-[11px] flex items-center gap-1.5 transition whitespace-nowrap"
            title="Live Stream to YouTube, Twitch, or Facebook Live"
          >
            <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Stream</span>
          </button>
        )}

        <div className="h-5 w-px bg-[#26334a] mx-0.5" />

        {/* Import / Export & Settings */}
        <button
          onClick={onExportPackage}
          className="h-8 w-8 flex items-center justify-center bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Export Service Package (.worshipflow)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={onImportPackage}
          accept=".worshipflow,.json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 flex items-center justify-center bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Import Service Package (.worshipflow)"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenSettings}
          className="h-8 w-8 flex items-center justify-center bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Application Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
