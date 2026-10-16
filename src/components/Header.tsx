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
  Sliders
} from 'lucide-react';

interface HeaderProps {
  serviceTitle: string;
  onOpenSearch: () => void;
  onOpenQuickMode: () => void;
  onOpenSermonMode: () => void;
  onOpenSettings: () => void;
  onOpenAudienceOutput: () => void;
  onOpenStageOutput: () => void;
  onExportPackage: () => void;
  onImportPackage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isAudienceActive: boolean;
  isStageActive: boolean;
  isSaved: boolean;
  onOpenSlideDesigner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serviceTitle,
  onOpenSearch,
  onOpenQuickMode,
  onOpenSermonMode,
  onOpenSettings,
  onOpenAudienceOutput,
  onOpenStageOutput,
  onExportPackage,
  onImportPackage,
  isAudienceActive,
  isStageActive,
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
    <header className="h-14 bg-[#0d131f] border-b border-[#26334a] px-4 flex items-center justify-between gap-4 select-none shrink-0 z-30">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-1.5 rounded-lg shadow-lg">
          <Flame className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              LIVE PSALMS
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
              PRO MEDIA
            </span>
            {displayCount > 1 ? (
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
                <Tv className="w-2.5 h-2.5 text-emerald-400" /> {displayCount} Screens Detected
              </span>
            ) : (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                1 Screen (Borderless)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="truncate max-w-[200px] text-slate-200">{serviceTitle}</span>
            <span className="text-slate-600">•</span>
            {isSaved ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <Save className="w-3 h-3" /> Saved
              </span>
            ) : (
              <span className="text-[11px] text-amber-400 font-medium">Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Global Search Bar Trigger */}
      <div className="flex-1 max-w-md">
        <button
          onClick={onOpenSearch}
          className="w-full h-9 px-3 bg-[#162032] hover:bg-[#1e2b42] border border-[#26334a] hover:border-indigo-500/50 rounded-lg text-slate-400 hover:text-slate-200 flex items-center justify-between text-xs transition-all shadow-inner group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Search Songs, Scriptures, Media, Playlists...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-semibold bg-[#0d131f] border border-[#26334a] rounded text-slate-400">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Quick Action Tools */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenQuickMode}
          className="h-9 px-3 bg-[#182338] hover:bg-indigo-600/20 border border-[#26334a] hover:border-indigo-500/40 rounded-lg text-indigo-300 font-medium text-xs flex items-center gap-1.5 transition"
          title="Quick 2-click song presentation mode"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Mode</span>
        </button>

        <button
          onClick={onOpenSermonMode}
          className="h-9 px-3 bg-[#182338] hover:bg-purple-600/20 border border-[#26334a] hover:border-purple-500/40 rounded-lg text-purple-300 font-medium text-xs flex items-center gap-1.5 transition"
          title="Sermon Outline Builder"
        >
          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
          <span>Sermon Mode</span>
        </button>

        <button
          onClick={onOpenSlideDesigner}
          className="h-9 px-3 bg-[#182338] hover:bg-emerald-600/20 border border-[#26334a] hover:border-emerald-500/40 rounded-lg text-emerald-300 font-medium text-xs flex items-center gap-1.5 transition"
          title="Interactive Visual Slide Designer"
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Slide Canvas</span>
        </button>

        {/* Display Output Windows Controls */}
        <div className="h-6 w-px bg-[#26334a] mx-1" />

        <button
          onClick={onOpenAudienceOutput}
          className={`h-9 px-3.5 rounded-lg border font-semibold text-xs flex items-center gap-2 transition ${
            isAudienceActive
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
              : 'bg-[#182338] border-[#26334a] text-slate-300 hover:border-slate-500'
          }`}
          title="Open Audience Screen (Projector / Main Output)"
        >
          <Tv className={`w-4 h-4 ${isAudienceActive ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
          <span>Audience Output</span>
          <span className={`w-2 h-2 rounded-full ${isAudienceActive ? 'bg-rose-500 glow-live' : 'bg-slate-600'}`} />
        </button>

        <button
          onClick={onOpenStageOutput}
          className={`h-9 px-3.5 rounded-lg border font-semibold text-xs flex items-center gap-2 transition ${
            isStageActive
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-[#182338] border-[#26334a] text-slate-300 hover:border-slate-500'
          }`}
          title="Open Stage Display (Confidence Monitor for Worship Leaders / Pastors)"
        >
          <MonitorPlay className={`w-4 h-4 ${isStageActive ? 'text-amber-400' : 'text-slate-400'}`} />
          <span>Stage Display</span>
          <span className={`w-2 h-2 rounded-full ${isStageActive ? 'bg-amber-500' : 'bg-slate-600'}`} />
        </button>

        <div className="h-6 w-px bg-[#26334a] mx-1" />

        {/* Import / Export & Settings */}
        <button
          onClick={onExportPackage}
          className="p-2 bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Export Service Package (.worshipflow)"
        >
          <Download className="w-4 h-4" />
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
          className="p-2 bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Import Service Package (.worshipflow)"
        >
          <Upload className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 bg-[#182338] hover:bg-[#23314d] border border-[#26334a] rounded-lg text-slate-300 hover:text-white transition"
          title="Application Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
