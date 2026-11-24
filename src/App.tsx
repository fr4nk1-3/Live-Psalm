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
  QuickPinnedItem,
  ChurchProfile,
  ProjectorLayout
} from './types/presentation';
import { StorageService } from './services/storage';
import { BroadcastService } from './services/broadcast';
import { ImporterService } from './services/importer';
import { MediaVaultService } from './services/mediaVault';
import { applyUiTheme } from './utils/uiTheme';

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
import { StreamingModal } from './components/StreamingModal';
import { MediaPlayerBar } from './components/MediaPlayerBar';

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
  const [liveSlide, setLiveSlide] = useState<Slide | null>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_live_slide_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [liveItemId, setLiveItemId] = useState<string | null>(null);

  // Independent Live Lower-Third Announcement State
  const [activeLowerThirdText, setActiveLowerThirdText] = useState<{
    id?: string;
    title?: string;
    subtitle?: string;
    content?: string;
    speed?: 'slow' | 'normal' | 'fast';
  } | null>(null);

  // Emergency States (Mutually Exclusive)
  // Church profile, kept reactive so the broadcast dock and logo follow edits
  const [churchProfile, setChurchProfile] = useState<ChurchProfile>(() => StorageService.getChurchProfile());

  const [emergency, setEmergency] = useState<EmergencyState>({
    isBlack: false,
    isClear: false,
    isLogo: false,
    isFreeze: false,
    isStopMedia: false
  });

  // Transitions (initialized from saved AppSettings)
  const [transition, setTransition] = useState<TransitionSettings>(() => {
    const s = StorageService.getSettings();
    return {
      type: s.defaultTransition || 'fade',
      durationMs: s.transitionDurationMs ?? 400
    };
  });

  const activeThemeIdRef = React.useRef<string>(activeThemeId);
  activeThemeIdRef.current = activeThemeId;

  const handleProjectorLayoutChange = React.useCallback((layout: ProjectorLayout) => {
    setThemes(prev =>
      prev.map(t =>
        t.id === activeThemeIdRef.current
          ? {
              ...t,
              projectorLayout: layout,
              lowerThirdStyle: layout === 'lower_third'
            }
          : t
      )
    );
    const currentSettings = StorageService.getSettings();
    if (currentSettings.defaultProjectorLayout !== layout) {
      StorageService.saveSettings({ ...currentSettings, defaultProjectorLayout: layout });
    }
  }, []);

  useEffect(() => {
    const s = StorageService.getSettings();
    applyUiTheme(s.uiTheme || 'system');
    if (s.defaultProjectorLayout) {
      setThemes(prev =>
        prev.map(t =>
          t.id === activeThemeIdRef.current && !t.projectorLayout
            ? {
                ...t,
                projectorLayout: s.defaultProjectorLayout,
                lowerThirdStyle: s.defaultProjectorLayout === 'lower_third'
              }
            : t
        )
      );
    }
    if (s.autoLaunchAudience && !BroadcastService.isAudienceOpen()) {
      BroadcastService.openAudienceWindow();
      setIsAudienceActive(true);
    }
    const handleSettingsUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        setTransition(prev => ({
          type: detail.defaultTransition || prev.type,
          durationMs: detail.transitionDurationMs ?? prev.durationMs
        }));
        setAudienceViewMode(detail.audienceViewMode || 'near');
        if (detail.defaultProjectorLayout) {
          setThemes(prev =>
            prev.map(t =>
              t.id === activeThemeIdRef.current
                ? {
                    ...t,
                    projectorLayout: detail.defaultProjectorLayout,
                    lowerThirdStyle: detail.defaultProjectorLayout === 'lower_third'
                  }
                : t
            )
          );
        }
        applyUiTheme(detail.uiTheme || 'system');
      }
    };
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: light)');
    const handleSystemThemeChange = () => {
      const current = StorageService.getSettings().uiTheme || 'system';
      if (current === 'system') applyUiTheme('system');
    };
    window.addEventListener('app-settings-updated', handleSettingsUpdate);
    mediaQuery?.addEventListener?.('change', handleSystemThemeChange);
    return () => {
      window.removeEventListener('app-settings-updated', handleSettingsUpdate);
      mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
    };
  }, []);

  // Speaker / Stage Notes
  const [speakerNotes, setSpeakerNotes] = useState<string>(playlist[0]?.speakerNotes || '');

  // Countdown Ticker & Advanced Options State
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [isCountdownRunning, setIsCountdownRunning] = useState<boolean>(false);
  const countdownAnchorRef = React.useRef<{ baseEpochMs: number; baseSeconds: number } | null>(null);
  const [countUp, setCountUp] = useState<boolean>(false);
  const [isFullSlideCountdown, setIsFullSlideCountdown] = useState<boolean>(false);
  const [countdownTargetScreen, setCountdownTargetScreen] = useState<'audience' | 'stage' | 'both'>('both');
  const [countdownTitle, setCountdownTitle] = useState<string>(
    () => localStorage.getItem('live_psalms_countdown_title_v1') || 'SERVICE STARTING IN'
  );
  const [countdownOvertimeTitle, setCountdownOvertimeTitle] = useState<string>(
    () => localStorage.getItem('live_psalms_countdown_overtime_title_v1') || 'SERVICE IN PROGRESS'
  );
  const [countdownTargetTimestamp, setCountdownTargetTimestamp] = useState<number | null>(null);
  const [countdownEndAction, setCountdownEndAction] = useState<'none' | 'play_video' | 'start_playlist' | 'go_live_active'>('none');
  const [countdownEndVideoId, setCountdownEndVideoId] = useState<string>('');

  // Display Windows Active Status
  const [isAudienceActive, setIsAudienceActive] = useState<boolean>(false);
  const [audienceViewMode, setAudienceViewMode] = useState<'near' | 'far'>(
    () => StorageService.getSettings().audienceViewMode || 'near'
  );
  const [isStageActive, setIsStageActive] = useState<boolean>(false);
  const [isLedActive, setIsLedActive] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // ── Video Background & Fullscreen Video State ──
  /** Global video BG: loops silently behind every slide across the whole service */
  const [globalVideoBgUrl, setGlobalVideoBgUrl] = useState<string | null>(null);
  /** Item-level video BG: loops behind all slides of the currently active item only */
  const [itemVideoBgUrl, setItemVideoBgUrl] = useState<string | null>(null);
  /** Active fullscreen video being controlled by MediaPlayerBar */
  const [activeVideoMedia, setActiveVideoMedia] = useState<MediaAsset | null>(null);
  /** Shared background applied across all Bible scripture slides */
  const [bibleBackground, setBibleBackground] = useState<{ backgroundUrl?: string; backgroundType?: Slide['backgroundType'] }>(
    () => StorageService.getBibleBackground()
  );

  // Sync media logo item name & URL whenever the user updates Church Profile in Settings
  useEffect(() => {
    const handleProfileUpdated = (evt?: any) => {
      const profile = evt?.detail || StorageService.getChurchProfile();
      setChurchProfile(profile);
      const logoName = StorageService.getLogoDisplayName(profile);
      setMedia(prev =>
        prev.map(m =>
          m.id === 'media-logo-main' || m.type === 'logo'
            ? { ...m, name: logoName, url: profile.logoUrl || m.url }
            : m
        )
      );
    };
    window.addEventListener('church-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('church-profile-updated', handleProfileUpdated);
  }, []);

  // Load any large local video/image assets persisted in IndexedDB MediaVault
  useEffect(() => {
    MediaVaultService.loadAllVaultMedia()
      .then(vaultAssets => {
        if (vaultAssets.length > 0) {
          setMedia(prev => {
            const next = [...prev];
            vaultAssets.forEach(va => {
              const existingIdx = next.findIndex(m => m.id === va.id);
              if (existingIdx >= 0) {
                next[existingIdx] = va;
              } else {
                next.unshift(va);
              }
            });
            return next;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Helper to apply current Bible background to any Bible slides
  const applyBibleBgToSlides = (slides: Slide[], bg = bibleBackground): Slide[] => {
    return slides.map(s =>
      s.sectionLabel === 'Scripture'
        ? { ...s, backgroundUrl: bg.backgroundUrl, backgroundType: bg.backgroundType }
        : s
    );
  };

  // Update background across ALL Bible slides in playlist, quickPinnedItems, previewSlide, and liveSlide
  const propagateBibleBackground = (bg: { backgroundUrl?: string; backgroundType?: Slide['backgroundType'] }) => {
    setBibleBackground(bg);
    StorageService.saveBibleBackground(bg);

    setPlaylist(prev =>
      prev.map(item => {
        const isBibleItem = item.type === 'bible' || item.slides.some(s => s.sectionLabel === 'Scripture');
        if (!isBibleItem) return item;
        return {
          ...item,
          slides: item.slides.map(s =>
            item.type === 'bible' || s.sectionLabel === 'Scripture'
              ? { ...s, backgroundUrl: bg.backgroundUrl, backgroundType: bg.backgroundType }
              : s
          )
        };
      })
    );

    setQuickPinnedItems(prev =>
      prev.map(pin =>
        pin.type === 'bible'
          ? {
              ...pin,
              slides: pin.slides.map(s => ({
                ...s,
                backgroundUrl: bg.backgroundUrl,
                backgroundType: bg.backgroundType
              }))
            }
          : pin
      )
    );

    setPreviewSlide(prev =>
      prev && (prev.sectionLabel === 'Scripture' || activeItem?.type === 'bible')
        ? { ...prev, backgroundUrl: bg.backgroundUrl, backgroundType: bg.backgroundType }
        : prev
    );

    setLiveSlide(prev =>
      prev && prev.sectionLabel === 'Scripture'
        ? { ...prev, backgroundUrl: bg.backgroundUrl, backgroundType: bg.backgroundType }
        : prev
    );
  };

  // Modal Dialog States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickModeOpen, setIsQuickModeOpen] = useState(false);
  const [isSermonModeOpen, setIsSermonModeOpen] = useState(false);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreamingOpen, setIsStreamingOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const activeItem = playlist.find(i => i.id === activeItemId) || null;
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];

  /** The window subtitle reflects the first section heading in the service. */
  const serviceTitle = (() => {
    const heading = playlist.find(item => item.type === 'header' && item.title.trim());
    if (!heading) return 'Untitled service';
    const raw = heading.title.trim();
    return raw === raw.toUpperCase()
      ? raw.toLowerCase().replace(/(^|\s|&)([a-z])/g, (_match, prefix, letter) => prefix + letter.toUpperCase())
      : raw;
  })();

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
      setIsLedActive(BroadcastService.isLedOpen());
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  // Sync itemVideoBgUrl whenever the live item or playlist changes
  useEffect(() => {
    const targetItem = playlist.find(i => i.id === (liveItemId || activeItemId));
    setItemVideoBgUrl(targetItem?.videoBackgroundUrl || null);
  }, [liveItemId, activeItemId, playlist]);

  //Sync activeVideoMedia when liveSlide changes
  useEffect(() => {
    if (liveSlide && liveSlide.backgroundType === 'video' && liveSlide.backgroundUrl && !liveSlide.content) {
      const matched = media.find(m => m.url === liveSlide.backgroundUrl);
      setActiveVideoMedia(matched || {
        id: liveSlide.id,
        name: liveSlide.title || 'Live Video',
        type: 'video',
        url: liveSlide.backgroundUrl,
        category: 'Videos'
      });
    } else {
      setActiveVideoMedia(null);
    }
  }, [liveSlide, media]);

  const handleCountdownFinished = () => {
    // Ensure any full-slide countdown overlay is dismissed so only the intended content shows
    setIsFullSlideCountdown(false);

    if (countdownEndAction === 'start_playlist' && playlist.length > 0) {
      const firstItem = playlist[0];
      setActiveItemId(firstItem.id);
      setSpeakerNotes(firstItem.speakerNotes || '');
      if (firstItem.slides && firstItem.slides.length > 0) {
        setPreviewSlide(firstItem.slides[0]);
        setLiveSlide(firstItem.slides[0]);
        setLiveItemId(firstItem.id);
      }
    } else if (countdownEndAction === 'play_video') {
      const vid = media.find(m => m.id === countdownEndVideoId) || media.find(m => m.type === 'video');
      if (vid) {
        const videoSlide: Slide = {
          id: `countdown-vid-${Date.now()}`,
          title: vid.name,
          backgroundUrl: vid.url,
          backgroundType: 'video',
          content: ''
        };
        setPreviewSlide(videoSlide);
        setLiveSlide(videoSlide);
      }
    } else if (countdownEndAction === 'go_live_active') {
      if (previewSlide) {
        setLiveSlide(previewSlide);
        setLiveItemId(activeItemId);
      } else if (activeItem && activeItem.slides.length > 0) {
        setPreviewSlide(activeItem.slides[0]);
        setLiveSlide(activeItem.slides[0]);
        setLiveItemId(activeItem.id);
      }
    }
  };

  // Countdown Ticker Timer (wall-clock anchored for 1-second-per-second accuracy in both duration & clock modes)
  useEffect(() => {
    if (!isCountdownRunning) {
      countdownAnchorRef.current = null;
      return;
    }

    if (countdownTargetTimestamp === null && !countdownAnchorRef.current) {
      countdownAnchorRef.current = { baseEpochMs: Date.now(), baseSeconds: countdownSeconds };
    }

    const syncTick = () => {
      const now = Date.now();
      if (countdownTargetTimestamp !== null) {
        const diff = Math.ceil((countdownTargetTimestamp - now) / 1000);
        const next = diff <= 0 && countdownEndAction !== 'none' ? 0 : diff;
        setCountdownSeconds(prev => (prev === next ? prev : next));
        return;
      }

      const anchor = countdownAnchorRef.current;
      if (!anchor) return;
      const elapsed = Math.floor((now - anchor.baseEpochMs) / 1000);
      const raw = countUp ? anchor.baseSeconds + elapsed : anchor.baseSeconds - elapsed;
      const next = !countUp && raw <= 0 && countdownEndAction !== 'none' ? 0 : raw;
      setCountdownSeconds(prev => (prev === next ? prev : next));
    };

    const timer = setInterval(syncTick, 250);
    return () => clearInterval(timer);
  }, [isCountdownRunning, countUp, countdownEndAction, countdownTargetTimestamp]);

  // Trigger completion action & stop timer when countdown hits 00:00
  useEffect(() => {
    if (isCountdownRunning && !countUp && countdownSeconds === 0 && countdownEndAction !== 'none') {
      setIsCountdownRunning(false);
      handleCountdownFinished();
    }
  }, [countdownSeconds, isCountdownRunning, countUp, countdownEndAction]);

  // Sync live slide, ticker, and emergency state directly to OBS Studio (WebSocket + Local Files)
  useEffect(() => {
    const tickerFormatted = activeLowerThirdText
      ? [activeLowerThirdText.title, activeLowerThirdText.content, activeLowerThirdText.subtitle].filter(Boolean).join(' — ')
      : '';
    const isPureVideo = !!(liveSlide && liveSlide.backgroundType === 'video' && !liveSlide.content);
    BroadcastService.syncObsDirectOutput({
      title: isPureVideo ? '' : (liveSlide?.title || liveSlide?.sectionLabel || ''),
      content: isPureVideo ? '' : (liveSlide?.content || ''),
      subtitle: isPureVideo ? '' : (liveSlide?.subtitle || ''),
      ticker: tickerFormatted,
      isBlack: emergency.isBlack,
      isClear: emergency.isClear
    });
  }, [liveSlide, activeLowerThirdText, emergency.isBlack, emergency.isClear]);
  // Broadcast Updates to Audience Display
  useEffect(() => {
    try {
      if (liveSlide) {
        localStorage.setItem('live_psalms_live_slide_v1', JSON.stringify(liveSlide));
      } else {
        localStorage.removeItem('live_psalms_live_slide_v1');
      }
    } catch (e) {}
    BroadcastService.postMessage({
      type: 'LIVE_SLIDE_CHANGE',
      liveSlide
    });
  }, [liveSlide]);

  // Broadcast global video BG changes to all output windows
  useEffect(() => {
    try {
      if (globalVideoBgUrl) {
        localStorage.setItem('live_psalms_global_video_bg_v1', globalVideoBgUrl);
      } else {
        localStorage.removeItem('live_psalms_global_video_bg_v1');
      }
    } catch (e) {}
    BroadcastService.postMessage({
      type: 'GLOBAL_VIDEO_BG_CHANGE',
      globalVideoBgUrl
    });
  }, [globalVideoBgUrl]);

  // Broadcast item-level video BG changes to all output windows
  useEffect(() => {
    try {
      if (itemVideoBgUrl) {
        localStorage.setItem('live_psalms_item_video_bg_v1', itemVideoBgUrl);
      } else {
        localStorage.removeItem('live_psalms_item_video_bg_v1');
      }
    } catch (e) {}
    BroadcastService.postMessage({
      type: 'ITEM_VIDEO_BG_CHANGE',
      itemVideoBgUrl
    });
  }, [itemVideoBgUrl]);

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

  useEffect(() => {
    BroadcastService.postMessage({
      type: 'TRANSITION_CHANGE',
      transition
    });
  }, [transition]);

  // Broadcast Countdown Updates to Audience & Stage Displays
  useEffect(() => {
    BroadcastService.postMessage({
      type: 'COUNTDOWN_UPDATE',
      countdownRemaining: countdownSeconds,
      countdownRunning: isCountdownRunning,
      isFullSlideCountdown,
      countdownTargetScreen,
      countdownTitle,
      countdownOvertimeTitle
    });
  }, [countdownSeconds, isCountdownRunning, isFullSlideCountdown, countdownTargetScreen, countdownTitle, countdownOvertimeTitle]);

  // Broadcast Updates to Stage Display (Confidence Monitor)
  useEffect(() => {
    const upcomingNext = getUpcomingNextSlide();
    let savedMsg: string | null = null;
    let savedFlash = false;
    try {
      const raw = localStorage.getItem('live_psalms_stage_message_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        savedMsg = parsed?.message || null;
        savedFlash = Boolean(parsed?.flash);
      }
    } catch {}
    BroadcastService.postMessage({
      type: 'STAGE_DISPLAY_UPDATE',
      stageState: {
        currentSlide: liveSlide || undefined,
        nextSlide: upcomingNext,
        currentItemTitle: activeItem?.title,
        clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        countdownRemaining: countdownSeconds,
        countdownRunning: isCountdownRunning,
        speakerNotes,
        stageMessage: savedMsg,
        stageMessageFlash: savedFlash
      }
    });
  }, [liveSlide, previewSlide, activeItem, playlist, countdownSeconds, isCountdownRunning, speakerNotes]);

  // Respond when any newly-opened output window requests initial state
  useEffect(() => {
    const unsub = BroadcastService.subscribe((payload) => {
      if (payload.type === 'REQUEST_INITIAL_STATE') {
        BroadcastService.postMessage({ type: 'THEME_CHANGE', theme: activeTheme });
        BroadcastService.postMessage({ type: 'TRANSITION_CHANGE', transition });
        BroadcastService.postMessage({ type: 'EMERGENCY_STATE_CHANGE', emergency });
        BroadcastService.postMessage({ type: 'GLOBAL_VIDEO_BG_CHANGE', globalVideoBgUrl });
        BroadcastService.postMessage({ type: 'ITEM_VIDEO_BG_CHANGE', itemVideoBgUrl });
        BroadcastService.postMessage({ type: 'LIVE_SLIDE_CHANGE', liveSlide });
        BroadcastService.postMessage({ type: 'LOWER_THIRD_TRIGGER', lowerThirdText: activeLowerThirdText });
        BroadcastService.postMessage({ type: 'APP_SETTINGS_UPDATE', appSettings: StorageService.getSettings() });
        BroadcastService.postMessage({
          type: 'COUNTDOWN_UPDATE',
          countdownRemaining: countdownSeconds,
          countdownRunning: isCountdownRunning,
          isFullSlideCountdown,
          countdownTargetScreen,
          countdownTitle,
          countdownOvertimeTitle
        });
        let savedMsg: string | null = null;
        let savedFlash = false;
        try {
          const raw = localStorage.getItem('live_psalms_stage_message_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            savedMsg = parsed?.message || null;
            savedFlash = Boolean(parsed?.flash);
          }
        } catch {}
        BroadcastService.postMessage({
          type: 'STAGE_DISPLAY_UPDATE',
          stageState: {
            currentSlide: liveSlide || undefined,
            nextSlide: getUpcomingNextSlide(),
            currentItemTitle: activeItem?.title,
            clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            countdownRemaining: countdownSeconds,
            countdownRunning: isCountdownRunning,
            speakerNotes,
            stageMessage: savedMsg,
            stageMessageFlash: savedFlash
          }
        });
      }
    });
    return () => unsub();
  }, [
    activeTheme,
    transition,
    emergency,
    globalVideoBgUrl,
    itemVideoBgUrl,
    liveSlide,
    activeLowerThirdText,
    countdownSeconds,
    isCountdownRunning,
    isFullSlideCountdown,
    countdownTargetScreen,
    activeItem,
    speakerNotes
  ]);

  // Lower Third Ticker Broadcast Trigger
  const handleTriggerLowerThirdAnnouncement = (slide: Slide & { speed?: 'slow' | 'normal' | 'fast' }) => {
    const payloadData = {
      id: slide.id,
      title: slide.title || activeItem?.title || 'Announcement',
      subtitle: slide.subtitle,
      content: (slide.content || '').replace(/\r?\n/g, ' — '),
      speed: slide.speed || 'normal'
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

  // Quick Section Pinned Items State & Remembered Last Viewed Slide Map
  const [quickPinnedItems, setQuickPinnedItems] = useState<QuickPinnedItem[]>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_quick_pins_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [lastViewedSlideMap, setLastViewedSlideMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_last_slide_map_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const [primaryBibleTranslation, setPrimaryBibleTranslation] = useState<string>('bible-eng-nkjv');
  const [activeBibleTranslation, setActiveBibleTranslation] = useState<string>('bible-eng-nkjv');
  const [parallelBibleTranslation, setParallelBibleTranslation] = useState<string | null>(null);
  const [targetParallelVersionId, setTargetParallelVersionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_target_parallel_v1');
      if (!saved) return null;
      return StorageService.resolveTranslationId(saved);
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (targetParallelVersionId) {
        localStorage.setItem('live_psalms_target_parallel_v1', targetParallelVersionId);
      } else {
        localStorage.removeItem('live_psalms_target_parallel_v1');
      }
    } catch (e) {}
  }, [targetParallelVersionId]);

  useEffect(() => {
    try {
      localStorage.setItem('live_psalms_quick_pins_v1', JSON.stringify(quickPinnedItems));
    } catch (e) {}
  }, [quickPinnedItems]);

  useEffect(() => {
    try {
      localStorage.setItem('live_psalms_last_slide_map_v1', JSON.stringify(lastViewedSlideMap));
    } catch (e) {}
  }, [lastViewedSlideMap]);

  /** Helper to normalize book/chapter key so remembered verse works across pinned items and playlist items */
  const getBookChapterKey = (title?: string, bibleMeta?: { book: string; chapter: number }): string | null => {
    if (bibleMeta?.book && bibleMeta?.chapter) {
      return `bc_${bibleMeta.book.toLowerCase()}_${bibleMeta.chapter}`;
    }
    if (!title) return null;
    const cleaned = title.replace(/^Scripture:\s*/i, '').trim();
    const match = cleaned.match(/^(.+?)\s+(\d+)/);
    if (match) {
      return `bc_${match[1].trim().toLowerCase()}_${match[2]}`;
    }
    return null;
  };

  /** Record the last viewed/selected slide for a Bible book/chapter or playlist item */
  const recordLastViewedSlide = (
    itemId: string | null | undefined,
    slide: Slide | null | undefined,
    itemTitle?: string
  ) => {
    if (!slide) return;
    const bcKey = getBookChapterKey(itemTitle || activeItem?.title, slide.bibleMeta);
    const titleKey = (itemTitle || activeItem?.title || '').replace(/^Scripture:\s*/i, '').trim().toLowerCase();

    setLastViewedSlideMap(prev => {
      const next = { ...prev };
      if (itemId) next[itemId] = slide.id;
      if (titleKey) {
        next[titleKey] = slide.id;
        next[`scripture: ${titleKey}`] = slide.id;
      }
      if (bcKey) next[bcKey] = slide.id;
      return next;
    });

    if (itemId) {
      setPlaylist(prev =>
        prev.map(i => (i.id === itemId ? { ...i, lastViewedSlideId: slide.id } : i))
      );
    }

    setQuickPinnedItems(prev =>
      prev.map(p => {
        const pTitleClean = p.title.replace(/^Scripture:\s*/i, '').trim().toLowerCase();
        const pBcKey = getBookChapterKey(p.title, p.bibleMeta);
        if (
          (itemId && p.id === itemId) ||
          (titleKey && pTitleClean === titleKey) ||
          (bcKey && pBcKey === bcKey)
        ) {
          return { ...p, lastViewedSlideId: slide.id };
        }
        return p;
      })
    );
  };

  /** Find a slide in `slides` matching a target slide or remembered slide ID (by ID, exact book/chapter/verse, or title) */
  const findMatchingSlideInList = (
    slides: Slide[],
    refSlideOrId?: Slide | string | null,
    fallbackItem?: { title?: string; passageRef?: string; bibleMeta?: { book: string; chapter: number } } | null
  ): Slide | undefined => {
    if (!slides || slides.length === 0 || !refSlideOrId) return undefined;
    if (typeof refSlideOrId === 'string') {
      const exact = slides.find(s => s.id === refSlideOrId);
      if (exact) return exact;
      // Extract book, chapter, and verse number from deterministic ID `slide-bv-Book-Chapter-Verse`
      const bvMatch = refSlideOrId.match(/^slide-bv-(.+)-(\d+)-(\d+)$/);
      if (bvMatch) {
        const refBook = StorageService.parseBibleReference(`${bvMatch[1]} ${bvMatch[2]}`)?.book || bvMatch[1];
        const refChap = parseInt(bvMatch[2], 10);
        const vNum = parseInt(bvMatch[3], 10);
        const byExactCoords = slides.find(s => {
          const c = StorageService.extractSlideBibleCoords(s, fallbackItem);
          return c && c.book.toLowerCase() === refBook.toLowerCase() && c.chapter === refChap && c.verse === vNum;
        });
        if (byExactCoords) return byExactCoords;
        const byVerse = slides.find(
          s => s.bibleMeta?.verse === vNum || s.title?.endsWith(`:${vNum}`)
        );
        if (byVerse) return byVerse;
      }
      return undefined;
    } else {
      const exact = slides.find(s => s.id === refSlideOrId.id);
      if (exact) return exact;

      const targetCoords = StorageService.extractSlideBibleCoords(refSlideOrId, fallbackItem);
      if (targetCoords) {
        const byExactCoords = slides.find(s => {
          const c = StorageService.extractSlideBibleCoords(s, fallbackItem);
          return (
            c &&
            c.book.toLowerCase() === targetCoords.book.toLowerCase() &&
            c.chapter === targetCoords.chapter &&
            c.verse === targetCoords.verse
          );
        });
        if (byExactCoords) return byExactCoords;
      }

      if (refSlideOrId.title) {
        const normTitle = refSlideOrId.title.trim().toLowerCase();
        const byTitle = slides.find(s => s.title?.trim().toLowerCase() === normTitle);
        if (byTitle) return byTitle;
      }
      return undefined;
    }
  };

  /** Resolve which slide to select when opening a pinned item or playlist item */
  const resolveRememberedSlide = (
    slides: Slide[],
    itemId?: string,
    title?: string,
    explicitTarget?: Slide,
    itemLastViewedId?: string,
    bibleMeta?: { book: string; chapter: number }
  ): Slide => {
    const fallbackItem = { title, bibleMeta };
    if (explicitTarget) {
      const matched = findMatchingSlideInList(slides, explicitTarget, fallbackItem);
      if (matched) return matched;
    }
    const cleanTitle = (title || '').replace(/^Scripture:\s*/i, '').trim().toLowerCase();
    const bcKey = getBookChapterKey(title, bibleMeta || slides[0]?.bibleMeta);
    const candidateIds = [
      itemLastViewedId,
      itemId ? lastViewedSlideMap[itemId] : undefined,
      cleanTitle ? lastViewedSlideMap[cleanTitle] : undefined,
      bcKey ? lastViewedSlideMap[bcKey] : undefined
    ].filter(Boolean) as string[];

    for (const cid of candidateIds) {
      const matched = findMatchingSlideInList(slides, cid, fallbackItem);
      if (matched) return matched;
    }
    return slides[0];
  };

  const handlePinToQuickSection = (
    title: string,
    slides: Slide[],
    type: 'bible' | 'song' | 'announcement' = 'bible',
    sourceRef?: string,
    targetSlide?: Slide,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => {
    if (!slides || slides.length === 0) return;

    const processedSlides = type === 'bible' ? applyBibleBgToSlides(slides) : slides;
    const cleanTitle = title.replace(/^Scripture:\s*/i, '').trim();
    const targetBcKey = type === 'bible' ? getBookChapterKey(cleanTitle, bibleMeta || processedSlides[0]?.bibleMeta) : null;
    const sameBibleScope = (
      aMeta?: PlaylistItem['bibleMeta'],
      aSlides?: Slide[],
      bMeta?: PlaylistItem['bibleMeta'],
      bSlides?: Slide[]
    ) => {
      const aStart = aMeta?.startVerse ?? aSlides?.[0]?.bibleMeta?.verse ?? 1;
      const aEnd = aMeta?.endVerse ?? aSlides?.[Math.max(0, (aSlides?.length || 1) - 1)]?.bibleMeta?.verse ?? aSlides?.length ?? 1;
      const bStart = bMeta?.startVerse ?? bSlides?.[0]?.bibleMeta?.verse ?? 1;
      const bEnd = bMeta?.endVerse ?? bSlides?.[Math.max(0, (bSlides?.length || 1) - 1)]?.bibleMeta?.verse ?? bSlides?.length ?? 1;
      return aStart === bStart && aEnd === bEnd;
    };

    // Check if item already exists in playlist (match by title, passageRef, or book/chapter + verse range)
    const existingItem = playlist.find(i => {
      if (
        i.title.toLowerCase() === cleanTitle.toLowerCase() ||
        i.title.toLowerCase() === `scripture: ${cleanTitle.toLowerCase()}` ||
        (i.passageRef && i.passageRef.toLowerCase() === cleanTitle.toLowerCase())
      ) {
        return true;
      }
      if (type === 'bible' && targetBcKey && i.type === 'bible') {
        const iBcKey = getBookChapterKey(i.title, i.bibleMeta || i.slides[0]?.bibleMeta);
        return iBcKey === targetBcKey && sameBibleScope(bibleMeta, processedSlides, i.bibleMeta, i.slides);
      }
      return false;
    });
    let itemId = existingItem?.id;

    const selectedSlide = resolveRememberedSlide(
      processedSlides,
      itemId,
      cleanTitle,
      targetSlide,
      existingItem?.lastViewedSlideId,
      bibleMeta
    );

    if (!existingItem) {
      const newItem: PlaylistItem = {
        id: `item-qp-${Math.random().toString(36).substring(2, 9)}`,
        title: cleanTitle,
        type: type === 'song' ? 'song' : type === 'announcement' ? 'announcement' : 'bible',
        passageRef: type === 'bible' ? cleanTitle : undefined,
        category: type === 'song' ? 'Worship' : type === 'announcement' ? 'Announcements' : 'Scripture',
        slides: processedSlides,
        lastViewedSlideId: selectedSlide?.id,
        bibleMeta
      };
      setPlaylist(prev => [...prev, newItem]);
      itemId = newItem.id;
    } else {
      setPlaylist(prev =>
        prev.map(i =>
          i.id === existingItem.id
            ? {
                ...i,
                title: cleanTitle,
                passageRef: type === 'bible' ? cleanTitle : i.passageRef,
                slides: processedSlides,
                lastViewedSlideId: selectedSlide?.id,
                bibleMeta: bibleMeta || i.bibleMeta
              }
            : i
        )
      );
    }

    const newPin: QuickPinnedItem = {
      id: itemId!,
      title: cleanTitle,
      type,
      slides: processedSlides,
      sourceRef: sourceRef || cleanTitle,
      lastViewedSlideId: selectedSlide?.id,
      bibleMeta
    };

    setQuickPinnedItems(prev => {
      const exists = prev.some(p => {
        if (p.title.toLowerCase() === cleanTitle.toLowerCase() || p.id === itemId) return true;
        if (type === 'bible' && targetBcKey && p.type === 'bible') {
          const pBcKey = getBookChapterKey(p.title, p.bibleMeta || p.slides[0]?.bibleMeta);
          return pBcKey === targetBcKey && sameBibleScope(bibleMeta, processedSlides, p.bibleMeta, p.slides);
        }
        return false;
      });
      if (exists) {
        return prev.map(p => {
          const isMatch =
            p.title.toLowerCase() === cleanTitle.toLowerCase() ||
            p.id === itemId ||
            (type === 'bible' &&
              targetBcKey &&
              p.type === 'bible' &&
              getBookChapterKey(p.title, p.bibleMeta || p.slides[0]?.bibleMeta) === targetBcKey &&
              sameBibleScope(bibleMeta, processedSlides, p.bibleMeta, p.slides));
          return isMatch
            ? {
                ...p,
                id: itemId!,
                title: cleanTitle,
                slides: processedSlides,
                lastViewedSlideId: selectedSlide?.id || p.lastViewedSlideId,
                bibleMeta: bibleMeta || p.bibleMeta
              }
            : p;
        });
      }
      return [...prev, newPin];
    });

    // Activate this item in Center Workspace at the target/remembered slide!
    setActiveItemId(itemId!);
    if (selectedSlide) {
      setPreviewSlide(selectedSlide);
      recordLastViewedSlide(itemId!, selectedSlide, cleanTitle);
    }
  };

  const handleUnpinFromQuickSection = (pinIdOrTitle: string) => {
    setQuickPinnedItems(prev => prev.filter(p => p.id !== pinIdOrTitle && p.title !== pinIdOrTitle));
  };

  const handleLoadQuickPinnedSlides = (slides: Slide[], title: string, pinId?: string) => {
    if (!slides || slides.length === 0) return;

    const processedSlides = applyBibleBgToSlides(slides);
    const cleanTitle = title.replace(/^Scripture:\s*/i, '').trim();
    const pinObj = quickPinnedItems.find(
      p => (pinId && p.id === pinId) || p.title.toLowerCase() === cleanTitle.toLowerCase()
    );
    const targetBcKey = getBookChapterKey(cleanTitle, pinObj?.bibleMeta || processedSlides[0]?.bibleMeta);
    const targetItem = playlist.find(
      i =>
        (pinId && i.id === pinId) ||
        i.title.toLowerCase() === cleanTitle.toLowerCase() ||
        i.title.toLowerCase() === `scripture: ${cleanTitle.toLowerCase()}` ||
        (i.passageRef && i.passageRef.toLowerCase() === cleanTitle.toLowerCase()) ||
        (targetBcKey &&
          i.type === 'bible' &&
          getBookChapterKey(i.title, i.bibleMeta || i.slides[0]?.bibleMeta) === targetBcKey)
    );

    if (targetItem) {
      // Prefer processedSlides from pinObj if its translation matches activeBibleTranslation
      const pinTrans = pinObj?.bibleMeta?.translationId || processedSlides[0]?.bibleMeta?.translationId;
      const itemTrans = targetItem.bibleMeta?.translationId || targetItem.slides[0]?.bibleMeta?.translationId;
      const slidesToUse =
        pinTrans === activeBibleTranslation && itemTrans !== activeBibleTranslation
          ? processedSlides
          : targetItem.slides.length >= processedSlides.length
          ? targetItem.slides
          : processedSlides;
      if (slidesToUse !== targetItem.slides) {
        setPlaylist(prev =>
          prev.map(i =>
            i.id === targetItem.id
              ? { ...i, slides: slidesToUse, bibleMeta: pinObj?.bibleMeta || i.bibleMeta }
              : i
          )
        );
      }
      const remembered = resolveRememberedSlide(
        slidesToUse,
        targetItem.id,
        cleanTitle,
        undefined,
        pinObj?.lastViewedSlideId || targetItem.lastViewedSlideId,
        pinObj?.bibleMeta || targetItem.bibleMeta
      );
      setActiveItemId(targetItem.id);
      setPreviewSlide(remembered);
      recordLastViewedSlide(targetItem.id, remembered, cleanTitle);
    } else {
      const newId = pinId || `item-qp-${Math.random().toString(36).substring(2, 9)}`;
      const remembered = resolveRememberedSlide(
        processedSlides,
        newId,
        cleanTitle,
        undefined,
        pinObj?.lastViewedSlideId,
        pinObj?.bibleMeta
      );
      const newItem: PlaylistItem = {
        id: newId,
        title: cleanTitle,
        type: 'bible',
        passageRef: cleanTitle,
        category: 'Scripture',
        slides: processedSlides,
        lastViewedSlideId: remembered?.id,
        bibleMeta: pinObj?.bibleMeta
      };
      setPlaylist(prev => [...prev, newItem]);
      setActiveItemId(newItem.id);
      setPreviewSlide(remembered);
      recordLastViewedSlide(newItem.id, remembered, cleanTitle);
    }
  };

  /** Selecting a verse in the LibraryTabs full-chapter preview loads the entire chapter and selects that verse */
  const handleSelectBibleVerseInChapter = (
    passageRef: string,
    allChapterSlides: Slide[],
    targetSlide?: Slide,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => {
    handlePinToQuickSection(passageRef, allChapterSlides, 'bible', passageRef, targetSlide, bibleMeta);
  };

  // Accumulative Slide Appending Handler for Quick Section Jump
  const handleAppendSlidesToActiveItem = (newSlides: Slide[], passageRef?: string) => {
    if (!newSlides || newSlides.length === 0) return;

    const processedSlides = applyBibleBgToSlides(newSlides);

    if (activeItemId && activeItem) {
      const updatedSlides = [...activeItem.slides, ...processedSlides];
      setPlaylist(prev => prev.map(item => item.id === activeItemId ? {
        ...item,
        slides: updatedSlides,
        title: passageRef ? `${item.title} | ${passageRef}` : item.title
      } : item));
      setPreviewSlide(processedSlides[0]);
    } else {
      const newItem: PlaylistItem = {
        id: `item-${Math.random().toString(36).substring(2, 9)}`,
        title: passageRef ? `Scripture: ${passageRef}` : processedSlides[0].title || 'Service Item',
        type: 'bible',
        category: 'Scripture',
        slides: processedSlides
      };
      setPlaylist(prev => [...prev, newItem]);
      setActiveItemId(newItem.id);
      setPreviewSlide(processedSlides[0]);
    }
  };

  // Stepper handlers
  const findSlideIndexInActive = (slides: Slide[], refSlide: Slide | null | undefined): number => {
    if (!refSlide || slides.length === 0) return -1;
    const byId = slides.findIndex(s => s.id === refSlide.id);
    if (byId >= 0) return byId;
    if (refSlide.bibleMeta?.verse !== undefined) {
      const byVerse = slides.findIndex(
        s =>
          s.bibleMeta?.verse === refSlide.bibleMeta?.verse &&
          (!refSlide.bibleMeta?.chapter || s.bibleMeta?.chapter === refSlide.bibleMeta?.chapter)
      );
      if (byVerse >= 0) return byVerse;
    }
    if (refSlide.title) {
      const byTitle = slides.findIndex(s => s.title === refSlide.title);
      if (byTitle >= 0) return byTitle;
    }
    return -1;
  };

  const handleNextSlide = () => {
    if (!activeItem || activeItem.slides.length === 0) return;
    const slides = activeItem.slides;

    // Prefer previewSlide if user explicitly selected a verse in activeItem, otherwise liveSlide
    const currentRefSlide =
      previewSlide && findSlideIndexInActive(slides, previewSlide) >= 0
        ? previewSlide
        : liveSlide && activeItemId === liveItemId
        ? liveSlide
        : previewSlide || slides[0];
    const currIdx = findSlideIndexInActive(slides, currentRefSlide);

    if (currIdx >= 0 && currIdx < slides.length - 1) {
      const nextSlide = slides[currIdx + 1];
      setPreviewSlide(nextSlide);
      recordLastViewedSlide(activeItemId, nextSlide, activeItem.title);
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
          const nextSlide =
            nextItem.type === 'bible'
              ? resolveRememberedSlide(
                  nextItem.slides,
                  nextItem.id,
                  nextItem.title,
                  undefined,
                  nextItem.lastViewedSlideId,
                  nextItem.bibleMeta
                )
              : nextItem.slides[0];
          setPreviewSlide(nextSlide);
          recordLastViewedSlide(nextItem.id, nextSlide, nextItem.title);
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

    const currentRefSlide =
      previewSlide && findSlideIndexInActive(slides, previewSlide) >= 0
        ? previewSlide
        : liveSlide && activeItemId === liveItemId
        ? liveSlide
        : previewSlide || slides[0];
    const currIdx = findSlideIndexInActive(slides, currentRefSlide);

    if (currIdx > 0) {
      const prevSlide = slides[currIdx - 1];
      setPreviewSlide(prevSlide);
      recordLastViewedSlide(activeItemId, prevSlide, activeItem.title);
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
          recordLastViewedSlide(prevItem.id, prevSlide, prevItem.title);
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        return;
      }

      // Do not trigger single-key operator shortcuts while a modal dialog or input is active
      if (
        isSearchOpen ||
        isQuickModeOpen ||
        isSermonModeOpen ||
        isDesignerOpen ||
        isSettingsOpen ||
        isBroadcastOpen ||
        isInspectorOpen
      ) {
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && playlist.length > 0) {
        e.preventDefault();
        const curIdx = playlist.findIndex(i => i.id === activeItemId);
        const nextIdx =
          e.key === 'ArrowDown'
            ? curIdx < 0 ? 0 : Math.min(playlist.length - 1, curIdx + 1)
            : curIdx < 0 ? 0 : Math.max(0, curIdx - 1);
        const targetItem = playlist[nextIdx];
        if (targetItem) {
          handleSelectItem(targetItem);
        }
        return;
      }

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
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const idx = parseInt(e.key, 10) - 1;
        if (activeItem && activeItem.slides[idx]) {
          e.preventDefault();
          const targetSlide = activeItem.slides[idx];
          setPreviewSlide(targetSlide);
          setLiveSlide(targetSlide);
          setLiveItemId(activeItemId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    previewSlide,
    activeItem,
    playlist,
    activeItemId,
    isSearchOpen,
    isQuickModeOpen,
    isSermonModeOpen,
    isDesignerOpen,
    isSettingsOpen,
    isBroadcastOpen,
    isInspectorOpen
  ]);

  // Playlist Handlers
  const handleSelectItem = (item: PlaylistItem) => {
    setActiveItemId(item.id);
    if (item.type === 'header') {
      return;
    }
    if (item.slides.length > 0) {
      const target =
        item.type === 'bible'
          ? resolveRememberedSlide(
              item.slides,
              item.id,
              item.title,
              undefined,
              item.lastViewedSlideId,
              item.bibleMeta
            )
          : item.slides[0];
      setPreviewSlide(target);
      setLiveSlide(target);
      setLiveItemId(item.id);
    } else {
      setPreviewSlide(null);
    }
    setSpeakerNotes(item.speakerNotes || '');
  };

  const handleSelectSlideInPlaylist = (item: PlaylistItem, slide: Slide) => {
    setActiveItemId(item.id);
    setPreviewSlide(slide);
    setLiveSlide(slide);
    setLiveItemId(item.id);
    setSpeakerNotes(item.speakerNotes || '');
    if (item.type === 'bible') {
      setPlaylist(prev =>
        prev.map(p => (p.id === item.id ? { ...p, lastViewedSlideId: slide.id } : p))
      );
    }
  };

  /**
   * Selecting an item in the service loads it into Preview only. Taking it to
   * air is always an explicit action (Go live, Enter, or double-click).
   */
  const handlePreviewItem = (item: PlaylistItem) => {
    setActiveItemId(item.id);
    if (item.type === 'header') return;
    setSpeakerNotes(item.speakerNotes || '');
    if (item.slides.length === 0) {
      setPreviewSlide(null);
      return;
    }
    const target =
      item.type === 'bible'
        ? resolveRememberedSlide(
            item.slides,
            item.id,
            item.title,
            undefined,
            item.lastViewedSlideId,
            item.bibleMeta
          )
        : item.slides[0];
    setPreviewSlide(target);
  };

  const handlePreviewSlideInPlaylist = (item: PlaylistItem, slide: Slide) => {
    setActiveItemId(item.id);
    setPreviewSlide(slide);
    setSpeakerNotes(item.speakerNotes || '');
    if (item.type === 'bible') {
      setPlaylist(prev => prev.map(p => (p.id === item.id ? { ...p, lastViewedSlideId: slide.id } : p)));
    }
  };

  const handleAddItem = (type: ItemType) => {
    if (type === 'header') {      const headerItem: PlaylistItem = {
        id: `item-hdr-${Math.random().toString(36).substring(2, 9)}`,
        title: 'WORSHIP & PRAISE',
        type: 'header',
        category: 'Section',
        slides: []
      };
      setPlaylist(prev => [...prev, headerItem]);
      setActiveItemId(headerItem.id);
      return;
    }
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

  const handleRenameItem = (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setPlaylist(prev => prev.map(i => (i.id === id ? { ...i, title: trimmed } : i)));
  };

  const handleClearPlaylist = () => {
    setPlaylist([]);
    setActiveItemId(null);
    setPreviewSlide(null);
    setSpeakerNotes('');
  };

  const handleRemoveItem = (id: string) => {
    const remaining = playlist.filter(i => i.id !== id);
    setPlaylist(remaining);
    if (activeItemId === id) {
      const nextActive = remaining[0] || null;
      setActiveItemId(nextActive?.id || null);
      setPreviewSlide(nextActive?.slides[0] || null);
      setSpeakerNotes(nextActive?.speakerNotes || '');
    }
    if (liveItemId === id) {
      setLiveItemId(null);
    }
  };

  const handleDuplicateItem = (id: string) => {
    const idx = playlist.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = playlist[idx];
    const dupItem: PlaylistItem = {
      ...item,
      id: `item-${Math.random().toString(36).substring(2, 9)}`,
      title: `${item.title} (Copy)`,
      slides: item.slides.map(s => ({ ...s }))
    };
    setPlaylist(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, dupItem);
      return next;
    });
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    const updated = [...playlist];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPlaylist(updated);
  };

  const handleLoadTemplate = (templateName: string) => {
    const templatePlaylist = StorageService.getServiceTemplate(templateName);
    setPlaylist(templatePlaylist);
    const first = templatePlaylist[0] || null;
    setActiveItemId(first?.id || null);
    setPreviewSlide(first?.slides[0] || null);
    setSpeakerNotes(first?.speakerNotes || '');
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

  const handleAddBibleToPlaylist = (
    passageRef: string,
    slides: Slide[],
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => {
    handlePinToQuickSection(passageRef, slides, 'bible', passageRef, undefined, bibleMeta);
  };

  const handleAddBiblePassageAndGoLive = (
    passageRef: string,
    slides: Slide[],
    targetSlide?: Slide,
    bibleMeta?: PlaylistItem['bibleMeta']
  ) => {
    if (!slides || slides.length === 0) return;
    const processedSlides = applyBibleBgToSlides(slides);
    const matchedTarget =
      (targetSlide && findMatchingSlideInList(processedSlides, targetSlide, { title: passageRef, bibleMeta })) ||
      (targetSlide ? applyBibleBgToSlides([targetSlide])[0] : processedSlides[0]);

    const cleanRef = passageRef.replace(/^Scripture:\s*/i, '').trim();
    const targetBcKey = getBookChapterKey(cleanRef, bibleMeta || processedSlides[0]?.bibleMeta);

    // Reuse existing playlist item for this chapter if already appended/pinned, ensuring full chapter slides remain intact!
    const existingItem = playlist.find(
      i =>
        i.title.toLowerCase() === cleanRef.toLowerCase() ||
        i.title.toLowerCase() === `scripture: ${cleanRef.toLowerCase()}` ||
        (i.passageRef && i.passageRef.toLowerCase() === cleanRef.toLowerCase()) ||
        (targetBcKey &&
          i.type === 'bible' &&
          getBookChapterKey(i.title, i.bibleMeta || i.slides[0]?.bibleMeta) === targetBcKey &&
          (bibleMeta?.startVerse ?? 1) === (i.bibleMeta?.startVerse ?? 1))
    );

    let itemId = existingItem?.id;

    if (existingItem) {
      setPlaylist(prev =>
        prev.map(i =>
          i.id === existingItem.id
            ? {
                ...i,
                title: cleanRef,
                passageRef: cleanRef,
                slides: processedSlides,
                lastViewedSlideId: matchedTarget.id,
                bibleMeta: bibleMeta || i.bibleMeta
              }
            : i
        )
      );
    } else {
      const newItem: PlaylistItem = {
        id: `item-bible-${Math.random().toString(36).substring(2, 9)}`,
        title: cleanRef,
        type: 'bible',
        passageRef: cleanRef,
        category: 'Scripture',
        slides: processedSlides,
        lastViewedSlideId: matchedTarget.id,
        bibleMeta
      };
      setPlaylist(prev => [...prev, newItem]);
      itemId = newItem.id;
    }

    // Also keep Quick Pinned Section updated with full chapter & remembered verse
    setQuickPinnedItems(prev => {
      const exists = prev.some(
        p =>
          p.title.toLowerCase() === cleanRef.toLowerCase() ||
          p.id === itemId ||
          (targetBcKey &&
            p.type === 'bible' &&
            getBookChapterKey(p.title, p.bibleMeta || p.slides[0]?.bibleMeta) === targetBcKey)
      );
      if (exists) {
        return prev.map(p =>
          p.title.toLowerCase() === cleanRef.toLowerCase() ||
          p.id === itemId ||
          (targetBcKey &&
            p.type === 'bible' &&
            getBookChapterKey(p.title, p.bibleMeta || p.slides[0]?.bibleMeta) === targetBcKey)
            ? {
                ...p,
                id: itemId!,
                title: cleanRef,
                slides: processedSlides,
                lastViewedSlideId: matchedTarget.id,
                bibleMeta: bibleMeta || p.bibleMeta
              }
            : p
        );
      }
      return [
        ...prev,
        {
          id: itemId!,
          title: cleanRef,
          type: 'bible',
          slides: processedSlides,
          sourceRef: cleanRef,
          lastViewedSlideId: matchedTarget.id,
          bibleMeta
        }
      ];
    });

    setActiveItemId(itemId!);
    setPreviewSlide(matchedTarget);
    setLiveSlide(matchedTarget);
    setLiveItemId(itemId!);
    recordLastViewedSlide(itemId!, matchedTarget, cleanRef);
  };

  /** Fast 1-click Primary / Parallel Bible Translation Switcher (maps Book -> Book, Chapter -> Chapter, Verse -> Verse!) */
  const handleSwitchActiveBibleTranslation = async (
    primaryId: string,
    parallelId: string | null,
    specificSlide?: Slide,
    isTranslateToggle?: boolean
  ) => {
    const resolvedId = StorageService.resolveTranslationId(primaryId);
    if (!isTranslateToggle) {
      setPrimaryBibleTranslation(resolvedId);
    }
    setActiveBibleTranslation(resolvedId);
    setParallelBibleTranslation(parallelId);

    // 1. Translate all Bible items in the Service Playlist (preserving exact book, chapter, verse range, and remembered slide)
    const translatedPlaylistMap = new Map<
      string,
      { slides: Slide[]; bibleMeta?: PlaylistItem['bibleMeta']; lastViewedSlideId?: string }
    >();

    for (const item of playlist) {
      const isBible = item.type === 'bible' || item.slides.some(s => s.sectionLabel === 'Scripture');
      if (!isBible) continue;
      const tr = await StorageService.translateBibleItemSlidesAsync(item, resolvedId, parallelId);
      if (tr && tr.slides.length > 0) {
        const processed = applyBibleBgToSlides(tr.slides);
        const remSlide = resolveRememberedSlide(
          processed,
          item.id,
          item.title,
          undefined,
          item.lastViewedSlideId,
          tr.bibleMeta || item.bibleMeta
        );
        translatedPlaylistMap.set(item.id, {
          slides: processed,
          bibleMeta: tr.bibleMeta || item.bibleMeta,
          lastViewedSlideId: remSlide?.id || item.lastViewedSlideId
        });
      }
    }

    // 2. Translate all Bible items in Quick Pinned Section
    const translatedPinMap = new Map<
      string,
      { slides: Slide[]; bibleMeta?: PlaylistItem['bibleMeta']; lastViewedSlideId?: string }
    >();

    for (const pin of quickPinnedItems) {
      if (pin.type !== 'bible') continue;
      const fromPlaylist = translatedPlaylistMap.get(pin.id);
      if (fromPlaylist) {
        translatedPinMap.set(pin.id, fromPlaylist);
        continue;
      }
      const tr = await StorageService.translateBibleItemSlidesAsync(pin, resolvedId, parallelId);
      if (tr && tr.slides.length > 0) {
        const processed = applyBibleBgToSlides(tr.slides);
        const remSlide = resolveRememberedSlide(
          processed,
          pin.id,
          pin.title,
          undefined,
          pin.lastViewedSlideId,
          tr.bibleMeta || pin.bibleMeta
        );
        translatedPinMap.set(pin.id, {
          slides: processed,
          bibleMeta: tr.bibleMeta || pin.bibleMeta,
          lastViewedSlideId: remSlide?.id || pin.lastViewedSlideId
        });
      }
    }

    // 3. Resolve exact Verse -> Verse mapping for Preview Slide
    const activeTranslated = activeItem ? translatedPlaylistMap.get(activeItem.id) : undefined;
    let nextPreview: Slide | null = null;

    const previewTargetRef = specificSlide || previewSlide;
    if (previewTargetRef && activeTranslated) {
      nextPreview =
        findMatchingSlideInList(activeTranslated.slides, previewTargetRef, activeItem) || null;
    }
    if (!nextPreview && previewTargetRef) {
      // If previewSlide is a Scripture slide not inside activeTranslated, translate it directly 1-to-1
      const directPreview = await StorageService.translateSingleBibleSlideAsync(
        previewTargetRef,
        resolvedId,
        parallelId,
        activeItem
      );
      if (directPreview) {
        nextPreview = applyBibleBgToSlides([directPreview])[0];
      }
    }
    if (!nextPreview && activeTranslated && activeItem) {
      nextPreview = resolveRememberedSlide(
        activeTranslated.slides,
        activeItem.id,
        activeItem.title,
        undefined,
        activeTranslated.lastViewedSlideId,
        activeTranslated.bibleMeta
      );
    }

    // 4. Resolve exact Verse -> Verse mapping for Live Slide
    let nextLive: Slide | null = null;
    if (specificSlide && nextPreview) {
      nextLive = nextPreview;
    } else if (liveSlide) {
      if (activeTranslated) {
        nextLive = findMatchingSlideInList(activeTranslated.slides, liveSlide, activeItem) || null;
      }
      if (!nextLive) {
        for (const [pId, trData] of translatedPlaylistMap.entries()) {
          const pItem = playlist.find(i => i.id === pId);
          const found = findMatchingSlideInList(trData.slides, liveSlide, pItem);
          if (found) {
            nextLive = found;
            break;
          }
        }
      }
      if (!nextLive) {
        const directLive = await StorageService.translateSingleBibleSlideAsync(
          liveSlide,
          resolvedId,
          parallelId,
          activeItem
        );
        if (directLive) {
          nextLive = applyBibleBgToSlides([directLive])[0];
        }
      }
    }

    // 5. Commit updated Playlist, QuickPinnedItems, PreviewSlide, and LiveSlide
    if (translatedPlaylistMap.size > 0) {
      setPlaylist(prev =>
        prev.map(i => {
          const tr = translatedPlaylistMap.get(i.id);
          if (!tr) return i;
          const isCurrentActive = activeItem && i.id === activeItem.id;
          return {
            ...i,
            slides: tr.slides,
            bibleMeta: tr.bibleMeta,
            lastViewedSlideId:
              isCurrentActive && nextPreview ? nextPreview.id : tr.lastViewedSlideId || i.lastViewedSlideId
          };
        })
      );
    }

    if (translatedPinMap.size > 0) {
      setQuickPinnedItems(prev =>
        prev.map(p => {
          const tr = translatedPinMap.get(p.id);
          if (!tr) return p;
          const isCurrentActive =
            activeItem &&
            (p.id === activeItem.id ||
              getBookChapterKey(p.title, p.bibleMeta) === getBookChapterKey(activeItem.title, tr.bibleMeta));
          return {
            ...p,
            slides: tr.slides,
            bibleMeta: tr.bibleMeta,
            lastViewedSlideId:
              isCurrentActive && nextPreview ? nextPreview.id : tr.lastViewedSlideId || p.lastViewedSlideId
          };
        })
      );
    }

    if (nextPreview) {
      setPreviewSlide(nextPreview);
      if (activeItem) {
        recordLastViewedSlide(activeItem.id, nextPreview, activeItem.title);
      }
    }

    if (specificSlide && nextLive) {
      setLiveSlide(nextLive);
      if (activeItem) setLiveItemId(activeItem.id);
    } else if (nextLive) {
      setLiveSlide(nextLive);
    }
  };

  /** Tracks a single temporarily-translated slide so it reverts when moving to another slide */
  const tempTranslatedSlideRef = React.useRef<{ slideId: string; originalSlide: Slide } | null>(null);

  const restoreTempTranslatedSlide = (entry: { slideId: string; originalSlide: Slide }) => {
    const orig = entry.originalSlide;
    setPlaylist(prev =>
      prev.map(item =>
        item.slides.some(s => s.id === entry.slideId)
          ? { ...item, slides: item.slides.map(s => (s.id === entry.slideId ? orig : s)) }
          : item
      )
    );
    setQuickPinnedItems(prev =>
      prev.map(pin =>
        pin.slides.some(s => s.id === entry.slideId)
          ? { ...pin, slides: pin.slides.map(s => (s.id === entry.slideId ? orig : s)) }
          : pin
      )
    );
  };

  useEffect(() => {
    const temp = tempTranslatedSlideRef.current;
    if (!temp) return;
    const behavior = StorageService.getSettings().slideTranslationBehavior || 'single_slide_revert';
    if (behavior !== 'single_slide_revert') return;
    if (previewSlide?.id !== temp.slideId && liveSlide?.id !== temp.slideId) {
      tempTranslatedSlideRef.current = null;
      restoreTempTranslatedSlide(temp);
    }
  }, [previewSlide?.id, liveSlide?.id]);

  /** "Translate" Action: honors Settings -> Slide translation behavior */
  const handleTranslateActiveBible = async (targetVersionId?: string, specificSlide?: Slide) => {
    if (!targetParallelVersionId && !targetVersionId) return;

    const behavior = StorageService.getSettings().slideTranslationBehavior || 'single_slide_revert';
    const targetSlide = specificSlide || previewSlide || liveSlide;
    if (!targetSlide) return;

    const currentTrans = StorageService.resolveTranslationId(
      targetSlide.bibleMeta?.translationId ||
        activeItem?.bibleMeta?.translationId ||
        activeItem?.slides[0]?.bibleMeta?.translationId ||
        activeBibleTranslation
    );

    const resolvedParallel = targetParallelVersionId
      ? StorageService.resolveTranslationId(targetParallelVersionId)
      : null;

    const resolvedTarget = targetVersionId
      ? StorageService.resolveTranslationId(targetVersionId)
      : resolvedParallel && currentTrans !== resolvedParallel
      ? resolvedParallel
      : primaryBibleTranslation;

    if (behavior === 'entire_chapter') {
      await handleSwitchActiveBibleTranslation(resolvedTarget, null, specificSlide, true);
      return;
    }

    // Single-slide translation ('single_slide_revert' or 'single_slide_keep')
    if (behavior === 'single_slide_revert' && tempTranslatedSlideRef.current) {
      const prevTemp = tempTranslatedSlideRef.current;
      if (prevTemp.slideId !== targetSlide.id) {
        tempTranslatedSlideRef.current = null;
        restoreTempTranslatedSlide(prevTemp);
      } else if (resolvedTarget === prevTemp.originalSlide.bibleMeta?.translationId) {
        // User toggled back to the original translation
        const orig = applyBibleBgToSlides([prevTemp.originalSlide])[0];
        tempTranslatedSlideRef.current = null;
        setPlaylist(prev =>
          prev.map(item =>
            item.slides.some(s => s.id === targetSlide.id)
              ? { ...item, slides: item.slides.map(s => (s.id === targetSlide.id ? orig : s)) }
              : item
          )
        );
        setQuickPinnedItems(prev =>
          prev.map(pin =>
            pin.slides.some(s => s.id === targetSlide.id)
              ? { ...pin, slides: pin.slides.map(s => (s.id === targetSlide.id ? orig : s)) }
              : pin
          )
        );
        if (previewSlide?.id === targetSlide.id) setPreviewSlide(orig);
        if (liveSlide?.id === targetSlide.id) setLiveSlide(orig);
        return;
      }
    }

    const translatedRaw = await StorageService.translateSingleBibleSlideAsync(
      targetSlide,
      resolvedTarget,
      null,
      activeItem
    );
    if (!translatedRaw) return;

    const translatedSlide = applyBibleBgToSlides([{ ...translatedRaw, id: targetSlide.id }])[0];

    if (behavior === 'single_slide_revert' && !tempTranslatedSlideRef.current) {
      tempTranslatedSlideRef.current = { slideId: targetSlide.id, originalSlide: targetSlide };
    }

    setPlaylist(prev =>
      prev.map(item =>
        item.slides.some(s => s.id === targetSlide.id)
          ? { ...item, slides: item.slides.map(s => (s.id === targetSlide.id ? translatedSlide : s)) }
          : item
      )
    );
    setQuickPinnedItems(prev =>
      prev.map(pin =>
        pin.slides.some(s => s.id === targetSlide.id)
          ? { ...pin, slides: pin.slides.map(s => (s.id === targetSlide.id ? translatedSlide : s)) }
          : pin
      )
    );
    if (previewSlide?.id === targetSlide.id) setPreviewSlide(translatedSlide);
    if (liveSlide?.id === targetSlide.id) setLiveSlide(translatedSlide);
  };

  const handleAddMediaToCatalogOnly = (mediaAsset: MediaAsset) => {
    setMedia(prev => {
      if (prev.some(m => m.id === mediaAsset.id)) return prev;
      return [mediaAsset, ...prev];
    });
  };

  const handleDeleteMediaAsset = (mediaId: string) => {
    const target = media.find(m => m.id === mediaId);
    setMedia(prev => prev.filter(m => m.id !== mediaId));
    MediaVaultService.deleteVaultMedia(mediaId).catch(() => {});
    if (target) {
      if (globalVideoBgUrl === target.url) setGlobalVideoBgUrl(null);
      if (itemVideoBgUrl === target.url) setItemVideoBgUrl(null);
    }
  };

  const handleAddMediaToPlaylist = (mediaAsset: MediaAsset) => {
    // Save to the media catalog so it persists
    setMedia(prev => {
      if (prev.find(m => m.id === mediaAsset.id)) return prev;
      return [mediaAsset, ...prev];
    });

    const isVideo = mediaAsset.type === 'video';
    const newItem: PlaylistItem = {
      id: `item-media-${Math.random().toString(36).substring(2, 9)}`,
      title: mediaAsset.name,
      type: 'media',
      mediaUrl: mediaAsset.url,
      mediaType: isVideo ? 'video' : 'image',
      category: mediaAsset.category || (isVideo ? 'Videos' : 'Images'),
      slides: [
        {
          id: `slide-media-${Math.random().toString(36).substring(2, 9)}`,
          title: mediaAsset.name,
          content: '',
          backgroundUrl: mediaAsset.url,
          backgroundType: isVideo ? ('video' as const) : ('image' as const),
          sectionLabel: 'Title' as const
        }
      ]
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(newItem.slides[0]);
  };

  /** Workflow 1 — Play video or present image fullscreen on the audience output immediately */
  const handlePlayVideoNow = (mediaAsset: MediaAsset) => {
    // Save to catalog
    setMedia(prev => (prev.find(m => m.id === mediaAsset.id) ? prev : [mediaAsset, ...prev]));

    const isVideo = mediaAsset.type === 'video';
    const slide: Slide = {
      id: `slide-media-${Math.random().toString(36).substring(2, 9)}`,
      content: '', // empty content triggers fullscreen media display
      backgroundUrl: mediaAsset.url,
      backgroundType: isVideo ? ('video' as const) : ('image' as const),
      sectionLabel: 'Title' as const,
      title: mediaAsset.name
    };
    const newItem: PlaylistItem = {
      id: `item-media-${Math.random().toString(36).substring(2, 9)}`,
      title: mediaAsset.name,
      type: 'media',
      mediaUrl: mediaAsset.url,
      mediaType: isVideo ? 'video' : 'image',
      category: mediaAsset.category || (isVideo ? 'Videos' : 'Images'),
      slides: [slide]
    };
    setPlaylist(prev => [...prev, newItem]);
    setActiveItemId(newItem.id);
    setPreviewSlide(slide);
    // Immediately go live with the media slide
    setLiveSlide(slide);
    setLiveItemId(newItem.id);
  };

  /** Workflow 2 — Set image/video as looping background on the currently active slide (or all Bible slides if viewing a Bible verse) */
  const handleSetMediaAsBackground = (mediaAsset: MediaAsset, specificSlide?: Slide) => {
    // Save to catalog
    setMedia(prev => (prev.find(m => m.id === mediaAsset.id) ? prev : [mediaAsset, ...prev]));

    const isVideo = mediaAsset.type === 'video';
    const bgUpdate = {
      backgroundUrl: mediaAsset.url,
      backgroundType: (isVideo ? 'video' : 'image') as 'video' | 'image'
    };

    const targetSlide = specificSlide || previewSlide;

    if (targetSlide?.sectionLabel === 'Scripture' || activeItem?.type === 'bible') {
      propagateBibleBackground(bgUpdate);
      return;
    }

    if (activeItemId && activeItem && targetSlide) {
      setPlaylist(prev =>
        prev.map(item =>
          item.id === activeItemId
            ? { ...item, slides: item.slides.map(s => (s.id === targetSlide.id ? { ...s, ...bgUpdate } : s)) }
            : item
        )
      );
      if (previewSlide?.id === targetSlide.id) {
        setPreviewSlide(prev => (prev ? { ...prev, ...bgUpdate } : prev));
      }
      if (liveSlide?.id === targetSlide.id) {
        setLiveSlide(prev => (prev ? { ...prev, ...bgUpdate } : prev));
      }
    }
  };

  /**
   * Workflow 3 — Set video or image as background behind ALL slides of the active item.
   */
  const handleSetVideoBackgroundForItem = (mediaAsset: MediaAsset) => {
    setMedia(prev => (prev.find(m => m.id === mediaAsset.id) ? prev : [mediaAsset, ...prev]));
    if (activeItem?.type === 'bible') {
      propagateBibleBackground({
        backgroundUrl: mediaAsset.url,
        backgroundType: mediaAsset.type === 'video' ? 'video' : 'image'
      });
    }
    if (!activeItemId) return;
    if (mediaAsset.type === 'video') {
      setPlaylist(prev =>
        prev.map(item => (item.id === activeItemId ? { ...item, videoBackgroundUrl: mediaAsset.url } : item))
      );
      if (activeItemId === liveItemId || liveItemId === null) {
        setItemVideoBgUrl(mediaAsset.url);
      }
    } else {
      // For still image across an entire item, apply to all slides of that item
      setPlaylist(prev =>
        prev.map(item =>
          item.id === activeItemId
            ? {
                ...item,
                videoBackgroundUrl: undefined,
                slides: item.slides.map(s => ({ ...s, backgroundUrl: mediaAsset.url, backgroundType: 'image' }))
              }
            : item
        )
      );
      setPreviewSlide(prev => (prev ? { ...prev, backgroundUrl: mediaAsset.url, backgroundType: 'image' } : prev));
      setLiveSlide(prev => (prev ? { ...prev, backgroundUrl: mediaAsset.url, backgroundType: 'image' } : prev));
    }
  };

  /** Workflow 4 — Set a video or still image as the persistent global background behind the entire service */
  const handleSetGlobalVideoBackground = (mediaAsset: MediaAsset) => {
    setMedia(prev => (prev.find(m => m.id === mediaAsset.id) ? prev : [mediaAsset, ...prev]));
    if (mediaAsset.type === 'video') {
      setGlobalVideoBgUrl(mediaAsset.url);
    } else {
      setGlobalVideoBgUrl(null);
      setItemVideoBgUrl(null);
      setThemes(prev =>
        prev.map(t => (t.id === activeTheme.id ? { ...t, backgroundUrl: mediaAsset.url } : t))
      );
      // "Every slide" must beat per-slide and per-item overrides.
      setPlaylist(prev =>
        prev.map(item => ({
          ...item,
          videoBackgroundUrl: undefined,
          slides: item.slides.map(slide =>
            slide.backgroundUrl || slide.backgroundType
              ? { ...slide, backgroundUrl: undefined, backgroundType: undefined }
              : slide
          )
        }))
      );
    }
    // Clear slide-specific background override on active preview/live slide if user explicitly applies Global BG
    if (previewSlide?.backgroundUrl) {
      setPreviewSlide(prev => (prev ? { ...prev, backgroundUrl: undefined, backgroundType: undefined } : prev));
    }
    if (liveSlide?.backgroundUrl && liveSlide.content) {
      setLiveSlide(prev => (prev ? { ...prev, backgroundUrl: undefined, backgroundType: undefined } : prev));
    }
  };

  /** Unified ProPresenter background application helper (used by Quick BG Drawer & Drag-and-Drop) */
  const handleApplyBackgroundWithScope = (
    mediaAsset: MediaAsset,
    scope: 'global' | 'item' | 'slide',
    targetSlide?: Slide
  ) => {
    if (scope === 'global') {
      handleSetGlobalVideoBackground(mediaAsset);
    } else if (scope === 'item') {
      handleSetVideoBackgroundForItem(mediaAsset);
    } else {
      handleSetMediaAsBackground(mediaAsset, targetSlide);
    }
  };

  /** Clear active motion/custom backgrounds across Live Layer, Active Item, and Selected Slide */
  const handleClearAllBackgrounds = () => {
    setGlobalVideoBgUrl(null);
    setItemVideoBgUrl(null);
    if (activeItemId) {
      setPlaylist(prev =>
        prev.map(item =>
          item.id === activeItemId
            ? {
                ...item,
                videoBackgroundUrl: undefined,
                slides: item.slides.map(s => ({ ...s, backgroundUrl: undefined, backgroundType: undefined }))
              }
            : item
        )
      );
    }
    setPreviewSlide(prev => (prev ? { ...prev, backgroundUrl: undefined, backgroundType: undefined } : prev));
    setLiveSlide(prev =>
      prev && prev.content ? { ...prev, backgroundUrl: undefined, backgroundType: undefined } : prev
    );
  };

  /** Clear the global video background */
  const handleClearGlobalVideoBackground = () => setGlobalVideoBgUrl(null);

  /** Clear the video background for the active item */
  const handleClearItemVideoBackground = () => {
    if (!activeItemId) return;
    setPlaylist(prev =>
      prev.map(item => (item.id === activeItemId ? { ...item, videoBackgroundUrl: undefined } : item))
    );
    setItemVideoBgUrl(null);
  };

  // Quick 2-Click Present Now Launcher
  const handleQuickPresentNow = (title: string, slides: Slide[], goLive: boolean = true) => {
    const newItem: PlaylistItem = {
      id: `item-quick-${Math.random().toString(36).substring(2, 9)}`,
      title,
      type: 'song',
      slides
    };
    setPlaylist(prev => [newItem, ...prev]);
    setActiveItemId(newItem.id);
    setPreviewSlide(slides[0] || null);
    if (goLive && slides[0]) {
      setLiveSlide(slides[0]);
      setLiveItemId(newItem.id);
    }
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

  // Derive current active Bible book & chapter so LibraryTabs stays in sync when switching items/pins
  const activeBibleBookChapter = React.useMemo(() => {
    if (!activeItem) return null;
    const isBible =
      activeItem.type === 'bible' || activeItem.slides.some(s => s.sectionLabel === 'Scripture');
    if (!isBible) return null;

    const coords =
      (previewSlide && StorageService.extractSlideBibleCoords(previewSlide, activeItem)) ||
      StorageService.extractSlideBibleCoords(activeItem.slides[0], activeItem);
    if (coords) {
      return { book: coords.book, chapter: coords.chapter };
    }
    const parsed = StorageService.parseBibleReference(activeItem.passageRef || activeItem.title);
    if (parsed) {
      return { book: parsed.book, chapter: parsed.chapter };
    }
    return null;
  }, [activeItemId, activeItem?.title, activeItem?.bibleMeta?.book, activeItem?.bibleMeta?.chapter]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Top Header */}
      <Header
        serviceTitle={serviceTitle}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenQuickMode={() => setIsQuickModeOpen(true)}
        onOpenSermonMode={() => setIsSermonModeOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAudienceOutput={() => {
          const nextState = BroadcastService.toggleAudienceWindow();
          setIsAudienceActive(nextState);
        }}
        onOpenStageOutput={() => {
          const nextState = BroadcastService.toggleStageWindow();
          setIsStageActive(nextState);
        }}
        onOpenLedOutput={() => {
          const nextState = BroadcastService.toggleLedWindow();
          setIsLedActive(nextState);
        }}
        onOpenStreaming={() => setIsStreamingOpen(true)}
        onExportPackage={handleExportPackage}
        onImportPackage={handleImportPackage}
        isAudienceActive={isAudienceActive}
        isStageActive={isStageActive}
        isLedActive={isLedActive}
        isSaved={isSaved}
        onOpenSlideDesigner={() => setIsDesignerOpen(true)}
      />

      {/* Main Studio Body Workspace Layout */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden select-none">
        {/* Left Panel: Library Browser (Songs, Bible, Announcements, Media, Themes) */}
        <LibraryTabs
          songs={songs}
          media={media}
          themes={themes}
          activeThemeId={activeThemeId}
          quickPinnedItems={quickPinnedItems}
          primaryTranslationId={primaryBibleTranslation}
          activeTranslationId={activeBibleTranslation}
          parallelTranslationId={parallelBibleTranslation}
          targetParallelVersionId={targetParallelVersionId}
          activeBibleBook={activeBibleBookChapter?.book}
          activeBibleChapter={activeBibleBookChapter?.chapter}
          onSelectTargetParallelVersion={setTargetParallelVersionId}
          onTranslateActiveBible={handleTranslateActiveBible}
          onChangeBibleTranslations={handleSwitchActiveBibleTranslation}
          onSelectBibleVerseInChapter={handleSelectBibleVerseInChapter}
          onAddSongToPlaylist={handleAddSongToPlaylist}
          onAddBibleToPlaylist={handleAddBibleToPlaylist}
          onAddBiblePassageAndGoLive={handleAddBiblePassageAndGoLive}
          onAppendSlidesToActiveItem={handleAppendSlidesToActiveItem}
          onPinToQuickSection={handlePinToQuickSection}
          onUnpinFromQuickSection={handleUnpinFromQuickSection}
          onAddMediaToPlaylist={handleAddMediaToPlaylist}
          onAddMediaToCatalogOnly={handleAddMediaToCatalogOnly}
          onDeleteMediaAsset={handleDeleteMediaAsset}
          onSetMediaAsBackground={(m) => handleSetMediaAsBackground(m)}
          onPlayVideoNow={handlePlayVideoNow}
          onSetVideoBackgroundForItem={handleSetVideoBackgroundForItem}
          onSetGlobalVideoBackground={handleSetGlobalVideoBackground}
          activeBackgroundUrl={globalVideoBgUrl || itemVideoBgUrl || previewSlide?.backgroundUrl || null}
          onClearBackground={handleClearAllBackgrounds}
          onSelectTheme={(tId) => setActiveThemeId(tId)}
          onGoLiveWithSlide={(slide) => {
            const processed = slide?.sectionLabel === 'Scripture' ? applyBibleBgToSlides([slide])[0] : slide;
            setPreviewSlide(processed);
            setLiveSlide(processed);
            setLiveItemId(activeItemId);
            recordLastViewedSlide(activeItemId, processed, activeItem?.title);
          }}
          activeLowerThirdText={activeLowerThirdText}
          onClearLowerThirdAnnouncement={handleClearLowerThirdAnnouncement}
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
          audienceViewMode={audienceViewMode}
          quickPinnedItems={quickPinnedItems}
          lastViewedSlideMap={lastViewedSlideMap}
          activeTranslationId={primaryBibleTranslation}
          parallelTranslationId={parallelBibleTranslation}
          targetParallelVersionId={targetParallelVersionId}
          onTranslateActiveBible={handleTranslateActiveBible}
          onSwitchBibleTranslation={handleSwitchActiveBibleTranslation}
          mediaList={media}
          globalVideoBgUrl={globalVideoBgUrl}
          onSelectSlidePreview={(slide) => {
            setPreviewSlide(slide);
            recordLastViewedSlide(activeItemId, slide, activeItem?.title);
          }}
          onSendSlideLive={(slide) => {
            setPreviewSlide(slide);
            setLiveSlide(slide);
            setLiveItemId(activeItemId);
            recordLastViewedSlide(activeItemId, slide, activeItem?.title);
          }}
          onJumpSection={handleJumpSection}
          activeLowerThirdText={activeLowerThirdText}
          onClearLowerThirdAnnouncement={handleClearLowerThirdAnnouncement}
          onTriggerLowerThirdAnnouncement={handleTriggerLowerThirdAnnouncement}
          onUnpinFromQuickSection={handleUnpinFromQuickSection}
          onLoadQuickPinnedSlides={handleLoadQuickPinnedSlides}
          onUpdateItemSlides={(itemId, updatedSlides) => {
            setPlaylist(prev => prev.map(i => i.id === itemId ? { ...i, slides: updatedSlides } : i));
            if (previewSlide) {
              const updatedPreview = updatedSlides.find(s => s.id === previewSlide.id);
              if (updatedPreview) setPreviewSlide(updatedPreview);
            }
            if (liveSlide) {
              const updatedLive = updatedSlides.find(s => s.id === liveSlide.id);
              if (updatedLive) setLiveSlide(updatedLive);
            }
          }}
          onClearLiveSlide={() => setLiveSlide(null)}
          onApplyBackground={handleApplyBackgroundWithScope}
          onClearBackground={handleClearAllBackgrounds}
          onOpenInspector={() => setIsInspectorOpen(true)}
          onOpenStreamSettings={() => setIsStreamingOpen(true)}
          onUpdateTheme={(updated) => {
            setThemes(prev => prev.map(t => t.id === activeTheme.id ? { ...t, ...updated } : t));
            if (updated.projectorLayout) {
              const currentSettings = StorageService.getSettings();
              if (currentSettings.defaultProjectorLayout !== updated.projectorLayout) {
                StorageService.saveSettings({ ...currentSettings, defaultProjectorLayout: updated.projectorLayout });
              }
            }
          }}
          countdownSeconds={countdownSeconds}
        />

        {/* Right rail: service order */}
        <PlaylistPanel
          playlist={playlist}
          activeItemId={activeItemId}
          onPreviewItem={handlePreviewItem}
          onSelectItem={handleSelectItem}
          onPreviewSlideInItem={handlePreviewSlideInPlaylist}
          onSelectSlideInItem={handleSelectSlideInPlaylist}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onDuplicateItem={handleDuplicateItem}
          onRenameItem={handleRenameItem}
          onClearPlaylist={handleClearPlaylist}
          onMoveItem={handleMoveItem}
          onLoadTemplate={handleLoadTemplate}
          liveItemId={liveItemId}
          liveSlideId={liveSlide?.id || null}
        />

        <InspectorPanel
          open={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          theme={activeTheme}
          onUpdateTheme={(updated) => {
            setThemes(prev => prev.map(t => t.id === activeTheme.id ? { ...t, ...updated } : t));
            if (updated.projectorLayout) {
              const currentSettings = StorageService.getSettings();
              if (currentSettings.defaultProjectorLayout !== updated.projectorLayout) {
                StorageService.saveSettings({ ...currentSettings, defaultProjectorLayout: updated.projectorLayout });
              }
            }
          }}
          activeSlide={previewSlide}
          activeItem={activeItem}
          onUpdateSlide={(updated) => {
            if (!previewSlide || !activeItem) return;
            const isBibleSlide = previewSlide.sectionLabel === 'Scripture' || activeItem.type === 'bible';
            const isBgChange = 'backgroundUrl' in updated || 'backgroundType' in updated;

            if (isBibleSlide && isBgChange) {
              propagateBibleBackground({
                backgroundUrl: updated.backgroundUrl,
                backgroundType: updated.backgroundType
              });
              return;
            }

            const updatedSlides = activeItem.slides.map(s => s.id === previewSlide.id ? { ...s, ...updated } : s);
            setPlaylist(prev => prev.map(i => i.id === activeItem.id ? { ...i, slides: updatedSlides } : i));
            setPreviewSlide(prev => prev ? { ...prev, ...updated } : null);
            if (liveSlide?.id === previewSlide.id) {
              setLiveSlide(prev => prev ? { ...prev, ...updated } : null);
            }
          }}
          mediaList={media}
          speakerNotes={speakerNotes}
          onUpdateSpeakerNotes={(notes) => {
            setSpeakerNotes(notes);
            if (activeItemId) {
              setPlaylist(prev => prev.map(i => i.id === activeItemId ? { ...i, speakerNotes: notes } : i));
            }
          }}
          globalVideoBgUrl={globalVideoBgUrl}
          onClearGlobalVideoBg={handleClearGlobalVideoBackground}
          onClearItemVideoBg={handleClearItemVideoBackground}
        />
      </div>

      {/* Media Player Bar — appears when a fullscreen video slide is active */}
      <MediaPlayerBar
        activeMedia={activeVideoMedia}
        onClear={() => {
          setActiveVideoMedia(null);
          if (liveSlide?.backgroundType === 'video' && !liveSlide.content) {
            setLiveSlide(null);
          }
        }}
        onTriggerLogo={() => handleToggleEmergency('isLogo')}
      />

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
          setCountdownTargetTimestamp(null);
          countdownAnchorRef.current = { baseEpochMs: Date.now(), baseSeconds: secs };
          setCountdownSeconds(secs);
          setIsCountdownRunning(true);
        }}
        onPauseCountdown={() => {
          countdownAnchorRef.current = null;
          setIsCountdownRunning(false);
        }}
        onStopCountdown={() => {
          countdownAnchorRef.current = null;
          setIsCountdownRunning(false);
          setCountdownTargetTimestamp(null);
          setCountdownSeconds(0);
        }}
        countUp={countUp}
        onToggleCountUp={setCountUp}
        isFullSlideCountdown={isFullSlideCountdown}
        onToggleFullSlideCountdown={setIsFullSlideCountdown}
        countdownTargetScreen={countdownTargetScreen}
        onChangeCountdownTargetScreen={setCountdownTargetScreen}
        countdownTitle={countdownTitle}
        countdownOvertimeTitle={countdownOvertimeTitle}
        onChangeCountdownLabels={(title, overtimeTitle) => {
          setCountdownTitle(title);
          setCountdownOvertimeTitle(overtimeTitle);
          try {
            localStorage.setItem('live_psalms_countdown_title_v1', title);
            localStorage.setItem('live_psalms_countdown_overtime_title_v1', overtimeTitle);
          } catch (e) {}
        }}
        countdownTargetTimestamp={countdownTargetTimestamp}
        onStartClockCountdown={(targetMs) => {
          setCountUp(false);
          setCountdownTargetTimestamp(targetMs);
          setCountdownSeconds(Math.round((targetMs - Date.now()) / 1000));
          setIsCountdownRunning(true);
        }}
        onClearClockCountdown={() => {
          setCountdownTargetTimestamp(null);
        }}
        countdownEndAction={countdownEndAction}
        onChangeCountdownEndAction={setCountdownEndAction}
        countdownEndVideoId={countdownEndVideoId}
        onChangeCountdownEndVideoId={setCountdownEndVideoId}
        mediaList={media}
        onOpenStreamSettings={() => setIsStreamingOpen(true)}
      />

      {/* Modals & Dialogs */}
      <StreamingModal
        isOpen={isStreamingOpen}
        onClose={() => setIsStreamingOpen(false)}
        liveSlide={liveSlide}
        theme={activeTheme}
        countdownSeconds={countdownSeconds}
      />
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
        media={media}
        onAddSermonToPlaylist={(item, goLive) => {
          setPlaylist(prev => [...prev, item]);
          setActiveItemId(item.id);
          setPreviewSlide(item.slides[0] || null);
          setSpeakerNotes(item.speakerNotes || '');
          if (goLive && item.slides[0]) {
            setLiveSlide(item.slides[0]);
            setLiveItemId(item.id);
          }
        }}
      />

      <SlideDesignerModal
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        activeSlide={previewSlide}
        activeTheme={activeTheme}
        media={media}
        onSaveSlide={(updated, options) => {
          if (!previewSlide || !activeItem) return;
          const isBibleSlide = previewSlide.sectionLabel === 'Scripture' || activeItem.type === 'bible';
          if (isBibleSlide && updated.backgroundUrl !== previewSlide.backgroundUrl) {
            propagateBibleBackground({
              backgroundUrl: updated.backgroundUrl,
              backgroundType: updated.backgroundType
            });
          }
          const updatedSlides = activeItem.slides.map(s => {
            if (s.id === previewSlide.id) return updated;
            if (options?.applyBgToItem) {
              return {
                ...s,
                backgroundUrl: updated.backgroundUrl,
                backgroundType: updated.backgroundType,
                backgroundColor: updated.backgroundColor
              };
            }
            return s;
          });
          setPlaylist(prev => prev.map(i => i.id === activeItem.id ? { ...i, slides: updatedSlides } : i));
          setPreviewSlide(updated);
          if (options?.goLive || liveSlide?.id === previewSlide.id) {
            setLiveSlide(updated);
            setLiveItemId(activeItem.id);
          }
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
