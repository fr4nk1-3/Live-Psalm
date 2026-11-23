import React, { useState, useEffect, useRef } from 'react';
import { Slide, Theme, EmergencyState, AudienceAlert } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { Megaphone, Bell } from 'lucide-react';

function isVideoUrl(url?: string | null, bgType?: Slide['backgroundType']): boolean {
  if (!url) return false;
  if (bgType === 'video') return true;
  // Uploaded images are blob: URLs with no extension; the slide already says
  // it is an image, so do not fall through to the video heuristic.
  if (bgType === 'image') return false;
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

function safePlayVideo(vid: HTMLVideoElement | null) {
  if (!vid) return;
  const p = vid.play();
  if (p !== undefined) {
    p.catch(() => {
      vid.muted = true;
      vid.play().catch(() => {});
    });
  }
}

export const ObsOutputWindow: React.FC = () => {
  const [liveSlide, setLiveSlide] = useState<Slide | null>(() => {
    try {
      const saved = localStorage.getItem('live_psalms_live_slide_v1');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
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
    fontSize: 48,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: true,
    accentColor: '#6366f1'
  });
  const [emergency, setEmergency] = useState<EmergencyState>({
    isBlack: false,
    isClear: false,
    isLogo: false,
    isFreeze: false,
    isStopMedia: false
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const isFrozenRef = useRef(false);
  const pendingSlideRef = useRef<Slide | null | undefined>(undefined);

  const applySlide = (slide: Slide | null) => {
    setLiveSlide(slide);
    if (slide && isVideoUrl(slide.backgroundUrl, slide.backgroundType) && !slide.content) {
      setFullscreenVideoUrl(slide.backgroundUrl || null);
    } else {
      setFullscreenVideoUrl(null);
    }
  };

  useEffect(() => {
    // Force transparent html/body background so OBS Browser Source composites cleanly over camera layers
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    const prevBodyBgColor = document.body.style.backgroundColor;
    document.documentElement.style.background = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    document.body.classList.remove('bg-[#090d14]');

    const unsubscribe = BroadcastService.subscribe((payload: BroadcastPayload) => {
      if (payload.type === 'EMERGENCY_STATE_CHANGE' && payload.emergency) {
        const wasFrozen = isFrozenRef.current;
        const nowFrozen = !!payload.emergency.isFreeze;
        isFrozenRef.current = nowFrozen;
        setEmergency(payload.emergency);
        if (payload.emergency.isStopMedia) {
          videoRef.current?.pause();
          setFullscreenVideoUrl(null);
        }
        if (wasFrozen && !nowFrozen && pendingSlideRef.current !== undefined) {
          applySlide(pendingSlideRef.current);
          pendingSlideRef.current = undefined;
        }
      }
      if (payload.type === 'LIVE_SLIDE_CHANGE' && payload.liveSlide !== undefined) {
        if (isFrozenRef.current) {
          pendingSlideRef.current = payload.liveSlide;
        } else {
          applySlide(payload.liveSlide);
        }
      }
      if (payload.type === 'MEDIA_CMD_PLAY' && payload.mediaCmd?.url) {
        setFullscreenVideoUrl(payload.mediaCmd.url);
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
      }
      if (payload.type === 'MEDIA_CMD_RESUME') {
        safePlayVideo(videoRef.current);
      }
      if (payload.type === 'MEDIA_CMD_SEEK' && payload.mediaCmd?.seekTo !== undefined) {
        if (videoRef.current) videoRef.current.currentTime = payload.mediaCmd.seekTo;
      }
      if (payload.type === 'MEDIA_CMD_VOLUME' && payload.mediaCmd?.volume !== undefined) {
        if (videoRef.current) videoRef.current.volume = payload.mediaCmd.volume;
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
      }
      if (payload.type === 'LOWER_THIRD_TRIGGER') {
        setLowerThirdAnnouncement(payload.lowerThirdText || null);
      }
      if (payload.type === 'AUDIENCE_ALERT_CHANGE') {
        setAudienceAlert(payload.audienceAlert || null);
      }
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        setTheme(payload.theme);
      }
    });

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
          applySlide(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
      document.body.style.backgroundColor = prevBodyBgColor;
    };
  }, []);

  if (emergency.isBlack) {
    return <div className="w-screen h-screen bg-black" />;
  }

  const isPureVideoSlide = !!(liveSlide && isVideoUrl(liveSlide.backgroundUrl, liveSlide.backgroundType) && !liveSlide.content?.trim());
  const isPureImageSlide = !!(liveSlide && liveSlide.backgroundUrl && !isPureVideoSlide && !liveSlide.content?.trim());

  return (
    <div className="w-screen h-screen bg-transparent text-white relative overflow-hidden select-none flex flex-col justify-end">
      {/* FULLSCREEN FOREGROUND VIDEO OR IMAGE PRESENTATION ON OBS */}
      {fullscreenVideoUrl && !emergency.isStopMedia && (
        <div className="absolute inset-0 z-10 bg-black">
          <video
            ref={videoRef}
            key={fullscreenVideoUrl}
            src={fullscreenVideoUrl}
            autoPlay
            playsInline
            onLoadedMetadata={e => safePlayVideo(e.currentTarget)}
            className="w-full h-full object-contain bg-black"
          />
        </div>
      )}
      {isPureImageSlide && !emergency.isClear && !emergency.isLogo && liveSlide?.backgroundUrl && (
        <div className="absolute inset-0 z-10 bg-black">
          <img
            src={liveSlide.backgroundUrl}
            alt={liveSlide.title || 'OBS Image'}
            className="w-full h-full object-contain bg-black"
          />
        </div>
      )}

      {/* PROPRESENTER NURSERY PAGER / AUDIENCE ALERT PROP */}
      {audienceAlert && (
        <div className="absolute top-8 right-10 z-40 bg-[#090d18]/95 border-2 border-amber-400 rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4 animate-slide-fade">
          <div className="p-2.5 rounded-xl bg-amber-500 text-black font-black flex items-center justify-center">
            <Bell className="w-6 h-6 animate-bounce" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              {audienceAlert.message || 'PARENT PAGER / ALERT'}
            </span>
            <span className="text-3xl font-black text-white tracking-wider leading-none mt-0.5">
              {audienceAlert.code}
            </span>
          </div>
        </div>
      )}

      {/* OBS TRANSPARENT LOWER THIRD SLIDE DISPLAY (only for text slides, not pure video clips) */}
      {!emergency.isClear && !emergency.isLogo && liveSlide && !isPureVideoSlide && liveSlide.content && (
        <div
          className={`relative z-20 w-full px-16 ${
            lowerThirdAnnouncement ? 'pb-24' : 'pb-12'
          } flex flex-col items-center justify-end animate-slide-fade`}
        >
          <div className="w-full max-w-5xl bg-[#090d18]/90 border-l-2 border-white/25 px-8 py-6 rounded-2xl shadow-2xl text-center border border-slate-700/80">
            {(liveSlide.title || liveSlide.sectionLabel) && (
              <span className="text-sm font-black uppercase text-white/60 tracking-widest block mb-1.5">
                {liveSlide.title || liveSlide.sectionLabel}
              </span>
            )}
            <div
              className="font-extrabold text-white text-4xl leading-snug whitespace-pre-line"
              style={{
                fontFamily: theme.fontFamily,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)'
              }}
            >
              {liveSlide.content}
            </div>
            {liveSlide.subtitle && (
              <div className="text-sm text-white/60 font-bold mt-2 tracking-wide">
                {liveSlide.subtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OBS CRAWL LINE TICKER OVERLAY */}
      {lowerThirdAnnouncement && (
        <div className="absolute bottom-4 left-0 right-0 z-30 bg-[#070b15]/95 border-y border-white/15 flex items-center overflow-hidden h-14 animate-slide-fade">
          <div className="h-full px-5 bg-black/70 flex items-center gap-2 text-white font-black text-xs uppercase tracking-wider shrink-0 z-10">
            <Megaphone className="w-4 h-4 text-amber-300 " />
            <span>ANNOUNCEMENT</span>
          </div>

          <div className="flex-1 overflow-hidden relative flex items-center h-full">
            <div
              className="animate-crawl-line font-extrabold text-white text-xl tracking-wide flex items-center gap-8"
              style={{
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
                <span className="text-white/70 text-base font-bold">
                  — {lowerThirdAnnouncement.subtitle}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
