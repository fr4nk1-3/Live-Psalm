import React, { useState } from 'react';
import { Song, MediaAsset, Slide } from '../types/presentation';
import { ImporterService } from '../services/importer';
import { Zap, Play, X, Music, Image as ImageIcon } from 'lucide-react';

interface QuickPresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  media: MediaAsset[];
  onPresentNow: (title: string, slides: Slide[]) => void;
}

export const QuickPresentationModal: React.FC<QuickPresentationModalProps> = ({
  isOpen,
  onClose,
  songs,
  media,
  onPresentNow
}) => {
  const [selectedSongId, setSelectedSongId] = useState<string>(songs[0]?.id || '');
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string>(media[0]?.url || '');

  if (!isOpen) return null;

  const handleLaunch = () => {
    const song = songs.find(s => s.id === selectedSongId);
    if (!song) return;
    const slides = ImporterService.songToSlides(song, selectedMediaUrl);
    onPresentNow(song.title, slides);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-[#0f1624] border border-indigo-500/60 rounded-2xl shadow-2xl p-6 text-xs space-y-4 animate-zoom-in">
        <div className="flex items-center justify-between border-b border-[#26334a] pb-3">
          <div className="flex items-center gap-2 font-black text-sm text-indigo-300 uppercase tracking-wider">
            <Zap className="w-5 h-5 text-amber-400 fill-current" />
            <span>Quick 2-Click Presentation Mode</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400">
          Designed for fast, spontaneous worship services. Select a song and motion background to broadcast live in 2 clicks.
        </p>

        {/* Step 1: Song Picker */}
        <div className="space-y-1 bg-[#141d2e] border border-slate-800 p-3 rounded-xl">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Music className="w-3.5 h-3.5 text-emerald-400" /> 1. Select Song
          </label>
          <select
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white font-bold text-sm outline-none focus:border-indigo-500"
          >
            {songs.map(s => (
              <option key={s.id} value={s.id}>{s.title} ({s.artist})</option>
            ))}
          </select>
        </div>

        {/* Step 2: Background Picker */}
        <div className="space-y-1 bg-[#141d2e] border border-slate-800 p-3 rounded-xl">
          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> 2. Select Motion Background
          </label>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {media.slice(0, 6).map(m => (
              <div
                key={m.id}
                onClick={() => setSelectedMediaUrl(m.url)}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition h-16 ${
                  selectedMediaUrl === m.url
                    ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                    : 'border-slate-800 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white truncate">
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Present Button */}
        <button
          onClick={handleLaunch}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-xl flex items-center justify-center gap-2 transition transform active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>PRESENT NOW (GO LIVE!)</span>
        </button>
      </div>
    </div>
  );
};
