import React, { useState, useEffect } from 'react';
import { 
  PlaylistItem, 
  Slide, 
  Song, 
  MediaAsset, 
  Theme, 
  EmergencyState, 
  TransitionSettings, 
  SectionTag,
  ItemType,
  QuickPinnedItem
} from './types/presentation';
import { StorageService } from './services/storage';
import { BroadcastService } from './services/broadcast';
import { ImporterService } from './services/importer';

import { Header } from './components/Header';
import { PlaylistPanel } from './components/PlaylistPanel';
import { LibraryTabs } from './components/LibraryTabs';
import { CenterWorkspace } from './components/CenterWorkspace';
import { InspectorPanel } from './components/InspectorPanel';
import { BottomControlBar } from './components/BottomControlBar';

import { GlobalSearchModal } from './components/GlobalSearchModal';
import { QuickPresentationModal } from './components/QuickPresentationModal';
import { SermonModeModal } from './components/SermonModeModal';
import { SlideDesignerModal } from './components/SlideDesignerModal';
import { SettingsModal } from './components/SettingsModal';

import { AudienceOutputWindow } from './components/AudienceOutputWindow';
import { StageDisplayWindow } from './components/StageDisplayWindow';
import { LedWallOutputWindow } from './components/LedWallOutputWindow';
import { ObsOutputWindow } from './components/ObsOutputWindow';

export const App: React.FC = () => {
  // Check if current URL is Audience, Stage, LED Wall, or OBS window
  const urlParams = new URLSearchParams(window.location.search);
  const outputMode = urlParams.get('output');

  if (outputMode === 'audience') {
    return <AudienceOutputWindow />;
  }
  if (outputMode === 'stage') {
    return <StageDisplayWindow />;
  }
  if (outputMode === 'led') {
    return <LedWallOutputWindow />;
  }
  if (outputMode === 'obs') {
    return <ObsOutputWindow />;
  }

  // --- CONTROL SCREEN OPERATOR STATE ---
  const savedData = StorageService.getSavedData();

  const [playlist, setPlaylist] = useState<PlaylistItem[]>(savedData.playlist);
  const [songs, setSongs] = useState<Song[]>(savedData.songs);
  const [themes, setThemes] = useState<Theme[]>(savedData.themes);
  const [media, setMedia] = useState<MediaAsset[]>(savedData.media);
  const [activeThemeId, setActiveThemeId] = useState<string>(savedData.activeThemeId);

  // Active / Selected Items
  const [activeItemId, setActiveItemId] = useState<string | null>(playlist[0]?.id || null);
  const [previewSlide, setPreviewSlide] = useState<Slide | null>(playlist[0]?.slides[0] || null);
  const [liveSlide, setLiveSlide] = useState<Slide | null>(null);
  const [liveItemId, setLiveItemId] = useState<string | null>(null);

  // Independent Live Lower-Third Announcement State
  const [activeLowerThirdText, setActiveLowerThirdText] = useState<{ title?: string; subtitle?: string; content?: string } | null>(null);

  // Emergency States (Mutually Exclusive)
  const [emergency, setEmergency] = useState<EmergencyState>({
    isBlack: false,
    isClear: false,
    isLogo: false,
    isFreeze: false,
    isStopMedia: false
  });

  // Transitions
  const [transition, setTransition] = useState<TransitionSettings>({
    type: 'fade',
    durationMs: 400
  });

  // Speaker / Stage Notes
  const [speakerNotes, setSpeakerNotes] = useState<string>(playlist[0]?.speakerNotes || '');

  // Countdown Ticker & Advanced Options State
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [isCountdownRunning, setIsCountdownRunning] = useState<boolean>(false);
  const [isFullSlideCountdown, setIsFullSlideCountdown] = useState<boolean>(false);
  const [countdownTargetScreen, setCountdownTargetScreen] = useState<'audience' | 'stage' | 'both'>('both');
  const [countdownEndAction, setCountdownEndAction] = useState<'none' | 'play_video' | 'start_playlist' | 'go_live_active'>('none');
  const [countdownEndVideoId, setCountdownEndVideoId] = useState<string>('');

  // Display Windows Active Status
  const [isAudienceActive, setIsAudienceActive] = useState<boolean>(false);
  const [isStageActive, setIsStageActive] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Modal Dialog States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickModeOpen, setIsQuickModeOpen] = useState(false);
  const [isSermonModeOpen, setIsSermonModeOpen] = useState(false);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeItem = playlist.find(i => i.id === activeItemId) || null;
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];

  // Helper to accurately compute the upcoming slide for Stage Confidence Monitor
  const getUpcomingNextSlide = (): Slide | undefined => {
    const referenceSlide = liveSlide || previewSlide;
    if (!referenceSlide) return undefined;

    let itemIndex = -1;
    let slideIndex = -1;

    for (let i = 0; i < playlist.length; i++) {
      const sIdx = playlist[i].slides.findIndex(s => s.id === referenceSlide.id);
      if (sIdx >= 0) {
        itemIndex = i;
        slideIndex = sIdx;
        break;
      }
    }

    if (itemIndex === -1) return undefined;

    const currentSlides = playlist[itemIndex].slides;

    if (slideIndex < currentSlides.length - 1) {
      return currentSlides[slideIndex + 1];
    }

    if (itemIndex < playlist.length - 1) {
      const nextItem = playlist[itemIndex + 1];
      if (nextItem.slides && nextItem.slides.length > 0) {
        return nextItem.slides[0];
      }
    }

    return undefined;
  };

  // Auto-Save Effect
  useEffect(() => {
    setIsSaved(false);
    const handler = setTimeout(() => {
      StorageService.saveData({
        playlist,
        songs,
        themes,
        media,
        activeThemeId
      });
      setIsSaved(true);
    }, 500);

    return () => clearTimeout(handler);
  }, [playlist, songs, themes, media, activeThemeId]);

  // Window Status Check Interval & Broadcast Sync
  useEffect(() => {
    const checkInterval = setInterval(() => {
      setIsAudienceActive(BroadcastService.isAudienceOpen());
      setIsStageActive(BroadcastService.isStageOpen());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const handleCountdownFinished = () => {
    if (countdownEndAction === 'start_playlist' && playlist.length > 0) {
      const firstItem = playlist[0];
      setActiveItemId(firstItem.id);
      if (firstItem.slides && firstItem.slides.length > 0) {
        setLiveSlide(firstItem.slides[0]);
        setLiveItemId(firstItem.id);
      }
    } else if (countdownEndAction === 'play_video' && countdownEndVideoId) {
      const vid = media.find(m => m.id === countdownEndVideoId);
      if (vid) {
        const videoSlide: Slide = {
          id: `countdown-vid-${Date.now()}`,
          title: vid.name,
          backgroundUrl: vid.url,
          backgroundType: 'video',
          content: ''
        };
        setLiveSlide(videoSlide);
      }
    } else if (countdownEndAction === 'go_live_active') {
      if (previewSlide) {
        setLiveSlide(previewSlide);
        setLiveItemId(activeItemId);
      } else if (activeItem && activeItem.slides.length > 0) {
        setLiveSlide(activeItem.slides[0]);
        setLiveItemId(activeItem.id);
      }
    }
  };

  // Countdown Ticker Timer
  useEffect(() => {
    let timer: any = null;
    if (isCountdownRunning && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds(prev => {
          if (prev <= 1) {
            setIsCountdownRunning(false);
            handleCountdownFinished();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCountdownRunning, countdownSeconds, countdownEndAction, countdownEndVideoId, playlist, previewSlide, activeItem, media]);

  // Broadcast Updates to Audience Display
  useEffect(() => {
    BroadcastService.postMessage({
      type: 'LIVE_SLIDE_CHANGE',
      liveSlide
    });
  }, [liveSlide]);

  useEffect(() => {
    BroadcastService.postMessage({
      type: 'THEME_CHANGE',
      theme: activeTheme
    });
  }, [activeTheme]);

  useEffect(() => {
    BroadcastService.postMessage({
      type: 'EMERGENCY_STATE_CHANGE',
      emergency
    });
  }, [emergency]);

  // Broadcast Updates to Stage Display (Confidence Monitor)
  useEffect(() => {
    const upcomingNext = getUpcomingNextSlide();
    BroadcastService.postMessage({
      type: 'STAGE_DISPLAY_UPDATE',
      stageState: {
        currentSlide: liveSlide || undefined,
        nextSlide: upcomingNext,
        currentItemTitle: activeItem?.title,
        clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        countdownRemaining: countdownSeconds,
        speakerNotes
      }
    });
  }, [liveSlide, previewSlide, activeItem, playlist, countdownSeconds, speakerNotes]);

  // Lower Third Ticker Broadcast Trigger
  const handleTriggerLowerThirdAnnouncement = (slide: Slide) => {
    const payloadData = {
      title: slide.title || activeItem?.title || 'Announcement',
      subtitle: slide.subtitle,
      content: (slide.content || '').replace(/\r?\n/g, ' — ')
    };
    setActiveLowerThirdText(payloadData);
    try {
      localStorage.setItem('live_psalms_active_ticker_v1', JSON.stringify(payloadData));
    } catch (e) {}
    BroadcastService.postMessage({
      type: 'LOWER_THIRD_TRIGGER',
      lowerThirdText: payloadData
    });
  };

  const handleClearLowerThirdAnnouncement = () => {
    setActiveLowerThirdText(null);
    try {
      localStorage.removeItem('live_psalms_active_ticker_v1');
    } catch (e) {}
    BroadcastService.postMessage({
      type: 'LOWER_THIRD_TRIGGER',
      lowerThirdText: null
    });
  };

  // Mutually Exclusive Emergency Mode Toggle
  const handleToggleEmergency = (key: keyof EmergencyState) => {
    setEmergency(prev => {
      const isCurrentlyActive = prev[key];
      return {
        isBlack: key === 'isBlack' ? !isCurrentlyActive : false,
        isClear: key === 'isClear' ? !isCurrentlyActive : false,
        isLogo: key === 'isLogo' ? !isCurrentlyActive : false,
        isFreeze: key === 'isFreeze' ? !isCurrentlyActive : false,
        isStopMedia: key === 'isStopMedia' ? !isCurrentlyActive : false,
      };
    });
  };

  // Quick Section Pinned Items State & Handlers
  const [quickPinnedItems, setQuickPinnedItems] = useState<QuickPinnedItem[]>([]);

  const handlePinToQuickSection = (title: string, slides: Slide[], type: 'bible' | 'song' | 'announcement' = 'bible', sourceRef?: string) => {
    if (!slides || slides.length === 0) return;

    // Check if item already exists in playlist
    let existingItem = playlist.find(i => i.title.toLowerCase() === title.toLowerCase());
    let itemId = existingItem?.id;

    if (!existingItem) {
      const newItem: PlaylistItem = {
        id: `item-qp-${Math.random().toString(36).substring(2, 9)}`,
        title: title,
        type: type === 'song' ? 'song' : type === 'announcement' ? 'announcement' : 'bible',
        category: type === 'song' ? 'Worship' : type === 'announcement' ? 'Announcements' : 'Scripture',
        slides: slides
      };
      setPlaylist(prev => [...prev, newItem]);
      itemId = newItem.id;
    }

    const newPin: QuickPinnedItem = {
      id: itemId!,
      title,
      type,
      slides,
      sourceRef
    };

    setQuickPinnedItems(prev => {
      if (prev.some(p => p.title === title || p.id === itemId)) return prev;
      return [...prev, newPin];
    });

    // Instantly activate this item in Center Workspace!
    setActiveItemId(itemId!);
    if (slides.length > 0) {
      setPreviewSlide(slides[0]);
    }
  };

  const handleUnpinFromQuickSection = (pinIdOrTitle: string) => {
    setQuickPinnedItems(prev => prev.filter(p => p.id !== pinIdOrTitle && p.title !== pinIdOrTitle));
  };

  const handleLoadQuickPinnedSlides = (slides: Slide[], title: string, pinId?: string) => {
    if (!slides || slides.length === 0) return;

    let targetItem = playlist.find(i => (pinId && i.id === pinId) || i.title.toLowerCase() === title.toLowerCase());

    if (targetItem) {
      setActiveItemId(targetItem.id);
      if (targetItem.slides.length > 0) {
        setPreviewSlide(targetItem.slides[0]);
      }
    } else {
      const newItem: PlaylistItem = {
        id: pinId || `item-qp-${Math.random().toString(36).substring(2, 9)}`,
        title: title,
        type: 'bible',
        category: 'Scripture',
        slides: slides
      };
      setPlaylist(prev => [...prev, newItem]);
      setActiveItemId(newItem.id);
      setPreviewSlide(slides[0]);
    }
  };

  // Accumulative Slide Appending Handler for Quick Section Jump
  const handleAppendSlidesToActiveItem = (newSlides: Slide[], passageRef?: string) => {
    if (!newSlides || newSlides.length === 0) return;

    if (activeItemId && activeItem) {
      const updatedSlides = [...activeItem.slides, ...newSlides];
      setPlaylist(prev => prev.map(item => item.id === activeItemId ? {
        ...item,
        slides: updatedSlides,
        title: passageRef ? `${item.title} | ${passageRef}` : item.title
      } : item));
      setPreviewSlide(newSlides[0]);
    } else {
      const newItem: PlaylistItem = {
        id: `item-${Math.random().toString(36).substring(2, 9)}`,
        title: passageRef ? `Scripture: ${passageRef}` : newSlides[0].title || 'Service Item',
        type: 'bible',
        category: 'Scripture',
        slides: newSlides
      };
      setPlaylist(prev => [...prev, newItem]);
      setActiveItemId(newItem.id);
      setPreviewSlide(newSlides[0]);
    }
  };

  // Stepper handlers
  const handleNextSlide = () => {
    if (!activeItem || activeItem.slides.length === 0) return;
    const slides = activeItem.slides;

    const currentRefSlide = (liveSlide && activeItemId === liveItemId) ? liveSlide : (previewSlide || slides[0]);
    const currIdx = slides.findIndex(s => s.id === currentRefSlide?.id);

    if (currIdx >= 0 && currIdx < slides.length - 1) {
      const nextSlide = slides[currIdx + 1];
      setPreviewSlide(nextSlide);
      if (liveSlide !== null) {
        setLiveSlide(nextSlide);
        setLiveItemId(activeItemId);
      }
    } else {
      const itemIdx = playlist.findIndex(i => i.id === activeItemId);
      if (itemIdx >= 0 && itemIdx < playlist.length - 1) {
        const nextItem = playlist[itemIdx + 1];
        setActiveItemId(nextItem.id);
        if (nextItem.slides.length > 0) {
          const nextSlide = nextItem.slides[0];
          setPreviewSlide(nextSlide);
          if (liveSlide !== null) {
            setLiveSlide(nextSlide);
            setLiveItemId(nextItem.id);
          }
        }
      }
    }
  };

  const handlePrevSlide = () => {
    if (!activeItem || activeItem.slides.length === 0) return;
    const slides = activeItem.slides;

    const currentRefSlide = (liveSlide && activeItemId === liveItemId) ? liveSlide : (previewSlide || slides[0]);
    const currIdx = slides.findIndex(s => s.id === currentRefSlide?.id);

    if (currIdx > 0) {
      const prevSlide = slides[currIdx - 1];
      setPreviewSlide(prevSlide);
      if (liveSlide !== null) {
        setLiveSlide(prevSlide);
        setLiveItemId(activeItemId);
      }
    } else {
      const itemIdx = playlist.findIndex(i => i.id === activeItemId);
      if (itemIdx > 0) {
        const prevItem = playlist[itemIdx - 1];
        setActiveItemId(prevItem.id);
        if (prevItem.slides.length > 0) {
          const prevSlide = prevItem.slides[prevItem.slides.length - 1];
          setPreviewSlide(prevSlide);
          if (liveSlide !== null) {
            setLiveSlide(prevSlide);
            setLiveItemId(prevItem.id);
          }
        }
      }
    }
  };

  // Section Jump Pill Trigger
  const handleJumpSection = (sectionLabel: SectionTag) => {
    if (!activeItem) return;
    const target = activeItem.slides.find(s => s.sectionLabel === sectionLabel);
    if (target) {
      setPreviewSlide(target);
      setLiveSlide(target);
      setLiveItemId(activeItemId);
    }
  };

  // --- KEYBOARD SHORTCUT HANDLERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleToggleEmergency('isBlack');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleToggleEmergency('isClear');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleToggleEmergency('isLogo');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleEmergency('isFreeze');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (previewSlide) {
          setLiveSlide(previewSlide);
          setLiveItemId(activeItemId);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewSlide, activeItem, playlist, activeItemId]);

  // Playlist Handlers
  const handleSelectItem = (item: PlaylistItem) => {
    setActiveItemId(item.id);
    if (item.slides.length > 0) {
      setPreviewSlide(item.slides[0]);
    }
    if (item.speakerNotes) {
      setSpeakerNotes(item.speakerNotes);
    }
  };

  const handleAddItem = (type: ItemType) => {
    const newItem: PlaylistItem = {
      id: `item-${Math.random().toString(36).substring(2, 9)}`,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type,
      category: 'General',
      slides: [
        {
          id: `slide-${Math.random().toString(36).substring(2, 9)}`,
          content: `New ${type} slide content`,
          sectionLabel: 'Slide'
        }
      ]
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(newItem.slides[0]);
  };

  const handleRemoveItem = (id: string) => {
    setPlaylist(prev => prev.filter(i => i.id !== id));
    if (activeItemId === id) {
      setActiveItemId(playlist[0]?.id || null);
    }
  };

  const handleDuplicateItem = (id: string) => {
    const item = playlist.find(i => i.id === id);
    if (!item) return;
    const dupItem: PlaylistItem = {
      ...item,
      id: `item-${Math.random().toString(36).substring(2, 9)}`,
      title: `${item.title} (Copy)`
    };
    setPlaylist(prev => [...prev, dupItem]);
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    const updated = [...playlist];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPlaylist(updated);
  };

  const handleLoadTemplate = (templateName: string) => {
    setPlaylist(StorageService.getSavedData().playlist);
    setActiveItemId(StorageService.getSavedData().playlist[0]?.id || null);
  };

  // Importer & Library Handlers
  const handleAddSongToPlaylist = (song: Song) => {
    const slides = ImporterService.songToSlides(song);
    const newItem: PlaylistItem = {
      id: `item-song-${Math.random().toString(36).substring(2, 9)}`,
      title: song.title,
      type: 'song',
      songId: song.id,
      category: 'Worship',
      slides
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(slides[0]);
  };

  const handleAddBibleToPlaylist = (passageRef: string, slides: Slide[]) => {
    const newItem: PlaylistItem = {
      id: `item-bible-${Math.random().toString(36).substring(2, 9)}`,
      title: `Scripture: ${passageRef}`,
      type: 'bible',
      passageRef,
      category: 'Scripture',
      slides
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(slides[0]);
  };

  const handleAddBiblePassageAndGoLive = (passageRef: string, slides: Slide[], targetSlide?: Slide) => {
    const newItem: PlaylistItem = {
      id: `item-bible-${Math.random().toString(36).substring(2, 9)}`,
      title: `Scripture: ${passageRef}`,
      type: 'bible',
      passageRef,
      category: 'Scripture',
      slides
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    const target = targetSlide || slides[0];
    setPreviewSlide(target);
    setLiveSlide(target);
    setLiveItemId(newItem.id);
  };

  const handleAddMediaToPlaylist = (mediaAsset: MediaAsset) => {
    const newItem: PlaylistItem = {
      id: `item-media-${Math.random().toString(36).substring(2, 9)}`,
      title: mediaAsset.name,
      type: 'media',
      mediaUrl: mediaAsset.url,
      mediaType: mediaAsset.type === 'video' ? 'video' : 'image',
      category: mediaAsset.category,
      slides: [
        {
          id: `slide-media-${Math.random().toString(36).substring(2, 9)}`,
          content: mediaAsset.name,
          backgroundUrl: mediaAsset.url,
          backgroundType: mediaAsset.type === 'video' ? 'video' : 'image',
          sectionLabel: 'Title'
        }
      ]
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(newItem.slides[0]);
  };

  // Quick 2-Click Present Now Launcher
  const handleQuickPresentNow = (title: string, slides: Slide[]) => {
    const newItem: PlaylistItem = {
      id: `item-quick-${Math.random().toString(36).substring(2, 9)}`,
      title,
      type: 'song',
      slides
    };
    setPlaylist(prev => [newItem, ...prev]);
    setActiveItemId(newItem.id);
    setPreviewSlide(slides[0]);
    setLiveSlide(slides[0]);
    setLiveItemId(newItem.id);
  };

  // Package Export & Import
  const handleExportPackage = () => {
    ImporterService.exportServicePackage(
      'Sunday Service Worship Package',
      playlist,
      songs,
      themes,
      media
    );
  };

  const handleImportPackage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const pkg = JSON.parse(evt.target?.result as string);
        if (pkg.playlist) setPlaylist(pkg.playlist);
        if (pkg.songs) setSongs(pkg.songs);
        if (pkg.themes) setThemes(pkg.themes);
        if (pkg.media) setMedia(pkg.media);
        alert(`Successfully imported service package: ${pkg.serviceTitle || file.name}`);
      } catch (err) {
        alert('Invalid service package format.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateSong = (updatedSong: Song) => {
    setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
    setPlaylist(prevPlaylist => 
      prevPlaylist.map(item => {
        if (item.songId === updatedSong.id || item.title === updatedSong.title) {
          const updatedSlides: Slide[] = ImporterService.songToSlides(updatedSong);
          return {
            ...item,
            title: updatedSong.title,
            slides: updatedSlides
          };
        }
        return item;
      })
    );
  };

  const handleDeleteSong = (songId: string) => {
    setSongs(prev => prev.filter(s => s.id !== songId));
  };

  return (
    <div className="w-screen h-screen bg-[#090d14] text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Header */}
      <Header
        serviceTitle="Sunday Service Worship & Media"
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenQuickMode={() => setIsQuickModeOpen(true)}
        onOpenSermonMode={() => setIsSermonModeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAudienceOutput={() => BroadcastService.openAudienceWindow()}
        onOpenStageOutput={() => BroadcastService.openStageWindow()}
        onExportPackage={handleExportPackage}
        onImportPackage={handleImportPackage}
        isAudienceActive={isAudienceActive}
        isStageActive={isStageActive}
        isSaved={isSaved}
        onOpenSlideDesigner={() => setIsDesignerOpen(true)}
      />

      {/* Main Studio Body Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Service Playlist */}
        <PlaylistPanel
          playlist={playlist}
          activeItemId={activeItemId}
          onSelectItem={handleSelectItem}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onDuplicateItem={handleDuplicateItem}
          onMoveItem={handleMoveItem}
          onLoadTemplate={handleLoadTemplate}
          liveItemId={liveItemId}
        />

        {/* Tabbed Library Browser (Songs, Bible, Announcements, Media, Themes) */}
        <LibraryTabs
          songs={songs}
          media={media}
          themes={themes}
          activeThemeId={activeThemeId}
          quickPinnedItems={quickPinnedItems}
          onAddSongToPlaylist={handleAddSongToPlaylist}
          onAddBibleToPlaylist={handleAddBibleToPlaylist}
          onAddBiblePassageAndGoLive={handleAddBiblePassageAndGoLive}
          onAppendSlidesToActiveItem={handleAppendSlidesToActiveItem}
          onPinToQuickSection={handlePinToQuickSection}
          onUnpinFromQuickSection={handleUnpinFromQuickSection}
          onAddMediaToPlaylist={handleAddMediaToPlaylist}
          onSelectTheme={(tId) => setActiveThemeId(tId)}
          onGoLiveWithSlide={(slide) => {
            setLiveSlide(slide);
            setLiveItemId(activeItemId);
          }}
          onTriggerLowerThirdAnnouncement={handleTriggerLowerThirdAnnouncement}
          onAddNewSong={(s) => setSongs(prev => [s, ...prev])}
          onUpdateSong={handleUpdateSong}
          onDeleteSong={handleDeleteSong}
        />

        {/* Center Workspace (Preview/Live Dual Cards & Slide Grid) */}
        <CenterWorkspace
          activeItem={activeItem}
          previewSlide={previewSlide}
          liveSlide={liveSlide}
          activeTheme={activeTheme}
          quickPinnedItems={quickPinnedItems}
          onSelectSlidePreview={(slide) => setPreviewSlide(slide)}
          onSendSlideLive={(slide) => {
            setLiveSlide(slide);
            setLiveItemId(activeItemId);
          }}
          onJumpSection={handleJumpSection}
          onTriggerLowerThirdAnnouncement={handleTriggerLowerThirdAnnouncement}
          onClearLowerThirdAnnouncement={handleClearLowerThirdAnnouncement}
          activeLowerThirdText={activeLowerThirdText}
          onUnpinFromQuickSection={handleUnpinFromQuickSection}
          onLoadQuickPinnedSlides={handleLoadQuickPinnedSlides}
        />

        {/* Right Inspector Panel */}
        <InspectorPanel
          theme={activeTheme}
          onUpdateTheme={(updated) => {
            setThemes(prev => prev.map(t => t.id === activeTheme.id ? { ...t, ...updated } : t));
          }}
          activeSlide={previewSlide}
          onUpdateSlide={(updated) => {
            if (!previewSlide || !activeItem) return;
            const updatedSlides = activeItem.slides.map(s => s.id === previewSlide.id ? { ...s, ...updated } : s);
            setPlaylist(prev => prev.map(i => i.id === activeItem.id ? { ...i, slides: updatedSlides } : i));
            setPreviewSlide(prev => prev ? { ...prev, ...updated } : null);
          }}
          mediaList={media}
          speakerNotes={speakerNotes}
          onUpdateSpeakerNotes={(notes) => setSpeakerNotes(notes)}
        />
      </div>

      <BottomControlBar
        emergency={emergency}
        onToggleEmergency={handleToggleEmergency}
        transition={transition}
        onChangeTransition={(t) => setTransition(prev => ({ ...prev, ...t }))}
        onPrevSlide={handlePrevSlide}
        onNextSlide={handleNextSlide}
        onGoLiveCurrent={() => {
          if (previewSlide) {
            setLiveSlide(previewSlide);
            setLiveItemId(activeItemId);
          }
        }}
        countdownSeconds={countdownSeconds}
        isCountdownRunning={isCountdownRunning}
        onStartCountdown={(secs) => {
          setCountdownSeconds(secs);
          setIsCountdownRunning(true);
        }}
        onStopCountdown={() => {
          setIsCountdownRunning(false);
          setCountdownSeconds(0);
        }}
        isFullSlideCountdown={isFullSlideCountdown}
        onToggleFullSlideCountdown={setIsFullSlideCountdown}
        countdownTargetScreen={countdownTargetScreen}
        onChangeCountdownTargetScreen={setCountdownTargetScreen}
        countdownEndAction={countdownEndAction}
        onChangeCountdownEndAction={setCountdownEndAction}
        countdownEndVideoId={countdownEndVideoId}
        onChangeCountdownEndVideoId={setCountdownEndVideoId}
        mediaList={media}
      />

      {/* Modals & Dialogs */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        songs={songs}
        media={media}
        playlist={playlist}
        onAddSong={handleAddSongToPlaylist}
        onAddBible={handleAddBibleToPlaylist}
        onAddMedia={handleAddMediaToPlaylist}
        onGoLiveSlide={(s) => setLiveSlide(s)}
      />

      <QuickPresentationModal
        isOpen={isQuickModeOpen}
        onClose={() => setIsQuickModeOpen(false)}
        songs={songs}
        media={media}
        onPresentNow={handleQuickPresentNow}
      />

      <SermonModeModal
        isOpen={isSermonModeOpen}
        onClose={() => setIsSermonModeOpen(false)}
        onAddSermonToPlaylist={(item) => {
          setPlaylist(prev => [...prev, item]);
          setActiveItemId(item.id);
          setPreviewSlide(item.slides[0]);
        }}
      />

      <SlideDesignerModal
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        activeSlide={previewSlide}
        activeTheme={activeTheme}
        onSaveSlide={(updated) => {
          if (!previewSlide || !activeItem) return;
          const updatedSlides = activeItem.slides.map(s => s.id === previewSlide.id ? updated : s);
          setPlaylist(prev => prev.map(i => i.id === activeItem.id ? { ...i, slides: updatedSlides } : i));
          setPreviewSlide(updated);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetDefaults={() => {
          localStorage.clear();
          window.location.reload();
        }}
      />
    </div>
  );
};
