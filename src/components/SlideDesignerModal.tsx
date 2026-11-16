import React, { useState, useEffect } from 'react';
import { Slide, Theme, MediaAsset, SectionTag } from '../types/presentation';
import {
  Sliders,
  X,
  Check,
  Lock,
  Play,
  Film,
  Image as ImageIcon,
  Ban,
  Grid,
  Palette
} from 'lucide-react';

interface SlideDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSlide: Slide | null;
  activeTheme: Theme;
  media?: MediaAsset[];
  onSaveSlide: (
    updatedSlide: Slide,
    options?: { goLive?: boolean; applyBgToItem?: boolean }
  ) => void;
}

const SECTION_TAGS: SectionTag[] = [
  'Title',
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Verse 4',
  'Pre-Chorus',
  'Chorus',
  'Chorus 2',
  'Bridge',
  'Tag',
  'Intro',
  'Outro',
  'Ending',
  'Slide',
  'Scripture'
];

const isVideoAssetUrl = (url?: string, type?: string) => {
  if (type === 'video') return true;
  if (!url) return false;
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.startsWith('data:video')
  );
};

export const SlideDesignerModal: React.FC<SlideDesignerModalProps> = ({
  isOpen,
  onClose,
  activeSlide,
  activeTheme,
  media = [],
  onSaveSlide
}) => {
  const [content, setContent] = useState(activeSlide?.content || '');
  const [title, setTitle] = useState(activeSlide?.title || '');
  const [subtitle, setSubtitle] = useState(activeSlide?.subtitle || '');
  const [sectionLabel, setSectionLabel] = useState<SectionTag>(activeSlide?.sectionLabel || 'Slide');
  const [backgroundUrl, setBackgroundUrl] = useState(activeSlide?.backgroundUrl || '');
  const [backgroundType, setBackgroundType] = useState<'video' | 'image' | 'color' | undefined>(
    activeSlide?.backgroundType
  );
  const [backgroundColor, setBackgroundColor] = useState(activeSlide?.backgroundColor || '');
  const [showSafeGuides, setShowSafeGuides] = useState(true);
  const [applyBgToItem, setApplyBgToItem] = useState(false);

  useEffect(() => {
    if (isOpen && activeSlide) {
      setContent(activeSlide.content || '');
      setTitle(activeSlide.title || '');
      setSubtitle(activeSlide.subtitle || '');
      setSectionLabel(activeSlide.sectionLabel || 'Slide');
      setBackgroundUrl(activeSlide.backgroundUrl || '');
      setBackgroundType(activeSlide.backgroundType);
      setBackgroundColor(activeSlide.backgroundColor || '');
      setApplyBgToItem(false);
    }
  }, [isOpen, activeSlide]);

  if (!isOpen) return null;

  if (!activeSlide) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-md bg-[#0f1624] border border-[#26334a] rounded-2xl p-6 text-center space-y-3 shadow-2xl">
          <Sliders className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-black text-white">No Slide Selected</div>
          <p className="text-xs text-slate-400">
            Select a slide from the Service Playlist or Center Grid first to open it in the Visual Slide Canvas.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
          >
            Got It
          </button>
        </div>
      </div>
    );
  }

  const isScriptureSlide = activeSlide.sectionLabel === 'Scripture';
  const effectiveBgUrl =
    backgroundType === 'color' ? undefined : backgroundUrl || activeTheme.backgroundUrl;
  const effectiveIsVideo = isVideoAssetUrl(effectiveBgUrl, backgroundType);

  const handleSelectMediaAsset = (asset: MediaAsset | null) => {
    if (!asset) {
      setBackgroundUrl('');
      setBackgroundType(undefined);
      setBackgroundColor('');
      return;
    }
    setBackgroundUrl(asset.url);
    setBackgroundType(asset.type === 'video' ? 'video' : 'image');
    setBackgroundColor('');
  };

  const handleSave = (goLive: boolean) => {
    onSaveSlide(
      {
        ...activeSlide,
        content,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        sectionLabel,
        backgroundUrl: backgroundType === 'color' ? undefined : backgroundUrl.trim() || undefined,
        backgroundType:
          backgroundType === 'color'
            ? 'color'
            : backgroundUrl.trim()
            ? isVideoAssetUrl(backgroundUrl.trim(), backgroundType)
              ? 'video'
              : 'image'
            : undefined,
        backgroundColor: backgroundType === 'color' ? backgroundColor || '#0f172a' : undefined
      },
      { goLive, applyBgToItem }
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl bg-[#0f1624] border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs animate-zoom-in">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white uppercase tracking-wider">
                Visual Slide Canvas
              </h2>
              <p className="text-[11px] text-slate-400">
                16:9 live composition preview with theme typography, media backgrounds, and safe guides.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSafeGuides(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition ${
                showSafeGuides
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle 16:9 title-safe broadcast guides"
            >
              <Grid className="w-3.5 h-3.5" /> Safe Guides
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Editor Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left: 16:9 Canvas Stage */}
          <div className="lg:col-span-7 bg-[#070a11] p-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-[#26334a]">
            <div
              className="relative w-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center p-8"
              style={{
                aspectRatio: '16 / 9',
                backgroundColor:
                  backgroundType === 'color'
                    ? backgroundColor || '#0f172a'
                    : '#000000'
              }}
            >
              {effectiveBgUrl &&
                (effectiveIsVideo ? (
                  <video
                    src={effectiveBgUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={effectiveBgUrl}
                    alt="Canvas BG"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ))}

              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(0,0,0,${activeTheme.scrimOpacity})` }}
              />

              {/* Broadcast Safe Area Guide */}
              {showSafeGuides && (
                <div className="absolute inset-4 border border-dashed border-emerald-400/35 rounded-lg pointer-events-none z-10">
                  <span className="absolute -top-2.5 left-2 px-1 bg-black/70 text-[8px] font-mono text-emerald-300/80 uppercase">
                    Title Safe (16:9)
                  </span>
                </div>
              )}

              {/* Live Slide Content */}
              <div
                className="relative z-20 max-w-xl w-full flex flex-col"
                style={{
                  textAlign: activeTheme.align || 'center',
                  alignItems:
                    activeTheme.align === 'left'
                      ? 'flex-start'
                      : activeTheme.align === 'right'
                      ? 'flex-end'
                      : 'center'
                }}
              >
                {title && (
                  <div
                    className="text-[11px] font-black uppercase tracking-widest mb-3 px-3 py-1 rounded-full border inline-block"
                    style={{
                      color: activeTheme.accentColor || '#a5b4fc',
                      borderColor: `${activeTheme.accentColor || '#6366f1'}66`,
                      backgroundColor: 'rgba(15, 23, 42, 0.78)'
                    }}
                  >
                    {title}
                  </div>
                )}

                <div
                  className="font-extrabold text-xl sm:text-2xl leading-snug whitespace-pre-line drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
                  style={{
                    fontFamily: activeTheme.fontFamily,
                    color: activeTheme.textColor || '#ffffff'
                  }}
                >
                  {content || 'Slide text preview...'}
                </div>

                {subtitle && (
                  <div
                    className="text-xs font-bold mt-3 uppercase tracking-wider"
                    style={{ color: activeTheme.accentColor || '#6ee7b7' }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full flex items-center justify-between text-[10px] text-slate-500 mt-2.5 px-1">
              <span>Theme: {activeTheme.name} ({activeTheme.fontFamily})</span>
              <span>Section: {sectionLabel}</span>
            </div>
          </div>

          {/* Right: Structured Inspector */}
          <div className="lg:col-span-5 bg-[#0f1624] p-4 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Section Tag
                </label>
                <select
                  disabled={isScriptureSlide}
                  value={sectionLabel}
                  onChange={e => setSectionLabel(e.target.value as SectionTag)}
                  className="w-full bg-[#0b101b] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-white font-semibold outline-none disabled:opacity-50"
                >
                  {SECTION_TAGS.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Badge Title
                </label>
                <input
                  type="text"
                  placeholder="Optional badge..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#0b101b] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Main Body Text / Lyrics
              </label>
              {isScriptureSlide ? (
                <div className="p-2.5 bg-[#0b101b] border border-amber-500/30 rounded-lg text-amber-300 text-[11px] font-semibold flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Scripture text is locked for Bible slides to preserve accuracy.</span>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full h-24 bg-[#0b101b] border border-slate-700 focus:border-emerald-500 rounded-lg p-2.5 text-white outline-none resize-none leading-relaxed"
                  placeholder="Enter slide lyrics or message..."
                />
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Subtitle / Reference / Credit
              </label>
              <input
                type="text"
                placeholder="Optional subtitle..."
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                className="w-full bg-[#0b101b] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-white outline-none"
              />
            </div>

            {/* Visual Background Picker */}
            <div className="bg-[#121929] border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> Slide Background
                </label>
                <label className="flex items-center gap-1.5 bg-[#0b101b] border border-slate-700 rounded-md px-2 py-0.5 cursor-pointer text-[10px] text-slate-300">
                  <Palette className="w-3 h-3 text-purple-400" />
                  <span>Solid</span>
                  <input
                    type="color"
                    value={backgroundColor || '#0f172a'}
                    onChange={e => {
                      setBackgroundColor(e.target.value);
                      setBackgroundType('color');
                      setBackgroundUrl('');
                    }}
                    className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-1.5 max-h-28 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => handleSelectMediaAsset(null)}
                  className={`h-12 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition ${
                    !backgroundUrl && backgroundType !== 'color'
                      ? 'border-emerald-400 bg-emerald-950/30 text-emerald-200'
                      : 'border-slate-800 bg-[#0b101b] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" /> Theme Default
                </button>

                {media.map(m => {
                  const isSel = backgroundType !== 'color' && backgroundUrl === m.url;
                  const isVid = m.type === 'video';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMediaAsset(m)}
                      className={`relative h-12 rounded-lg overflow-hidden border transition ${
                        isSel
                          ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                          : 'border-slate-800 opacity-75 hover:opacity-100'
                      }`}
                      title={m.name}
                    >
                      {isVid ? (
                        <video src={m.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 flex items-center gap-0.5">
                        {isVid && <Film className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                        <span className="text-[8px] font-bold text-white truncate">{m.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                placeholder="Or paste custom image/video URL..."
                value={backgroundUrl}
                onChange={e => {
                  const val = e.target.value;
                  setBackgroundUrl(val);
                  setBackgroundType(val.trim() ? (isVideoAssetUrl(val) ? 'video' : 'image') : undefined);
                }}
                className="w-full bg-[#0b101b] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-slate-300 text-[11px] outline-none"
              />

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={applyBgToItem}
                  onChange={e => setApplyBgToItem(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Apply this background to all slides in current item</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131b2c] border-t border-[#26334a] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-slate-400 hover:text-white font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Save Slide
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-wider rounded-xl shadow flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Save &amp; Go Live
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
