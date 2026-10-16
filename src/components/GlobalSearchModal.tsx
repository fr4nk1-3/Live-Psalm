import React, { useState, useEffect } from 'react';
import { Song, MediaAsset, PlaylistItem } from '../types/presentation';
import { StorageService } from '../services/storage';
import { Search, Music, Book, Film, Play, Plus, X, Zap } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  media: MediaAsset[];
  playlist: PlaylistItem[];
  onAddSong: (song: Song) => void;
  onAddBible: (ref: string, slides: any[]) => void;
  onAddMedia: (media: MediaAsset) => void;
  onGoLiveSlide: (slide: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  songs,
  media,
  playlist,
  onAddSong,
  onAddBible,
  onAddMedia,
  onGoLiveSlide
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchedSongs = songs.filter(s =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(query.toLowerCase()))
  );

  const matchedMedia = media.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.category.toLowerCase().includes(query.toLowerCase())
  );

  // Search Bible Verses (Reference match + keyword text search)
  const matchedBibleVerses = query.trim() ? StorageService.searchBibleVerses(query) : [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-start justify-center pt-20 p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0f1624] border border-[#26334a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-zoom-in">
        {/* Search Header */}
        <div className="p-4 border-b border-[#26334a] flex items-center gap-3 bg-[#131b2c]">
          <Search className="w-5 h-5 text-indigo-400" />
          <input
            type="text"
            placeholder="Search scripture (e.g. John 3:16 or 'love'), songs, or media..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-white text-base outline-none placeholder-slate-500 font-medium"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* SCRIPTURE MATCHES */}
          {matchedBibleVerses.length > 0 && (
            <div>
              <div className="font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Book className="w-4 h-4" /> Scripture Verses ({matchedBibleVerses.length})
              </div>
              <div className="space-y-2">
                {matchedBibleVerses.slice(0, 8).map((v, idx) => (
                  <div key={idx} className="bg-[#162032] border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between gap-3 group hover:border-amber-400 transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
                        <span>{v.formattedRef}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({v.translation})</span>
                      </div>
                      <div className="text-slate-200 italic truncate mt-0.5">
                        "{v.text}"
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const slides = [{
                          id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
                          title: v.formattedRef,
                          content: v.text,
                          subtitle: v.translation,
                          sectionLabel: 'Scripture'
                        }];
                        onAddBible(v.formattedRef, slides);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow flex items-center gap-1 shrink-0 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add to Service
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SONGS MATCHES */}
          {matchedSongs.length > 0 && (
            <div>
              <div className="font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Music className="w-4 h-4" /> Songs ({matchedSongs.length})
              </div>
              <div className="space-y-1.5">
                {matchedSongs.map(song => (
                  <div
                    key={song.id}
                    className="bg-[#141d2e] border border-slate-800 hover:border-emerald-500/50 p-2.5 rounded-xl flex items-center justify-between gap-2 group transition"
                  >
                    <div>
                      <div className="font-bold text-slate-200 text-sm">{song.title}</div>
                      <div className="text-slate-400 text-[10px]">{song.artist} • {song.sections.length} sections</div>
                    </div>
                    <button
                      onClick={() => {
                        onAddSong(song);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-1 shadow transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEDIA MATCHES */}
          {matchedMedia.length > 0 && (
            <div>
              <div className="font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Film className="w-4 h-4" /> Media Assets ({matchedMedia.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {matchedMedia.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onAddMedia(item);
                      onClose();
                    }}
                    className="bg-[#141d2e] border border-slate-800 hover:border-sky-500/60 p-2 rounded-lg cursor-pointer transition text-center group"
                  >
                    <img src={item.url} alt={item.name} className="w-full h-16 object-cover rounded mb-1" />
                    <div className="font-bold text-slate-200 truncate">{item.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {query && matchedSongs.length === 0 && matchedBibleVerses.length === 0 && matchedMedia.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No results found for "{query}". Try searching for "John 3:16" or "Way Maker".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
