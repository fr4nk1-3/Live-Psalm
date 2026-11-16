import React, { useState, useMemo } from 'react';
import { PlaylistItem, Slide, MediaAsset } from '../types/presentation';
import { MoreHorizontal } from 'lucide-react';
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
import { Label } from './ui/label';
import { Field, FieldGroup } from './ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { EmptyState, ListHeader } from './ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

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
    <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(88vh,44rem)] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sermon deck</DialogTitle>
          <DialogDescription>
            Build the title, points, background and notes, then check the deck.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Builder controls */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-b border-border p-5 md:w-7/12 md:min-w-0 md:border-b-0 md:border-r">
            <FieldGroup title="Sermon">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Title" htmlFor="sermon-title">
                  <Input
                    id="sermon-title"
                    type="text"
                    autoFocus
                    placeholder="Unstoppable Faith"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="Series" htmlFor="sermon-series">
                  <Input
                    id="sermon-series"
                    type="text"
                    placeholder="Sunday Word"
                    value={seriesSubtitle}
                    onChange={e => setSeriesSubtitle(e.target.value)}
                  />
                </Field>
                <Field label="Speaker" htmlFor="sermon-speaker">
                  <Input
                    id="sermon-speaker"
                    type="text"
                    placeholder="Pastor John"
                    value={speaker}
                    onChange={e => setSpeaker(e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>

            <Separator />

            <FieldGroup title="Points" description="Each point becomes one slide.">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted-foreground">
                  {points.length} {points.length === 1 ? 'point' : 'points'}
                </span>
                {points.length > 0 && (
                  <Button variant="ghost" size="xs" onClick={() => setPoints([])}>
                    Clear points
                  </Button>
                )}
              </div>

              {points.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-md border border-border">
                  {points.map((pt, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center gap-1 border-t border-border/70 px-1.5 first:border-t-0"
                    >
                      <span className="tabular w-4 shrink-0 text-2xs text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Input
                        type="text"
                        value={pt}
                        onChange={e => handleUpdatePoint(idx, e.target.value)}
                        aria-label={`Point ${idx + 1}`}
                        className="h-8 flex-1 border-transparent bg-transparent px-1.5 text-xs hover:border-input"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Point ${idx + 1} options`}
                            title="Point options"
                            className="shrink-0 opacity-0 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={idx === 0}
                            onSelect={() => handleMovePoint(idx, -1)}
                          >
                            Move up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={idx === points.length - 1}
                            onSelect={() => handleMovePoint(idx, 1)}
                          >
                            Move down
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => handleRemovePoint(idx)}
                            className="text-destructive focus:text-destructive"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Type a point or reference"
                  value={newPoint}
                  onChange={e => setNewPoint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPoint();
                    }
                  }}
                  aria-label="New point"
                />
                <Button variant="secondary" size="sm" onClick={handleAddPoint} className="shrink-0">
                  Add
                </Button>
              </div>
            </FieldGroup>

            <Separator />

            <FieldGroup title="Slides">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label>Title slide</Label>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    Opens the deck with the sermon title.
                  </p>
                </div>
                <Switch
                  checked={includeTitleSlide}
                  onCheckedChange={setIncludeTitleSlide}
                  aria-label="Include title slide"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label>Closing slide</Label>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    Ends the deck with a prayer or altar call.
                  </p>
                </div>
                <Switch
                  checked={includeClosingSlide}
                  onCheckedChange={setIncludeClosingSlide}
                  aria-label="Include closing slide"
                />
              </div>

              {includeClosingSlide && (
                <Field label="Closing text" htmlFor="sermon-closing">
                  <Textarea
                    id="sermon-closing"
                    value={closingText}
                    onChange={e => setClosingText(e.target.value)}
                    rows={2}
                    placeholder="Closing slide text"
                    className="h-16"
                  />
                </Field>
              )}
            </FieldGroup>

            {media.length > 0 && (
              <>
                <Separator />
                <FieldGroup title="Background">
                  <Field label="Image or video" hint="Applies to every slide in the deck.">
                    <Select
                      value={selectedMediaId ?? '__none__'}
                      onValueChange={value =>
                        setSelectedMediaId(value === '__none__' ? null : value)
                      }
                    >
                      <SelectTrigger aria-label="Deck background">
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
              </>
            )}

            <Separator />

            <FieldGroup title="Speaker notes" description="Shown on the stage display only.">
              <Textarea
                value={speakerNotes}
                onChange={e => setSpeakerNotes(e.target.value)}
                placeholder="Notes for the preacher"
                aria-label="Speaker notes"
                className="h-20"
              />
            </FieldGroup>
          </div>

          {/* Deck preview */}
          <div className="flex min-h-0 flex-col md:w-5/12 md:min-w-0">
            <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <ListHeader className="px-0">Deck</ListHeader>
              <span className="tabular text-2xs text-muted-foreground">
                {builtSlides.length} {builtSlides.length === 1 ? 'slide' : 'slides'}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {builtSlides.length === 0 ? (
                <EmptyState
                  title="No slides yet"
                  description="Add a point, or enable the title or closing slide to build the deck."
                />
              ) : (
                builtSlides.map((slide, idx) => (
                  <div
                    key={`${slide.id}-${idx}`}
                    className="space-y-1 border-t border-border/70 px-4 py-2 first:border-t-0"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-2xs text-muted-foreground">
                        {slide.title || slide.sectionLabel}
                      </span>
                      <span className="tabular shrink-0 text-2xs text-muted-foreground">
                        {idx + 1}
                      </span>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-foreground">
                      {slide.content}
                    </p>
                    {slide.subtitle && (
                      <p className="truncate text-2xs text-muted-foreground">{slide.subtitle}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button variant="ghost" size="sm" onClick={handleResetSample}>
            Load sample
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={builtSlides.length === 0}
              onClick={() => handleBuildSermon(false)}
            >
              Add to playlist ({builtSlides.length})
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={builtSlides.length === 0}
              onClick={() => handleBuildSermon(true)}
            >
              Add and go live
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
