import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Song } from '../types/presentation';
import { ImporterService } from '../services/importer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field } from './ui/field';
import { EmptyState } from './ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';

interface SongEditorModalProps {
  isOpen: boolean;
  editingSong: Song | null;
  onClose: () => void;
  onSaveSong: (
    song: Song,
    action: 'library' | 'playlist' | 'golive'
  ) => void;
}

const SECTION_SHORTCUTS = [
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Chorus',
  'Pre-Chorus',
  'Bridge',
  'Tag',
  'Outro'
];

export const SongEditorModal: React.FC<SongEditorModalProps> = ({
  isOpen,
  editingSong,
  onClose,
  onSaveSong
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSong) {
      setTitle(editingSong.title);
      setArtist(editingSong.artist || '');
      setLyrics(
        editingSong.sections
          .map(s => `${s.label}\n${s.lyrics}`)
          .join('\n\n')
      );
    } else {
      setTitle('');
      setArtist('');
      setLyrics('');
    }
  }, [isOpen, editingSong]);

  const previewSong = useMemo(() => {
    const parsed = ImporterService.parseLyricsToSong(
      title.trim() || 'Untitled Song',
      lyrics.trim() || 'Verse 1\nStart typing lyrics on the left...',
      artist.trim() || undefined
    );
    if (editingSong) {
      parsed.id = editingSong.id;
    }
    return parsed;
  }, [title, artist, lyrics, editingSong]);

  const previewSlides = useMemo(() => {
    return ImporterService.songToSlides(previewSong);
  }, [previewSong]);

  if (!isOpen) return null;

  const insertSectionHeader = (header: string) => {
    const el = textareaRef.current;
    if (!el) {
      setLyrics(prev => (prev.trim() ? `${prev.trimEnd()}\n\n${header}\n` : `${header}\n`));
      return;
    }
    const start = el.selectionStart ?? lyrics.length;
    const end = el.selectionEnd ?? lyrics.length;
    const before = lyrics.slice(0, start);
    const after = lyrics.slice(end);
    const prefix = before.trim().length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const insertion = `${prefix}${header}\n`;
    const nextText = `${before}${insertion}${after}`;
    setLyrics(nextText);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = before.length + insertion.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleImportTextFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result || '');
      if (content.trim()) {
        setLyrics(content.replace(/\r\n/g, '\n'));
        if (!title.trim()) {
          const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
          setTitle(baseName);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = (action: 'library' | 'playlist' | 'golive') => {
    if (!title.trim() || !lyrics.trim()) return;
    const finalSong = ImporterService.parseLyricsToSong(
      title.trim(),
      lyrics.trim(),
      artist.trim() || undefined
    );
    if (editingSong) {
      finalSong.id = editingSong.id;
    }
    onSaveSong(finalSong, action);
    onClose();
  };

  const canSave = title.trim().length > 0 && lyrics.trim().length > 0;
  const slideCount = lyrics.trim() ? previewSlides.length : 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{editingSong ? 'Edit song' : 'New song'}</DialogTitle>
          <DialogDescription>
            {editingSong
              ? 'Change the title, author or lyrics. Slides update as you type.'
              : 'Lyrics become slides. A section heading or a blank line starts a new slide.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_320px] md:overflow-hidden">
          <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="song-title">
                <Input
                  id="song-title"
                  type="text"
                  autoFocus
                  placeholder="Way Maker"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Author" htmlFor="song-artist">
                <Input
                  id="song-artist"
                  type="text"
                  placeholder="Sinach"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Section headings" hint="Inserts the heading at the cursor.">
              <div className="flex flex-wrap gap-1.5">
                {SECTION_SHORTCUTS.map(tag => (
                  <Button
                    key={tag}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => insertSectionHeader(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </Field>

            <Field
              label="Lyrics"
              htmlFor="song-lyrics"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import .txt
                </Button>
              }
              hint="A blank line starts a new slide. Long sections wrap every four lines."
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.text"
                onChange={handleImportTextFile}
                className="hidden"
              />
              <Textarea
                id="song-lyrics"
                ref={textareaRef}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder={`Verse 1\nYou are here, moving in our midst\nI worship You, I worship You\n\nChorus\nWay maker, miracle worker\nPromise keeper, light in the darkness...`}
                className="h-64"
              />
            </Field>
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-border bg-card/40 px-4 py-4 md:border-l md:border-t-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Slides</p>
              <span className="tabular text-2xs text-muted-foreground">
                {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
              </span>
            </div>

            <div className="mt-2">
              {!lyrics.trim() ? (
                <EmptyState
                  title="Slides appear here"
                  description="Type or paste lyrics on the left, or import a .txt file."
                  className="px-2 py-8"
                />
              ) : (
                previewSlides.map((slide, idx) => (
                  <div
                    key={`${slide.id}-${idx}`}
                    className="border-t border-border/70 py-2 first:border-t-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs text-muted-foreground">
                        {slide.sectionLabel || `Slide ${idx + 1}`}
                      </span>
                      <span className="tabular text-2xs text-muted-foreground">#{idx + 1}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-foreground">
                      {slide.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canSave}
              onClick={() => handleSubmit('library')}
            >
              {editingSong ? 'Update song' : 'Save to library'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!canSave}
              onClick={() => handleSubmit('playlist')}
            >
              Save and add to playlist
            </Button>

            <Button
              type="button"
              variant="default"
              disabled={!canSave}
              onClick={() => handleSubmit('golive')}
            >
              Save and go live
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
