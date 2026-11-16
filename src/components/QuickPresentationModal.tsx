import React, { useState, useEffect, useMemo } from 'react';
import { Song, MediaAsset, Slide } from '../types/presentation';
import { ImporterService } from '../services/importer';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, FieldGroup } from './ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { EmptyState, ListHeader } from './ui/primitives';

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
    <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(88vh,40rem)] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quick presentation</DialogTitle>
          <DialogDescription>Send a song or a single slide to the screen.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Song / text and background */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-b border-border p-5 md:w-7/12 md:min-w-0 md:border-b-0 md:border-r">
            <Tabs value={mode} onValueChange={value => setMode(value as 'song' | 'instant')}>
              <TabsList className="w-full">
                <TabsTrigger value="song">Song</TabsTrigger>
                <TabsTrigger value="instant">Instant slide</TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === 'song' ? (
              <FieldGroup title="Song">
                <Input
                  type="text"
                  value={songQuery}
                  onChange={e => setSongQuery(e.target.value)}
                  placeholder="Search titles and artists"
                  aria-label="Search songs"
                />
                <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                  {filteredSongs.length === 0 ? (
                    <p className="px-2.5 py-2 text-2xs text-muted-foreground">
                      No songs match that search.
                    </p>
                  ) : (
                    filteredSongs.map(song => {
                      const isSelected = selectedSong?.id === song.id;
                      return (
                        <button
                          key={song.id}
                          type="button"
                          onClick={() => {
                            setSelectedSongId(song.id);
                            setStartSlideIndex(0);
                          }}
                          aria-pressed={isSelected}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 border-t border-border/70 px-2.5 py-1.5 text-left transition-colors first:border-t-0',
                            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {song.title}
                          </span>
                          <span className="shrink-0 text-2xs text-muted-foreground">
                            {song.artist || 'Traditional'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-2xs text-muted-foreground">
                  {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
                </p>
              </FieldGroup>
            ) : (
              <FieldGroup title="Text">
                <Field label="Heading" htmlFor="quick-instant-title">
                  <Input
                    id="quick-instant-title"
                    type="text"
                    value={instantTitle}
                    onChange={e => setInstantTitle(e.target.value)}
                    placeholder="Optional heading"
                  />
                </Field>
                <Field label="Body" htmlFor="quick-instant-content">
                  <Textarea
                    id="quick-instant-content"
                    value={instantContent}
                    onChange={e => setInstantContent(e.target.value)}
                    rows={4}
                    placeholder="Lyrics, an announcement, or scripture text"
                    className="h-24"
                  />
                </Field>
              </FieldGroup>
            )}

            <FieldGroup title="Background">
              <Field
                label="Image or video"
                hint="Applies to every slide in this presentation."
              >
                <Select
                  value={selectedMediaId ?? '__none__'}
                  onValueChange={value => setSelectedMediaId(value === '__none__' ? null : value)}
                >
                  <SelectTrigger aria-label="Presentation background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Theme default</SelectItem>
                    {media.map(asset => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>

          {/* Slide preview */}
          <div className="flex min-h-0 flex-col md:w-5/12 md:min-w-0">
            <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <ListHeader className="px-0">
                {mode === 'song' ? 'Start from' : 'Preview'}
              </ListHeader>
              <span className="tabular text-2xs text-muted-foreground">
                {previewSlides.length} {previewSlides.length === 1 ? 'slide' : 'slides'}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {previewSlides.length === 0 ? (
                <EmptyState
                  title="No slides"
                  description="Choose a song to see the slides it will send."
                />
              ) : (
                previewSlides.map((slide, idx) => {
                  const isStart = idx === startSlideIndex;
                  return (
                    <button
                      key={`${slide.id}-${idx}`}
                      type="button"
                      onClick={() => setStartSlideIndex(idx)}
                      aria-pressed={isStart}
                      className={cn(
                        'block w-full rounded-md border-t border-border/70 px-2 py-1.5 text-left transition-colors first:border-t-0',
                        isStart ? 'bg-accent' : 'hover:bg-accent/60'
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-2xs text-muted-foreground">
                          {slide.sectionLabel || `Slide ${idx + 1}`}
                        </span>
                        {isStart && mode === 'song' ? (
                          <span className="shrink-0 text-2xs text-muted-foreground">Start here</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs leading-snug text-foreground">
                        {slide.content}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" disabled={!canLaunch} onClick={() => handleLaunch(false)}>
            Add to playlist
          </Button>
          <Button variant="default" size="sm" disabled={!canLaunch} onClick={() => handleLaunch(true)}>
            Present now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
