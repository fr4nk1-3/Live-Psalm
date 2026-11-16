import React, { useState, useMemo } from 'react';
import { PlaylistItem, Slide, MediaAsset } from '../types/presentation';
import {
  BookOpen,
  Plus,
  Trash2,
  X,
  Check,
  Play,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Film,
  Ban,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface SermonModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  media?: MediaAsset[];
  onAddSermonToPlaylist: (item: PlaylistItem, goLive?: boolean) => void;
}

const SAMPLE_POINTS = [
  'Point 1: Faith That Moves Mountains (Matthew 17:20)',
  'Point 2: Walking by Faith, Not by Sight (2 Corinthians 5:7)',
  'Point 3: The Victory That Overcomes the World (1 John 5:4)'
];

export const SermonModeModal: React.FC<SermonModeModalProps> = ({
  isOpen,
  onClose,
  media = [],
  onAddSermonToPlaylist
}) => {
  const [title, setTitle] = useState('');
  const [seriesSubtitle, setSeriesSubtitle] = useState('Sunday Word');
  const [speaker, setSpeaker] = useState('');
  const [speakerNotes, setSpeakerNotes] = useState('');
  const [points, setPoints] = useState<string[]>([...SAMPLE_POINTS]);
  const [newPoint, setNewPoint] = useState('');
  const [includeTitleSlide, setIncludeTitleSlide] = useState(true);
  const [includeClosingSlide, setIncludeClosingSlide] = useState(true);
  const [closingText, setClosingText] = useState(
    'PRAYER & ALTAR CALL\n"Come boldly to the throne of grace."'
  );
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);

  const selectedMedia = useMemo(
    () => (selectedMediaId ? media.find(m => m.id === selectedMediaId) || null : null),
    [media, selectedMediaId]
  );

  const builtSlides = useMemo<Slide[]>(() => {
    const slides: Slide[] = [];
    const safeTitle = title.trim() || 'Sunday Sermon';
    const safeSpeaker = speaker.trim();
    const bgProps = selectedMedia
      ? {
          backgroundUrl: selectedMedia.url,
          backgroundType: (selectedMedia.type === 'video' ? 'video' : 'image') as 'video' | 'image'
        }
      : {};

    if (includeTitleSlide) {
      slides.push({
        id: `slide-sermon-title-${Date.now()}`,
        title: safeTitle.toUpperCase(),
        content: seriesSubtitle.trim()
          ? `${safeTitle.toUpperCase()}\n"${seriesSubtitle.trim()}"`
          : safeTitle.toUpperCase(),
        subtitle: safeSpeaker || undefined,
        sectionLabel: 'Title',
        ...bgProps
      });
    }

    points
      .map(p => p.trim())
      .filter(Boolean)
      .forEach((pt, idx) => {
        slides.push({
          id: `slide-sermon-pt-${idx}-${Date.now()}`,
          title: `POINT ${idx + 1}`,
          content: pt,
          subtitle: safeSpeaker ? `${safeTitle} • ${safeSpeaker}` : safeTitle,
          sectionLabel: 'Slide',
          ...bgProps
        });
      });

    if (includeClosingSlide && closingText.trim()) {
      slides.push({
        id: `slide-sermon-closing-${Date.now()}`,
        title: 'CLOSING & PRAYER',
        content: closingText.trim(),
        subtitle: safeTitle,
        sectionLabel: 'Outro',
        ...bgProps
      });
    }

    return slides;
  }, [
    title,
    seriesSubtitle,
    speaker,
    points,
    includeTitleSlide,
    includeClosingSlide,
    closingText,
    selectedMedia
  ]);

  if (!isOpen) return null;

  const handleAddPoint = () => {
    if (!newPoint.trim()) return;
    setPoints(prev => [...prev, newPoint.trim()]);
    setNewPoint('');
  };

  const handleUpdatePoint = (idx: number, val: string) => {
    setPoints(prev => prev.map((p, i) => (i === idx ? val : p)));
  };

  const handleMovePoint = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= points.length) return;
    setPoints(prev => {
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleRemovePoint = (idx: number) => {
    setPoints(prev => prev.filter((_, i) => i !== idx));
  };

  const handleResetSample = () => {
    setTitle('Unstoppable Faith');
    setSeriesSubtitle('Faith Series');
    setSpeaker('Senior Pastor');
    setPoints([...SAMPLE_POINTS]);
    setIncludeTitleSlide(true);
    setIncludeClosingSlide(true);
  };

  const handleBuildSermon = (goLive: boolean) => {
    if (builtSlides.length === 0) return;
    const safeTitle = title.trim() || 'Sunday Sermon';
    const playlistItem: PlaylistItem = {
      id: `item-sermon-${Math.random().toString(36).substring(2, 9)}`,
      title: `Sermon: ${safeTitle}`,
      type: 'sermon',
      category: 'Sermon',
      slides: builtSlides,
      speakerNotes: speakerNotes.trim() || undefined,
      videoBackgroundUrl: selectedMedia?.type === 'video' ? selectedMedia.url : undefined
    };

    onAddSermonToPlaylist(playlistItem, goLive);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-[#0f1624] border border-purple-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs animate-zoom-in">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/40 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white uppercase tracking-wider">
                Sermon Presentation Builder
              </h2>
              <p className="text-[11px] text-slate-400">
                Build sermon title, editable points, background, and speaker notes with live preview.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSample}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
              title="Fill with sample sermon outline"
            >
              <RotateCcw className="w-3 h-3" /> Load Sample
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

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Column: Builder Controls */}
          <div className="md:col-span-7 p-4 space-y-3.5 overflow-y-auto border-b md:border-b-0 md:border-r border-[#26334a]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Sermon Title
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Unstoppable Faith"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Series / Tagline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sunday Word"
                  value={seriesSubtitle}
                  onChange={e => setSeriesSubtitle(e.target.value)}
                  className="w-full bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Speaker Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pastor John"
                  value={speaker}
                  onChange={e => setSpeaker(e.target.value)}
                  className="w-full bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Editable & Reorderable Sermon Points */}
            <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Main Sermon Points ({points.length})
                </label>
                {points.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPoints([])}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Clear Points
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {points.map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-[#0d1320] border border-slate-700 p-1.5 rounded-lg"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px] shrink-0">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={pt}
                      onChange={e => handleUpdatePoint(idx, e.target.value)}
                      className="flex-1 bg-transparent text-slate-100 font-medium text-xs outline-none px-1"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePoint(idx, -1)}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                      title="Move point up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === points.length - 1}
                      onClick={() => handleMovePoint(idx, 1)}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                      title="Move point down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePoint(idx)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Remove point"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Type a sermon point or scripture & press Enter..."
                  value={newPoint}
                  onChange={e => setNewPoint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPoint();
                    }
                  }}
                  className="flex-1 bg-[#0d1320] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Optional Title & Closing Slides */}
            <div className="bg-[#141d2e] border border-slate-800 p-3 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTitleSlide}
                    onChange={e => setIncludeTitleSlide(e.target.checked)}
                    className="accent-purple-500"
                  />
                  Include Title Slide
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeClosingSlide}
                    onChange={e => setIncludeClosingSlide(e.target.checked)}
                    className="accent-purple-500"
                  />
                  Include Closing / Prayer Slide
                </label>
              </div>

              {includeClosingSlide && (
                <textarea
                  rows={2}
                  value={closingText}
                  onChange={e => setClosingText(e.target.value)}
                  placeholder="Closing slide text..."
                  className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-purple-500 resize-none"
                />
              )}
            </div>

            {/* Background Selector (if media available) */}
            {media.length > 0 && (
              <div className="bg-[#141d2e] border border-slate-800 p-3 rounded-xl space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> Slide Background (Optional)
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMediaId(null)}
                    className={`shrink-0 w-20 h-12 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${
                      selectedMediaId === null
                        ? 'border-purple-400 bg-purple-950/40 text-purple-200'
                        : 'border-slate-800 bg-[#0d1320] text-slate-400'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Theme
                  </button>
                  {media.map(m => {
                    const isSel = selectedMediaId === m.id;
                    const isVid = m.type === 'video';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMediaId(m.id)}
                        className={`relative shrink-0 w-20 h-12 rounded-lg overflow-hidden border-2 transition ${
                          isSel
                            ? 'border-purple-400 ring-2 ring-purple-500/40'
                            : 'border-slate-800 opacity-75 hover:opacity-100'
                        }`}
                      >
                        {isVid ? (
                          <video src={m.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                        ) : (
                          <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 flex items-center gap-0.5">
                          {isVid && <Film className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                          <span className="text-[8px] font-bold text-white truncate">{m.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Speaker Notes */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Speaker Notes (Stage Display)
              </label>
              <textarea
                value={speakerNotes}
                onChange={e => setSpeakerNotes(e.target.value)}
                placeholder="Notes visible to the preacher on the Stage Monitor..."
                className="w-full h-14 bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-purple-500 resize-none"
              />
            </div>
          </div>

          {/* Right Column: Live Sermon Deck Preview */}
          <div className="md:col-span-5 bg-[#0b101b] p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Sermon Deck Preview
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-purple-300">
                {builtSlides.length} {builtSlides.length === 1 ? 'slide' : 'slides'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {builtSlides.length === 0 ? (
                <div className="h-full min-h-[200px] flex items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl text-slate-500">
                  Add at least one point or enable Title/Closing slide to build your deck.
                </div>
              ) : (
                builtSlides.map((slide, idx) => (
                  <div
                    key={`${slide.id}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#131b2c] border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[9px] font-bold uppercase text-purple-300">
                        {slide.title || slide.sectionLabel}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                    </div>
                    <div className="text-xs text-slate-100 whitespace-pre-line leading-relaxed">
                      {slide.content}
                    </div>
                    {slide.subtitle && (
                      <div className="text-[10px] text-slate-400 truncate">{slide.subtitle}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131b2c] border-t border-[#26334a] flex flex-wrap items-center justify-between gap-2">
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
              disabled={builtSlides.length === 0}
              onClick={() => handleBuildSermon(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Add to Playlist ({builtSlides.length})
            </button>

            <button
              type="button"
              disabled={builtSlides.length === 0}
              onClick={() => handleBuildSermon(true)}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black uppercase tracking-wider rounded-xl shadow-xl flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Add & Go Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
