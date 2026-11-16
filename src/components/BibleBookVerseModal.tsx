import React, { useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Field } from './ui/field';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';

interface BibleBookVerseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBook: string;
  onSelectBook: (book: string) => void;
  selectedChapter: number;
  onSelectChapter: (chapter: number) => void;
  entireChapter: boolean;
  onToggleEntireChapter: (entire: boolean) => void;
  startVerse: number;
  onSelectStartVerse: (verse: number) => void;
  endVerse: number;
  onSelectEndVerse: (verse: number) => void;
}

const OLD_TESTAMENT_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi'
];

const NEW_TESTAMENT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

const CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21, Ruth: 4,
  '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36, Ezra: 10,
  Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Psalm: 150, Proverbs: 31, Ecclesiastes: 12, 'Song of Solomon': 8,
  Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13,
  Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3,
  '1 John': 5, '2 John': 1, '3 John': 1, Jude: 1, Revelation: 22
};

export const BibleBookVerseModal: React.FC<BibleBookVerseModalProps> = ({
  isOpen,
  onClose,
  selectedBook,
  onSelectBook,
  selectedChapter,
  onSelectChapter,
  entireChapter,
  onToggleEntireChapter,
  startVerse,
  onSelectStartVerse,
  endVerse,
  onSelectEndVerse
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalChapters = CHAPTER_COUNTS[selectedBook] || 50;
  const chaptersList = Array.from({ length: totalChapters }, (_, i) => i + 1);

  const otFiltered = OLD_TESTAMENT_BOOKS.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
  const ntFiltered = NEW_TESTAMENT_BOOKS.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase()));

  const passageLabel = `${selectedBook} ${selectedChapter}${entireChapter ? '' : `:${startVerse}–${endVerse}`}`;

  const renderBookRow = (book: string) => {
    const isSelected = selectedBook === book;
    return (
      <button
        key={book}
        type="button"
        onClick={() => {
          onSelectBook(book);
          onSelectChapter(1);
        }}
        aria-pressed={isSelected}
        className={cn(
          'flex h-7 w-full items-center justify-between gap-1 rounded-sm px-2 text-left text-xs transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
      >
        <span className="truncate">{book}</span>
        {isSelected && <Check className="h-3 w-3 shrink-0" />}
      </button>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[840px]">
        <DialogHeader>
          <DialogTitle>Select passage</DialogTitle>
          <DialogDescription>Choose a book, chapter and verse range.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_200px]">
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search books"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search books"
                  className="h-7 pl-7 pr-7 text-xs"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Select
                value={testamentFilter}
                onValueChange={(value) => setTestamentFilter(value as 'ALL' | 'OT' | 'NT')}
              >
                <SelectTrigger className="h-7 text-xs" aria-label="Testament filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All 66 books</SelectItem>
                  <SelectItem value="OT">Old Testament (39)</SelectItem>
                  <SelectItem value="NT">New Testament (27)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {(testamentFilter === 'ALL' || testamentFilter === 'OT') && otFiltered.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-1 text-2xs text-muted-foreground">Old Testament</p>
                  {otFiltered.map(renderBookRow)}
                </>
              )}

              {(testamentFilter === 'ALL' || testamentFilter === 'NT') && ntFiltered.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-3 text-2xs text-muted-foreground">New Testament</p>
                  {ntFiltered.map(renderBookRow)}
                </>
              )}

              {otFiltered.length === 0 && ntFiltered.length === 0 && (
                <p className="px-1 py-2 text-2xs leading-relaxed text-muted-foreground">
                  No book matches "{searchQuery}".
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="shrink-0 border-b border-border px-4 py-2.5">
              <p className="text-xs font-medium text-foreground">{selectedBook}</p>
              <p className="text-2xs text-muted-foreground">{totalChapters} chapters</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-6 gap-1">
                {chaptersList.map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => onSelectChapter(ch)}
                    aria-pressed={selectedChapter === ch}
                    className={cn(
                      'tabular h-7 rounded-sm text-xs transition-colors',
                      selectedChapter === ch
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-border px-4 py-2.5">
              <p className="text-xs font-medium text-foreground">Verse range</p>
              <p className="tabular text-2xs text-muted-foreground">{passageLabel}</p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="entire-chapter">Entire chapter</Label>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    Reads every verse in {selectedBook} {selectedChapter}.
                  </p>
                </div>
                <Switch
                  id="entire-chapter"
                  checked={entireChapter}
                  onCheckedChange={onToggleEntireChapter}
                  aria-label="Entire chapter"
                />
              </div>

              {!entireChapter && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From" htmlFor="start-verse">
                    <Input
                      id="start-verse"
                      type="number"
                      min={1}
                      value={startVerse}
                      onChange={(e) => onSelectStartVerse(parseInt(e.target.value) || 1)}
                      className="tabular"
                    />
                  </Field>
                  <Field label="To" htmlFor="end-verse">
                    <Input
                      id="end-verse"
                      type="number"
                      min={1}
                      value={endVerse}
                      onChange={(e) => onSelectEndVerse(parseInt(e.target.value) || 1)}
                      className="tabular"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <p className="text-2xs text-muted-foreground">
            <span className="tabular text-foreground">{passageLabel}</span>
          </p>
          <Button type="button" variant="default" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
