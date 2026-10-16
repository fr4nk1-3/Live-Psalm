import React, { useState, useEffect } from 'react';
import { Search, X, Check, BookOpen, Layers } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div 
        className="bg-[#0f172a] border border-amber-500/50 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-[#141d2e] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Select Scripture Book</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40">
                  {selectedBook}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose from 66 normalized books (39 Old Testament • 27 New Testament)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Controls: Search & Testament Filter */}
        <div className="p-4 bg-[#0d1320] border-b border-slate-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search book name (e.g. Genesis, Psalms, John, Romans, Revelation)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 focus:border-indigo-500 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-400 outline-none shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTestamentFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full transition ${
                testamentFilter === 'ALL'
                  ? 'bg-indigo-500 text-white font-black shadow-md'
                  : 'bg-[#182338] text-slate-300 hover:bg-slate-700'
              }`}
            >
              All 66 Books
            </button>
            <button
              type="button"
              onClick={() => setTestamentFilter('OT')}
              className={`px-3.5 py-1.5 rounded-full transition ${
                testamentFilter === 'OT'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-[#182338] text-amber-400 hover:bg-slate-700'
              }`}
            >
              📜 Old Testament (39)
            </button>
            <button
              type="button"
              onClick={() => setTestamentFilter('NT')}
              className={`px-3.5 py-1.5 rounded-full transition ${
                testamentFilter === 'NT'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'bg-[#182338] text-emerald-400 hover:bg-slate-700'
              }`}
            >
              ✝️ New Testament (27)
            </button>
          </div>
        </div>

        {/* Modal Body: Book Grid Only */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Old Testament Books */}
          {(testamentFilter === 'ALL' || testamentFilter === 'OT') && otFiltered.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black uppercase text-amber-400 tracking-wider border-b border-amber-500/30 pb-1 flex items-center justify-between">
                <span>📜 Old Testament</span>
                <span className="text-[10px] text-slate-500">({otFiltered.length} Books)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {otFiltered.map(book => (
                  <button
                    key={book}
                    type="button"
                    onClick={() => {
                      onSelectBook(book);
                      onClose();
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between group cursor-pointer ${
                      selectedBook === book
                        ? 'bg-amber-950/70 border-amber-500 text-white font-bold shadow-md'
                        : 'bg-[#141d2e] border-slate-800 hover:border-amber-500/50 hover:bg-[#1a263d] text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold truncate group-hover:text-amber-300 transition">{book}</span>
                    {selectedBook === book && (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New Testament Books */}
          {(testamentFilter === 'ALL' || testamentFilter === 'NT') && ntFiltered.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black uppercase text-emerald-400 tracking-wider border-b border-emerald-500/30 pb-1 flex items-center justify-between">
                <span>✝️ New Testament</span>
                <span className="text-[10px] text-slate-500">({ntFiltered.length} Books)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ntFiltered.map(book => (
                  <button
                    key={book}
                    type="button"
                    onClick={() => {
                      onSelectBook(book);
                      onClose();
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between group cursor-pointer ${
                      selectedBook === book
                        ? 'bg-emerald-950/70 border-emerald-500 text-white font-bold shadow-md'
                        : 'bg-[#141d2e] border-slate-800 hover:border-emerald-500/50 hover:bg-[#1a263d] text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-bold truncate group-hover:text-emerald-300 transition">{book}</span>
                    {selectedBook === book && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#141d2e] border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-semibold">
            Selected Book: <span className="text-indigo-300 font-bold">{selectedBook}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl shadow transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
