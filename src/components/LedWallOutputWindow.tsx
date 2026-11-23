import React, { useState, useEffect, useRef } from 'react';
import { Slide, Theme, EmergencyState } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { getFlexibleFontSize } from '../utils/fontSize';

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

export const LedWallOutputWindow: React.FC = () => {
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
  const [theme, setTheme] = useState<Theme>({
    id: 'default',
    name: 'Modern Worship',
    fontFamily: 'Inter',
    fontSize: 56,
    fontWeight: '900',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.3,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
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
      if (payload.type === 'GLOBAL_VIDEO_BG_CHANGE') {
        setGlobalVideoBgUrl(payload.globalVideoBgUrl ?? null);
      }
      if (payload.type === 'ITEM_VIDEO_BG_CHANGE') {
        setItemVideoBgUrl(payload.itemVideoBgUrl ?? null);
      }
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        setTheme(payload.theme);
      }
    });

    BroadcastService.requestInitialState();

    return () => unsubscribe();
  }, []);

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

  return (
    <div
      onClick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }}
      onDoubleClick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }}
      className="w-screen h-screen bg-black text-white relative overflow-hidden select-none flex flex-col justify-between cursor-none"
    >
      {emergency.isBlack ? (
        <div className="absolute inset-0 bg-black z-50" />
      ) : (
        <>
          {/* FOREGROUND VIDEO PRESENTATION */}
          {fullscreenVideoUrl && !emergency.isStopMedia && (
            <div className="absolute inset-0 z-40">
              <video
                ref={videoRef}
                key={fullscreenVideoUrl}
                src={fullscreenVideoUrl}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={e => safePlayVideo(e.currentTarget)}
                className="w-full h-full object-contain bg-black"
              />
            </div>
          )}

          {/* MOTION GRAPHICS / VIDEO BACKGROUND LAYER */}
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
                alt="LED Wall Background"
                className={`absolute inset-0 w-full h-full ${
                  isPureImageSlide
                    ? 'object-contain bg-black opacity-100 z-20'
                    : 'object-cover opacity-80 filter contrast-125 saturate-125'
                }`}
              />
            )
          )}

          {/* SCRIM */}
          {!fullscreenVideoUrl && !isPureMediaSlide && (
            <div
              className="absolute inset-0 z-10"
              style={{ backgroundColor: `rgba(0,0,0,${theme.scrimOpacity * 0.7})` }}
            />
          )}

          {/* LED WALL TEXT DISPLAY */}
          {!emergency.isClear && liveSlide && liveSlide.content && (
            <div className="relative z-20 w-full h-full p-12 flex flex-col justify-center items-center text-center animate-slide-fade">
              <div className="max-w-6xl my-auto">
                {liveSlide.title && liveSlide.content && (
                  <div className="text-sm font-black uppercase text-amber-400 tracking-[0.3em] mb-4 bg-black/60 px-6 py-2 rounded-full inline-block border border-amber-500/50 shadow-2xl">
                    {liveSlide.title}
                  </div>
                )}

                <div
                  className="font-black text-white leading-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.95)] whitespace-pre-line tracking-wide uppercase"
                  style={{
                    fontFamily: theme.fontFamily,
                    fontSize: getFlexibleFontSize(liveSlide.content, 64).fontSize,
                    lineHeight: getFlexibleFontSize(liveSlide.content, 64).lineHeight,
                    textAlign: theme.align
                  }}
                >
                  {liveSlide.content}
                </div>

                {liveSlide.subtitle && (
                  <div className="text-base font-extrabold text-amber-300 mt-6 tracking-widest uppercase">
                    {liveSlide.subtitle}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
