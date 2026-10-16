import React from 'react';
import { PlaylistItem, Slide, SectionTag, Theme, QuickPinnedItem } from '../types/presentation';
import { 
  Play, 
  Eye, 
  Tv, 
  Megaphone,
  Zap,
  X,
  Pin
} from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';

interface CenterWorkspaceProps {
  activeItem: PlaylistItem | null;
  previewSlide: Slide | null;
  liveSlide: Slide | null;
  activeTheme: Theme;
  quickPinnedItems?: QuickPinnedItem[];
  onSelectSlidePreview: (slide: Slide) => void;
  onSendSlideLive: (slide: Slide) => void;
  onJumpSection: (sectionLabel: SectionTag) => void;
  onTriggerLowerThirdAnnouncement: (slide: Slide) => void;
  onClearLowerThirdAnnouncement: () => void;
  activeLowerThirdText: { title?: string; content?: string } | null;
  onUnpinFromQuickSection?: (pinIdOrTitle: string) => void;
  onLoadQuickPinnedSlides?: (slides: Slide[], title: string, itemId?: string) => void;
}

export const CenterWorkspace: React.FC<CenterWorkspaceProps> = ({
  activeItem,
  previewSlide,
  liveSlide,
  activeTheme,
  quickPinnedItems = [],
  onSelectSlidePreview,
  onSendSlideLive,
  onJumpSection,
  onTriggerLowerThirdAnnouncement,
  onClearLowerThirdAnnouncement,
  activeLowerThirdText,
  onUnpinFromQuickSection,
  onLoadQuickPinnedSlides
}) => {
  // Extract unique section labels present in the active item
  const availableSections: SectionTag[] = Array.from(
    new Set(
      (activeItem?.slides || [])
        .map(s => s.sectionLabel)
        .filter(Boolean) as SectionTag[]
    )
  );

  return (
    <div className="flex-1 bg-[#090d14] flex flex-col h-full overflow-hidden select-none">
      {/* Top PREVIEW & LIVE Monitors Header */}
      <div className="h-44 p-3 bg-[#0d1320] border-b border-[#26334a] grid grid-cols-2 gap-3 shrink-0">
        {/* PREVIEW DISPLAY CARD */}
        <div className="relative rounded-xl overflow-hidden border border-blue-500/40 bg-[#121824] flex flex-col justify-between shadow-lg group">
          {/* Header Badge */}
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/90 text-white font-extrabold text-[10px] tracking-wider uppercase shadow glow-preview">
            <Eye className="w-3.5 h-3.5" />
            <span>PREVIEW</span>
          </div>

          {/* Slide Canvas Content */}
          <div className="relative flex-1 flex items-center justify-center p-4 text-center overflow-hidden">
            {previewSlide?.backgroundUrl ? (
              <img
                src={previewSlide.backgroundUrl}
                alt="Preview Background"
                className="absolute inset-0 w-full h-full object-cover opacity-50 filter blur-[1px]"
              />
            ) : activeTheme.backgroundUrl ? (
              <img
                src={activeTheme.backgroundUrl}
                alt="Theme Background"
                className="absolute inset-0 w-full h-full object-cover opacity-40 filter blur-[2px]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
            )}

            {/* Dark Overlay Scrim */}
            <div 
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${activeTheme.scrimOpacity})` }}
            />

            {/* Content Text */}
            <div className="relative z-10 max-w-md w-full px-2 max-h-32 overflow-y-auto">
              {previewSlide ? (
                <>
                  <div 
                    className="font-bold text-white drop-shadow-md whitespace-pre-line"
                    style={{ 
                      fontFamily: activeTheme.fontFamily,
                      ...getFlexibleFontSize(previewSlide.content, 20) 
                    }}
                  >
                    {previewSlide.content}
                  </div>
                  {previewSlide.subtitle && (
                    <div className="text-[10px] text-indigo-300 font-semibold mt-1">
                      {previewSlide.subtitle}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-slate-500 text-xs italic">No slide selected for preview</span>
              )}
            </div>
          </div>

          {/* Go Live Button */}
          {previewSlide && (
            <div className="p-2 bg-[#121824]/90 border-t border-slate-800 flex justify-end z-20">
              <button
                onClick={() => onSendSlideLive(previewSlide)}
                className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1.5 transition transform active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>GO LIVE</span>
              </button>
            </div>
          )}
        </div>

        {/* LIVE DISPLAY CARD */}
        <div className="relative rounded-xl overflow-hidden border border-rose-500/80 bg-[#121824] flex flex-col justify-between shadow-xl glow-live">
          {/* Header Badge */}
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600 text-white font-black text-[10px] tracking-wider uppercase shadow-md glow-live">
            <Tv className="w-3.5 h-3.5 animate-pulse" />
            <span>LIVE OUTPUT</span>
          </div>

          {/* Slide Canvas Content */}
          <div className="relative flex-1 flex items-center justify-center p-4 text-center overflow-hidden">
            {liveSlide?.backgroundUrl ? (
              <img
                src={liveSlide.backgroundUrl}
                alt="Live Background"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
            ) : activeTheme.backgroundUrl ? (
              <img
                src={activeTheme.backgroundUrl}
                alt="Theme Background"
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900" />
            )}

            {/* Dark Overlay Scrim */}
            <div 
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${activeTheme.scrimOpacity})` }}
            />

            {/* Live Text Content */}
            <div className="relative z-10 max-w-md w-full px-2 max-h-32 overflow-y-auto">
              {liveSlide ? (
                <>
                  <div 
                    className="font-extrabold text-white drop-shadow-lg whitespace-pre-line"
                    style={{ 
                      fontFamily: activeTheme.fontFamily,
                      ...getFlexibleFontSize(liveSlide.content, 22)
                    }}
                  >
                    {liveSlide.content}
                  </div>
                  {liveSlide.subtitle && (
                    <div className="text-xs text-rose-300 font-bold mt-1">
                      {liveSlide.subtitle}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-rose-400/60 text-xs font-semibold uppercase tracking-widest">
                  OUTPUT CLEAR / BLACK
                </span>
              )}
            </div>

            {/* Live Lower-Third Announcement Active Crawl Line Ticker Banner */}
            {activeLowerThirdText && (
              <div className="absolute bottom-2 left-2 right-2 z-30 bg-purple-950/95 border border-purple-500/90 rounded-lg flex items-center justify-between gap-2 p-1.5 shadow-xl backdrop-blur overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  <span className="px-1.5 py-0.5 bg-purple-700 text-white font-black text-[9px] uppercase rounded shrink-0 flex items-center gap-1">
                    <Megaphone className="w-3 h-3 text-amber-300 animate-pulse" /> CRAWL TICKER
                  </span>
                  <div className="overflow-hidden relative flex-1">
                    <div className="animate-crawl-line font-bold text-white text-[11px] whitespace-nowrap">
                      {activeLowerThirdText.content} {activeLowerThirdText.title ? `— (${activeLowerThirdText.title})` : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClearLowerThirdAnnouncement}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px] uppercase rounded flex items-center gap-1 shrink-0 transition"
                  title="Remove lower third announcement ticker"
                >
                  <X className="w-3 h-3" /> Stop Ticker
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Selection Section Bar (Pinned Chapters, Verses, Songs) */}
      {quickPinnedItems && quickPinnedItems.length > 0 && (
        <div className="px-4 py-2 bg-[#09101c] border-b border-amber-500/40 flex items-center gap-2 overflow-x-auto shrink-0 shadow-md">
          <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Pin className="w-3.5 h-3.5 text-amber-400" /> Quick Selection:
          </span>
          {quickPinnedItems.map(item => {
            const isActivePin = activeItem && (activeItem.id === item.id || activeItem.title.toLowerCase() === item.title.toLowerCase());
            return (
              <div
                key={item.id}
                className={`rounded-full px-3 py-1 flex items-center gap-2 text-xs shrink-0 transition shadow ${
                  isActivePin
                    ? 'bg-amber-950/90 border-2 border-amber-400 text-amber-200 ring-2 ring-amber-400/50 shadow-amber-500/20 font-black scale-[1.02]'
                    : 'bg-[#141d2e] border border-slate-700 hover:border-amber-400 text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onLoadQuickPinnedSlides) onLoadQuickPinnedSlides(item.slides, item.title, item.id);
                    else if (item.slides.length > 0) onSelectSlidePreview(item.slides[0]);
                  }}
                  className="font-bold hover:text-amber-300 transition flex items-center gap-1.5 text-xs"
                  title={`Click to view ${item.title} slides`}
                >
                  <span>{item.type === 'bible' ? '📖' : item.type === 'song' ? '🎵' : '📢'}</span>
                  <span className="max-w-[180px] truncate">{item.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActivePin ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-300'
                  }`}>
                    {item.slides.length} slides
                  </span>
                </button>
                {onUnpinFromQuickSection && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpinFromQuickSection(item.id);
                    }}
                    className="text-slate-400 hover:text-rose-400 p-0.5 rounded-full hover:bg-rose-950/50 transition"
                    title="Unpin from Quick Section"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Section Jump Pills Bar */}
      {availableSections.length > 0 && (
        <div className="px-4 py-2 bg-[#0e1524] border-b border-[#26334a] flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-amber-400" /> Quick Section Jump:
          </span>
          {availableSections.map(sec => (
            <button
              key={sec}
              onClick={() => onJumpSection(sec)}
              className="px-3 py-1 bg-[#182338] hover:bg-indigo-600 hover:text-white border border-slate-700 hover:border-indigo-500 rounded-full text-xs font-bold text-slate-200 transition shadow shrink-0"
            >
              {sec}
            </button>
          ))}
        </div>
      )}

      {/* Main Slide Grid Matrix Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeItem ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">
                  {activeItem.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {activeItem.type.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Single click to preview • Double click or click "LIVE" to broadcast
              </span>
            </div>

            {/* Slides Grid */}
            <div className="grid grid-cols-3 gap-3">
              {activeItem.slides.map((slide, sIdx) => {
                const isPreviewed = previewSlide?.id === slide.id;
                const isLive = liveSlide?.id === slide.id;

                return (
                  <div
                    key={slide.id}
                    onClick={() => onSelectSlidePreview(slide)}
                    onDoubleClick={() => onSendSlideLive(slide)}
                    className={`relative rounded-xl p-3 min-h-[160px] max-h-[220px] flex flex-col justify-between border cursor-pointer transition transform hover:-translate-y-0.5 ${
                      isLive
                        ? 'bg-rose-950/60 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                        : isPreviewed
                        ? 'bg-blue-950/60 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                        : 'bg-[#141d2e] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Header: Slide # & Section Tag */}
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded">
                        #{sIdx + 1}
                      </span>
                      {slide.sectionLabel && (
                        <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-0.5 rounded-full">
                          {slide.sectionLabel}
                        </span>
                      )}
                    </div>

                    {/* Content text preview snippet */}
                    <div className="z-10 text-center my-auto px-2 overflow-y-auto max-h-[110px]">
                      <div 
                        className="font-bold text-white whitespace-pre-line"
                        style={getFlexibleFontSize(slide.content, 14)}
                      >
                        {slide.content}
                      </div>
                    </div>

                    {/* Bottom Action Controls: DUAL MODES (Full Slide vs Lower Third Ticker Overlay) */}
                    <div className="flex items-center justify-between z-10 pt-1.5 border-t border-slate-800/80 text-[10px] gap-1">
                      {isLive ? (
                        <span className="font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 glow-live truncate">
                          <Tv className="w-3 h-3 animate-pulse shrink-0" /> LIVE
                        </span>
                      ) : isPreviewed ? (
                        <span className="font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1 truncate">
                          <Eye className="w-3 h-3 shrink-0" /> PREVIEW
                        </span>
                      ) : (
                        <span className="text-slate-500 truncate">Select slide</span>
                      )}

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Option 1: Trigger as Independent Lower-Third Announcement Ticker without interrupting live presentation */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTriggerLowerThirdAnnouncement(slide);
                          }}
                          className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white font-extrabold rounded text-[9px] uppercase shadow transition flex items-center gap-1"
                          title="Trigger as Lower-Third Announcement Ticker overlay on Audience screen without stopping current worship song!"
                        >
                          <Megaphone className="w-3 h-3" /> Ticker
                        </button>

                        {/* Option 2: Go Live with Full Presentation Slide */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendSlideLive(slide);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded text-[9px] uppercase shadow transition"
                          title="Broadcast full slide live"
                        >
                          LIVE
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center">
            <p className="font-semibold text-slate-400">No Item Selected</p>
            <p className="text-slate-600 mt-1">Select an item from the playlist on the left to view slides.</p>
          </div>
        )}
      </div>
    </div>
  );
};
