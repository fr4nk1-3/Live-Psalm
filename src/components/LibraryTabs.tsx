import React, { useState, useEffect } from 'react';
import { Song, MediaAsset, Theme, AnnouncementItem, QuickPinnedItem, Slide, PlaylistItem } from '../types/presentation';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { OnlineBibleApiService, OnlineBibleVersion } from '../services/onlineBibleApi';
import { ImporterService } from '../services/importer';
import { MediaVaultService } from '../services/mediaVault';
import { BibleVersionModal, getBibleLanguageGroup, LanguageGroup } from './BibleVersionModal';
import { BibleBookVerseModal } from './BibleBookVerseModal';
import { SongEditorModal } from './SongEditorModal';
import { Check, ChevronDown, MoreHorizontal, Play, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Field } from './ui/field';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { EmptyState, ListHeader } from './ui/primitives';

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
  const [perVerseOverrides, setPerVerseOverrides] = useState<Record<string, Slide>>({});
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

    if (specificVerseSlide) {
      const resolvedPrimary = StorageService.resolveTranslationId(primaryTranslation);
      const resolvedParallel = StorageService.resolveTranslationId(parallelTranslation);
      const currentVerseTrans = StorageService.resolveTranslationId(
        specificVerseSlide.bibleMeta?.translationId || selectedTranslation
      );
      const targetId = currentVerseTrans === resolvedParallel ? resolvedPrimary : resolvedParallel;
      const vBook = specificVerseSlide.bibleMeta?.book || bibleBook;
      const vChap = specificVerseSlide.bibleMeta?.chapter || bibleChapter;
      const vNum = specificVerseSlide.bibleMeta?.verse || 1;
      const verseKey = `${vBook}:${vChap}:${vNum}`;
      const verseRef = `${vBook} ${vChap}:${vNum}`;

      StorageService.translateSingleBibleSlideAsync(specificVerseSlide, targetId, null).then(
        translatedSlide => {
          if (!translatedSlide) return;
          setPerVerseOverrides(prev => ({ ...prev, [verseKey]: translatedSlide }));
          const singleMeta: PlaylistItem['bibleMeta'] = {
            book: vBook,
            chapter: vChap,
            startVerse: vNum,
            endVerse: vNum,
            translationId: targetId
          };
          if (goLive && onAddBiblePassageAndGoLive) {
            onAddBiblePassageAndGoLive(verseRef, [translatedSlide], translatedSlide, singleMeta);
          } else if (onSelectBibleVerseInChapter) {
            onSelectBibleVerseInChapter(verseRef, [translatedSlide], translatedSlide, singleMeta);
          }
        }
      );
      return;
    }

    // Chapter-wide translation toggle (when clicking main Translate button)
    const targetId =
      selectedTranslation === parallelTranslation ? primaryTranslation : parallelTranslation;
    setSelectedTranslation(targetId);
    setPerVerseOverrides({});

    if (onTranslateActiveBible) {
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

  /** Same version sources the version modals list, for the two compact selects. */
  const bibleVersionOptions = React.useMemo(() => {
    const options: { id: string; name: string; abbreviation: string }[] = [];
    const seen = new Set<string>();
    const add = (id: string, name?: string, abbreviation?: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      options.push({ id, name: name || id, abbreviation: abbreviation || name || id });
    };
    preloadedManifest.forEach(m => add(m.id, m.name, m.abbreviation));
    customBibles.forEach(cb => add(cb.id, cb.name, cb.abbreviation));
    onlineVersions.forEach(ov => add(ov.id, ov.version, (ov as any).abbreviation || 'API'));
    QUICK_BIBLE_VERSIONS.forEach(v => add(v.id, v.abbr, v.abbr));
    if (primaryVersionInfo) add(primaryVersionInfo.id, primaryVersionInfo.name, primaryVersionInfo.abbreviation);
    if (parallelVersionInfo) add(parallelVersionInfo.id, parallelVersionInfo.name, parallelVersionInfo.abbreviation);
    return options;
  }, [preloadedManifest, customBibles, onlineVersions, primaryVersionInfo, parallelVersionInfo]);

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
    setPerVerseOverrides({});
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
    <aside className="panel w-[300px] shrink-0 border-r border-border">
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as 'songs' | 'bible' | 'announcements' | 'media' | 'themes')
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex h-11 shrink-0 items-stretch border-b border-border px-3">
          <TabsList variant="underline" className="grid h-full w-full grid-cols-5 gap-0 border-b-0">
            {[
              { value: 'songs', label: 'Songs' },
              { value: 'bible', label: 'Bible' },
              { value: 'announcements', label: 'Ticker' },
              { value: 'media', label: 'Media' },
              { value: 'themes', label: 'Themes' }
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} variant="underline" className="px-0 text-[11px]">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* SONGS */}
        <TabsContent value="songs" className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search songs"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
                aria-label="Search songs"
              />
            </div>
            <Button size="xs" onClick={handleStartNewSong}>
              New song
            </Button>
          </div>

          {filteredSongs.length === 0 ? (
            <EmptyState
              title={songs.length === 0 ? 'No songs in the library' : 'No matching songs'}
              description={
                songs.length === 0
                  ? 'Add a song to build your worship sets.'
                  : 'Try a different title or artist.'
              }
              action={
                songs.length === 0 ? (
                  <Button size="xs" onClick={handleStartNewSong}>
                    New song
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-border/70 border-t border-border/70">
              {filteredSongs.map(song => {
                const isSongPinned = quickPinnedItems.some(p => p.title === song.title);
                return (
                  <div
                    key={song.id}
                    onClick={() => onAddSongToPlaylist(song)}
                    className="group flex cursor-pointer items-center gap-2 px-1 py-2 transition-colors hover:bg-accent/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{song.title}</div>
                      <div className="truncate text-2xs text-muted-foreground">
                        {song.artist || 'Traditional'} · {song.sections.length} sections
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-6 px-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddSongToPlaylist(song);
                        }}
                      >
                        Add
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Options for ${song.title}`}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onSelect={(event) => handleStartEditSong(song, event as unknown as React.MouseEvent)}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onAddSongToPlaylist(song)}>
                            Add to service
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              if (isSongPinned) {
                                if (onUnpinFromQuickSection) onUnpinFromQuickSection(song.title);
                              } else {
                                const songSlides = ImporterService.songToSlides(song);
                                if (onPinToQuickSection) {
                                  onPinToQuickSection(song.title, songSlides, 'song');
                                } else if (onAppendSlidesToActiveItem) {
                                  onAppendSlidesToActiveItem(songSlides, song.title);
                                }
                              }
                            }}
                          >
                            {isSongPinned ? 'Unpin from quick section' : 'Pin to quick section'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onSelect={() => {
                              if (window.confirm(`Are you sure you want to delete "${song.title}" from your library?`)) {
                                onDeleteSong(song.id);
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* BIBLE */}
        <TabsContent value="bible" className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search scripture"
                value={bibleKeywordSearch}
                onChange={(e) => setBibleKeywordSearch(e.target.value)}
                className="h-8 pl-7 pr-7 text-xs"
                aria-label="Search scripture text or reference"
              />
              {bibleKeywordSearch && (
                <button
                  type="button"
                  onClick={() => setBibleKeywordSearch('')}
                  aria-label="Clear scripture search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button size="xs" onClick={() => setShowBibleImportModal(true)}>
              Import
            </Button>
          </div>

          {bibleKeywordSearch.trim() !== '' && (
            <div className="space-y-1">
              <ListHeader>{bibleKeywordResults.length} matches</ListHeader>
              {bibleKeywordResults.length === 0 ? (
                <p className="px-1 py-2 text-2xs text-muted-foreground">
                  No verses match this search.
                </p>
              ) : (
                <div className="divide-y divide-border/70 border-t border-border/70">
                  {bibleKeywordResults.map((res, idx) => {
                    const resultSlide = {
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
                    };
                    return (
                      <div
                        key={idx}
                        className="group flex items-start gap-2 px-1 py-1.5 transition-colors hover:bg-accent/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{res.formattedRef}</div>
                          <div className="line-clamp-2 text-2xs text-muted-foreground">{res.text}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-6 px-1.5"
                            onClick={() => onGoLiveWithSlide(resultSlide)}
                          >
                            Take live
                          </Button>
                          {onAppendSlidesToActiveItem && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Options for ${res.formattedRef}`}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-48"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onSelect={() =>
                                    onAppendSlidesToActiveItem([resultSlide], res.formattedRef)
                                  }
                                >
                                  Append to current item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Versions */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">
                Primary
              </span>
              <Select
                value={primaryVersionInfo.id}
                onValueChange={(value) => handleSelectPrimaryTranslation(value)}
              >
                <SelectTrigger className="h-8 flex-1 px-2 text-xs" aria-label="Primary Bible version">
                  <span className="truncate">{primaryVersionInfo.abbreviation}</span>
                </SelectTrigger>
                <SelectContent className="min-w-[220px]">
                  {bibleVersionOptions.map(option => (
                    <SelectItem key={option.id} value={option.id} className="text-xs">
                      {option.abbreviation} — {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="xs"
                variant="ghost"
                className="h-7 px-1.5"
                onClick={() => setIsVersionModalOpen(true)}
              >
                Browse
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">
                Parallel
              </span>
              <Select
                value={parallelVersionInfo ? parallelVersionInfo.id : 'none'}
                onValueChange={(value) => handleSelectParallelTranslation(value === 'none' ? null : value)}
              >
                <SelectTrigger className="h-8 flex-1 px-2 text-xs" aria-label="Parallel Bible version">
                  <span className={cn('truncate', !parallelVersionInfo && 'text-muted-foreground')}>
                    {parallelVersionInfo ? parallelVersionInfo.abbreviation : 'None'}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[220px]">
                  <SelectItem value="none" className="text-xs">
                    None
                  </SelectItem>
                  {bibleVersionOptions
                    .filter(option => option.id !== primaryVersionInfo.id)
                    .map(option => (
                      <SelectItem key={option.id} value={option.id} className="text-xs">
                        {option.abbreviation} — {option.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {parallelVersionInfo ? (
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-7 px-1.5"
                  onClick={() => {
                    handleSelectParallelTranslation(null);
                    if (selectedTranslation !== primaryVersionInfo.id) {
                      setSelectedTranslation(primaryVersionInfo.id);
                      if (onChangeBibleTranslations) {
                        onChangeBibleTranslations(primaryVersionInfo.id, null);
                      }
                    }
                  }}
                >
                  Clear
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-7 px-1.5"
                  onClick={() => setIsParallelVersionModalOpen(true)}
                >
                  Browse
                </Button>
              )}
            </div>

            {parallelVersionInfo && (
              <Button
                variant="outline"
                size="xs"
                className="w-full"
                onClick={() => handleTranslateToParallelNow()}
                title="Switch the chapter between the primary and parallel version"
              >
                {selectedTranslation === parallelVersionInfo.id
                  ? `Translate to ${primaryVersionInfo.abbreviation}`
                  : `Translate to ${parallelVersionInfo.abbreviation}`}
              </Button>
            )}
          </div>

          {/* Passage */}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="block">Passage</Label>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-full justify-between px-2 font-normal"
                onClick={() => setIsBookModalOpen(true)}
              >
                <span className="truncate">{bibleBook}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </div>
            <div className="w-16 shrink-0 space-y-1">
              <Label htmlFor="library-bible-chapter" className="block">
                Chapter
              </Label>
              <Input
                id="library-bible-chapter"
                type="number"
                min={1}
                value={bibleChapter}
                onChange={(e) => setBibleChapter(parseInt(e.target.value) || 1)}
                className="tabular h-8 px-1 text-center text-xs"
              />
            </div>
          </div>

          {/* Verse range */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Verses</span>
              <div className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (entireChapter) return;
                    setEntireChapter(true);
                  }}
                  className={cn(
                    'h-6 rounded-sm px-2 text-2xs font-medium transition-colors',
                    entireChapter
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Whole chapter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!entireChapter) return;
                    setEntireChapter(false);
                    if (chapterMaxVerse < 999) setEndVerse(chapterMaxVerse);
                  }}
                  className={cn(
                    'h-6 rounded-sm px-2 text-2xs font-medium transition-colors',
                    !entireChapter
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Range
                </button>
              </div>
            </div>
            {!entireChapter && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="library-bible-from" className="block">
                    From
                  </Label>
                  <Input
                    id="library-bible-from"
                    type="number"
                    min={1}
                    value={startVerse}
                    onChange={(e) => setStartVerse(parseInt(e.target.value) || 1)}
                    className="tabular h-8 px-1 text-center text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="library-bible-to" className="block">
                    To
                  </Label>
                  <Input
                    id="library-bible-to"
                    type="number"
                    min={1}
                    value={endVerse}
                    onChange={(e) => setEndVerse(parseInt(e.target.value) || 1)}
                    className="tabular h-8 px-1 text-center text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chapter actions */}
          <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
            <span className="truncate text-2xs text-muted-foreground">
              {chapterPassage ? chapterPassage.formattedRef : `${bibleBook} ${bibleChapter}`}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {(() => {
                const isCurrentChapterPinned =
                  chapterPassage && quickPinnedItems.some(p => p.title === chapterPassage.formattedRef);
                if (isCurrentChapterPinned) {
                  return (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-7 px-1.5"
                      onClick={() => {
                        if (chapterPassage && onUnpinFromQuickSection) {
                          onUnpinFromQuickSection(chapterPassage.formattedRef);
                        }
                      }}
                    >
                      Unpin chapter
                    </Button>
                  );
                }
                return (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-7 px-1.5"
                    disabled={isPassageLoading}
                    onClick={handleBibleSearch}
                    title="Pin this chapter to the quick section"
                  >
                    Pin chapter
                  </Button>
                );
              })()}
              <Button
                size="xs"
                variant="secondary"
                className="h-7"
                disabled={isPassageLoading}
                onClick={() => {
                  if (chapterPassage && chapterSlides.length > 0) {
                    onAddBibleToPlaylist(chapterPassage.formattedRef, chapterSlides, currentBibleMeta);
                  }
                }}
                title="Add this chapter to the service"
              >
                Add chapter
              </Button>
            </div>
          </div>

          {/* Chapter verses */}
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
              <div className="space-y-2">
                <ListHeader
                  action={
                    <span className="tabular text-2xs text-muted-foreground">
                      {filteredChapterSlides.length}/{chapterSlides.length}
                    </span>
                  }
                >
                  Verses
                </ListHeader>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Filter verses"
                    value={verseJumpQuery}
                    onChange={(e) => setVerseJumpQuery(e.target.value)}
                    className="h-7 pl-6 pr-6 text-2xs"
                    aria-label="Filter verses by number or word"
                  />
                  {verseJumpQuery && (
                    <button
                      type="button"
                      onClick={() => setVerseJumpQuery('')}
                      aria-label="Clear verse filter"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {filteredChapterSlides.length === 0 ? (
                  <p className="px-1 py-2 text-2xs text-muted-foreground">No verses match this filter.</p>
                ) : (
                  <div className="divide-y divide-border/70 border-t border-border/70">
                    {filteredChapterSlides.map((verseSlide, vIdx) => {
                      const verseNum = verseSlide.bibleMeta?.verse ?? (vIdx + 1);
                      const verseKey = `${chapterPassage.book}:${chapterPassage.chapter}:${verseNum}`;
                      const activeVerseSlide = perVerseOverrides[verseKey] || verseSlide;
                      const verseRef = `${chapterPassage.book} ${chapterPassage.chapter}:${verseNum}`;
                      const isVersePinned = quickPinnedItems.some(p => p.title === verseRef);
                      const activeVerseTrans = StorageService.resolveTranslationId(
                        activeVerseSlide.bibleMeta?.translationId || selectedTranslation
                      );
                      const singleVerseMeta: PlaylistItem['bibleMeta'] = {
                        book: chapterPassage.book,
                        chapter: chapterPassage.chapter,
                        startVerse: verseNum,
                        endVerse: verseNum,
                        translationId: activeVerseTrans,
                        parallelTranslationId: parallelTranslation || undefined
                      };

                      return (
                        <div
                          key={verseSlide.id}
                          onClick={() => {
                            if (onSelectBibleVerseInChapter) {
                              onSelectBibleVerseInChapter(
                                verseRef,
                                [activeVerseSlide],
                                activeVerseSlide,
                                singleVerseMeta
                              );
                            } else if (onPinToQuickSection) {
                              onPinToQuickSection(
                                verseRef,
                                [activeVerseSlide],
                                'bible',
                                verseRef,
                                activeVerseSlide,
                                singleVerseMeta
                              );
                            }
                          }}
                          onDoubleClick={() => {
                            if (onAddBiblePassageAndGoLive) {
                              onAddBiblePassageAndGoLive(
                                verseRef,
                                [activeVerseSlide],
                                activeVerseSlide,
                                singleVerseMeta
                              );
                            }
                          }}
                          className="group flex cursor-pointer items-start gap-2 px-1 py-2 transition-colors hover:bg-accent/60"
                          title="Click to preview this verse · Double-click to take it live"
                        >
                          <span className="tabular w-5 shrink-0 pt-0.5 text-2xs text-muted-foreground">
                            {verseNum}
                          </span>
                          <p className="min-w-0 flex-1 whitespace-pre-line text-xs leading-relaxed text-foreground/90">
                            {activeVerseSlide.content}
                          </p>
                          <div className="flex shrink-0 items-start gap-0.5">
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 px-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              disabled={isVersePinned}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onPinToQuickSection) {
                                  onPinToQuickSection(
                                    verseRef,
                                    [activeVerseSlide],
                                    'bible',
                                    verseRef,
                                    activeVerseSlide,
                                    singleVerseMeta
                                  );
                                } else if (onAppendSlidesToActiveItem) {
                                  onAppendSlidesToActiveItem([activeVerseSlide], verseRef);
                                }
                              }}
                            >
                              {isVersePinned ? 'Added' : 'Add'}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Options for ${verseRef}`}
                                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-52"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onSelect={() => {
                                    if (onAddBiblePassageAndGoLive) {
                                      onAddBiblePassageAndGoLive(
                                        verseRef,
                                        [activeVerseSlide],
                                        activeVerseSlide,
                                        singleVerseMeta
                                      );
                                    }
                                  }}
                                >
                                  Take live
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    if (isVersePinned) {
                                      if (onUnpinFromQuickSection) onUnpinFromQuickSection(verseRef);
                                    } else if (onPinToQuickSection) {
                                      onPinToQuickSection(
                                        verseRef,
                                        [activeVerseSlide],
                                        'bible',
                                        verseRef,
                                        activeVerseSlide,
                                        singleVerseMeta
                                      );
                                    } else if (onAppendSlidesToActiveItem) {
                                      onAppendSlidesToActiveItem([activeVerseSlide], verseRef);
                                    }
                                  }}
                                >
                                  {isVersePinned ? 'Unpin from quick section' : 'Pin to quick section'}
                                </DropdownMenuItem>
                                {parallelVersionInfo && (
                                  <DropdownMenuItem
                                    onSelect={() => handleTranslateToParallelNow(activeVerseSlide, true)}
                                  >
                                    Translate to{' '}
                                    {activeVerseTrans === parallelVersionInfo.id
                                      ? primaryVersionInfo.abbreviation
                                      : parallelVersionInfo.abbreviation}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* TICKER */}
        <TabsContent value="announcements" className="flex-1 space-y-3 overflow-y-auto p-3">
          {(() => {
            const filteredAnnouncements = announcements.filter(
              a =>
                a.title.toLowerCase().includes(annQuery.toLowerCase()) ||
                a.content.toLowerCase().includes(annQuery.toLowerCase())
            );

            const openNewTicker = () => {
              setEditingAnn(null);
              setAnnTitle('');
              setAnnSubtitle('');
              setAnnContent('');
              setShowAnnModal(true);
            };

            return (
              <>
                {activeLowerThirdText && (
                  <div className="rounded-sm border border-live/40 bg-live/10 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="live" className="shrink-0">
                        Live
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-2xs font-medium">
                        {activeLowerThirdText.title || 'Announcement'}
                      </span>
                      {onClearLowerThirdAnnouncement && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-6 px-1.5"
                          onClick={onClearLowerThirdAnnouncement}
                        >
                          Stop
                        </Button>
                      )}
                    </div>
                    {activeLowerThirdText.content ? (
                      <div className="mt-1 truncate text-2xs text-muted-foreground">
                        {activeLowerThirdText.content}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search tickers"
                      value={annQuery}
                      onChange={(e) => setAnnQuery(e.target.value)}
                      className="h-8 pl-7 text-xs"
                      aria-label="Search saved tickers"
                    />
                  </div>
                  <Button size="xs" onClick={openNewTicker}>
                    New ticker
                  </Button>
                </div>

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
                  className="space-y-1.5 rounded-sm border border-border bg-background/40 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="library-quick-ticker" className="text-[11px]">
                      Quick ticker
                    </Label>
                    <div className="inline-flex h-6 items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
                      {(['slow', 'normal', 'fast'] as const).map(spd => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setTickerSpeed(spd)}
                          title={`Set crawl speed: ${spd}`}
                          className={cn(
                            'h-5 rounded-sm px-1.5 text-[11px] font-medium capitalize transition-colors',
                            tickerSpeed === spd
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {spd}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="library-quick-ticker"
                      type="text"
                      placeholder="Type a message and press Enter"
                      value={quickTickerInput}
                      onChange={(e) => setQuickTickerInput(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <Button
                      type="submit"
                      size="xs"
                      variant="secondary"
                      className="h-7 shrink-0"
                      disabled={!quickTickerInput.trim()}
                    >
                      Send
                    </Button>
                  </div>
                </form>

                {selectedTickerIds.length > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-background/40 px-2 py-1.5">
                    <span className="truncate text-2xs text-muted-foreground">
                      {selectedTickerIds.length} selected
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => setSelectedTickerIds([])}
                      >
                        Clear
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="h-6"
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
                      >
                        Run combined
                      </Button>
                    </div>
                  </div>
                )}

                {filteredAnnouncements.length === 0 ? (
                  <EmptyState
                    title={announcements.length === 0 ? 'No tickers yet' : 'No matching tickers'}
                    description={
                      announcements.length === 0
                        ? 'Create a ticker to run notices across the lower third.'
                        : 'Try a different word.'
                    }
                    action={
                      announcements.length === 0 ? (
                        <Button size="xs" onClick={openNewTicker}>
                          New ticker
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="divide-y divide-border/70 border-t border-border/70">
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
                          className="group flex items-start gap-2 px-1 py-2 transition-colors hover:bg-accent/60"
                        >
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
                            aria-label={`Include ${ann.title} in the combined crawl`}
                            title="Include in the combined crawl"
                            className="mt-0.5 h-3 w-3 shrink-0 cursor-pointer accent-foreground"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium">{ann.title}</span>
                              {isThisTickerLive && (
                                <Badge variant="live" className="shrink-0">
                                  Live
                                </Badge>
                              )}
                            </div>
                            <div className="truncate text-2xs text-muted-foreground">
                              {ann.subtitle ? `${ann.subtitle} · ` : ''}
                              {ann.content}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {isThisTickerLive && onClearLowerThirdAnnouncement ? (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 px-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={onClearLowerThirdAnnouncement}
                              >
                                Stop
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-6 px-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
                              >
                                Run
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Options for ${ann.title}`}
                                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-52"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingAnn(ann);
                                    setAnnTitle(ann.title);
                                    setAnnSubtitle(ann.subtitle || '');
                                    setAnnContent(ann.content);
                                    setShowAnnModal(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                {onAppendSlidesToActiveItem && (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      onAppendSlidesToActiveItem([annSlide], `Announcement: ${ann.title}`)
                                    }
                                  >
                                    Append to current item
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onSelect={() => {
                                    onAddBibleToPlaylist(`Announcement: ${ann.title}`, [annSlide]);
                                  }}
                                >
                                  Add to service
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                  onSelect={() => handleDeleteAnnouncement(ann.id)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* MEDIA */}
        <TabsContent value="media" className="flex-1 space-y-3 overflow-y-auto p-3">
          {(() => {
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
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search media"
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                      className="h-8 pl-7 text-xs"
                      aria-label="Search media"
                    />
                  </div>
                  <Button asChild size="xs">
                    <label className="cursor-pointer">
                      {isUploadingMedia ? 'Adding…' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*,video/*,audio/*,.mp4,.webm,.mov,.mkv,.mp3,.wav,.ogg,.m4a"
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
                  </Button>
                </div>

                <div className="inline-flex h-8 w-full items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMediaSubMode('backgrounds')}
                    className={cn(
                      'h-7 flex-1 rounded-sm text-2xs font-medium transition-colors',
                      mediaSubMode === 'backgrounds'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Backgrounds
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSubMode('foreground')}
                    className={cn(
                      'h-7 flex-1 rounded-sm text-2xs font-medium transition-colors',
                      mediaSubMode === 'foreground'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Clips
                  </button>
                </div>

                <div className="inline-flex h-7 w-full items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
                  {[
                    { id: 'All', label: `All ${media.length}` },
                    { id: 'Videos', label: `Videos ${videoCount}` },
                    { id: 'Backgrounds', label: `Images ${imageCount}` }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMediaCategory(cat.id)}
                      className={cn(
                        'tabular h-6 flex-1 rounded-sm px-1 text-2xs font-medium transition-colors',
                        mediaCategory === cat.id
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {mediaSubMode === 'backgrounds' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Apply to</span>
                      {activeBackgroundUrl && onClearBackground && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-6 px-1.5"
                          onClick={onClearBackground}
                        >
                          Clear background
                        </Button>
                      )}
                    </div>
                    <div className="inline-flex h-7 w-full items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
                      {[
                        { id: 'global', label: 'Live layer' },
                        { id: 'item', label: 'Current item' },
                        { id: 'slide', label: 'Selected slide' }
                      ].map(scope => (
                        <button
                          key={scope.id}
                          type="button"
                          onClick={() => setBgTargetScope(scope.id as any)}
                          className={cn(
                            'h-6 flex-1 rounded-sm px-1 text-2xs font-medium transition-colors',
                            bgTargetScope === scope.id
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {scope.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    Plays fullscreen with audio and opens the broadcast transport deck.
                  </p>
                )}

                {visibleMedia.length === 0 ? (
                  <EmptyState
                    title="No media matches"
                    description="Upload an image or video, or change the filter."
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
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
                          className="group min-w-0"
                          draggable={mediaSubMode === 'backgrounds'}
                          onDragStart={e => {
                            if (mediaSubMode !== 'backgrounds') return;
                            e.dataTransfer.setData(
                              'application/livepsalms-media',
                              JSON.stringify(item)
                            );
                          }}
                        >
                          <button
                            type="button"
                            onClick={
                              mediaSubMode === 'backgrounds'
                                ? applyBackground
                                : () =>
                                    onPlayVideoNow
                                      ? onPlayVideoNow(item)
                                      : onAddMediaToPlaylist(item)
                            }
                            title={
                              mediaSubMode === 'backgrounds'
                                ? `Set ${item.name} as the background`
                                : `Play ${item.name} fullscreen`
                            }
                            className="relative block aspect-video w-full overflow-hidden rounded-sm border border-border bg-background"
                          >
                            {isVideo ? (
                              <>
                                <video
                                  src={item.url}
                                  className="pointer-events-none h-full w-full object-cover"
                                  muted
                                  loop={mediaSubMode === 'backgrounds'}
                                  autoPlay={mediaSubMode === 'backgrounds'}
                                  playsInline
                                  preload="metadata"
                                  onLoadedMetadata={event => {
                                    // Paint a representative frame instead of a black tile.
                                    event.currentTarget.currentTime = 0.4;
                                  }}
                                />
                                {mediaSubMode === 'foreground' && (
                                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                                      <Play className="h-3.5 w-3.5 fill-current" />
                                    </span>
                                  </span>
                                )}
                                <span className="pointer-events-none absolute bottom-1 right-1 rounded-sm bg-black/70 px-1 text-[10px] leading-4 text-white/80">
                                  Video
                                </span>
                              </>
                            ) : (
                              <img
                                src={item.url}
                                alt={item.name}
                                className="pointer-events-none h-full w-full object-cover"
                              />
                            )}
                            {isActiveBg && (
                              <span className="absolute left-1 top-1">
                                <Badge variant="outline" className="bg-background/85">
                                  <Check className="h-3 w-3" />
                                  Applied
                                </Badge>
                              </span>
                            )}
                          </button>

                          <div className="mt-1 flex items-center gap-1">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-2xs font-medium" title={item.name}>
                                {item.name}
                              </div>
                              <div className="truncate text-2xs text-muted-foreground">
                                {mediaSubMode === 'backgrounds'
                                  ? isActiveBg
                                    ? 'Applied'
                                    : isVideo
                                    ? 'Video'
                                    : 'Image'
                                  : isVideo
                                  ? 'Video'
                                  : 'Image'}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label={`Options for ${item.name}`}
                                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-48"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {mediaSubMode === 'backgrounds' ? (
                                  <DropdownMenuItem onSelect={applyBackground}>
                                    Apply as background
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      onPlayVideoNow
                                        ? onPlayVideoNow(item)
                                        : onAddMediaToPlaylist(item)
                                    }
                                  >
                                    Play fullscreen now
                                  </DropdownMenuItem>
                                )}
                                {isVideo && onSetGlobalVideoBackground && (
                                  <DropdownMenuItem onSelect={() => onSetGlobalVideoBackground(item)}>
                                    Set as Live Video BG
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onAddMediaToPlaylist(item)}>
                                  Add to service
                                </DropdownMenuItem>
                                {onDeleteMediaAsset && item.id.startsWith('vault-') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                      onSelect={() => onDeleteMediaAsset(item.id)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* THEMES */}
        <TabsContent value="themes" className="flex-1 space-y-3 overflow-y-auto p-3">
          <ListHeader
            action={
              <span className="tabular text-2xs text-muted-foreground">{themes.length} presets</span>
            }
          >
            Global themes
          </ListHeader>

          {themes.length === 0 ? (
            <EmptyState
              title="No themes"
              description="Themes you add in settings appear here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {themes.map(t => {
                const isSelected = t.id === activeThemeId;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'min-w-0 rounded-sm border bg-card',
                      isSelected ? 'border-foreground/40' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTheme(t.id)}
                      aria-pressed={isSelected}
                      title={t.name}
                      className="relative block aspect-video w-full overflow-hidden rounded-t-sm bg-background text-left"
                    >
                      {t.backgroundUrl && (
                        <img
                          src={t.backgroundUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: `rgba(0, 0, 0, ${t.scrimOpacity})` }}
                      />
                      <span
                        className={cn(
                          'relative z-10 flex h-full w-full items-center px-1.5',
                          t.align === 'center'
                            ? 'justify-center'
                            : t.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        )}
                      >
                        <span
                          className="block w-full truncate text-[15px] leading-tight"
                          style={{ fontFamily: t.fontFamily, color: t.textColor }}
                        >
                          Aa
                        </span>
                      </span>
                    </button>

                    <div className="flex items-center gap-1 border-t border-border px-1.5 py-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-2xs font-medium">{t.name}</span>
                          {isSelected && (
                            <Check className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <div className="truncate text-2xs text-muted-foreground">
                          {t.fontSize}px · {t.align}
                          {t.lowerThirdStyle ? ' · lower third' : ''}
                        </div>
                      </div>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: t.accentColor }}
                        title={`Accent ${t.accentColor}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* NEW/EDIT TICKER DIALOG */}
      <Dialog open={showAnnModal} onOpenChange={(open) => setShowAnnModal(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAnn ? 'Edit ticker' : 'New ticker'}</DialogTitle>
            <DialogDescription>Crawls across the lower third while it is live.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto px-5 py-4">
            <Field label="Title" htmlFor="library-ticker-title">
              <Input
                id="library-ticker-title"
                type="text"
                placeholder="Sunday worship"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="text-xs"
              />
            </Field>
            <Field label="Subtitle" htmlFor="library-ticker-subtitle" hint="Optional second line.">
              <Input
                id="library-ticker-subtitle"
                type="text"
                placeholder="Wednesday 7:00 PM"
                value={annSubtitle}
                onChange={(e) => setAnnSubtitle(e.target.value)}
                className="text-xs"
              />
            </Field>
            <Field label="Message" htmlFor="library-ticker-message">
              <Textarea
                id="library-ticker-message"
                rows={3}
                placeholder="Text that scrolls across the screen"
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                className="text-xs"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAnnModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAnnouncement}>
              Save ticker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BIBLE IMPORT DIALOG */}
      <Dialog open={showBibleImportModal} onOpenChange={(open) => setShowBibleImportModal(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import a translation</DialogTitle>
            <DialogDescription>JSON or XML (Zefania, OpenSong).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto px-5 py-4">
            <Field label="Name" htmlFor="library-bible-import-name" hint="Defaults to the file name.">
              <Input
                id="library-bible-import-name"
                type="text"
                value={importBibleName}
                onChange={(e) => setImportBibleName(e.target.value)}
                className="text-xs"
              />
            </Field>
            <Field
              label="Abbreviation"
              htmlFor="library-bible-import-abbr"
              hint="Short label shown in the version list."
            >
              <Input
                id="library-bible-import-abbr"
                type="text"
                value={importBibleAbbr}
                onChange={(e) => setImportBibleAbbr(e.target.value)}
                className="text-xs"
              />
            </Field>
            <Button asChild size="sm" variant="secondary">
              <label className="cursor-pointer">
                Choose file
                <input
                  type="file"
                  accept=".json,.xml,application/json,text/xml"
                  onChange={handleBibleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowBibleImportModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bible Version Selection Modal Popup (Primary) */}
      <BibleVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        selectedTranslation={primaryTranslation}
        onSelectTranslation={(id) => handleSelectPrimaryTranslation(id)}
        customBibles={customBibles}
        onlineVersions={onlineVersions}
        apiBibleEnabled={settings.apiBibleEnabled}
        mode="primary"
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
        mode="parallel"
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
    </aside>
  );
};
