import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Song } from '../types/presentation';
import { ImporterService } from '../services/importer';
import {
  X,
  Music,
  Plus,
  Play,
  Upload,
  Check,
  Sparkles,
  Layers
} from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0f1624] border border-[#26334a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Music className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">
                {editingSong ? 'Edit Worship Song' : 'Add New Worship Song'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Use section buttons or blank lines — slides are formatted automatically in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.text"
              onChange={handleImportTextFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Import lyrics from a .txt file"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              Import .txt
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
          {/* Left Column: Form & Guided Editor */}
          <div className="md:col-span-7 p-4 space-y-3 overflow-y-auto border-b md:border-b-0 md:border-r border-[#26334a]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Song Title *
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Way Maker"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white font-semibold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Artist / Author
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sinach"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Quick Section Tag Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Insert Section Tag
                </label>
                <span className="text-[10px] text-slate-500">Click to insert at cursor</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_SHORTCUTS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertSectionHeader(tag)}
                    className="px-2 py-1 bg-[#162032] hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-400/60 text-slate-200 hover:text-indigo-200 rounded-md text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3 text-indigo-400" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Lyrics Textarea */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Lyrics *
                </label>
                <span className="text-[10px] text-slate-500">
                  Blank line = new slide section • Auto-wraps every 4 lines
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder={`Verse 1\nYou are here, moving in our midst\nI worship You, I worship You\n\nChorus\nWay maker, miracle worker\nPromise keeper, light in the darkness...`}
                className="w-full h-64 bg-[#090d16] border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-100 leading-relaxed outline-none resize-none font-sans"
              />
            </div>
          </div>

          {/* Right Column: Live Slide Preview */}
          <div className="md:col-span-5 bg-[#0b101b] p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Live Slide Preview
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-indigo-300">
                {lyrics.trim() ? previewSlides.length : 0} {previewSlides.length === 1 ? 'slide' : 'slides'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!lyrics.trim() ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  <Music className="w-7 h-7 text-slate-700 mb-2" />
                  <p className="font-semibold text-slate-400">Slide cards appear here</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Type or paste lyrics on the left, or import a .txt file.
                  </p>
                </div>
              ) : (
                previewSlides.map((slide, idx) => (
                  <div
                    key={`${slide.id}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#131b2c] border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-bold uppercase text-indigo-300">
                        {slide.sectionLabel || `Slide ${idx + 1}`}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                    </div>
                    <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                      {slide.content}
                    </div>
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
            className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSubmit('library')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {editingSong ? 'Update Song' : 'Save to Library'}
            </button>

            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSubmit('playlist')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Layers className="w-3.5 h-3.5" />
              Save & Add to Playlist
            </button>

            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSubmit('golive')}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Save & Go Live
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
