import React, { useState, useEffect } from 'react';
import { Song, MediaAsset, Theme, AnnouncementItem, QuickPinnedItem } from '../types/presentation';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { OnlineBibleApiService, OnlineBibleVersion } from '../services/onlineBibleApi';
import { ImporterService } from '../services/importer';
import { BibleVersionModal } from './BibleVersionModal';
import { BibleBookVerseModal } from './BibleBookVerseModal';
import { 
  Music, 
  Book, 
  Film, 
  Palette, 
  Search, 
  Plus, 
  FilePlus, 
  Check, 
  Upload,
  Globe,
  Loader2,
  Pencil, 
  Edit3, 
  Trash2, 
  X,
  Play,
  Megaphone,
  Layers,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  BookOpen
} from 'lucide-react';

const BIBLE_BOOKS_66 = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

interface LibraryTabsProps {
  songs: Song[];
  media: MediaAsset[];
  themes: Theme[];
  activeThemeId: string;
  quickPinnedItems?: QuickPinnedItem[];
  onAddSongToPlaylist: (song: Song) => void;
  onAddBibleToPlaylist: (passageRef: string, slides: any[]) => void;
  onAddBiblePassageAndGoLive?: (passageRef: string, slides: any[], targetSlide?: any) => void;
  onAppendSlidesToActiveItem?: (slides: any[], titleRef?: string) => void;
  onPinToQuickSection?: (title: string, slides: any[], type?: 'bible' | 'song' | 'announcement', sourceRef?: string) => void;
  onUnpinFromQuickSection?: (pinIdOrTitle: string) => void;
  onAddMediaToPlaylist: (media: MediaAsset) => void;
  onSelectTheme: (themeId: string) => void;
  onGoLiveWithSlide: (slide: any) => void;
  onTriggerLowerThirdAnnouncement?: (slide: any) => void;
  onAddNewSong: (song: Song) => void;
  onUpdateSong: (song: Song) => void;
  onDeleteSong: (songId: string) => void;
}

export const LibraryTabs: React.FC<LibraryTabsProps> = ({
  songs,
  media,
  themes,
  activeThemeId,
  quickPinnedItems = [],
  onAddSongToPlaylist,
  onAddBibleToPlaylist,
  onAddBiblePassageAndGoLive,
  onAppendSlidesToActiveItem,
  onPinToQuickSection,
  onUnpinFromQuickSection,
  onAddMediaToPlaylist,
  onSelectTheme,
  onGoLiveWithSlide,
  onTriggerLowerThirdAnnouncement,
  onAddNewSong,
  onUpdateSong,
  onDeleteSong
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'bible' | 'announcements' | 'media' | 'themes'>('songs');

  // App Settings
  const settings = StorageService.getSettings();

  // Songs Search & Form State
  const [songSearch, setSongSearch] = useState('');
  const [showSongForm, setShowSongForm] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newLyrics, setNewLyrics] = useState('');

  // Announcements State & Handlers
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(() => StorageService.getAnnouncements());
  const [annQuery, setAnnQuery] = useState('');
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annSubtitle, setAnnSubtitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  const handleSaveAnnouncement = () => {
    if (!annTitle.trim() || !annContent.trim()) {
      alert('Please enter an Announcement Title and Message content.');
      return;
    }

    if (editingAnn) {
      const updated = announcements.map(a => a.id === editingAnn.id ? {
        ...a,
        title: annTitle,
        subtitle: annSubtitle,
        content: annContent
      } : a);
      setAnnouncements(updated);
      StorageService.saveAnnouncements(updated);
    } else {
      const newAnn: AnnouncementItem = {
        id: `ann-${Math.random().toString(36).substring(2, 9)}`,
        title: annTitle,
        subtitle: annSubtitle,
        content: annContent
      };
      const updated = [newAnn, ...announcements];
      setAnnouncements(updated);
      StorageService.saveAnnouncements(updated);
    }

    setShowAnnModal(false);
    setEditingAnn(null);
    setAnnTitle('');
    setAnnSubtitle('');
    setAnnContent('');
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (confirm('Delete this announcement template?')) {
      const updated = announcements.filter(a => a.id !== id);
      setAnnouncements(updated);
      StorageService.saveAnnouncements(updated);
    }
  };

  // Bible State
  const [onlineVersions, setOnlineVersions] = useState<OnlineBibleVersion[]>([]);
  const [customBibles, setCustomBibles] = useState<CustomBibleTranslation[]>(() => StorageService.getCustomBibles());
  const [selectedTranslation, setSelectedTranslation] = useState<string>('nkjv');
  const [bibleBook, setBibleBook] = useState('John');
  const [bibleChapter, setBibleChapter] = useState(3);
  const [entireChapter, setEntireChapter] = useState(true);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(18);
  const [chapterPassage, setChapterPassage] = useState<any | null>(null);
  const [isPassageLoading, setIsPassageLoading] = useState(false);
  const [showBibleImportModal, setShowBibleImportModal] = useState(false);
  const [importBibleName, setImportBibleName] = useState('');
  const [importBibleAbbr, setImportBibleAbbr] = useState('');
  const [bibleKeywordSearch, setBibleKeywordSearch] = useState('');

  // Version & Book Modal States
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // Version Picker Search & Category State
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [versionSearchQuery, setVersionSearchQuery] = useState('');
  const [versionCategoryFilter, setVersionCategoryFilter] = useState<'ALL' | 'Kiswahili' | 'English' | 'API Online'>('ALL');

  const preloadedManifest = StorageService.getPreloadedManifestList();

  const allCategorizedVersions = React.useMemo(() => {
    const items: {
      id: string;
      name: string;
      abbreviation: string;
      category: 'Kiswahili' | 'English' | 'API Online';
      flag: string;
      sourceType: 'builtin' | 'preloaded' | 'custom' | 'api';
    }[] = [];

    // 1. Built-in KJV
    items.push({
      id: 'kjv',
      name: 'King James Version (KJV)',
      abbreviation: 'KJV',
      category: 'English',
      flag: '🇬🇧',
      sourceType: 'builtin'
    });

    // 2. Pre-loaded Manifest Bibles
    for (const m of preloadedManifest) {
      const s = (m.name + ' ' + m.abbreviation + ' ' + m.id).toLowerCase();
      const isKiswahili = s.includes('swahili') || s.includes('kiswahili') || s.includes('takatifu') || s.includes('habari njema') || s.includes('suv') || s.includes('rsuv');
      const cat = isKiswahili ? 'Kiswahili' as const : 'English' as const;
      items.push({
        id: m.id,
        name: m.name,
        abbreviation: m.abbreviation,
        category: cat,
        flag: cat === 'Kiswahili' ? '🇰🇪' : '🇬🇧',
        sourceType: 'preloaded'
      });
    }

    // 3. User Custom Bibles
    for (const cb of customBibles) {
      if (!items.some(it => it.id === cb.id)) {
        const s = (cb.name + ' ' + cb.abbreviation + ' ' + cb.id).toLowerCase();
        const isKiswahili = s.includes('swahili') || s.includes('kiswahili') || s.includes('takatifu') || s.includes('habari njema') || s.includes('suv') || s.includes('rsuv');
        const cat = isKiswahili ? 'Kiswahili' as const : 'English' as const;
        items.push({
          id: cb.id,
          name: cb.name,
          abbreviation: cb.abbreviation,
          category: cat,
          flag: cat === 'Kiswahili' ? '🇰🇪' : '🇬🇧',
          sourceType: 'custom'
        });
      }
    }

    // 4. API Online Bibles (if enabled)
    if (settings.apiBibleEnabled) {
      for (const ov of onlineVersions) {
        items.push({
          id: ov.id,
          name: `${ov.version} (API Online)`,
          abbreviation: (ov as any).abbreviation || 'API',
          category: 'API Online',
          flag: '🌐',
          sourceType: 'api'
        });
      }
    }

    return items;
  }, [preloadedManifest, customBibles, onlineVersions, settings.apiBibleEnabled]);

  const activeVersionInfo = allCategorizedVersions.find(v => v.id === selectedTranslation) || {
    id: selectedTranslation,
    name: selectedTranslation,
    abbreviation: selectedTranslation.toUpperCase(),
    category: 'English' as const,
    flag: '📖',
    sourceType: 'custom' as const
  };

  const filteredVersions = allCategorizedVersions.filter(v => {
    const matchesSearch = 
      v.name.toLowerCase().includes(versionSearchQuery.toLowerCase()) ||
      v.abbreviation.toLowerCase().includes(versionSearchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(versionSearchQuery.toLowerCase());
    const matchesCat = versionCategoryFilter === 'ALL' || v.category === versionCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const kiswahiliVersions = filteredVersions.filter(v => v.category === 'Kiswahili');
  const englishVersions = filteredVersions.filter(v => v.category === 'English');
  const apiVersions = filteredVersions.filter(v => v.category === 'API Online');

  // Media Category Filter
  const [mediaCategory, setMediaCategory] = useState<string>('All');

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(songSearch.toLowerCase()))
  );

  const filteredMedia = mediaCategory === 'All' 
    ? media 
    : media.filter(m => m.category === mediaCategory);

  const handleSaveSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLyrics.trim()) return;

    if (editingSongId) {
      const updated = ImporterService.parseLyricsToSong(newTitle, newLyrics, newArtist);
      updated.id = editingSongId;
      onUpdateSong(updated);
    } else {
      const song = ImporterService.parseLyricsToSong(newTitle, newLyrics, newArtist);
      onAddNewSong(song);
    }

    setEditingSongId(null);
    setNewTitle('');
    setNewArtist('');
    setNewLyrics('');
    setShowSongForm(false);
  };

  const handleStartEditSong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSongId(song.id);
    setNewTitle(song.title);
    setNewArtist(song.artist || '');
    const reconstructedLyrics = song.sections
      .map(s => `${s.label}\n${s.lyrics}`)
      .join('\n\n');
    setNewLyrics(reconstructedLyrics);
    setShowSongForm(true);
  };

  const handleStartNewSong = () => {
    setEditingSongId(null);
    setNewTitle('');
    setNewArtist('');
    setNewLyrics('');
    setShowSongForm(true);
  };

  // Load online & local Bible versions
  useEffect(() => {
    const handleBiblesUpdated = (evt?: any) => {
      const updatedList = StorageService.getCustomBibles();
      setCustomBibles(updatedList);
      if (evt?.detail?.id) {
        setSelectedTranslation(evt.detail.id);
      }
    };

    handleBiblesUpdated();
    window.addEventListener('custom-bibles-updated', handleBiblesUpdated);

    if (settings.apiBibleEnabled) {
      OnlineBibleApiService.fetchAvailableVersions().then(versions => {
        setOnlineVersions(versions);
      });
    }

    return () => {
      window.removeEventListener('custom-bibles-updated', handleBiblesUpdated);
    };
  }, [settings.apiBibleEnabled, activeTab]);

  const handleFetchChapterPreview = async () => {
    setIsPassageLoading(true);
    try {
      const sVerse = entireChapter ? 1 : startVerse;
      const eVerse = entireChapter ? 999 : endVerse;

      let passage: any = null;
      if (settings.apiBibleEnabled) {
        passage = await OnlineBibleApiService.fetchPassage(
          selectedTranslation,
          bibleBook,
          bibleChapter,
          sVerse,
          eVerse
        );
      }

      if (!passage) {
        passage = await StorageService.queryBibleAsync(bibleBook, bibleChapter, sVerse, eVerse, selectedTranslation);
      }

      setChapterPassage(passage);
    } catch (e) {
      console.error('Error fetching chapter preview:', e);
    } finally {
      setIsPassageLoading(false);
    }
  };

  useEffect(() => {
    handleFetchChapterPreview();
  }, [bibleBook, bibleChapter, selectedTranslation, entireChapter, startVerse, endVerse, settings.apiBibleEnabled]);

  const handleBibleSearch = async () => {
    setIsPassageLoading(true);
    try {
      const sVerse = entireChapter ? 1 : startVerse;
      const eVerse = entireChapter ? 999 : endVerse;

      let passage = chapterPassage;
      if (!passage) {
        if (settings.apiBibleEnabled) {
          passage = await OnlineBibleApiService.fetchPassage(
            selectedTranslation,
            bibleBook,
            bibleChapter,
            sVerse,
            eVerse
          );
        }
        if (!passage) {
          passage = await StorageService.queryBibleAsync(bibleBook, bibleChapter, sVerse, eVerse, selectedTranslation);
        }
      }

      if (passage && passage.verses && passage.verses.length > 0) {
        const slides = passage.verses.map((v: any) => ({
          id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
          title: `${passage!.book} ${passage!.chapter}:${v.number}`,
          content: v.text,
          subtitle: `${passage!.formattedRef} (${passage!.translation})`,
          sectionLabel: 'Scripture' as const
        }));

        if (onPinToQuickSection) {
          onPinToQuickSection(passage.formattedRef, slides, 'bible');
        } else if (onAppendSlidesToActiveItem) {
          onAppendSlidesToActiveItem(slides, passage.formattedRef);
        } else {
          onAddBibleToPlaylist(passage.formattedRef, slides);
        }
      } else {
        alert(`Passage ${bibleBook} ${bibleChapter} not found in translation ${selectedTranslation}.`);
      }
    } catch (e) {
      alert('Error querying Bible passage.');
    } finally {
      setIsPassageLoading(false);
    }
  };

  // Bible File Importer Handler (Supports both JSON & XML format)
  const handleBibleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        const name = importBibleName.trim() || cleanFileName;
        const abbr = importBibleAbbr.trim() || name.substring(0, 4).toUpperCase();
        let customBible: CustomBibleTranslation | null = null;

        if (content.includes('<')) {
          // Parse XML Bible format (Zefania, OpenSong, XML)
          customBible = ImporterService.parseXmlBible(content, name, abbr);
        } else {
          // Parse JSON Bible format
          const parsed = JSON.parse(content);
          const jsonName = importBibleName.trim() || parsed.translation || cleanFileName;
          const jsonAbbr = importBibleAbbr.trim() || parsed.abbreviation || 'CUSTOM';
          const books = parsed.books || parsed;
          customBible = {
            id: `bible-${Math.random().toString(36).substring(2, 9)}`,
            name: jsonName,
            abbreviation: jsonAbbr,
            books
          };
        }

        if (customBible) {
          StorageService.saveCustomBible(customBible);
          setCustomBibles(StorageService.getCustomBibles());
          setSelectedTranslation(customBible.id);
          setShowBibleImportModal(false);
          alert(`Successfully imported Bible translation: ${customBible.name} (${customBible.abbreviation})`);
        }
      } catch (err) {
        alert('Could not parse Bible file. Ensure it is a valid JSON or XML Bible dataset file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-80 bg-[#0d1320] border-r border-[#26334a] flex flex-col h-full select-none shrink-0">
      {/* Top Tab Bar */}
      <div className="grid grid-cols-5 bg-[#11192a] border-b border-[#26334a] p-1 gap-1">
        {[
          { id: 'songs', label: 'Songs', icon: Music },
          { id: 'bible', label: 'Bible', icon: Book },
          { id: 'announcements', label: 'Ticker', icon: Megaphone },
          { id: 'media', label: 'Media', icon: Film },
          { id: 'themes', label: 'Themes', icon: Palette }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-1.5 px-0.5 rounded-md text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* SONGS TAB */}
        {activeTab === 'songs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search songs..."
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  className="w-full bg-[#182338] border border-[#26334a] focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>
              <button
                onClick={handleStartNewSong}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow"
                title="Create New Song"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            {/* Song Creation / Editing Form */}
            {showSongForm && (
              <form onSubmit={handleSaveSong} className="bg-[#162032] border border-indigo-500/60 p-3 rounded-lg space-y-2 text-xs shadow-lg animate-slide-fade">
                <div className="font-bold text-indigo-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {editingSongId ? (
                      <>
                        <Edit3 className="w-4 h-4 text-amber-400" />
                        <span>Edit Song Lyrics & Details</span>
                      </>
                    ) : (
                      <>
                        <FilePlus className="w-4 h-4 text-indigo-400" />
                        <span>Create New Song Entry</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSongForm(false);
                      setEditingSongId(null);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Song Title</label>
                  <input
                    type="text"
                    placeholder="Song Title (e.g. Way Maker)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white outline-none focus:border-indigo-500 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Artist / Author</label>
                  <input
                    type="text"
                    placeholder="Artist / Author (e.g. Sinach)"
                    value={newArtist}
                    onChange={(e) => setNewArtist(e.target.value)}
                    className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">
                    Song Lyrics & Section Labels
                  </label>
                  <textarea
                    placeholder="Type or paste lyrics here. Empty lines create section breaks automatically (e.g. Verse 1, Chorus, Bridge)..."
                    value={newLyrics}
                    onChange={(e) => setNewLyrics(e.target.value)}
                    className="w-full h-32 bg-[#0d1320] border border-slate-700 rounded p-2 text-white outline-none focus:border-indigo-500 text-[11px] font-mono resize-none leading-relaxed"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSongForm(false);
                      setEditingSongId(null);
                    }}
                    className="px-3 py-1.5 text-slate-400 hover:text-white font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded shadow transition"
                  >
                    {editingSongId ? 'Update Song' : 'Save Song'}
                  </button>
                </div>
              </form>
            )}

            {/* Songs List */}
            <div className="space-y-1.5">
              {filteredSongs.map(song => (
                <div
                  key={song.id}
                  onClick={() => onAddSongToPlaylist(song)}
                  className="bg-[#141d2e] border border-slate-800 hover:border-indigo-500 hover:bg-[#19243a] p-2.5 rounded-lg flex items-center justify-between gap-2 group transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-200 group-hover:text-indigo-300 truncate">
                      {song.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {song.artist || 'Traditional'} • {song.sections.length} sections
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartEditSong(song, e)}
                      className="p-1.5 bg-slate-800/80 hover:bg-amber-600/30 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 rounded transition"
                      title="Edit Song Lyrics & Details"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${song.title}" from your library?`)) {
                          onDeleteSong(song.id);
                        }
                      }}
                      className="p-1.5 bg-slate-800/80 hover:bg-rose-600/30 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 rounded transition"
                      title="Delete Song from Library"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {(() => {
                      const isSongPinned = quickPinnedItems.some(p => p.title === song.title);
                      if (isSongPinned) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onUnpinFromQuickSection) onUnpinFromQuickSection(song.title);
                            }}
                            className="px-2 py-1 bg-amber-600/40 hover:bg-rose-600 text-amber-300 hover:text-white border border-amber-500/50 rounded text-[11px] font-bold flex items-center gap-1 transition shadow-sm ml-1"
                            title="Unpin song from Quick Section"
                          >
                            <PinOff className="w-3 h-3" /> Pinned
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const songSlides = ImporterService.songToSlides(song);
                            if (onPinToQuickSection) {
                              onPinToQuickSection(song.title, songSlides, 'song');
                            } else if (onAppendSlidesToActiveItem) {
                              onAppendSlidesToActiveItem(songSlides, song.title);
                            }
                          }}
                          className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-sm ml-1"
                          title="Append song slides to Quick Section"
                        >
                          <Pin className="w-3 h-3" /> Append
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSongToPlaylist(song);
                      }}
                      className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                      title="Add as new playlist item"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BIBLE TAB WITH OFFLINE & API.BIBLE SEARCH + XML IMPORTER */}
        {activeTab === 'bible' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-[#26334a] pb-2">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" /> Scripture Search
              </div>
              <button
                onClick={() => setShowBibleImportModal(!showBibleImportModal)}
                className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition"
                title="Import custom offline Bible XML or JSON file"
              >
                <Upload className="w-3 h-3" /> Import XML/JSON
              </button>
            </div>

            {/* API Search Notice if API.Bible disabled in settings */}
            {!settings.apiBibleEnabled && (
              <div className="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 leading-normal">
                💡 <strong>Offline Mode:</strong> API.Bible is OFF by default. Using local Bibles (KJV, custom XML/JSON). Turn ON API search in Settings to fetch NKJV, NIV, AMP online.
              </div>
            )}

            {/* Direct Bible Search Input Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search scripture text or verse (e.g. John 3:16, 1 John 4, or 'love')..."
                value={bibleKeywordSearch}
                onChange={(e) => setBibleKeywordSearch(e.target.value)}
                className="w-full bg-[#182338] border border-[#26334a] focus:border-amber-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
              />
              {bibleKeywordSearch && (
                <button
                  onClick={() => setBibleKeywordSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Keyword Search Results List */}
            {bibleKeywordSearch.trim() !== '' && (
              <div className="bg-[#141d2e] border border-amber-500/40 p-2.5 rounded-lg space-y-2 max-h-60 overflow-y-auto">
                <div className="font-bold text-amber-400 text-[10px] uppercase flex items-center justify-between">
                  <span>Scripture Matches</span>
                  <span>{StorageService.searchBibleVerses(bibleKeywordSearch, selectedTranslation).length} found</span>
                </div>
                {StorageService.searchBibleVerses(bibleKeywordSearch, selectedTranslation).map((res, idx) => (
                  <div key={idx} className="bg-[#0d1320] border border-slate-800 hover:border-amber-500/50 p-2 rounded-lg flex items-center justify-between gap-2 group transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-amber-300 text-xs">{res.formattedRef}</div>
                      <div className="text-[10px] text-slate-300 italic truncate">"{res.text}"</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const slides = [{
                            id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
                            title: res.formattedRef,
                            content: res.text,
                            subtitle: res.translation,
                            sectionLabel: 'Scripture'
                          }];
                          if (onGoLiveWithSlide) onGoLiveWithSlide(slides[0]);
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow"
                        title="Go Live with verse"
                      >
                        <Play className="w-2.5 h-2.5" /> Live
                      </button>
                      {onAppendSlidesToActiveItem && (
                        <button
                          type="button"
                          onClick={() => {
                            const slides = [{
                              id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
                              title: res.formattedRef,
                              content: res.text,
                              subtitle: res.translation,
                              sectionLabel: 'Scripture'
                            }];
                            onAppendSlidesToActiveItem(slides, res.formattedRef);
                          }}
                          className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition"
                          title="Append verse to active item"
                        >
                          <Layers className="w-2.5 h-2.5" /> Append
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bible Import Modal */}
            {showBibleImportModal && (
              <div className="bg-[#162032] border border-amber-500/60 p-3 rounded-xl space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Import Bible Dataset (.xml, .json)
                </div>
                <p className="text-[10px] text-slate-400">
                  Select a Bible translation file (Zefania XML, OpenSong XML, or JSON).
                </p>
                <input
                  type="text"
                  placeholder="Translation Name (e.g. Amplified / NIV / WEB)"
                  value={importBibleName}
                  onChange={(e) => setImportBibleName(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white outline-none"
                />
                <input
                  type="text"
                  placeholder="Abbreviation (e.g. AMP, NIV, ESV)"
                  value={importBibleAbbr}
                  onChange={(e) => setImportBibleAbbr(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white outline-none"
                />
                <label className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow">
                  <Upload className="w-4 h-4" /> Select XML / JSON File & Import
                  <input
                    type="file"
                    accept=".xml,.json,.txt,.xmm"
                    onChange={handleBibleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Bible Lookup Form Trigger Cards */}
            <div className="space-y-3 bg-[#141d2e] border border-slate-800 p-3.5 rounded-2xl shadow-md">
              {/* Bible Version Card (Launches BibleVersionModal) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">
                    Bible Version
                  </label>
                  <span className={`text-[9px] font-bold flex items-center gap-0.5 ${settings.apiBibleEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Globe className="w-2.5 h-2.5" /> {settings.apiBibleEnabled ? 'API Online' : '30 Offline Bibles'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVersionModalOpen(true)}
                  className="w-full bg-[#0d1320] hover:bg-[#152033] border border-amber-500/50 hover:border-amber-400 rounded-xl p-2.5 text-left flex items-center justify-between transition shadow group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 shadow ${
                      activeVersionInfo.category === 'Kiswahili'
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                        : activeVersionInfo.category === 'API Online'
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                        : 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                    }`}>
                      {activeVersionInfo.flag} {activeVersionInfo.abbreviation}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate group-hover:text-amber-300 transition">
                        {activeVersionInfo.name}
                      </div>
                      <div className="text-[9px] text-slate-400 font-semibold">
                        {activeVersionInfo.category} Category • Click to Change
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 group-hover:text-amber-300 shrink-0 ml-2 font-bold text-xs bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </div>
                </button>
              </div>

              {/* Bible Book Selection Card (Launches BibleBookVerseModal) */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Scripture Book
                </label>
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(true)}
                  className="w-full bg-[#0d1320] hover:bg-[#152033] border border-indigo-500/50 hover:border-indigo-400 rounded-xl p-2.5 text-left flex items-center justify-between transition shadow group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 text-[10px] font-black uppercase shrink-0 shadow">
                      📖 {bibleBook}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition">
                        {bibleBook}
                      </div>
                      <div className="text-[9px] text-slate-400 font-semibold">
                        Click to Select Book
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-400 group-hover:text-indigo-300 shrink-0 ml-2 font-bold text-xs bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Select</span>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Chapter</label>
                  <input
                    type="number"
                    min={1}
                    value={bibleChapter}
                    onChange={(e) => setBibleChapter(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white text-center font-bold outline-none"
                  />
                </div>
                {!entireChapter && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">From Verse</label>
                      <input
                        type="number"
                        min={1}
                        value={startVerse}
                        onChange={(e) => setStartVerse(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white text-center font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">To Verse</label>
                      <input
                        type="number"
                        min={1}
                        value={endVerse}
                        onChange={(e) => setEndVerse(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white text-center font-bold outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {(() => {
                  const isCurrentChapterPinned = chapterPassage && quickPinnedItems.some(p => p.title === chapterPassage.formattedRef);
                  if (isCurrentChapterPinned) {
                    return (
                      <button
                        onClick={() => {
                          if (chapterPassage && onUnpinFromQuickSection) {
                            onUnpinFromQuickSection(chapterPassage.formattedRef);
                          }
                        }}
                        className="py-2 bg-amber-600/40 hover:bg-rose-600 text-amber-300 hover:text-white font-bold rounded-lg shadow flex items-center justify-center gap-1 transition text-[11px]"
                        title="Unpin chapter from Quick Section"
                      >
                        <PinOff className="w-3.5 h-3.5" /> Pinned (Unpin)
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={handleBibleSearch}
                      disabled={isPassageLoading}
                      className="py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-lg shadow flex items-center justify-center gap-1 transition disabled:opacity-50 text-[11px]"
                      title="Append chapter to Quick Selection Section"
                    >
                      <Pin className="w-3.5 h-3.5" /> Append Chapter
                    </button>
                  );
                })()}
                <button
                  onClick={() => {
                    if (chapterPassage && chapterPassage.verses) {
                      const slides = chapterPassage.verses.map((v: any) => ({
                        id: `slide-b-${Math.random().toString(36).substring(2, 9)}`,
                        title: `${chapterPassage.book} ${chapterPassage.chapter}:${v.number}`,
                        content: v.text,
                        subtitle: `${chapterPassage.formattedRef} (${chapterPassage.translation})`,
                        sectionLabel: 'Scripture' as const
                      }));
                      onAddBibleToPlaylist(chapterPassage.formattedRef, slides);
                    }
                  }}
                  disabled={isPassageLoading}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg shadow flex items-center justify-center gap-1 transition disabled:opacity-50 text-[11px]"
                  title="Add as new playlist item"
                >
                  <Plus className="w-3.5 h-3.5" /> New Item
                </button>
              </div>

              {/* Full Chapter Verses Preview List */}
              {chapterPassage && chapterPassage.verses && chapterPassage.verses.length > 0 && (
                <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <span>{chapterPassage.formattedRef} ({chapterPassage.translation})</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{chapterPassage.verses.length} Verses</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {chapterPassage.verses.map((v: any) => {
                      const verseSlide = {
                        id: `slide-bv-${chapterPassage.book}-${chapterPassage.chapter}-${v.number}`,
                        title: `${chapterPassage.book} ${chapterPassage.chapter}:${v.number}`,
                        content: v.text,
                        subtitle: `${chapterPassage.book} ${chapterPassage.chapter}:${v.number} (${chapterPassage.translation})`,
                        sectionLabel: 'Scripture'
                      };

                      const verseRef = `${chapterPassage.book} ${chapterPassage.chapter}:${v.number}`;
                      const isVersePinned = quickPinnedItems.some(p => p.title === verseRef);

                      return (
                        <div 
                          key={v.number}
                          className="p-2 bg-[#0d1320] hover:bg-[#182338] border border-slate-800/90 rounded-lg text-left transition group cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-400 mb-1">
                            <span className="text-amber-400 font-extrabold">{chapterPassage.book} {chapterPassage.chapter}:{v.number}</span>
                            <div className="flex items-center gap-1">
                              {isVersePinned ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onUnpinFromQuickSection) onUnpinFromQuickSection(verseRef);
                                  }}
                                  className="bg-amber-600/40 hover:bg-rose-600 text-amber-300 hover:text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-0.5 shadow transition"
                                  title="Unpin verse from Quick Section"
                                >
                                  <PinOff className="w-2.5 h-2.5" /> Pinned
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onPinToQuickSection) {
                                      onPinToQuickSection(verseRef, [verseSlide], 'bible');
                                    } else if (onAppendSlidesToActiveItem) {
                                      onAppendSlidesToActiveItem([verseSlide], verseRef);
                                    }
                                  }}
                                  className="bg-emerald-700/80 hover:bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-0.5 shadow transition"
                                  title="Append verse to Quick Section"
                                >
                                  <Pin className="w-2.5 h-2.5" /> Append
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAddBiblePassageAndGoLive) {
                                    onAddBiblePassageAndGoLive(`${chapterPassage.book} ${chapterPassage.chapter}`, [verseSlide], verseSlide);
                                  }
                                }}
                                className="bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 shadow transition"
                                title="Go Live immediately with this verse"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" /> GO LIVE
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-slate-200 font-medium leading-normal whitespace-pre-line">
                            {v.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEDICATED ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search announcements..."
                  value={annQuery}
                  onChange={(e) => setAnnQuery(e.target.value)}
                  className="w-full bg-[#090d14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => {
                  setEditingAnn(null);
                  setAnnTitle('');
                  setAnnSubtitle('');
                  setAnnContent('');
                  setShowAnnModal(true);
                }}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>

            {/* Announcements List */}
            <div className="space-y-2">
              {announcements
                .filter(a => a.title.toLowerCase().includes(annQuery.toLowerCase()) || a.content.toLowerCase().includes(annQuery.toLowerCase()))
                .map(ann => {
                  const annSlide = {
                    id: `slide-ann-${Math.random().toString(36).substring(2, 9)}`,
                    title: ann.title,
                    content: ann.content,
                    subtitle: ann.subtitle,
                    sectionLabel: 'Title'
                  };

                  return (
                    <div
                      key={ann.id}
                      className="p-3 bg-[#121824] hover:bg-[#182234] border border-purple-500/30 rounded-xl space-y-2 shadow transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Megaphone className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="text-xs font-black text-white truncate">{ann.title}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditingAnn(ann);
                              setAnnTitle(ann.title);
                              setAnnSubtitle(ann.subtitle || '');
                              setAnnContent(ann.content);
                              setShowAnnModal(true);
                            }}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                            title="Edit announcement"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1 bg-rose-950/80 hover:bg-rose-900 text-rose-400 rounded"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {ann.subtitle && (
                        <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                          {ann.subtitle}
                        </div>
                      )}

                      <div className="text-xs text-slate-300 font-medium line-clamp-2 leading-relaxed bg-[#0a0e1a] p-2 rounded-lg border border-slate-800">
                        {ann.content}
                      </div>

                      {/* Quick Action Controls */}
                      <div className="flex items-center justify-between pt-1 text-[10px] gap-1.5">
                        <button
                          onClick={() => {
                            if (onTriggerLowerThirdAnnouncement) {
                              onTriggerLowerThirdAnnouncement({
                                title: ann.title,
                                subtitle: ann.subtitle,
                                content: ann.content
                              });
                            }
                          }}
                          className="flex-1 py-1 bg-purple-700 hover:bg-purple-600 text-white font-extrabold rounded text-[9px] uppercase tracking-wider shadow flex items-center justify-center gap-1 transition"
                          title="Trigger continuous marquee crawl line ticker across Audience output screen"
                        >
                          <Megaphone className="w-3 h-3 text-amber-300 animate-pulse" /> TICKER (CRAWL)
                        </button>

                        {onAppendSlidesToActiveItem && (
                          <button
                            onClick={() => onAppendSlidesToActiveItem([annSlide], `Announcement: ${ann.title}`)}
                            className="py-1 px-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-[9px] uppercase tracking-wider transition flex items-center gap-0.5 shadow"
                            title="Append slide to active item (Quick Section Jump)"
                          >
                            <Layers className="w-3 h-3" /> Append Slide
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onAddBibleToPlaylist(`Announcement: ${ann.title}`, [annSlide]);
                          }}
                          className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded text-[9px] uppercase tracking-wider transition flex items-center gap-1"
                          title="Add full slide to active service playlist"
                        >
                          <Plus className="w-3 h-3" /> Add Slide
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* MEDIA TAB */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {['All', 'Backgrounds', 'Videos', 'Logos'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setMediaCategory(cat)}
                  className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition ${
                    mediaCategory === cat
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Media Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredMedia.map(item => (
                <div
                  key={item.id}
                  onClick={() => onAddMediaToPlaylist(item)}
                  className="group relative bg-[#141d2e] border border-slate-800 hover:border-sky-500/60 rounded-lg overflow-hidden cursor-pointer transition"
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      className="w-full h-24 object-cover"
                      muted
                      loop
                      autoPlay
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-24 object-cover group-hover:scale-105 transition duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition" />
                  <div className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate flex items-center justify-between">
                    <span>{item.name}</span>
                    {item.type === 'video' && <span className="bg-sky-600 px-1 py-0.5 rounded text-[8px] uppercase">VIDEO</span>}
                  </div>
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition">
                    <span className="p-1 bg-sky-600 text-white rounded-full flex items-center justify-center shadow">
                      <Plus className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* THEMES TAB */}
        {activeTab === 'themes' && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Global Presentation Themes
            </div>

            {themes.map(t => {
              const isSelected = t.id === activeThemeId;
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 text-white'
                      : 'bg-[#141d2e] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded border border-slate-600 shadow flex items-center justify-center font-bold text-xs"
                      style={{ backgroundColor: t.accentColor, fontFamily: t.fontFamily }}
                    >
                      Aa
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{t.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.fontFamily} • {t.align}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW/EDIT ANNOUNCEMENT MODAL */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1624] border border-purple-500/60 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-purple-400" />
                {editingAnn ? 'Edit Announcement' : 'Create New Announcement'}
              </h3>
              <button
                onClick={() => setShowAnnModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. SUNDAY WORSHIP / MIDWEEK PRAYER"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full bg-[#080c14] border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Subtitle / Info (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Wednesday 7:00 PM / Main Sanctuary"
                  value={annSubtitle}
                  onChange={(e) => setAnnSubtitle(e.target.value)}
                  className="w-full bg-[#080c14] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Announcement Message (Marquee Crawl Content)</label>
                <textarea
                  rows={3}
                  placeholder="Enter full announcement text to scroll continuously across lower-third ticker..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full bg-[#080c14] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-purple-500 leading-normal"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAnnModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnouncement}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Save Announcement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bible Version Selection Modal Popup */}
      <BibleVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        selectedTranslation={selectedTranslation}
        onSelectTranslation={(id) => setSelectedTranslation(id)}
        customBibles={customBibles}
        onlineVersions={onlineVersions}
        apiBibleEnabled={settings.apiBibleEnabled}
      />

      {/* Bible Book & Chapter Selection Modal Popup */}
      <BibleBookVerseModal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        selectedBook={bibleBook}
        onSelectBook={(b) => setBibleBook(b)}
        selectedChapter={bibleChapter}
        onSelectChapter={(c) => setBibleChapter(c)}
        entireChapter={entireChapter}
        onToggleEntireChapter={(e) => setEntireChapter(e)}
        startVerse={startVerse}
        onSelectStartVerse={(v) => setStartVerse(v)}
        endVerse={endVerse}
        onSelectEndVerse={(v) => setEndVerse(v)}
      />
    </div>
  );
};
