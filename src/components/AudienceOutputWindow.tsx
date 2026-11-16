import React, { useState, useEffect, useRef } from 'react';
import { Slide, Theme, EmergencyState, TransitionSettings, AudienceAlert, AudienceViewMode } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { StorageService } from '../services/storage';
import { Flame, Megaphone, Bell } from 'lucide-react';
import { getOutputFontSize } from '../utils/fontSize';
import { useAutoFitFontSize } from '../utils/useAutoFitFontSize';
import { FullscreenVideoPlayer } from './FullscreenVideoPlayer';

function isVideoUrl(url?: string | null, bgType?: Slide['backgroundType']): boolean {
  if (!url) return false;
  if (bgType === 'video') return true;
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.m4v') ||
    lower.startsWith('data:video') ||
    lower.startsWith('blob:')
  );
}

/** Play a video element reliably across popup/secondary windows even without prior user gesture in that window */
function safePlayVideo(vid: HTMLVideoElement | null) {
  if (!vid) return;
  const p = vid.play();
  if (p !== undefined) {
    p.catch(() => {
      // Browser blocked unmuted autoplay in secondary window — mute and play immediately so video always renders
      vid.muted = true;
      vid.play().catch(() => {});
    });
  }
}

export const AudienceOutputWindow: React.FC = () => {
  const [liveSlide, setLiveSlide] = useState<Slide | null>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_live_slide_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [audienceAlert, setAudienceAlert] = useState<AudienceAlert | null>(null);
  const [lowerThirdAnnouncement, setLowerThirdAnnouncement] = useState<{ title?: string; subtitle?: string; content?: string; speed?: 'slow' | 'normal' | 'fast' } | null>(() => {
    try {
      const raw = localStorage.getItem('live_psalms_active_ticker_v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [theme, setTheme] = useState<Theme>({
    id: 'default',
    name: 'Modern Worship',
    fontFamily: 'Inter',
    fontSize: 52,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.5,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#6366f1',
    backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
  });
  const [emergency, setEmergency] = useState<EmergencyState>({
    isBlack: false,
    isClear: false,
    isLogo: false,
    isFreeze: false,
    isStopMedia: false
  });
  const [transition, setTransition] = useState<TransitionSettings>({
    type: 'fade',
    durationMs: 400
  });
  const [audienceViewMode, setAudienceViewMode] = useState<AudienceViewMode>(() => {
    return StorageService.getSettings().audienceViewMode || 'near';
  });

  // ── Fullscreen video state ──
  // fullscreenVideoUrl is set when a pure-video slide goes live (no text)
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_live_slide_v1');
      if (saved) {
        const s: Slide = JSON.parse(saved);
        if (s && isVideoUrl(s.backgroundUrl, s.backgroundType) && !s.content) {
          return s.backgroundUrl || null;
        }
      }
    } catch (e) {}
    return null;
  });
  // Playing state controlled by MEDIA_CMD_* broadcasts from management
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(() => !!fullscreenVideoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const audienceSlideContainerRef = useRef<HTMLDivElement>(null);
  const audienceSlideTextRef = useRef<HTMLDivElement>(null);

  // Global and item-level looping video backgrounds
  const [globalVideoBgUrl, setGlobalVideoBgUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('live_psalms_global_video_bg_v1') || null;
    } catch (e) {
      return null;
    }
  });
  const [itemVideoBgUrl, setItemVideoBgUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('live_psalms_item_video_bg_v1') || null;
    } catch (e) {
      return null;
    }
  });

  // Countdown state for full-slide countdown overlay
  const [countdownState, setCountdownState] = useState<{
    remaining: number;
    running: boolean;
    isFullSlide: boolean;
    targetScreen: 'audience' | 'stage' | 'both';
  }>({
    remaining: 0,
    running: false,
    isFullSlide: false,
    targetScreen: 'both'
  });

  // Freeze state buffer refs so we can hold display while frozen and apply pending changes on unfreeze
  const isFrozenRef = useRef(false);
  const pendingStateRef = useRef<{
    liveSlide?: Slide | null;
    theme?: Theme;
    lowerThird?: { title?: string; subtitle?: string; content?: string } | null;
    globalVideoBgUrl?: string | null;
    itemVideoBgUrl?: string | null;
  }>({});

  // Detect actual screen resolution for scaling
  const [screenInfo, setScreenInfo] = useState({
    width: window.screen.width,
    height: window.screen.height,
    pixelRatio: window.devicePixelRatio || 1
  });

  useEffect(() => {
    const updateScreen = () => {
      setScreenInfo({
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio || 1
      });
    };
    window.addEventListener('resize', updateScreen);
    return () => window.removeEventListener('resize', updateScreen);
  }, []);

  // Base font vw derived from the theme fontSize setting + screen width
  const baseFontVw = (theme.fontSize / 1920) * 100;

  const churchProfile = StorageService.getChurchProfile();

  const applyLiveSlide = (slide: Slide | null) => {
    setLiveSlide(slide);
    if (slide && isVideoUrl(slide.backgroundUrl, slide.backgroundType) && !slide.content) {
      setFullscreenVideoUrl(slide.backgroundUrl || null);
      setIsVideoPlaying(true);
    } else {
      setFullscreenVideoUrl(null);
      setIsVideoPlaying(false);
    }
  };

  // ── Broadcast message handlers ──
  useEffect(() => {
    const unsubscribe = BroadcastService.subscribe((payload: BroadcastPayload) => {
      if (payload.type === 'EMERGENCY_STATE_CHANGE' && payload.emergency) {
        const wasFrozen = isFrozenRef.current;
        const nowFrozen = !!payload.emergency.isFreeze;
        isFrozenRef.current = nowFrozen;
        setEmergency(payload.emergency);

        if (payload.emergency.isStopMedia) {
          videoRef.current?.pause();
          setFullscreenVideoUrl(null);
          setIsVideoPlaying(false);
        }

        // Flush any buffered updates when unfreezing
        if (wasFrozen && !nowFrozen) {
          const pending = pendingStateRef.current;
          if (pending.liveSlide !== undefined) applyLiveSlide(pending.liveSlide);
          if (pending.theme !== undefined) setTheme(pending.theme);
          if (pending.lowerThird !== undefined) setLowerThirdAnnouncement(pending.lowerThird);
          if (pending.globalVideoBgUrl !== undefined) setGlobalVideoBgUrl(pending.globalVideoBgUrl);
          if (pending.itemVideoBgUrl !== undefined) setItemVideoBgUrl(pending.itemVideoBgUrl);
          pendingStateRef.current = {};
        }
      }

      if (payload.type === 'LIVE_SLIDE_CHANGE' && payload.liveSlide !== undefined) {
        if (isFrozenRef.current) {
          pendingStateRef.current.liveSlide = payload.liveSlide;
        } else {
          applyLiveSlide(payload.liveSlide);
        }
      }

      // ── Media commands from management screen ──
      if (payload.type === 'MEDIA_CMD_PLAY' && payload.mediaCmd?.url) {
        setFullscreenVideoUrl(payload.mediaCmd.url);
        setIsVideoPlaying(true);
        setTimeout(() => {
          if (videoRef.current) {
            if (payload.mediaCmd?.volume !== undefined) videoRef.current.volume = payload.mediaCmd.volume;
            if (payload.mediaCmd?.playbackRate !== undefined) videoRef.current.playbackRate = payload.mediaCmd.playbackRate;
            if (payload.mediaCmd?.loop !== undefined) videoRef.current.loop = payload.mediaCmd.loop;
            safePlayVideo(videoRef.current);
          }
        }, 50);
      }
      if (payload.type === 'MEDIA_CMD_PAUSE') {
        videoRef.current?.pause();
        setIsVideoPlaying(false);
      }
      if (payload.type === 'MEDIA_CMD_RESUME') {
        safePlayVideo(videoRef.current);
        setIsVideoPlaying(true);
      }
      if (payload.type === 'MEDIA_CMD_SEEK' && payload.mediaCmd?.seekTo !== undefined) {
        if (videoRef.current) videoRef.current.currentTime = payload.mediaCmd.seekTo;
      }
      if (payload.type === 'MEDIA_CMD_VOLUME' && payload.mediaCmd?.volume !== undefined) {
        if (videoRef.current) {
          videoRef.current.volume = payload.mediaCmd.volume;
          if (payload.mediaCmd.volume > 0) {
            // Attempt to unmute if browser allows
            videoRef.current.muted = false;
            videoRef.current.play().catch(() => {
              if (videoRef.current) videoRef.current.muted = true;
            });
          }
        }
      }
      if (payload.type === 'MEDIA_CMD_SPEED' && payload.mediaCmd?.playbackRate !== undefined) {
        if (videoRef.current) videoRef.current.playbackRate = payload.mediaCmd.playbackRate;
      }
      if (payload.type === 'MEDIA_CMD_LOOP' && payload.mediaCmd?.loop !== undefined) {
        if (videoRef.current) videoRef.current.loop = payload.mediaCmd.loop;
      }
      if (payload.type === 'MEDIA_CMD_STOP') {
        videoRef.current?.pause();
        setFullscreenVideoUrl(null);
        setIsVideoPlaying(false);
      }

      if (payload.type === 'LOWER_THIRD_TRIGGER') {
        if (isFrozenRef.current) {
          pendingStateRef.current.lowerThird = payload.lowerThirdText || null;
        } else {
          setLowerThirdAnnouncement(payload.lowerThirdText || null);
        }
      }
      if (payload.type === 'AUDIENCE_ALERT_CHANGE') {
        setAudienceAlert(payload.audienceAlert || null);
      }
      if (payload.type === 'GLOBAL_VIDEO_BG_CHANGE') {
        const nextUrl = payload.globalVideoBgUrl !== undefined ? payload.globalVideoBgUrl : null;
        if (isFrozenRef.current) {
          pendingStateRef.current.globalVideoBgUrl = nextUrl;
        } else {
          setGlobalVideoBgUrl(nextUrl);
        }
      }
      if (payload.type === 'ITEM_VIDEO_BG_CHANGE') {
        const nextUrl = payload.itemVideoBgUrl !== undefined ? payload.itemVideoBgUrl : null;
        if (isFrozenRef.current) {
          pendingStateRef.current.itemVideoBgUrl = nextUrl;
        } else {
          setItemVideoBgUrl(nextUrl);
        }
      }
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        if (isFrozenRef.current) {
          pendingStateRef.current.theme = payload.theme;
        } else {
          setTheme(payload.theme);
        }
      }
      if (payload.type === 'TRANSITION_CHANGE' && payload.transition) {
        setTransition(payload.transition);
      }
      if (payload.type === 'APP_SETTINGS_UPDATE' && payload.appSettings) {
        setAudienceViewMode(payload.appSettings.audienceViewMode || 'near');
      }
      if (payload.type === 'COUNTDOWN_UPDATE') {
        setCountdownState(prev => ({
          remaining: payload.countdownRemaining !== undefined ? payload.countdownRemaining : prev.remaining,
          running: payload.countdownRunning !== undefined ? payload.countdownRunning : prev.running,
          isFullSlide: payload.isFullSlideCountdown !== undefined ? payload.isFullSlideCountdown : prev.isFullSlide,
          targetScreen: payload.countdownTargetScreen || prev.targetScreen
        }));
      }
    });

    // Request current live state from the operator console on mount
    BroadcastService.requestInitialState();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'live_psalms_active_ticker_v1') {
        try {
          setLowerThirdAnnouncement(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {
          setLowerThirdAnnouncement(null);
        }
      } else if (e.key === 'live_psalms_live_slide_v1') {
        try {
          applyLiveSlide(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {}
      } else if (e.key === 'live_psalms_global_video_bg_v1') {
        setGlobalVideoBgUrl(e.newValue || null);
      } else if (e.key === 'live_psalms_item_video_bg_v1') {
        setItemVideoBgUrl(e.newValue || null);
      } else if (e.key === 'live_psalms_app_settings_v1') {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          setAudienceViewMode(parsed?.audienceViewMode || 'near');
        } catch (err) {}
      }
    };
    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) setAudienceViewMode(detail.audienceViewMode || 'near');
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  // Report playback status back to management so it can update its seek bar
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !fullscreenVideoUrl) return;
    const onTimeUpdate = () => {
      BroadcastService.postMessage({
        type: 'MEDIA_STATUS',
        mediaStatus: {
          playing: !vid.paused,
          currentTime: vid.currentTime,
          duration: vid.duration || 0,
          url: fullscreenVideoUrl,
          volume: vid.volume
        }
      });
    };
    vid.addEventListener('timeupdate', onTimeUpdate);
    return () => vid.removeEventListener('timeupdate', onTimeUpdate);
  }, [fullscreenVideoUrl]);

  // Auto-play when fullscreenVideoUrl is set
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !fullscreenVideoUrl) return;
    if (isVideoPlaying) {
      safePlayVideo(vid);
    }
  }, [fullscreenVideoUrl, isVideoPlaying]);

  // Ensure background video plays whenever its src changes
  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.play().catch(() => {});
    }
  }, [liveSlide?.backgroundUrl, itemVideoBgUrl, globalVideoBgUrl]);

  // Background priority:
  //  1. Slide-specific video background (or explicit slide image when no item/global motion video BG is active)
  //  2. Item-level video BG
  //  3. Global video BG
  //  4. Slide-specific image / Theme backgroundUrl
  const slideBgUrl = liveSlide?.backgroundUrl ?? null;
  const isSlideVideoBg = isVideoUrl(slideBgUrl, liveSlide?.backgroundType);
  const isPureMediaSlide = !!(liveSlide && slideBgUrl && !liveSlide.content?.trim());
  const isPureVideoSlide = !!(isPureMediaSlide && isSlideVideoBg);
  const isPureImageSlide = !!(isPureMediaSlide && !isSlideVideoBg);
  const activeMotionLoopUrl = isPureMediaSlide
    ? (isSlideVideoBg ? slideBgUrl : null)
    : (isSlideVideoBg ? slideBgUrl : (itemVideoBgUrl || globalVideoBgUrl || null));
  const bgUrl = isPureMediaSlide ? slideBgUrl : (activeMotionLoopUrl || slideBgUrl || theme.backgroundUrl);
  const isVideoBg = isPureMediaSlide ? isSlideVideoBg : (!!activeMotionLoopUrl || isVideoUrl(bgUrl));

  // Compute font style for current slide content
  const isFarMode = audienceViewMode === 'far';
  const slideText = liveSlide?.content || '';
  const { fontSize: dynFontSize, lineHeight: dynLineHeight, maxWidth: dynMaxWidth } =
    getOutputFontSize(slideText, baseFontVw, screenInfo.width, audienceViewMode);

  const dynFontVw = parseFloat(dynFontSize) || Math.max(2.5, baseFontVw);
  const audienceFittedPx = useAutoFitFontSize(
    audienceSlideContainerRef,
    audienceSlideTextRef,
    [liveSlide?.id, liveSlide?.content, theme.fontSize, theme.fontFamily, audienceViewMode, dynFontSize],
    { minPx: 18, maxPx: 140, startVw: dynFontVw }
  );

  const contentPadding = isFarMode ? 'py-[2.5vh] px-[2.5vw]' : 'py-[4vh] px-[5vw]';
  const effectiveScrimOpacity = isFarMode ? Math.max(theme.scrimOpacity, 0.88) : theme.scrimOpacity;

  // Compute transition animation style
  const getTransitionClass = () => {
    if (transition.type === 'cut') return '';
    if (transition.type === 'zoom') return 'animate-zoom-in';
    return 'animate-slide-fade';
  };

  const formatCountdownDisplay = (secs: number) => {
    const isOvertime = secs < 0;
    const totalSecs = Math.abs(secs);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const base = h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return isOvertime ? `+${base}` : base;
  };

  const showFullSlideCountdown =
    !emergency.isClear &&
    countdownState.isFullSlide &&
    (countdownState.running || countdownState.remaining !== 0) &&
    (countdownState.targetScreen === 'both' || countdownState.targetScreen === 'audience');

  const handleRequestFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      onClick={handleRequestFullscreen}
      onDoubleClick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }}
      className="w-screen h-screen bg-black text-white relative overflow-hidden select-none cursor-none"
    >

      {/* ── FULLSCREEN VIDEO PRESENTATION (management-controlled, no controls rendered here) ── */}
      {fullscreenVideoUrl && !emergency.isBlack && !emergency.isStopMedia && (
        <div className="absolute inset-0 z-40">
          {/* Plain dumb video — all controls are on the management screen */}
          <video
            ref={videoRef}
            key={fullscreenVideoUrl}
            src={fullscreenVideoUrl}
            autoPlay
            playsInline
            onLoadedMetadata={e => {
              if (isVideoPlaying) safePlayVideo(e.currentTarget);
            }}
            className="w-full h-full object-contain bg-black"
            onEnded={() => {
              setIsVideoPlaying(false);
              BroadcastService.postMessage({
                type: 'MEDIA_STATUS',
                mediaStatus: { playing: false, currentTime: 0, duration: 0, url: fullscreenVideoUrl, volume: videoRef.current?.volume ?? 1 }
              });
            }}
          />
        </div>
      )}

      {/* ── BLACK EMERGENCY OVERRIDE ── */}
      {emergency.isBlack && (
        <div className="absolute inset-0 bg-black z-50" />
      )}

      {/* ── LOGO SCREEN ── */}
      {!emergency.isBlack && emergency.isLogo && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center z-40 text-center px-[8vw]">
          {churchProfile.logoUrl ? (
            <img
              src={churchProfile.logoUrl}
              alt={churchProfile.name}
              style={{ maxHeight: `${(churchProfile as any).logoSize ?? 35}vh`, maxWidth: '80vw' }}
              className="object-contain mb-[4vh] drop-shadow-2xl animate-pulse w-auto"
            />
          ) : (
            <div className="p-[3vw] bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-[3vw] shadow-2xl mb-[3vh]">
              <Flame style={{ width: '8vw', height: '8vw' }} className="text-white animate-pulse" />
            </div>
          )}
          <h1
            className="font-extrabold tracking-wider bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent uppercase"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 5rem)' }}
          >
            {churchProfile.name || 'GRACE COMMUNITY CHURCH'}
          </h1>
          <p
            className="text-indigo-300 font-semibold mt-[1.5vh] uppercase tracking-widest"
            style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.5rem)' }}
          >
            {churchProfile.tagline || 'Welcome To Worship'}
          </p>
        </div>
      )}

      {/* ── NORMAL PRESENTATION MODE ── */}
      {!emergency.isBlack && !emergency.isLogo && (
        <>
          {/* BACKGROUND — seamless looping video or image (suppressed when a foreground video is active) */}
          {bgUrl && !fullscreenVideoUrl && !isPureVideoSlide && !emergency.isStopMedia && (
            isVideoBg ? (
              <video
                ref={bgVideoRef}
                key={bgUrl}
                src={bgUrl}
                autoPlay
                loop
                muted
                playsInline
                onLoadedMetadata={e => {
                  e.currentTarget.muted = true;
                  e.currentTarget.play().catch(() => {});
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={bgUrl}
                alt="Background"
                className={`absolute inset-0 w-full h-full ${
                  isPureImageSlide ? 'object-contain bg-black opacity-100 z-20' : 'object-cover opacity-60'
                }`}
              />
            )
          )}

          {/* SCRIM (skip for pure foreground video or pure image slides) */}
          {!isPureMediaSlide && !fullscreenVideoUrl && (
            <div
              className="absolute inset-0 z-10"
              style={{
                backgroundColor: `rgba(0,0,0,${effectiveScrimOpacity})`,
                backgroundImage: isFarMode
                  ? 'radial-gradient(circle at center, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.68) 100%)'
                  : undefined,
                backdropFilter: theme.blurAmount ? `blur(${theme.blurAmount}px)` : undefined
              }}
            />
          )}

          {/* ── FULL-SLIDE COUNTDOWN MODE ── */}
          {showFullSlideCountdown && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-[6vw] animate-slide-fade">
              <div
                className="font-black uppercase tracking-[0.35em] text-indigo-300 bg-indigo-950/70 px-[3vw] py-[1vh] rounded-full border border-indigo-500/40 mb-[3vh]"
                style={{ fontSize: 'clamp(0.8rem, 1.8vw, 2rem)' }}
              >
                {countdownState.remaining < 0 ? 'SERVICE IN PROGRESS' : 'SERVICE STARTING IN'}
              </div>
              <div
                className={`font-mono font-black tracking-wider drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)] ${
                  countdownState.remaining < 0
                    ? 'text-rose-400 animate-pulse'
                    : countdownState.remaining <= 60
                    ? 'text-amber-300 animate-pulse'
                    : 'text-white'
                }`}
                style={{ fontSize: 'clamp(4rem, 16vw, 18rem)', lineHeight: 1 }}
              >
                {formatCountdownDisplay(countdownState.remaining)}
              </div>
              {churchProfile.name && (
                <div
                  className="font-bold text-slate-300 mt-[4vh] tracking-widest uppercase opacity-80"
                  style={{ fontSize: 'clamp(0.8rem, 1.6vw, 1.8rem)' }}
                >
                  {churchProfile.name}
                </div>
              )}
            </div>
          )}

          {/* MAIN CONTENT — only shown for text slides (not pure video/image slides or full-slide countdown) */}
          {!emergency.isClear && !showFullSlideCountdown && liveSlide && !isPureMediaSlide && (
            <div
              key={liveSlide.id}
              style={{ animationDuration: `${transition.durationMs}ms` }}
              className={`absolute inset-0 z-20 flex flex-col ${contentPadding} ${getTransitionClass()}`}
            >

              {/* ── LOWER-THIRD BADGE MODE ── */}
              {theme.lowerThirdStyle ? (
                <div
                  className={`mt-auto w-full pr-[4vw] rounded-r-[1vw] shadow-2xl text-left ${
                    isFarMode
                      ? 'bg-black/95 border-l-[1vw] border-amber-400 pl-[3.5vw] py-[3.5vh]'
                      : 'bg-slate-950/90 border-l-[0.6vw] border-emerald-500 pl-[3vw] py-[2.5vh] backdrop-blur-md'
                  }`}
                >
                  {liveSlide.sectionLabel && (
                    <span
                      className={`font-black uppercase tracking-widest block mb-[0.8vh] ${isFarMode ? 'text-amber-300' : 'text-emerald-400'}`}
                      style={{ fontSize: isFarMode ? 'clamp(1rem, 1.9vw, 2rem)' : 'clamp(0.6rem, 1.2vw, 1.2rem)' }}
                    >
                      {liveSlide.sectionLabel}
                    </span>
                  )}
                  <div
                    className={`${isFarMode ? 'font-black' : 'font-extrabold'} text-white leading-snug`}
                    style={{
                      fontFamily: theme.fontFamily,
                      fontSize: isFarMode ? 'clamp(1.5rem, 4.2vw, 4.8rem)' : 'clamp(1rem, 3vw, 3.5rem)',
                      color: isFarMode ? '#ffffff' : theme.textColor,
                      textShadow: isFarMode
                        ? '0 6px 22px rgba(0,0,0,1), 0 2px 4px rgba(0,0,0,1)'
                        : undefined,
                      WebkitTextStroke: isFarMode ? '0.016em rgba(0,0,0,0.75)' : undefined
                    }}
                  >
                    {liveSlide.content}
                  </div>
                  {liveSlide.subtitle && (
                    <div
                      className={`${isFarMode ? 'text-amber-300 font-black' : 'text-slate-400 font-semibold'} mt-[1vh]`}
                      style={{ fontSize: isFarMode ? 'clamp(1rem, 1.8vw, 1.9rem)' : 'clamp(0.6rem, 1.2vw, 1.1rem)' }}
                    >
                      {liveSlide.subtitle}
                    </div>
                  )}
                </div>
              ) : (
                /* ── FULLSCREEN CENTERED MODE ── */
                <div
                  className="m-auto flex flex-col items-center justify-center text-center h-full max-h-[90vh]"
                  style={{ maxWidth: dynMaxWidth, width: '100%' }}
                >
                  {/* Section / title badge — only for text slides */}
                  {(liveSlide.title || liveSlide.sectionLabel) && (
                    <div
                      className={`font-black uppercase tracking-[0.25em] mb-[2vh] rounded-full inline-block shrink-0 ${
                        isFarMode
                          ? 'text-amber-200 bg-black/90 px-[2.6vw] py-[0.9vh] border-2 border-amber-400/80 shadow-[0_8px_28px_rgba(0,0,0,0.95)]'
                          : 'text-indigo-300 bg-indigo-950/60 px-[2vw] py-[0.6vh] border border-indigo-500/40'
                      }`}
                      style={{ fontSize: isFarMode ? 'clamp(1rem, 2.1vw, 2.2rem)' : 'clamp(0.55rem, 1.1vw, 1.1rem)' }}
                    >
                      {liveSlide.title || liveSlide.sectionLabel}
                    </div>
                  )}

                  {/* Main text */}
                  <div
                    ref={audienceSlideContainerRef}
                    className="w-full flex-1 min-h-0 max-h-[72vh] flex items-center justify-center overflow-hidden"
                  >
                    <div
                      ref={audienceSlideTextRef}
                      className={`${isFarMode ? 'font-black' : 'font-extrabold'} text-white whitespace-pre-line drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]`}
                      style={{
                        fontFamily: theme.fontFamily,
                        fontSize: audienceFittedPx ? `${audienceFittedPx}px` : dynFontSize,
                        lineHeight: dynLineHeight,
                        textAlign: theme.align as any,
                        color: isFarMode ? '#ffffff' : theme.textColor,
                        letterSpacing: isFarMode
                          ? (theme.letterSpacing && theme.letterSpacing !== 'normal' ? theme.letterSpacing : '0.02em')
                          : (theme.letterSpacing || 'normal'),
                        textTransform: (theme.textTransform as any) || 'none',
                        textShadow: isFarMode
                          ? '0 6px 24px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.98), 0 2px 4px rgba(0,0,0,1)'
                          : undefined,
                        WebkitTextStroke: isFarMode ? '0.018em rgba(0,0,0,0.75)' : undefined,
                        width: '100%'
                      }}
                    >
                      {liveSlide.content}
                    </div>
                  </div>

                  {/* Subtitle / scripture reference */}
                  {liveSlide.subtitle && (
                    <div
                      className={`mt-[2.5vh] tracking-wider uppercase shrink-0 ${
                        isFarMode
                          ? 'font-black text-amber-300 drop-shadow-[0_4px_14px_rgba(0,0,0,1)]'
                          : 'font-bold text-indigo-200 opacity-90'
                      }`}
                      style={{ fontSize: isFarMode ? 'clamp(1.1rem, 2.4vw, 2.6rem)' : 'clamp(0.7rem, 1.4vw, 1.4rem)' }}
                    >
                      {liveSlide.subtitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PROPRESENTER NURSERY PAGER / AUDIENCE ALERT PROP ── */}
          {audienceAlert && (
            <div
              className="absolute top-[3.5vh] right-[3.5vw] z-40 bg-[#090d18]/95 border-2 border-amber-400 rounded-2xl px-[2vw] py-[1.4vh] shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center gap-[1.2vw] animate-slide-fade"
            >
              <div className="p-[0.8vw] rounded-xl bg-amber-500 text-black font-black flex items-center justify-center">
                <Bell style={{ width: '2.2vw', height: '2.2vw', minWidth: 20 }} className="animate-bounce" />
              </div>
              <div className="flex flex-col text-left">
                <span
                  className="font-black uppercase tracking-widest text-amber-400"
                  style={{ fontSize: 'clamp(0.65rem, 1vw, 1rem)' }}
                >
                  {audienceAlert.message || 'PARENT PAGER / ALERT'}
                </span>
                <span
                  className="font-black text-white tracking-wider leading-none mt-0.5"
                  style={{ fontSize: 'clamp(1.4rem, 3vw, 3.2rem)' }}
                >
                  {audienceAlert.code}
                </span>
              </div>
            </div>
          )}

          {/* ── LOWER THIRD ANNOUNCEMENT CRAWL ── */}
          {lowerThirdAnnouncement && (
            <div
              className="absolute bottom-0 left-0 right-0 z-30 bg-[#070b15]/95 border-t-[0.3vh] border-purple-500/80 shadow-2xl backdrop-blur-md flex items-center overflow-hidden animate-slide-fade"
              style={{ height: '10vh', minHeight: '60px' }}
            >
              {/* Badge */}
              <div
                className="h-full px-[2.5vw] bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 flex items-center gap-[1vw] text-white font-black uppercase tracking-wider shrink-0 border-r border-purple-400/40"
                style={{ fontSize: 'clamp(0.6rem, 1.2vw, 1.2rem)' }}
              >
                <Megaphone style={{ width: '2vw', height: '2vw', minWidth: 16 }} className="text-amber-300 animate-pulse" />
                <span>ANNOUNCEMENT</span>
                {lowerThirdAnnouncement.title && (
                  <span
                    className="font-extrabold text-purple-200 bg-purple-950/80 px-[1vw] py-[0.3vh] rounded-full border border-purple-400/40"
                    style={{ fontSize: 'clamp(0.55rem, 1vw, 1rem)' }}
                  >
                    {lowerThirdAnnouncement.title}
                  </span>
                )}
              </div>

              {/* Scrolling text */}
              <div className="flex-1 overflow-hidden relative flex items-center h-full">
                <div
                  className="animate-crawl-line font-extrabold text-white tracking-wide flex items-center gap-[4vw] whitespace-nowrap"
                  style={{
                    fontSize: 'clamp(0.9rem, 2.2vw, 2.2rem)',
                    animationDuration:
                      lowerThirdAnnouncement.speed === 'slow'
                        ? '32s'
                        : lowerThirdAnnouncement.speed === 'fast'
                        ? '13s'
                        : '22s'
                  }}
                >
                  <span>{lowerThirdAnnouncement.content}</span>
                  {lowerThirdAnnouncement.subtitle && (
                    <span className="text-purple-300 font-bold">
                      — {lowerThirdAnnouncement.subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
