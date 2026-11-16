import React, { useState, useEffect } from 'react';
import { Song, MediaAsset, PlaylistItem } from '../types/presentation';
import { StorageService } from '../services/storage';
import { Search } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Input } from './ui/input';
import { EmptyState, Kbd, ListHeader } from './ui/primitives';

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

  const matchedPlaylist = playlist.filter(p =>
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    p.slides.some(s => s.content.toLowerCase().includes(query.toLowerCase()))
  );

  // Search Bible Verses (Reference match + keyword text search)
  const matchedBibleVerses = query.trim() ? StorageService.searchBibleVerses(query) : [];

  const totalResults =
    matchedSongs.length + matchedBibleVerses.length + matchedMedia.length + matchedPlaylist.length;

  const handleAddVerse = (verse: {
    formattedRef: string;
    text: string;
    translation: string;
  }) => {
    const slides = [
      {
        id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
        title: verse.formattedRef,
        content: verse.text,
        subtitle: verse.translation,
        sectionLabel: 'Scripture'
      }
    ];
    onAddBible(verse.formattedRef, slides);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(88vh,32rem)] max-w-2xl">
        <DialogHeader className="gap-2">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Songs, scripture, media and the running service.</DialogDescription>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search, or type a reference such as John 3:16"
              autoFocus
              aria-label="Search songs, scripture, media and the service"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {query.trim() !== '' && totalResults === 0 && (
            <EmptyState
              title={`No matches for “${query.trim()}”`}
              description="Try a reference such as John 3:16, a song title, or a media name."
            />
          )}

          {query.trim() === '' && matchedSongs.length === 0 && matchedMedia.length === 0 && (
            <EmptyState
              title="Nothing to search yet"
              description="Add songs or media to the library, then search from here."
            />
          )}

          <div className="space-y-4">
            {matchedSongs.length > 0 && (
              <section>
                <ListHeader className="px-2 pb-1">Songs</ListHeader>
                {matchedSongs.map(song => (
                  <ResultRow
                    key={song.id}
                    title={song.title}
                    meta={`${song.artist || 'Traditional'} · ${song.sections.length} ${
                      song.sections.length === 1 ? 'section' : 'sections'
                    }`}
                    action="Add"
                    onClick={() => {
                      onAddSong(song);
                      onClose();
                    }}
                  />
                ))}
              </section>
            )}

            {matchedBibleVerses.length > 0 && (
              <section>
                <ListHeader className="px-2 pb-1">Scripture</ListHeader>
                {matchedBibleVerses.slice(0, 8).map((verse, idx) => (
                  <ResultRow
                    key={`${verse.formattedRef}-${idx}`}
                    title={verse.formattedRef}
                    meta={`${verse.translation} · ${verse.text}`}
                    action="Add"
                    onClick={() => handleAddVerse(verse)}
                  />
                ))}
              </section>
            )}

            {matchedMedia.length > 0 && (
              <section>
                <ListHeader className="px-2 pb-1">Media</ListHeader>
                {matchedMedia.map(item => (
                  <ResultRow
                    key={item.id}
                    title={item.name}
                    meta={`${item.category} · ${item.type === 'video' ? 'Video' : 'Image'}`}
                    action="Add"
                    onClick={() => {
                      onAddMedia(item);
                      onClose();
                    }}
                  />
                ))}
              </section>
            )}

            {query.trim() !== '' && matchedPlaylist.length > 0 && (
              <section>
                <ListHeader className="px-2 pb-1">Service</ListHeader>
                {matchedPlaylist.map(item => (
                  <ResultRow
                    key={item.id}
                    title={item.title}
                    meta={`${item.category || item.type} · ${item.slides.length} ${
                      item.slides.length === 1 ? 'slide' : 'slides'
                    }`}
                    action={item.slides.length > 0 ? 'Go live' : undefined}
                    onClick={
                      item.slides.length > 0
                        ? () => {
                            onGoLiveSlide(item.slides[0]);
                            onClose();
                          }
                        : undefined
                    }
                  />
                ))}
              </section>
            )}
          </div>
        </div>

        <DialogFooter className="justify-between">
          <span className="text-2xs text-muted-foreground">
            {query.trim() === ''
              ? 'Type to search the library and the service.'
              : `${totalResults} ${totalResults === 1 ? 'result' : 'results'}`}
          </span>
          <span className="flex items-center gap-3 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd> Close
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd> Toggle
            </span>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * One flat result row: title, a single muted meta line and a quiet text action.
 * The whole row is the target so a result can be added from anywhere in it.
 */
function ResultRow({
  title,
  meta,
  action,
  onClick
}: {
  title: string;
  meta: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
        onClick ? 'hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none' : 'cursor-default'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{title}</span>
        <span className="block truncate text-2xs text-muted-foreground">{meta}</span>
      </span>
      {action ? (
        <span className="shrink-0 text-2xs text-muted-foreground transition-colors group-hover:text-foreground">
          {action}
        </span>
      ) : null}
    </button>
  );
}
