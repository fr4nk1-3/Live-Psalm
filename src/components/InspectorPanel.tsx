import React from 'react';
import { Theme, Slide, MediaAsset, PlaylistItem } from '../types/presentation';
import { StorageService } from '../services/storage';
import {
  Sliders,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Layers,
  Lock,
  Film,
  Globe,
  X
} from 'lucide-react';

interface InspectorPanelProps {
  theme: Theme;
  onUpdateTheme: (updated: Partial<Theme>) => void;
  activeSlide: Slide | null;
  /** The currently selected playlist item (for item-level BG info) */
  activeItem?: PlaylistItem | null;
  onUpdateSlide: (updated: Partial<Slide>) => void;
  mediaList: MediaAsset[];
  speakerNotes: string;
  onUpdateSpeakerNotes: (notes: string) => void;
  /** Currently active global video background URL */
  globalVideoBgUrl?: string | null;
  /** Clears the global video background */
  onClearGlobalVideoBg?: () => void;
  /** Clears the item-level video background of the active item */
  onClearItemVideoBg?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  theme,
  onUpdateTheme,
  activeSlide,
  activeItem,
  onUpdateSlide,
  mediaList,
  speakerNotes,
  onUpdateSpeakerNotes,
  globalVideoBgUrl,
  onClearGlobalVideoBg,
  onClearItemVideoBg
}) => {
  return (
    <div className="w-56 xl:w-64 2xl:w-72 bg-[#0f1624] border-l border-[#26334a] flex flex-col h-full min-h-0 select-none shrink-0 transition-[width] duration-150">
      {/* Pinned Panel Header */}
      <div className="px-3 py-2.5 border-b border-[#26334a] bg-[#131b2c] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-black text-slate-200 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Inspector &amp; Theme</span>
        </div>
        {activeSlide && (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-300 uppercase truncate max-w-[90px]">
            {activeSlide.sectionLabel || 'Slide'}
          </span>
        )}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* TYPOGRAPHY SECTION */}
        <div className="bg-[#121929] border border-slate-800 p-3 rounded-xl space-y-2.5 text-xs">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <Type className="w-3.5 h-3.5" /> Typography &amp; Style
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
              Font Family
            </label>
            <select
              value={theme.fontFamily}
              onChange={(e) => onUpdateTheme({ fontFamily: e.target.value })}
              className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-white font-semibold outline-none text-xs"
            >
              {['Inter', 'Cinzel', 'Outfit', 'Montserrat', 'Playfair Display'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Font Size
              </label>
              <span className="text-[10px] font-mono font-bold text-indigo-300">
                {theme.fontSize}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={24}
                max={200}
                value={theme.fontSize}
                onChange={(e) => onUpdateTheme({ fontSize: parseInt(e.target.value, 10) })}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <input
                type="number"
                min={24}
                max={300}
                value={theme.fontSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 8) onUpdateTheme({ fontSize: v });
                }}
                className="w-14 bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-white font-bold text-center outline-none text-xs"
              />
            </div>
          </div>

          {/* Text Align Buttons */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
              Text Alignment
            </label>
            <div className="grid grid-cols-3 gap-1 bg-[#0b101b] p-1 rounded-lg border border-slate-700">
              {[
                { id: 'left', icon: AlignLeft },
                { id: 'center', icon: AlignCenter },
                { id: 'right', icon: AlignRight }
              ].map(align => (
                <button
                  key={align.id}
                  type="button"
                  onClick={() => onUpdateTheme({ align: align.id as any })}
                  className={`py-1.5 flex items-center justify-center rounded-md transition ${
                    theme.align === align.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <align.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Text Color & Accent Color */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Text Color
              </label>
              <label className="flex items-center gap-2 bg-[#0b101b] border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1.5 cursor-pointer">
                <input
                  type="color"
                  value={theme.textColor}
                  onChange={(e) => onUpdateTheme({ textColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                  {theme.textColor}
                </span>
              </label>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Accent Color
              </label>
              <label className="flex items-center gap-2 bg-[#0b101b] border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1.5 cursor-pointer">
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => onUpdateTheme({ accentColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-[10px] font-mono text-slate-300 uppercase truncate">
                  {theme.accentColor}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* BACKGROUND & SCRIM OVERLAY SECTION */}
        <div className="bg-[#121929] border border-slate-800 p-3 rounded-xl space-y-2.5 text-xs">
          <div className="font-bold text-sky-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <ImageIcon className="w-3.5 h-3.5" /> Background Overlay
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Dark Scrim Opacity
              </label>
              <span className="text-[10px] font-mono font-bold text-sky-300">
                {Math.round(theme.scrimOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={theme.scrimOpacity}
              onChange={(e) => onUpdateTheme({ scrimOpacity: parseFloat(e.target.value) })}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* Slide-specific Text & Background Override */}
          {activeSlide && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Edit Slide Content
                </label>
                {activeSlide.sectionLabel === 'Scripture' ? (
                  <div className="p-2.5 bg-[#0b101b] border border-amber-500/30 rounded-lg text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Scripture text is locked for Bible verses</span>
                  </div>
                ) : (
                  <textarea
                    value={activeSlide.content}
                    onChange={(e) => onUpdateSlide({ content: e.target.value })}
                    className="w-full h-24 bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg p-2.5 text-white outline-none text-xs font-sans resize-none leading-relaxed"
                    placeholder="Edit slide text..."
                  />
                )}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Slide Background
                </label>
                <select
                  value={activeSlide.backgroundUrl || ''}
                  onChange={(e) => {
                    const url = e.target.value || undefined;
                    if (!url) {
                      onUpdateSlide({ backgroundUrl: undefined, backgroundType: undefined });
                      return;
                    }
                    const asset = mediaList.find(m => m.url === url);
                    const isVideo =
                      asset?.type === 'video' ||
                      (url &&
                        (url.endsWith('.mp4') ||
                          url.endsWith('.webm') ||
                          url.endsWith('.mov') ||
                          url.startsWith('data:video')));
                    onUpdateSlide({
                      backgroundUrl: url,
                      backgroundType: isVideo ? 'video' : 'image'
                    });
                  }}
                  className="w-full bg-[#0b101b] border border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-white font-semibold outline-none text-xs"
                >
                  <option value="">Default Theme Background</option>
                  {mediaList.filter(m => m.type !== 'video').length > 0 && (
                    <optgroup label="Images & Logos">
                      {mediaList
                        .filter(m => m.type !== 'video')
                        .map(m => {
                          const displayName =
                            m.id === 'media-logo-main' || m.type === 'logo'
                              ? StorageService.getLogoDisplayName()
                              : m.name;
                          return (
                            <option key={m.id} value={m.url}>
                              {displayName}
                            </option>
                          );
                        })}
                    </optgroup>
                  )}
                  {mediaList.filter(m => m.type === 'video').length > 0 && (
                    <optgroup label="Motion Videos">
                      {mediaList
                        .filter(m => m.type === 'video')
                        .map(m => (
                          <option key={m.id} value={m.url}>
                            {m.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {activeSlide.backgroundType === 'video' && (
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                    <Film className="w-3 h-3" /> Video loop active behind slide
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PROJECTOR LAYOUT SECTION */}
        <div className="bg-[#121929] border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Projector Layout
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'centered', label: 'Centered Classic' },
              { id: 'lower_third', label: 'Lower-Third Bar' },
              { id: 'top_banner', label: 'Top Banner' },
              { id: 'split_left', label: 'Left Split Panel' },
              { id: 'split_right', label: 'Right Split Panel' },
              { id: 'boxed_card', label: 'Cinema Boxed Card' },
              { id: 'minimal', label: 'Minimal Clean' }
            ].map(opt => {
              const currentLayout = theme.projectorLayout || (theme.lowerThirdStyle ? 'lower_third' : 'centered');
              const isActive = currentLayout === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateTheme({
                    projectorLayout: opt.id as any,
                    lowerThirdStyle: opt.id === 'lower_third'
                  })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border text-left transition truncate ${
                    isActive
                      ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200'
                      : 'bg-[#0b101b] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Controls how slides &amp; scriptures are arranged on the Audience Projector screen.
          </p>
        </div>

        {/* VIDEO BACKGROUND STATUS SECTION */}
        {(globalVideoBgUrl || activeItem?.videoBackgroundUrl) && (
          <div className="bg-[#121929] border border-sky-700/50 p-3 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-sky-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Film className="w-3.5 h-3.5 text-sky-400" /> Active Video BGs
            </div>

            {globalVideoBgUrl && (
              <div className="flex items-center gap-2 p-2 bg-emerald-950/40 border border-emerald-700/50 rounded-lg">
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-emerald-300 text-[10px] uppercase tracking-wider">
                    Global BG
                  </div>
                  <div className="text-slate-400 text-[9px] truncate" title={globalVideoBgUrl}>
                    Loops behind entire service
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearGlobalVideoBg}
                  className="shrink-0 p-1 bg-rose-900/70 hover:bg-rose-700 text-rose-300 hover:text-white rounded transition"
                  title="Clear global video background"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {activeItem?.videoBackgroundUrl && (
              <div className="flex items-center gap-2 p-2 bg-indigo-950/40 border border-indigo-700/50 rounded-lg">
                <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-indigo-300 text-[10px] uppercase tracking-wider">
                    Item BG
                  </div>
                  <div className="text-slate-400 text-[9px] truncate">
                    {activeItem.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearItemVideoBg}
                  className="shrink-0 p-1 bg-rose-900/70 hover:bg-rose-700 text-rose-300 hover:text-white rounded transition"
                  title="Clear item video background"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* SPEAKER NOTES SECTION */}
        <div className="bg-[#121929] border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
          <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" /> Speaker / Stage Notes
          </div>
          <textarea
            placeholder="Enter notes visible only to operator & stage display..."
            value={speakerNotes}
            onChange={(e) => onUpdateSpeakerNotes(e.target.value)}
            className="w-full h-24 bg-[#0b101b] border border-slate-700 focus:border-amber-500 rounded-lg p-2.5 text-slate-200 outline-none text-xs resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
