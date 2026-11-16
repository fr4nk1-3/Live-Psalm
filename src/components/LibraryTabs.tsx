import React, { useState, useEffect } from 'react';
import { Song, MediaAsset, Theme, AnnouncementItem, QuickPinnedItem, Slide, PlaylistItem } from '../types/presentation';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { OnlineBibleApiService, OnlineBibleVersion } from '../services/onlineBibleApi';
import { ImporterService } from '../services/importer';
import { MediaVaultService } from '../services/mediaVault';
import { BibleVersionModal, getBibleLanguageGroup, LanguageGroup } from './BibleVersionModal';
import { BibleBookVerseModal } from './BibleBookVerseModal';
import { SongEditorModal } from './SongEditorModal';
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

const QUICK_BIBLE_VERSIONS = [
  { id: 'bible-eng-nkjv', abbr: 'NKJV', lang: 'EN' },
  { id: 'bible-eng-kjv', abbr: 'KJV', lang: 'EN' },
  { id: 'bible-eng-niv', abbr: 'NIV', lang: 'EN' },
  { id: 'bible-eng-amp', abbr: 'AMP', lang: 'EN' },
  { id: 'bible-eng-esv', abbr: 'ESV', lang: 'EN' },
  { id: 'bible-eng-nlt', abbr: 'NLT', lang: 'EN' },
  { id: 'bible-eng-tpt', abbr: 'TPT', lang: 'EN' },
  { id: 'bible-swh-suv', abbr: 'SUV (Swahili)', lang: 'KE' },
  { id: 'bible-kik-gky19', abbr: 'GKY19 (Kikuyu)', lang: 'KE' },
  { id: 'bible-luo-luo20', abbr: 'LUO20 (Luo)', lang: 'KE' },
  { id: 'bible-kal-klj19', abbr: 'KLJ19 (Kalenjin)', lang: 'KE' },
  { id: 'bible-kam-kmb', abbr: 'KMB (Kamba)', lang: 'KE' },
  { id: 'bible-mas-mas20', abbr: 'MAS20 (Maasai)', lang: 'KE' }
];

interface LibraryTabsProps {
  songs: Song[];
  media: MediaAsset[];
  themes: Theme[];
  activeThemeId: string;
  quickPinnedItems?: QuickPinnedItem[];
  primaryTranslationId?: string;
  activeTranslationId?: string;
  parallelTranslationId?: string | null;
  targetParallelVersionId?: string | null;
  activeBibleBook?: string;
  activeBibleChapter?: number;
  onSelectTargetParallelVersion?: (versionId: string | null) => void;
  onTranslateActiveBible?: (targetVersionId?: string) => void;
  onChangeBibleTranslations?: (primaryId: string, parallelId: string | null) => void;
  onSelectBibleVerseInChapter?: (
    passageRef: string,
    allChapterSlides: Slide[],
    targetSlide?: Slide,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => void;
  onAddSongToPlaylist: (song: Song) => void;
  onAddBibleToPlaylist: (passageRef: string, slides: any[], bibleMeta?: PlaylistItem['bibleMeta']) => void;
  onAddBiblePassageAndGoLive?: (
    passageRef: string,
    slides: any[],
    targetSlide?: any,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => void;
  onAppendSlidesToActiveItem?: (slides: any[], titleRef?: string) => void;
  onPinToQuickSection?: (
    title: string,
    slides: any[],
    type?: 'bible' | 'song' | 'announcement',
    sourceRef?: string,
    targetSlide?: Slide,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => void;
  onUnpinFromQuickSection?: (pinIdOrTitle: string) => void;
  onAddMediaToPlaylist: (media: MediaAsset) => void;
  onAddMediaToCatalogOnly?: (media: MediaAsset) => void;
  onDeleteMediaAsset?: (id: string) => void;
  activeBackgroundUrl?: string | null;
  onClearBackground?: () => void;
  onSetMediaAsBackground?: (media: MediaAsset) => void;
  onPlayVideoNow?: (media: MediaAsset) => void;
  /** Set video as background for ALL slides of the currently active playlist item */
  onSetVideoBackgroundForItem?: (media: MediaAsset) => void;
  /** Set video as the persistent global background behind the entire service */
  onSetGlobalVideoBackground?: (media: MediaAsset) => void;
  onSelectTheme: (themeId: string) => void;
  onGoLiveWithSlide: (slide: any) => void;
  activeLowerThirdText?: {
    id?: string;
    title?: string;
    subtitle?: string;
    content?: string;
    speed?: 'slow' | 'normal' | 'fast';
  } | null;
  onClearLowerThirdAnnouncement?: () => void;
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
  primaryTranslationId,
  activeTranslationId,
  parallelTranslationId,
  targetParallelVersionId = null,
  activeBibleBook,
  activeBibleChapter,
  onSelectTargetParallelVersion,
  onTranslateActiveBible,
  onChangeBibleTranslations,
  onSelectBibleVerseInChapter,
  onAddSongToPlaylist,
  onAddBibleToPlaylist,
  onAddBiblePassageAndGoLive,
  onAppendSlidesToActiveItem,
  onPinToQuickSection,
  onUnpinFromQuickSection,
  onAddMediaToPlaylist,
  onAddMediaToCatalogOnly,
  onDeleteMediaAsset,
  activeBackgroundUrl,
  onClearBackground,
  onSetMediaAsBackground,
  onPlayVideoNow,
  onSetVideoBackgroundForItem,
  onSetGlobalVideoBackground,
  onSelectTheme,
  onGoLiveWithSlide,
  activeLowerThirdText = null,
  onClearLowerThirdAnnouncement,
  onTriggerLowerThirdAnnouncement,
  onAddNewSong,
  onUpdateSong,
  onDeleteSong
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'bible' | 'announcements' | 'media' | 'themes'>('songs');
  const [mediaSubMode, setMediaSubMode] = useState<'backgrounds' | 'foreground'>('backgrounds');
  const [mediaSearch, setMediaSearch] = useState('');
  const [bgTargetScope, setBgTargetScope] = useState<'global' | 'item' | 'slide'>('global');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // App Settings
  const settings = StorageService.getSettings();

  // Songs Search & Modal State
  const [songSearch, setSongSearch] = useState('');
  const [showSongModal, setShowSongModal] = useState(false);
  const [editingSongObj, setEditingSongObj] = useState<Song | null>(null);

  // Announcements / Ticker State & Handlers
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(() => StorageService.getAnnouncements());
  const [annQuery, setAnnQuery] = useState('');
  const [quickTickerInput, setQuickTickerInput] = useState('');
  const [tickerSpeed, setTickerSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [selectedTickerIds, setSelectedTickerIds] = useState<string[]>([]);
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
  const [primaryTranslation, setPrimaryTranslation] = useState<string>(
    StorageService.resolveTranslationId(primaryTranslationId || activeTranslationId || 'bible-eng-nkjv')
  );
  const [selectedTranslation, setSelectedTranslation] = useState<string>(
    StorageService.resolveTranslationId(activeTranslationId || 'bible-eng-nkjv')
  );
  const [parallelTranslation, setParallelTranslation] = useState<string | null>(
    targetParallelVersionId ? StorageService.resolveTranslationId(targetParallelVersionId) : null
  );
  const [bibleBook, setBibleBook] = useState(activeBibleBook || 'John');
  const [bibleChapter, setBibleChapter] = useState(activeBibleChapter || 3);
  const [entireChapter, setEntireChapter] = useState(true);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(999);
  const [chapterMaxVerse, setChapterMaxVerse] = useState(999);
  const [verseJumpQuery, setVerseJumpQuery] = useState('');
  const [chapterPassage, setChapterPassage] = useState<any | null>(null);
  const [chapterSlides, setChapterSlides] = useState<Slide[]>([]);
  const [isPassageLoading, setIsPassageLoading] = useState(false);
  const [showBibleImportModal, setShowBibleImportModal] = useState(false);
  const [importBibleName, setImportBibleName] = useState('');
  const [importBibleAbbr, setImportBibleAbbr] = useState('');
  const [bibleKeywordSearch, setBibleKeywordSearch] = useState('');

  // Version & Book Modal States
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isParallelVersionModalOpen, setIsParallelVersionModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  // Sync when parent primaryTranslationId / activeTranslationId / targetParallelVersionId changes
  useEffect(() => {
    if (primaryTranslationId) {
      const resolvedPrim = StorageService.resolveTranslationId(primaryTranslationId);
      if (resolvedPrim !== primaryTranslation) {
        setPrimaryTranslation(resolvedPrim);
      }
    }
  }, [primaryTranslationId]);

  useEffect(() => {
    if (activeTranslationId) {
      const resolved = StorageService.resolveTranslationId(activeTranslationId);
      if (resolved !== selectedTranslation) {
        setSelectedTranslation(resolved);
      }
    }
  }, [activeTranslationId]);

  useEffect(() => {
    const resolvedPar = targetParallelVersionId
      ? StorageService.resolveTranslationId(targetParallelVersionId)
      : null;
    if (resolvedPar !== parallelTranslation) {
      setParallelTranslation(resolvedPar);
    }
    if (resolvedPar) {
      StorageService.loadBibleById(resolvedPar).catch(() => {});
    }
  }, [targetParallelVersionId]);

  // Keep Bible Sidebar book & chapter in sync when user switches active Bible item / pin in CenterWorkspace
  useEffect(() => {
    if (activeBibleBook && activeBibleChapter) {
      if (activeBibleBook !== bibleBook || activeBibleChapter !== bibleChapter) {
        setBibleBook(activeBibleBook);
        setBibleChapter(activeBibleChapter);
      }
    }
  }, [activeBibleBook, activeBibleChapter]);

  const handleSelectPrimaryTranslation = (id: string) => {
    const resolved = StorageService.resolveTranslationId(id);
    setPrimaryTranslation(resolved);
    setSelectedTranslation(resolved);
    if (parallelTranslation === resolved) {
      setParallelTranslation(null);
      if (onSelectTargetParallelVersion) onSelectTargetParallelVersion(null);
    }
    if (onChangeBibleTranslations) {
      onChangeBibleTranslations(resolved, null);
    }
  };

  const handleSelectParallelTranslation = (id: string | null) => {
    const resolved = id ? StorageService.resolveTranslationId(id) : null;
    const cleanParallel = resolved && resolved !== primaryTranslation ? resolved : null;
    setParallelTranslation(cleanParallel);
    if (cleanParallel) {
      StorageService.loadBibleById(cleanParallel).catch(() => {});
    }
    if (onSelectTargetParallelVersion) {
      onSelectTargetParallelVersion(cleanParallel);
    }
  };

  /** Click-to-Translate button handler: switches between Primary and Parallel Translation */
  const handleTranslateToParallelNow = (specificVerseSlide?: Slide, goLive?: boolean) => {
    if (!parallelTranslation) return;

    // If currently displaying Primary, translate to Parallel; if already on Parallel, translate back to Primary
    const targetId =
      selectedTranslation === parallelTranslation ? primaryTranslation : parallelTranslation;

    setSelectedTranslation(targetId);

    if (specificVerseSlide) {
      const sVerse = entireChapter ? 1 : startVerse;
      const eVerse = entireChapter ? 999 : endVerse;
      StorageService.buildBiblePassageSlidesAsync(
        bibleBook,
        bibleChapter,
        sVerse,
        eVerse,
        targetId,
        null
      ).then(built => {
        if (built && built.passage && built.slides.length > 0) {
          setChapterPassage(built.passage);
          setChapterSlides(built.slides);
          const vNum = specificVerseSlide.bibleMeta?.verse;
          const translatedVerseSlide =
            built.slides.find(s => s.bibleMeta?.verse === vNum) || built.slides[0];
          const meta: PlaylistItem['bibleMeta'] = {
            book: built.passage.book,
            chapter: built.passage.chapter,
            startVerse: sVerse,
            endVerse: eVerse,
            translationId: targetId
          };
          if (goLive && onAddBiblePassageAndGoLive) {
            onAddBiblePassageAndGoLive(built.passage.formattedRef, built.slides, translatedVerseSlide, meta);
          } else if (onSelectBibleVerseInChapter) {
            onSelectBibleVerseInChapter(built.passage.formattedRef, built.slides, translatedVerseSlide, meta);
          }
        }
      });
    } else if (onTranslateActiveBible) {
      onTranslateActiveBible(targetId);
    } else if (onChangeBibleTranslations) {
      onChangeBibleTranslations(targetId, null);
    }
  };

  const preloadedManifest = StorageService.getPreloadedManifestList();

  const resolveVersionDisplayInfo = React.useCallback(
    (transId: string | null) => {
      if (!transId) return null;
      const resolved = StorageService.resolveTranslationId(transId);
      const manifestMatch = preloadedManifest.find(
        m => m.id === resolved || m.abbreviation.toLowerCase() === resolved.toLowerCase()
      );
      if (manifestMatch) {
        const cat = getBibleLanguageGroup(manifestMatch.name, manifestMatch.abbreviation, manifestMatch.id);
        return {
          id: manifestMatch.id,
          name: manifestMatch.name,
          abbreviation: manifestMatch.abbreviation,
          category: cat,
          flag: cat === 'English' ? '🇬🇧' : '🇰🇪'
        };
      }

      const customMatch = customBibles.find(
        cb => cb.id === resolved || cb.abbreviation.toLowerCase() === resolved.toLowerCase()
      );
      if (customMatch) {
        const cat = getBibleLanguageGroup(customMatch.name, customMatch.abbreviation, customMatch.id);
        return {
          id: customMatch.id,
          name: customMatch.name,
          abbreviation: customMatch.abbreviation,
          category: cat,
          flag: cat === 'English' ? '🇬🇧' : '🇰🇪'
        };
      }

      const apiMatch = onlineVersions.find(ov => ov.id === resolved);
      if (apiMatch) {
        return {
          id: apiMatch.id,
          name: `${apiMatch.version} (API Online)`,
          abbreviation: (apiMatch as any).abbreviation || 'API',
          category: 'API Online' as LanguageGroup,
          flag: '🌐'
        };
      }

      return {
        id: resolved,
        name: resolved === 'kjv' ? 'King James Version (KJV)' : resolved,
        abbreviation: resolved.toUpperCase(),
        category: 'English' as LanguageGroup,
        flag: '🇬🇧'
      };
    },
    [preloadedManifest, customBibles, onlineVersions]
  );

  const primaryVersionInfo = React.useMemo(
    () => resolveVersionDisplayInfo(primaryTranslation)!,
    [primaryTranslation, resolveVersionDisplayInfo]
  );

  const parallelVersionInfo = React.useMemo(
    () => resolveVersionDisplayInfo(parallelTranslation),
    [parallelTranslation, resolveVersionDisplayInfo]
  );

  const activeVersionInfo = React.useMemo(
    () => resolveVersionDisplayInfo(selectedTranslation)!,
    [selectedTranslation, resolveVersionDisplayInfo]
  );

  const bibleKeywordResults = React.useMemo(() => {
    if (!bibleKeywordSearch.trim()) return [];
    return StorageService.searchBibleVerses(bibleKeywordSearch, selectedTranslation);
  }, [bibleKeywordSearch, selectedTranslation]);

  // Media Category Filter
  const [mediaCategory, setMediaCategory] = useState<string>('All');

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(songSearch.toLowerCase()))
  );

  const filteredMedia = mediaCategory === 'All' 
    ? media 
    : media.filter(m => m.category === mediaCategory);

  const handleSaveSongFromModal = (
    song: Song,
    action: 'library' | 'playlist' | 'golive'
  ) => {
    if (editingSongObj) {
      onUpdateSong(song);
    } else {
      onAddNewSong(song);
    }
    if (action === 'playlist') {
      onAddSongToPlaylist(song);
    } else if (action === 'golive') {
      onAddSongToPlaylist(song);
      const slides = ImporterService.songToSlides(song);
      if (slides.length > 0) {
        onGoLiveWithSlide(slides[0]);
      }
    }
    setEditingSongObj(null);
    setShowSongModal(false);
  };

  const handleStartEditSong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSongObj(song);
    setShowSongModal(true);
  };

  const handleStartNewSong = () => {
    setEditingSongObj(null);
    setShowSongModal(true);
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

      const built = await StorageService.buildBiblePassageSlidesAsync(
        bibleBook,
        bibleChapter,
        sVerse,
        eVerse,
        selectedTranslation,
        null
      );

      if (built && built.slides.length > 0) {
        setChapterPassage(built.passage);
        setChapterSlides(built.slides);
        if (entireChapter && built.passage?.verses?.length) {
          const maxV = built.passage.verses[built.passage.verses.length - 1].number;
          setChapterMaxVerse(maxV);
          setEndVerse(maxV);
        }
      } else if (settings.apiBibleEnabled) {
        const apiPassage = await OnlineBibleApiService.fetchPassage(
          selectedTranslation,
          bibleBook,
          bibleChapter,
          sVerse,
          eVerse
        );
        if (apiPassage && apiPassage.verses) {
          setChapterPassage(apiPassage);
          const apiSlides: Slide[] = apiPassage.verses.map((v: any) => ({
            id: `slide-bv-${apiPassage.book}-${apiPassage.chapter}-${v.number}`,
            title: `${apiPassage.book} ${apiPassage.chapter}:${v.number}`,
            content: v.text,
            subtitle: `${apiPassage.book} ${apiPassage.chapter}:${v.number} (${apiPassage.translation})`,
            sectionLabel: 'Scripture' as const,
            bibleMeta: {
              book: apiPassage.book,
              chapter: apiPassage.chapter,
              verse: v.number,
              translationId: selectedTranslation,
              parallelTranslationId: parallelTranslation || undefined
            }
          }));
          setChapterSlides(apiSlides);
        } else {
          setChapterPassage(null);
          setChapterSlides([]);
        }
      } else {
        setChapterPassage(null);
        setChapterSlides([]);
      }
    } catch (e) {
      console.error('Error fetching chapter preview:', e);
    } finally {
      setIsPassageLoading(false);
    }
  };

  useEffect(() => {
    handleFetchChapterPreview();
  }, [bibleBook, bibleChapter, selectedTranslation, parallelTranslation, entireChapter, startVerse, endVerse, settings.apiBibleEnabled]);

  const currentBibleMeta: PlaylistItem['bibleMeta'] = {
    book: chapterPassage?.book || bibleBook,
    chapter: chapterPassage?.chapter || bibleChapter,
    startVerse: entireChapter ? 1 : startVerse,
    endVerse: entireChapter ? 999 : endVerse,
    translationId: selectedTranslation,
    parallelTranslationId: parallelTranslation || undefined
  };

  const handleBibleSearch = async () => {
    setIsPassageLoading(true);
    try {
      const sVerse = entireChapter ? 1 : startVerse;
      const eVerse = entireChapter ? 999 : endVerse;

      let slidesToUse = chapterSlides;
      let passageToUse = chapterPassage;

      if (!passageToUse || slidesToUse.length === 0) {
        const built = await StorageService.buildBiblePassageSlidesAsync(
          bibleBook,
          bibleChapter,
          sVerse,
          eVerse,
          selectedTranslation,
          parallelTranslation
        );
        if (built && built.slides.length > 0) {
          passageToUse = built.passage;
          slidesToUse = built.slides;
          setChapterPassage(built.passage);
          setChapterSlides(built.slides);
        }
      }

      if (passageToUse && slidesToUse && slidesToUse.length > 0) {
        const meta: PlaylistItem['bibleMeta'] = {
          book: passageToUse.book,
          chapter: passageToUse.chapter,
          startVerse: sVerse,
          endVerse: eVerse,
          translationId: selectedTranslation,
          parallelTranslationId: parallelTranslation || undefined
        };

        if (onPinToQuickSection) {
          onPinToQuickSection(passageToUse.formattedRef, slidesToUse, 'bible', passageToUse.formattedRef, undefined, meta);
        } else if (onAppendSlidesToActiveItem) {
          onAppendSlidesToActiveItem(slidesToUse, passageToUse.formattedRef);
        } else {
          onAddBibleToPlaylist(passageToUse.formattedRef, slidesToUse, meta);
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
    <div className="w-64 xl:w-72 2xl:w-80 bg-[#0d1320] border-r border-[#26334a] flex flex-col h-full min-h-0 select-none shrink-0 transition-[width] duration-150">
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

        {/* BIBLE TAB */}
        {activeTab === 'bible' && (
          <div className="space-y-2.5 text-xs">
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
                  <span>{bibleKeywordResults.length} found</span>
                </div>
                {bibleKeywordResults.map((res, idx) => (
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
                            id: `slide-bv-${res.book}-${res.chapter}-${res.verse}`,
                            title: res.formattedRef,
                            content: res.text,
                            subtitle: res.translation,
                            sectionLabel: 'Scripture',
                            bibleMeta: {
                              book: res.book,
                              chapter: res.chapter,
                              verse: res.verse,
                              translationId: selectedTranslation
                            }
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
                              id: `slide-bv-${res.book}-${res.chapter}-${res.verse}`,
                              title: res.formattedRef,
                              content: res.text,
                              subtitle: res.translation,
                              sectionLabel: 'Scripture',
                              bibleMeta: {
                                book: res.book,
                                chapter: res.chapter,
                                verse: res.verse,
                                translationId: selectedTranslation
                              }
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

            {/* Bible Lookup Form Trigger Cards */}
            <div className="space-y-2.5 bg-[#121929] border border-slate-800 p-3 rounded-xl shadow-md">
              {/* 1. PRIMARY TRANSLATION CARD */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Primary Translation
                  </label>
                  <span className={`text-[9px] font-bold flex items-center gap-1 whitespace-nowrap ${settings.apiBibleEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Globe className="w-2.5 h-2.5" /> {settings.apiBibleEnabled ? 'API Online' : 'Offline Library'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVersionModalOpen(true)}
                  className={`w-full bg-[#0b101b] hover:bg-[#152033] border rounded-xl px-2.5 py-2 text-left flex items-center justify-between gap-2 transition group cursor-pointer ${
                    selectedTranslation === primaryVersionInfo.id
                      ? 'border-amber-500/80 hover:border-amber-400'
                      : 'border-slate-700 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase shrink-0 whitespace-nowrap">
                      {primaryVersionInfo.flag} {primaryVersionInfo.abbreviation}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-xs truncate group-hover:text-amber-300 transition">
                        {primaryVersionInfo.name}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        {selectedTranslation === primaryVersionInfo.id ? 'Currently active' : 'Primary version'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Search className="w-3 h-3" /> Change
                  </span>
                </button>
              </div>

              {/* 2. PARALLEL TRANSLATION CARD (Directly below Primary Translation) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Parallel Translation
                  </label>
                  {parallelVersionInfo && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectParallelTranslation(null);
                        if (selectedTranslation !== primaryVersionInfo.id) {
                          setSelectedTranslation(primaryVersionInfo.id);
                          if (onChangeBibleTranslations) {
                            onChangeBibleTranslations(primaryVersionInfo.id, null);
                          }
                        }
                      }}
                      className="text-[9px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-2.5 h-2.5" /> Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsParallelVersionModalOpen(true)}
                  className={`w-full bg-[#0b101b] hover:bg-[#152033] border rounded-xl px-2.5 py-2 text-left flex items-center justify-between gap-2 transition group cursor-pointer ${
                    parallelVersionInfo && selectedTranslation === parallelVersionInfo.id
                      ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                      : 'border-purple-500/40 hover:border-purple-400'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase shrink-0 whitespace-nowrap">
                      {parallelVersionInfo ? `${parallelVersionInfo.flag} ${parallelVersionInfo.abbreviation}` : 'NONE'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-xs truncate group-hover:text-purple-300 transition">
                        {parallelVersionInfo ? parallelVersionInfo.name : 'Choose Parallel Bible'}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        {parallelVersionInfo
                          ? selectedTranslation === parallelVersionInfo.id
                            ? 'Currently active'
                            : 'Ready to translate'
                          : 'Optional secondary version'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Search className="w-3 h-3" /> {parallelVersionInfo ? 'Change' : 'Select'}
                  </span>
                </button>
              </div>

              {/* 3. TRANSLATE BUTTON (Shown directly below Parallel Translation if Parallel Translation is selected) */}
              {parallelVersionInfo && (
                <button
                  type="button"
                  onClick={() => handleTranslateToParallelNow()}
                  className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-[11px] uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Translate active chapter & live verse between Primary and Parallel Translation"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {selectedTranslation === parallelVersionInfo.id
                      ? `Translate to ${primaryVersionInfo.abbreviation} (Primary)`
                      : `Translate to ${parallelVersionInfo.abbreviation}`}
                  </span>
                </button>
              )}

              {/* 4. SCRIPTURE BOOK CARD (Launches BibleBookVerseModal) */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Scripture Book
                </label>
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(true)}
                  className="w-full bg-[#0b101b] hover:bg-[#152033] border border-indigo-500/40 hover:border-indigo-400 rounded-xl px-2.5 py-2 text-left flex items-center justify-between gap-2 transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase shrink-0 whitespace-nowrap flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Book
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition">
                        {bibleBook}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        Chapter {bibleChapter}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Book className="w-3 h-3" /> Change
                  </span>
                </button>
              </div>

              {/* 5. CHAPTER & VERSE RANGE */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Chapter &amp; Verses
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEntireChapter(prev => {
                        const next = !prev;
                        if (!next && chapterMaxVerse < 999) {
                          setEndVerse(chapterMaxVerse);
                        }
                        return next;
                      });
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition whitespace-nowrap ${
                      entireChapter
                        ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/40'
                        : 'bg-amber-600/25 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {entireChapter ? 'Full Chapter' : 'Verse Range'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className={entireChapter ? 'col-span-3' : ''}>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Chapter</label>
                    <input
                      type="number"
                      min={1}
                      value={bibleChapter}
                      onChange={(e) => setBibleChapter(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg p-1.5 text-white text-center font-bold outline-none"
                    />
                  </div>
                  {!entireChapter && (
                    <>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">From</label>
                        <input
                          type="number"
                          min={1}
                          value={startVerse}
                          onChange={(e) => setStartVerse(parseInt(e.target.value) || 1)}
                          className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg p-1.5 text-white text-center font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">To</label>
                        <input
                          type="number"
                          min={1}
                          value={endVerse}
                          onChange={(e) => setEndVerse(parseInt(e.target.value) || 1)}
                          className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg p-1.5 text-white text-center font-bold outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 6. CHAPTER ACTIONS */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
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
                        className="py-2 bg-amber-600/35 hover:bg-rose-600 text-amber-200 hover:text-white font-bold rounded-lg border border-amber-500/40 flex items-center justify-center gap-1 transition text-[11px]"
                        title="Unpin chapter from Quick Section"
                      >
                        <PinOff className="w-3.5 h-3.5" /> Unpin Chapter
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
                    if (chapterPassage && chapterSlides.length > 0) {
                      onAddBibleToPlaylist(chapterPassage.formattedRef, chapterSlides, currentBibleMeta);
                    }
                  }}
                  disabled={isPassageLoading}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition disabled:opacity-50 text-[11px]"
                  title="Add as new playlist item"
                >
                  <Plus className="w-3.5 h-3.5" /> New Item
                </button>
              </div>

              {/* Full Chapter Verses Preview List */}
              {chapterPassage && chapterSlides.length > 0 && (() => {
                const trimmedJump = verseJumpQuery.trim().toLowerCase();
                const filteredChapterSlides = trimmedJump
                  ? chapterSlides.filter((vs, idx) => {
                      const vNum = String(vs.bibleMeta?.verse ?? idx + 1);
                      return (
                        vNum.startsWith(trimmedJump) ||
                        vs.content.toLowerCase().includes(trimmedJump)
                      );
                    })
                  : chapterSlides;

                return (
                  <div className="mt-2 border-t border-slate-800 pt-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider truncate">
                        {chapterPassage.formattedRef} ({StorageService.getTranslationAbbreviation(selectedTranslation)})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-semibold shrink-0">
                        {filteredChapterSlides.length}/{chapterSlides.length}v
                      </span>
                    </div>

                    {/* Quick Verse Filter / Jump */}
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Filter by verse # or word (e.g. 16)..."
                        value={verseJumpQuery}
                        onChange={(e) => setVerseJumpQuery(e.target.value)}
                        className="w-full bg-[#0b101b] border border-slate-800 focus:border-amber-500/60 rounded-lg pl-7 pr-7 py-1 text-[11px] text-slate-100 placeholder-slate-500 outline-none"
                      />
                      {verseJumpQuery && (
                        <button
                          type="button"
                          onClick={() => setVerseJumpQuery('')}
                          className="absolute right-2 top-1.5 text-slate-500 hover:text-white"
                          title="Clear verse filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                      {filteredChapterSlides.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-[11px] text-slate-500">
                          No verses match "{verseJumpQuery}".
                        </div>
                      ) : (
                        filteredChapterSlides.map((verseSlide, vIdx) => {
                          const verseNum = verseSlide.bibleMeta?.verse ?? (vIdx + 1);
                          const verseRef = `${chapterPassage.book} ${chapterPassage.chapter}:${verseNum}`;
                          const isVersePinned = quickPinnedItems.some(p => p.title === verseRef);

                          return (
                            <div
                              key={verseSlide.id}
                              onClick={() => {
                                if (onSelectBibleVerseInChapter) {
                                  onSelectBibleVerseInChapter(
                                    chapterPassage.formattedRef,
                                    chapterSlides,
                                    verseSlide,
                                    currentBibleMeta
                                  );
                                } else if (onPinToQuickSection) {
                                  onPinToQuickSection(
                                    chapterPassage.formattedRef,
                                    chapterSlides,
                                    'bible',
                                    chapterPassage.formattedRef,
                                    verseSlide,
                                    currentBibleMeta
                                  );
                                }
                              }}
                              onDoubleClick={() => {
                                if (onAddBiblePassageAndGoLive) {
                                  onAddBiblePassageAndGoLive(
                                    chapterPassage.formattedRef,
                                    chapterSlides,
                                    verseSlide,
                                    currentBibleMeta
                                  );
                                }
                              }}
                              className="p-2.5 bg-[#0b101b] hover:bg-[#152033] border border-slate-800/90 hover:border-amber-500/40 rounded-xl text-left transition group cursor-pointer space-y-1.5"
                              title="Click to select verse • Double-click or click Live to project and step through chapter"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-black shrink-0 whitespace-nowrap">
                                  v.{verseNum}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isVersePinned ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onUnpinFromQuickSection) onUnpinFromQuickSection(verseRef);
                                      }}
                                      className="bg-amber-600/30 hover:bg-rose-600 text-amber-200 hover:text-white border border-amber-500/40 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase flex items-center gap-0.5 transition whitespace-nowrap"
                                      title="Unpin verse from Quick Section"
                                    >
                                      <PinOff className="w-2.5 h-2.5" /> Pinned
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onPinToQuickSection) {
                                          onPinToQuickSection(
                                            chapterPassage.formattedRef,
                                            chapterSlides,
                                            'bible',
                                            chapterPassage.formattedRef,
                                            verseSlide,
                                            currentBibleMeta
                                          );
                                        } else if (onAppendSlidesToActiveItem) {
                                          onAppendSlidesToActiveItem(chapterSlides, chapterPassage.formattedRef);
                                        }
                                      }}
                                      className="bg-slate-800/90 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase flex items-center gap-0.5 transition whitespace-nowrap"
                                      title="Pin chapter at this verse to Quick Section"
                                    >
                                      <Pin className="w-2.5 h-2.5" /> Pin
                                    </button>
                                  )}

                                  {parallelVersionInfo && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTranslateToParallelNow(verseSlide, true);
                                      }}
                                      className="bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase flex items-center gap-0.5 transition whitespace-nowrap"
                                      title={`Translate this verse to ${
                                        selectedTranslation === parallelVersionInfo.id
                                          ? primaryVersionInfo.abbreviation
                                          : parallelVersionInfo.abbreviation
                                      } and Go Live`}
                                    >
                                      <Globe className="w-2.5 h-2.5" />
                                      <span>
                                        {selectedTranslation === parallelVersionInfo.id
                                          ? primaryVersionInfo.abbreviation
                                          : parallelVersionInfo.abbreviation}
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onAddBiblePassageAndGoLive) {
                                        onAddBiblePassageAndGoLive(
                                          chapterPassage.formattedRef,
                                          chapterSlides,
                                          verseSlide,
                                          currentBibleMeta
                                        );
                                      }
                                    }}
                                    className="bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase flex items-center gap-0.5 shadow transition whitespace-nowrap"
                                    title="Go Live immediately with this verse (full chapter loaded for Next/Prev stepping)"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> Live
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">
                                {verseSlide.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* DEDICATED TICKER & ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (() => {
          const filteredAnnouncements = announcements.filter(
            a =>
              a.title.toLowerCase().includes(annQuery.toLowerCase()) ||
              a.content.toLowerCase().includes(annQuery.toLowerCase())
          );

          return (
            <div className="space-y-2.5">
              {/* Active Live Ticker Status Banner */}
              {activeLowerThirdText && (
                <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-400/60 space-y-1.5 shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-200 truncate">
                        Live: {activeLowerThirdText.title || 'Announcement'}
                      </span>
                    </div>
                    {onClearLowerThirdAnnouncement && (
                      <button
                        type="button"
                        onClick={onClearLowerThirdAnnouncement}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[10px] font-black uppercase flex items-center gap-1 transition shrink-0"
                      >
                        <X className="w-3 h-3" /> Stop
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-100 font-medium line-clamp-2 bg-[#0b101b] px-2 py-1.5 rounded-lg border border-purple-500/30">
                    {activeLowerThirdText.content}
                  </div>
                </div>
              )}

              {/* Search & Create Saved Announcement */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search saved tickers..."
                    value={annQuery}
                    onChange={(e) => setAnnQuery(e.target.value)}
                    className="w-full bg-[#182338] border border-[#26334a] focus:border-purple-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAnn(null);
                    setAnnTitle('');
                    setAnnSubtitle('');
                    setAnnContent('');
                    setShowAnnModal(true);
                  }}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg shadow flex items-center gap-1 shrink-0 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>

              {/* Quick Live Ticker Input (Instant Broadcast) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = quickTickerInput.trim();
                  if (!text || !onTriggerLowerThirdAnnouncement) return;
                  onTriggerLowerThirdAnnouncement({
                    id: `quick-ticker-${Date.now()}`,
                    title: 'LIVE NOTICE',
                    content: text,
                    speed: tickerSpeed
                  });
                  setQuickTickerInput('');
                }}
                className="p-2.5 bg-[#121929] border border-slate-800 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 whitespace-nowrap">
                    Quick Live Ticker
                  </span>
                  <div className="grid grid-cols-3 bg-[#0b101b] p-0.5 rounded-lg border border-slate-800 gap-0.5">
                    {(['slow', 'normal', 'fast'] as const).map(spd => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setTickerSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                          tickerSpeed === spd
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title={`Set crawl speed: ${spd}`}
                      >
                        {spd}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Type message & press Enter..."
                    value={quickTickerInput}
                    onChange={(e) => setQuickTickerInput(e.target.value)}
                    className="flex-1 min-w-0 bg-[#0b101b] border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!quickTickerInput.trim()}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" /> Go
                  </button>
                </div>
              </form>

              {/* Combined Multi-Ticker Action Bar */}
              {selectedTickerIds.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px]">
                  <span className="text-amber-200 font-bold truncate">
                    {selectedTickerIds.length} queued
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTickerIds([])}
                      className="px-2 py-1 text-slate-300 hover:text-white text-[10px] font-semibold"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const items = announcements.filter(a => selectedTickerIds.includes(a.id));
                        if (items.length === 0 || !onTriggerLowerThirdAnnouncement) return;
                        const combinedText = items
                          .map(a => `${a.title}: ${a.content}${a.subtitle ? ` (${a.subtitle})` : ''}`)
                          .join('   •   ');
                        onTriggerLowerThirdAnnouncement({
                          id: `combined-${selectedTickerIds.join('-')}`,
                          title: `UPDATES (${items.length})`,
                          content: combinedText,
                          speed: tickerSpeed
                        });
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 shadow whitespace-nowrap"
                    >
                      <Megaphone className="w-3 h-3" /> Run Combined
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Announcements / Tickers List */}
              {filteredAnnouncements.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No saved tickers match your search.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAnnouncements.map(ann => {
                    const annSlide = {
                      id: `slide-ann-${ann.id}`,
                      title: ann.title,
                      content: ann.content,
                      subtitle: ann.subtitle,
                      sectionLabel: 'Title'
                    };
                    const isThisTickerLive =
                      Boolean(activeLowerThirdText) &&
                      (activeLowerThirdText?.id === ann.id ||
                        (activeLowerThirdText?.title === ann.title &&
                          activeLowerThirdText?.content === ann.content.replace(/\r?\n/g, ' — ')));
                    const isQueued = selectedTickerIds.includes(ann.id);

                    return (
                      <div
                        key={ann.id}
                        className={`p-2.5 rounded-xl space-y-2 transition group border ${
                          isThisTickerLive
                            ? 'bg-purple-950/45 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.22)]'
                            : 'bg-[#121929] hover:bg-[#162034] border-slate-800 hover:border-purple-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isQueued}
                              onChange={() =>
                                setSelectedTickerIds(prev =>
                                  prev.includes(ann.id)
                                    ? prev.filter(id => id !== ann.id)
                                    : [...prev, ann.id]
                                )
                              }
                              className="accent-amber-500 rounded cursor-pointer shrink-0"
                              title="Include in combined multi-ticker crawl"
                            />
                            <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isThisTickerLive ? 'text-amber-300 animate-pulse' : 'text-purple-400'}`} />
                            <span className="text-xs font-bold text-white truncate">{ann.title}</span>
                            {isThisTickerLive && (
                              <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-black uppercase shrink-0">
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              type="button"
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
                              type="button"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-1 bg-rose-950/80 hover:bg-rose-900 text-rose-400 rounded"
                              title="Delete announcement"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {ann.subtitle && (
                          <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider truncate">
                            {ann.subtitle}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed bg-[#0b101b] px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                          {ann.content}
                        </div>

                        {/* Uniform 3-Column Action Bar */}
                        <div className={`grid gap-1.5 pt-0.5 ${onAppendSlidesToActiveItem ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          {isThisTickerLive && onClearLowerThirdAnnouncement ? (
                            <button
                              type="button"
                              onClick={onClearLowerThirdAnnouncement}
                              className="py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] uppercase flex items-center justify-center gap-1 transition whitespace-nowrap"
                              title="Stop live ticker"
                            >
                              <X className="w-3 h-3 shrink-0" /> Stop
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onTriggerLowerThirdAnnouncement) {
                                  onTriggerLowerThirdAnnouncement({
                                    id: ann.id,
                                    title: ann.title,
                                    subtitle: ann.subtitle,
                                    content: ann.content,
                                    speed: tickerSpeed
                                  });
                                }
                              }}
                              className="py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[10px] uppercase flex items-center justify-center gap-1 transition whitespace-nowrap"
                              title="Trigger continuous marquee crawl ticker"
                            >
                              <Megaphone className="w-3 h-3 shrink-0" /> Ticker
                            </button>
                          )}

                          {onAppendSlidesToActiveItem && (
                            <button
                              type="button"
                              onClick={() => onAppendSlidesToActiveItem([annSlide], `Announcement: ${ann.title}`)}
                              className="py-1.5 px-2 bg-emerald-600/25 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/35 font-bold rounded-lg text-[10px] uppercase transition flex items-center justify-center gap-1 whitespace-nowrap"
                              title="Append slide to active item"
                            >
                              <Layers className="w-3 h-3 shrink-0" /> Append
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onAddBibleToPlaylist(`Announcement: ${ann.title}`, [annSlide]);
                            }}
                            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-lg text-[10px] uppercase transition flex items-center justify-center gap-1 whitespace-nowrap"
                            title="Add slide to service playlist"
                          >
                            <Plus className="w-3 h-3 shrink-0" /> Slide
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* MEDIA TAB — PROPRESENTER 2-MODE WORKFLOW (MOTION BACKGROUNDS vs FOREGROUND CLIPS) */}
        {activeTab === 'media' && (() => {
          const visibleMedia = media.filter(m => {
            const matchesCat =
              mediaCategory === 'All'
                ? true
                : mediaCategory === 'Videos'
                ? m.type === 'video'
                : m.type !== 'video';
            const matchesSearch =
              !mediaSearch.trim() ||
              m.name.toLowerCase().includes(mediaSearch.trim().toLowerCase());
            return matchesCat && matchesSearch;
          });

          const videoCount = media.filter(m => m.type === 'video').length;
          const imageCount = media.filter(m => m.type !== 'video').length;

          return (
            <div className="space-y-3">
              {/* Top Mode Switcher: Motion Backgrounds vs. Media Clips */}
              <div className="grid grid-cols-2 bg-[#090d14] p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => setMediaSubMode('backgrounds')}
                  className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                    mediaSubMode === 'backgrounds'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Motion / BGs
                </button>
                <button
                  type="button"
                  onClick={() => setMediaSubMode('foreground')}
                  className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                    mediaSubMode === 'foreground'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" /> Media Clips
                </button>
              </div>

              {/* Unified Search + Upload Row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search media..."
                    value={mediaSearch}
                    onChange={e => setMediaSearch(e.target.value)}
                    className="w-full bg-[#182338] border border-[#26334a] focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
                <label
                  className={`px-2.5 py-1.5 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow transition shrink-0 ${
                    mediaSubMode === 'backgrounds'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                  title="Upload images or videos"
                >
                  {isUploadingMedia ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingMedia ? 'Adding...' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*,.mp4,.webm,.mov,.mkv"
                    multiple
                    onChange={async e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      setIsUploadingMedia(true);
                      try {
                        for (const file of files) {
                          const newAsset = await MediaVaultService.saveMediaFile(
                            file,
                            mediaSubMode === 'backgrounds' ? 'background' : 'foreground'
                          );
                          if (onAddMediaToCatalogOnly) {
                            onAddMediaToCatalogOnly(newAsset);
                          } else {
                            onAddMediaToPlaylist(newAsset);
                          }
                        }
                      } finally {
                        setIsUploadingMedia(false);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Uniform Filter Pills */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                {[
                  { id: 'All', label: `All (${media.length})` },
                  { id: 'Videos', label: `Videos (${videoCount})` },
                  { id: 'Backgrounds', label: `Images (${imageCount})` }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMediaCategory(cat.id)}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition text-center ${
                      mediaCategory === cat.id
                        ? 'bg-indigo-600/25 border-indigo-400 text-indigo-200'
                        : 'bg-[#121929] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Contextual Mode Controls */}
              {mediaSubMode === 'backgrounds' ? (
                <div className="bg-[#121929] border border-indigo-500/30 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                      Click Background Target:
                    </span>
                    {activeBackgroundUrl && onClearBackground && (
                      <button
                        type="button"
                        onClick={onClearBackground}
                        className="px-2 py-0.5 bg-rose-900/80 hover:bg-rose-700 text-rose-200 rounded text-[9px] font-bold uppercase flex items-center gap-1 transition"
                      >
                        <X className="w-2.5 h-2.5" /> Clear BG
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-[#090d14] p-1 rounded-lg border border-slate-800">
                    {[
                      { id: 'global', label: 'Live Layer' },
                      { id: 'item', label: 'Current Item' },
                      { id: 'slide', label: 'Selected Slide' }
                    ].map(scope => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setBgTargetScope(scope.id as any)}
                        className={`py-1 px-1 rounded text-[9px] font-bold transition text-center ${
                          bgTargetScope === scope.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#121929] border border-rose-500/30 rounded-xl px-2.5 py-2 flex items-center gap-2 text-[10px] text-slate-300">
                  <Film className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Plays fullscreen with audio &amp; opens the Broadcast Transport Deck.</span>
                </div>
              )}

              {/* Uniform 16:9 Media Grid */}
              {visibleMedia.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No media matches your filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {visibleMedia.map(item => {
                    const isActiveBg =
                      mediaSubMode === 'backgrounds' && activeBackgroundUrl === item.url;
                    const isVideo = item.type === 'video';

                    const applyBackground = () => {
                      if (bgTargetScope === 'global') {
                        if (isVideo && onSetGlobalVideoBackground) {
                          onSetGlobalVideoBackground(item);
                        } else if (onSetMediaAsBackground) {
                          onSetMediaAsBackground(item);
                        }
                      } else if (bgTargetScope === 'item') {
                        if (isVideo && onSetVideoBackgroundForItem) {
                          onSetVideoBackgroundForItem(item);
                        } else if (onSetMediaAsBackground) {
                          onSetMediaAsBackground(item);
                        }
                      } else {
                        if (onSetMediaAsBackground) onSetMediaAsBackground(item);
                      }
                    };

                    return (
                      <div
                        key={item.id}
                        draggable={mediaSubMode === 'backgrounds'}
                        onDragStart={e => {
                          if (mediaSubMode !== 'backgrounds') return;
                          e.dataTransfer.setData(
                            'application/livepsalms-media',
                            JSON.stringify(item)
                          );
                        }}
                        onClick={
                          mediaSubMode === 'backgrounds' ? applyBackground : undefined
                        }
                        className={`group rounded-xl overflow-hidden border transition-all flex flex-col bg-[#121929] ${
                          isActiveBg
                            ? 'border-emerald-400 ring-1 ring-emerald-400/50 shadow-[0_0_14px_rgba(52,211,153,0.3)]'
                            : mediaSubMode === 'backgrounds'
                            ? 'border-slate-800 hover:border-indigo-400 cursor-pointer'
                            : 'border-slate-800 hover:border-rose-500/60'
                        }`}
                      >
                        {/* Uniform 16:9 Preview */}
                        <div className="relative aspect-video w-full overflow-hidden bg-[#090d14]">
                          {isVideo ? (
                            <video
                              src={item.url}
                              className="w-full h-full object-cover pointer-events-none"
                              muted
                              loop={mediaSubMode === 'backgrounds'}
                              autoPlay={mediaSubMode === 'backgrounds'}
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none"
                            />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

                          {/* Top Badges */}
                          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                isActiveBg
                                  ? 'bg-emerald-500 text-black'
                                  : isVideo
                                  ? mediaSubMode === 'backgrounds'
                                    ? 'bg-indigo-600/90 text-white'
                                    : 'bg-rose-600/90 text-white'
                                  : 'bg-slate-900/90 text-slate-200 border border-slate-700'
                              }`}
                            >
                              {isVideo ? (
                                <Film className="w-2.5 h-2.5" />
                              ) : (
                                <Layers className="w-2.5 h-2.5" />
                              )}
                              {isActiveBg
                                ? 'Active BG'
                                : mediaSubMode === 'backgrounds'
                                ? isVideo
                                  ? 'Loop'
                                  : 'Still'
                                : isVideo
                                ? 'Video'
                                : 'Image'}
                            </span>

                            {onDeleteMediaAsset && item.id.startsWith('vault-') && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteMediaAsset(item.id);
                                }}
                                className="p-1 bg-black/75 hover:bg-rose-600 text-slate-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition"
                                title="Delete media"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Uniform Card Footer */}
                        <div className="p-2 flex flex-col gap-1.5 flex-1 justify-between">
                          <div className="text-[11px] font-semibold text-slate-100 truncate">
                            {item.name}
                          </div>

                          {mediaSubMode === 'backgrounds' ? (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                applyBackground();
                              }}
                              className={`w-full py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition ${
                                isActiveBg
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30'
                              }`}
                            >
                              {isActiveBg ? 'Applied' : 'Apply BG'}
                            </button>
                          ) : (
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onPlayVideoNow
                                    ? onPlayVideoNow(item)
                                    : onAddMediaToPlaylist(item)
                                }
                                className="py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[9px] font-black uppercase flex items-center justify-center gap-1 transition"
                                title="Present fullscreen on output now"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                {isVideo ? 'Play' : 'Present'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onAddMediaToPlaylist(item)}
                                className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition border border-slate-700"
                                title="Add to service playlist"
                              >
                                <Plus className="w-2.5 h-2.5" /> List
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* THEMES TAB */}
        {activeTab === 'themes' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
                Global Themes
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300">
                {themes.length} presets
              </span>
            </div>

            <div className="space-y-2">
              {themes.map(t => {
                const isSelected = t.id === activeThemeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTheme(t.id)}
                    className={`w-full text-left rounded-xl overflow-hidden border transition-all group ${
                      isSelected
                        ? 'border-indigo-400 ring-1 ring-indigo-400/50 bg-indigo-950/35 shadow-[0_0_14px_rgba(99,102,241,0.25)]'
                        : 'border-slate-800 hover:border-indigo-500/50 bg-[#121929]'
                    }`}
                  >
                    {/* Visual Mini Theme Preview */}
                    <div className="relative h-16 w-full overflow-hidden bg-[#090d14] flex items-center justify-center px-3">
                      {t.backgroundUrl && (
                        <img
                          src={t.backgroundUrl}
                          alt={t.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      )}
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: `rgba(0,0,0,${t.scrimOpacity})` }}
                      />

                      <div
                        className="relative z-10 w-full font-extrabold text-xs truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                        style={{
                          fontFamily: t.fontFamily,
                          color: t.textColor,
                          textAlign: t.align
                        }}
                      >
                        Amazing Grace, how sweet the sound
                      </div>

                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-black uppercase flex items-center gap-0.5 shadow">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>

                    {/* Theme Metadata Footer */}
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">
                          {t.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="truncate">{t.fontFamily}</span>
                          <span>•</span>
                          <span>{t.fontSize}px</span>
                          <span>•</span>
                          <span className="capitalize">{t.align}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.lowerThirdStyle && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[9px] font-bold text-emerald-300 uppercase">
                            L3
                          </span>
                        )}
                        <span
                          className="w-4 h-4 rounded-full border border-slate-600 shrink-0"
                          style={{ backgroundColor: t.accentColor }}
                          title={`Accent: ${t.accentColor}`}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
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

      {/* Bible Version Selection Modal Popup (Primary) */}
      <BibleVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        selectedTranslation={primaryTranslation}
        onSelectTranslation={(id) => handleSelectPrimaryTranslation(id)}
        customBibles={customBibles}
        onlineVersions={onlineVersions}
        apiBibleEnabled={settings.apiBibleEnabled}
      />

      {/* Bible Version Selection Modal Popup (Parallel Translation) */}
      <BibleVersionModal
        isOpen={isParallelVersionModalOpen}
        onClose={() => setIsParallelVersionModalOpen(false)}
        selectedTranslation={parallelTranslation || ''}
        onSelectTranslation={(id) => handleSelectParallelTranslation(id)}
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
        onToggleEntireChapter={(val) => {
          setEntireChapter(val);
          if (!val && chapterMaxVerse < 999) {
            setEndVerse(chapterMaxVerse);
          }
        }}
        startVerse={startVerse}
        onSelectStartVerse={(v) => setStartVerse(v)}
        endVerse={endVerse}
        onSelectEndVerse={(v) => setEndVerse(v)}
      />

      {/* User-Friendly Song Creation & Editing Modal */}
      <SongEditorModal
        isOpen={showSongModal}
        editingSong={editingSongObj}
        onClose={() => {
          setShowSongModal(false);
          setEditingSongObj(null);
        }}
        onSaveSong={handleSaveSongFromModal}
      />
    </div>
  );
};
