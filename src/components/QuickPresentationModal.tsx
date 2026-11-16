import React, { useState, useEffect, useMemo } from 'react';
import { Song, MediaAsset, Slide } from '../types/presentation';
import { ImporterService } from '../services/importer';
import {
  Zap,
  Play,
  X,
  Music,
  Image as ImageIcon,
  Film,
  Search,
  Type,
  Layers,
  Ban
} from 'lucide-react';

interface QuickPresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  media: MediaAsset[];
  onPresentNow: (title: string, slides: Slide[], goLive?: boolean) => void;
}

export const QuickPresentationModal: React.FC<QuickPresentationModalProps> = ({
  isOpen,
  onClose,
  songs,
  media,
  onPresentNow
}) => {
  const [mode, setMode] = useState<'song' | 'instant'>('song');
  const [songQuery, setSongQuery] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string>(songs[0]?.id || '');
  const [startSlideIndex, setStartSlideIndex] = useState<number>(0);

  // Instant Slide state
  const [instantTitle, setInstantTitle] = useState('');
  const [instantContent, setInstantContent] = useState('');

  // Background state (null = theme/none)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(media[0]?.id || null);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedSongId && songs[0]?.id) {
      setSelectedSongId(songs[0].id);
    }
    setStartSlideIndex(0);
  }, [isOpen, songs]);

  const filteredSongs = useMemo(() => {
    const q = songQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q)
    );
  }, [songs, songQuery]);

  const selectedSong = useMemo(
    () => songs.find(s => s.id === selectedSongId) || filteredSongs[0] || null,
    [songs, selectedSongId, filteredSongs]
  );

  const selectedMedia = useMemo(
    () => (selectedMediaId ? media.find(m => m.id === selectedMediaId) || null : null),
    [media, selectedMediaId]
  );

  const previewSlides = useMemo<Slide[]>(() => {
    const bgProps = selectedMedia
      ? {
          backgroundUrl: selectedMedia.url,
          backgroundType: (selectedMedia.type === 'video' ? 'video' : 'image') as 'video' | 'image'
        }
      : {};

    if (mode === 'instant') {
      return [
        {
          id: `slide-quick-instant-${Date.now()}`,
          title: instantTitle.trim() || 'Quick Projection',
          content: instantContent.trim() || 'Type your message or scripture here...',
          sectionLabel: 'Slide',
          ...bgProps
        }
      ];
    }

    if (!selectedSong) return [];
    return ImporterService.songToSlides(selectedSong, selectedMedia?.url).map(s => ({
      ...s,
      ...bgProps
    }));
  }, [mode, selectedSong, selectedMedia, instantTitle, instantContent]);

  if (!isOpen) return null;

  const canLaunch =
    mode === 'song'
      ? Boolean(selectedSong && previewSlides.length > 0)
      : instantContent.trim().length > 0;

  const handleLaunch = (goLive: boolean) => {
    if (!canLaunch) return;
    const title =
      mode === 'song'
        ? selectedSong!.title
        : instantTitle.trim() || 'Quick Projection';

    const orderedSlides =
      mode === 'song' && startSlideIndex > 0 && startSlideIndex < previewSlides.length
        ? [
            previewSlides[startSlideIndex],
            ...previewSlides.slice(0, startSlideIndex),
            ...previewSlides.slice(startSlideIndex + 1)
          ]
        : previewSlides;

    onPresentNow(title, orderedSlides, goLive);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-[#0f1624] border border-indigo-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs animate-zoom-in">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400 fill-current" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white uppercase tracking-wider">
                Quick Presentation Mode
              </h2>
              <p className="text-[11px] text-slate-400">
                Launch a worship song or spontaneous message onto the screen in seconds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('song')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
              mode === 'song'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                : 'bg-[#141d2e] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Worship Song
          </button>
          <button
            type="button"
            onClick={() => setMode('instant')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
              mode === 'instant'
                ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                : 'bg-[#141d2e] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Instant Slide / Notice
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Song/Text + Background */}
          <div className="md:col-span-7 space-y-4">
            {mode === 'song' ? (
              <div className="bg-[#141d2e] border border-slate-800 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Music className="w-3.5 h-3.5 text-emerald-400" /> 1. Choose Song
                  </label>
                  <span className="text-[10px] text-slate-500">{filteredSongs.length} songs</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search song title or artist..."
                    value={songQuery}
                    onChange={e => setSongQuery(e.target.value)}
                    className="w-full bg-[#0d1320] border border-slate-700 focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-white outline-none"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {filteredSongs.map(s => {
                    const isSel = selectedSong?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedSongId(s.id);
                          setStartSlideIndex(0);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition ${
                          isSel
                            ? 'bg-indigo-600/25 border-indigo-400 text-white'
                            : 'bg-[#0d1320] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold truncate">{s.title}</span>
                        <span className="text-[10px] text-slate-400 truncate ml-2 shrink-0">
                          {s.artist || 'Traditional'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[#141d2e] border border-slate-800 p-3 rounded-xl space-y-2.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Type className="w-3.5 h-3.5 text-amber-400" /> 1. Instant Slide Content
                </label>
                <input
                  type="text"
                  placeholder="Optional Heading (e.g. WELCOME TO CHURCH)"
                  value={instantTitle}
                  onChange={e => setInstantTitle(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-white font-semibold outline-none"
                />
                <textarea
                  rows={4}
                  placeholder="Type spontaneous lyrics, announcement, or scripture text..."
                  value={instantContent}
                  onChange={e => setInstantContent(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 focus:border-indigo-500 rounded-lg p-2.5 text-white outline-none resize-none leading-relaxed"
                />
              </div>
            )}

            {/* Step 2: Background Picker */}
            <div className="bg-[#141d2e] border border-slate-800 p-3 rounded-xl space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> 2. Background (Image / Video)
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedMediaId(null)}
                  className={`rounded-lg border-2 h-16 flex flex-col items-center justify-center gap-1 transition ${
                    selectedMediaId === null
                      ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                      : 'border-slate-800 bg-[#0d1320] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span className="text-[10px] font-bold">None / Theme</span>
                </button>

                {media.map(m => {
                  const isSel = selectedMediaId === m.id;
                  const isVid = m.type === 'video';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMediaId(m.id)}
                      className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition h-16 text-left ${
                        isSel
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                          : 'border-slate-800 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {isVid ? (
                        <video
                          src={m.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 py-1 flex items-center gap-1">
                        {isVid && <Film className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                        <span className="text-[9px] font-bold text-white truncate">
                          {m.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Starting Slide & Live Preview */}
          <div className="md:col-span-5 bg-[#0b101b] border border-slate-800 rounded-xl p-3 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {mode === 'song' ? 'Click Slide to Start From' : 'Live Slide Preview'}
              </span>
              <span className="text-[10px] text-indigo-300 font-bold">
                {previewSlides.length} {previewSlides.length === 1 ? 'slide' : 'slides'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-64 pr-1">
              {previewSlides.map((slide, idx) => {
                const isStart = idx === startSlideIndex;
                return (
                  <button
                    key={`${slide.id}-${idx}`}
                    type="button"
                    onClick={() => setStartSlideIndex(idx)}
                    className={`w-full text-left p-2 rounded-lg border transition ${
                      isStart
                        ? 'bg-indigo-600/20 border-indigo-400 text-white'
                        : 'bg-[#131b2c] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300">
                        {slide.sectionLabel || `Slide ${idx + 1}`}
                      </span>
                      {isStart && mode === 'song' && (
                        <span className="text-[9px] font-black text-amber-300 uppercase">
                          Start Here
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] whitespace-pre-line line-clamp-3 leading-snug">
                      {slide.content}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
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
              disabled={!canLaunch}
              onClick={() => handleLaunch(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Add to Playlist
            </button>
            <button
              type="button"
              disabled={!canLaunch}
              onClick={() => handleLaunch(true)}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 disabled:opacity-40 text-white font-black uppercase tracking-wider rounded-xl shadow-xl flex items-center gap-2 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PRESENT NOW (GO LIVE!)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
