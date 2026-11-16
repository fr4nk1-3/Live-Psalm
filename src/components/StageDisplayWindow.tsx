import React, { useState, useEffect, useRef } from 'react';
import { Slide, StageDisplayState, AudienceViewMode } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { StorageService } from '../services/storage';
import { Clock as ClockIcon, FileText, ArrowRight, Zap, Timer, BookOpen, Film, Image as ImageIcon } from 'lucide-react';
import { getFlexibleFontSize, getOutputFontSize } from '../utils/fontSize';
import { useAutoFitFontSize } from '../utils/useAutoFitFontSize';

function formatTranslationBadge(translationId?: string | null): string | null {
  if (!translationId) return null;
  const cleaned = translationId
    .replace(/^bible-/i, '')
    .replace(/^(eng|swahili|kikuyu|luo|kalenjin|kamba|maasai)-/i, '');
  return cleaned.toUpperCase();
}

function isVideoMediaSlide(slide?: Slide | null): boolean {
  if (!slide?.backgroundUrl) return false;
  if (slide.backgroundType === 'video') return true;
  const u = slide.backgroundUrl.toLowerCase();
  return (
    u.endsWith('.mp4') ||
    u.endsWith('.webm') ||
    u.endsWith('.mov') ||
    u.endsWith('.mkv') ||
    u.endsWith('.m4v') ||
    u.startsWith('data:video') ||
    u.startsWith('blob:')
  );
}

export const StageDisplayWindow: React.FC = () => {
  const [stageState, setStageState] = useState<StageDisplayState>({
    clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    countdownRemaining: 0
  });
  const [countdownTargetScreen, setCountdownTargetScreen] = useState<'audience' | 'stage' | 'both'>('both');
  const [showVerseRefOnStage, setShowVerseRefOnStage] = useState<boolean>(
    () => StorageService.getSettings().showVerseNumbers ?? true
  );
  const [stageViewMode, setStageViewMode] = useState<AudienceViewMode>(
    () => StorageService.getSettings().stageViewMode || 'near'
  );
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const farContainerRef = useRef<HTMLDivElement | null>(null);
  const farTextRef = useRef<HTMLDivElement | null>(null);
  const nearContainerRef = useRef<HTMLDivElement | null>(null);
  const nearTextRef = useRef<HTMLDivElement | null>(null);

  const farFittedPx = useAutoFitFontSize(
    farContainerRef,
    farTextRef,
    [stageViewMode, stageState.currentSlide?.id, stageState.currentSlide?.content],
    { minPx: 18, maxPx: 140, startVw: 6.5 }
  );

  const nearFittedPx = useAutoFitFontSize(
    nearContainerRef,
    nearTextRef,
    [stageViewMode, stageState.currentSlide?.id, stageState.currentSlide?.content],
    { minPx: 16, maxPx: 96, startVw: 4.5 }
  );

  useEffect(() => {
    // Clock tick interval
    const timer = setInterval(() => {
      setStageState(prev => ({
        ...prev,
        clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }));
    }, 1000);

    // Listen to broadcast updates
    const unsubscribe = BroadcastService.subscribe((payload: BroadcastPayload) => {
      if (payload.type === 'STAGE_DISPLAY_UPDATE' && payload.stageState) {
        setStageState(prev => ({
          ...prev,
          ...payload.stageState
        }));
      }
      if (payload.type === 'STAGE_MESSAGE_CHANGE') {
        setStageState(prev => ({
          ...prev,
          stageMessage: payload.stageMessage ?? null,
          stageMessageFlash: payload.stageMessageFlash ?? false
        }));
      }
      if (payload.type === 'COUNTDOWN_UPDATE') {
        if (payload.countdownTargetScreen) {
          setCountdownTargetScreen(payload.countdownTargetScreen);
        }
        setStageState(prev => ({
          ...prev,
          countdownRemaining: payload.countdownRemaining !== undefined ? payload.countdownRemaining : prev.countdownRemaining,
          countdownRunning: payload.countdownRunning !== undefined ? payload.countdownRunning : prev.countdownRunning
        }));
      }
      if (payload.type === 'LIVE_SLIDE_CHANGE') {
        setStageState(prev => ({
          ...prev,
          currentSlide: payload.liveSlide || undefined
        }));
      }
      if (payload.type === 'PREVIEW_SLIDE_CHANGE') {
        setStageState(prev => ({
          ...prev,
          nextSlide: payload.previewSlide || undefined
        }));
      }
      if (payload.type === 'APP_SETTINGS_UPDATE' && payload.appSettings) {
        setShowVerseRefOnStage(payload.appSettings.showVerseNumbers ?? true);
        setStageViewMode(payload.appSettings.stageViewMode || 'near');
      }
      if (stageVideoRef.current) {
        const v = stageVideoRef.current;
        if (payload.type === 'MEDIA_CMD_PAUSE') v.pause();
        else if (payload.type === 'MEDIA_CMD_RESUME') v.play().catch(() => {});
        else if (payload.type === 'MEDIA_CMD_SEEK' && payload.mediaCmd?.seekTo !== undefined) {
          v.currentTime = payload.mediaCmd.seekTo;
        } else if (payload.type === 'MEDIA_CMD_SPEED' && payload.mediaCmd?.playbackRate !== undefined) {
          v.playbackRate = payload.mediaCmd.playbackRate;
        } else if (payload.type === 'MEDIA_CMD_LOOP' && payload.mediaCmd?.loop !== undefined) {
          v.loop = payload.mediaCmd.loop;
        }
      }
    });

    // Request initial state on mount
    BroadcastService.requestInitialState();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'live_psalms_app_settings_v1') {
        const s = StorageService.getSettings();
        setShowVerseRefOnStage(s.showVerseNumbers ?? true);
        setStageViewMode(s.stageViewMode || 'near');
      }
    };
    const handleCustomSettings = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        if (typeof detail.showVerseNumbers === 'boolean') {
          setShowVerseRefOnStage(detail.showVerseNumbers);
        }
        if (detail.stageViewMode) {
          setStageViewMode(detail.stageViewMode);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('app-settings-updated', handleCustomSettings);

    return () => {
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('app-settings-updated', handleCustomSettings);
    };
  }, []);

  const formatCountdown = (secs: number) => {
    const isOvertime = secs < 0;
    const totalSecs = Math.abs(secs);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    let formatted: string;
    if (d > 0) {
      formatted = `${d}d ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else if (h > 0) {
      formatted = `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
      formatted = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
    return isOvertime ? `+${formatted}` : formatted;
  };

  const isRunning   = !!stageState.countdownRunning;
  const secs        = stageState.countdownRemaining;
  const isOvertime  = isRunning && secs < 0;
  const isWarning   = isRunning && secs >= 0 && secs <= 180;  // < 3 min
  const isOnTime    = isRunning && secs > 180;                // > 3 min
  // Show the timer widget if targeted to stage/both AND (running OR paused with time remaining)
  const showTimer   = (countdownTargetScreen === 'both' || countdownTargetScreen === 'stage') && (isRunning || secs !== 0);

  if (stageViewMode === 'far') {
    const currentSlide = stageState.currentSlide;
    const isMediaOnly = !!(currentSlide && currentSlide.backgroundUrl && !currentSlide.content?.trim());
    const isVideo = isVideoMediaSlide(currentSlide);
    const meta = currentSlide?.bibleMeta;
    const bookVerseText = meta
      ? `${meta.book} ${meta.chapter}:${meta.verse}`
      : (currentSlide?.title || stageState.currentItemTitle || '');
    const primaryTrans = formatTranslationBadge(meta?.translationId);
    const parallelTrans = formatTranslationBadge(meta?.parallelTranslationId);
    const translationBadge = primaryTrans
      ? (parallelTrans ? `${primaryTrans} + ${parallelTrans}` : primaryTrans)
      : (currentSlide?.subtitle || '');

    const farSlideStyle = getOutputFontSize(
      currentSlide?.content || '',
      4.8,
      typeof window !== 'undefined' ? window.screen.width : 1920,
      'far'
    );

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
        className="w-screen h-screen bg-gradient-to-b from-[#070b14] via-[#0a101d] to-[#05070e] text-slate-50 select-none px-[3.5vw] py-[2.8vh] flex flex-col justify-between overflow-hidden relative"
      >
        {/* Subtle ambient radial glow matching timer state */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: isOvertime || isWarning
              ? 'radial-gradient(circle at 82% 10%, rgba(244,63,94,0.14), transparent 45%), radial-gradient(circle at 50% 55%, rgba(99,102,241,0.06), transparent 60%)'
              : isOnTime
              ? 'radial-gradient(circle at 82% 10%, rgba(16,185,129,0.12), transparent 45%), radial-gradient(circle at 50% 55%, rgba(99,102,241,0.06), transparent 60%)'
              : 'radial-gradient(circle at 82% 10%, rgba(245,158,11,0.10), transparent 45%), radial-gradient(circle at 50% 55%, rgba(99,102,241,0.07), transparent 60%)'
          }}
        />

        {/* TOP ELEGANT GLASS BAR: BOOK/VERSE + TRANSLATION ON LEFT, HERO COUNTER ON RIGHT */}
        <div className="relative z-10 flex items-center justify-between gap-6 px-6 py-4 rounded-3xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.45)] shrink-0">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {bookVerseText && (
              <div className="flex items-center gap-3 bg-amber-400/15 border border-amber-400/45 text-amber-200 px-5 py-2 rounded-2xl shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <BookOpen className="w-6 h-6 text-amber-300 shrink-0" />
                <span className="text-2xl xl:text-3xl font-bold tracking-tight truncate max-w-[38vw]">
                  {bookVerseText}
                </span>
              </div>
            )}
            {translationBadge && (
              <span className="px-4 py-2 rounded-2xl bg-sky-400/15 border border-sky-400/40 text-sky-200 text-lg xl:text-xl font-bold uppercase tracking-widest">
                {translationBadge}
              </span>
            )}
            {!meta && currentSlide?.sectionLabel && (
              <span className="px-4 py-2 rounded-2xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-200 text-lg xl:text-xl font-bold uppercase tracking-widest">
                {currentSlide.sectionLabel}
              </span>
            )}
            {!bookVerseText && !translationBadge && (
              <span className="text-lg font-bold uppercase tracking-[0.25em] text-slate-400">
                Stage Display
              </span>
            )}
          </div>

          {/* HERO COUNTER OR CLOCK */}
          <div className="font-mono shrink-0">
            {showTimer ? (
              <div
                className={`flex items-center gap-4 px-6 py-2.5 rounded-2xl border backdrop-blur-md transition-all ${
                  isOvertime || isWarning
                    ? 'bg-rose-500/15 border-rose-400/60 shadow-[0_0_28px_rgba(244,63,94,0.3)]'
                    : isOnTime
                    ? 'bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.22)]'
                    : 'bg-white/[0.05] border-white/15'
                }`}
              >
                <Timer
                  className={`w-8 h-8 ${
                    isOvertime || isWarning
                      ? 'text-rose-300 animate-pulse'
                      : isOnTime
                      ? 'text-emerald-300'
                      : 'text-slate-300'
                  }`}
                />
                <div className="flex flex-col leading-none">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.26em] mb-1 ${
                      isOvertime || isWarning ? 'text-rose-300' : isOnTime ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {isOvertime ? 'Overtime' : isWarning ? 'Countdown' : isOnTime ? 'Remaining' : 'Paused'}
                  </span>
                  <span
                    className={`text-5xl xl:text-7xl font-black tabular-nums tracking-tight ${
                      isOvertime || isWarning
                        ? 'text-rose-300 animate-pulse'
                        : isOnTime
                        ? 'text-emerald-300'
                        : 'text-white'
                    }`}
                  >
                    {formatCountdown(secs)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 bg-amber-400/10 border border-amber-400/35 px-6 py-2.5 rounded-2xl">
                <ClockIcon className="w-8 h-8 text-amber-300/90" />
                <span className="text-4xl xl:text-6xl font-black tabular-nums text-amber-200 tracking-tight">
                  {stageState.clockTime}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* STAGE MESSAGE BANNER (IF ACTIVE) */}
        {stageState.stageMessage && (
          <div
            className={`relative z-10 mt-[1.5vh] px-7 py-3 rounded-2xl border flex items-center gap-4 shrink-0 backdrop-blur-md ${
              stageState.stageMessageFlash
                ? 'bg-rose-600/90 border-rose-300 text-white animate-pulse shadow-[0_0_32px_rgba(244,63,94,0.5)]'
                : 'bg-amber-500/15 border-amber-400/50 text-amber-100'
            }`}
          >
            <span className="px-3 py-1 rounded-lg bg-black/35 text-xs font-bold uppercase tracking-widest border border-white/15">
              Cue
            </span>
            <span className="text-2xl xl:text-3xl font-bold tracking-wide">
              {stageState.stageMessage}
            </span>
          </div>
        )}

        {/* HERO LIVE SLIDE CARD — ELEGANT FRAMING, FULL FOCUS ON SLIDE */}
        <div
          ref={farContainerRef}
          className="relative z-10 flex-1 min-h-0 my-[2vh] rounded-3xl bg-white/[0.025] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center overflow-hidden px-[4vw] py-[3vh]"
        >
          {isMediaOnly && currentSlide?.backgroundUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <video
                  ref={stageVideoRef}
                  key={currentSlide.backgroundUrl}
                  src={currentSlide.backgroundUrl}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain rounded-2xl"
                />
              ) : (
                <img
                  key={currentSlide.backgroundUrl}
                  src={currentSlide.backgroundUrl}
                  alt={currentSlide.title || 'Stage Media'}
                  className="w-full h-full object-contain rounded-2xl"
                />
              )}
            </div>
          ) : currentSlide ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center" style={{ maxWidth: farSlideStyle.maxWidth }}>
              <div
                ref={farTextRef}
                className="font-extrabold text-slate-50 whitespace-pre-line w-full"
                style={{
                  fontSize: farFittedPx ? `${farFittedPx}px` : farSlideStyle.fontSize,
                  lineHeight: farSlideStyle.lineHeight,
                  letterSpacing: '0.015em',
                  textShadow: '0 6px 28px rgba(0,0,0,0.95)'
                }}
              >
                {currentSlide.content}
              </div>
            </div>
          ) : (
            <span className="text-slate-500 text-3xl font-bold uppercase tracking-[0.3em]">
              Output Clear
            </span>
          )}
        </div>

        {/* SUBTLE BOTTOM REFERENCE STRIP: BOOK, VERSE & TRANSLATION */}
        {(bookVerseText || translationBadge || currentSlide?.subtitle) && (
          <div className="relative z-10 flex items-center justify-center gap-3 shrink-0">
            <div className="flex items-center gap-3 px-5 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
              {bookVerseText && (
                <span className="text-lg xl:text-xl font-bold text-amber-200 tracking-wide">
                  {bookVerseText}
                </span>
              )}
              {bookVerseText && translationBadge && (
                <span className="text-slate-500">•</span>
              )}
              {translationBadge && (
                <span className="text-base xl:text-lg font-bold text-sky-300 uppercase tracking-widest">
                  {translationBadge}
                </span>
              )}
              {currentSlide?.subtitle && currentSlide.subtitle !== translationBadge && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-base xl:text-lg font-medium text-slate-300 tracking-wide">
                    {currentSlide.subtitle}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

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
      className="w-screen h-screen bg-[#070b12] text-white select-none p-6 flex flex-col justify-between overflow-hidden"
    >
      {/* TOP HEADER: CLOCK OR COUNTDOWN & SERVICE STATUS */}
      <div className="h-24 bg-[#0f1624] border border-[#26334a] rounded-2xl px-6 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <span className="text-xs font-black uppercase text-[#6366f1] bg-indigo-950/80 px-3.5 py-1.5 rounded-full border border-indigo-500/40 tracking-wider">
            STAGE CONFIDENCE MONITOR
          </span>
          {stageState.currentItemTitle && (
            <span className="text-base font-extrabold text-slate-200 truncate max-w-sm">
              {stageState.currentItemTitle}
            </span>
          )}
        </div>

        {/* TIME vs TIMER DISPLAY: MUTUALLY EXCLUSIVE HIGH VISIBILITY */}
        <div className="font-mono flex items-center">
          {showTimer ? (
            /* COUNTDOWN TIMER — colour shifts green → red → blinking red (overtime) */
            <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl border-2 transition-all ${
              isOvertime
                ? 'bg-rose-950/90 border-rose-500/90 shadow-[0_0_24px_rgba(239,68,68,0.6)]'
                : isWarning
                ? 'bg-rose-950/90 border-rose-500/90 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                : isOnTime
                ? 'bg-emerald-950/80 border-emerald-500/70 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                : 'bg-slate-900/80 border-slate-600/60'  // paused
            }`}>
              <Timer className={`w-8 h-8 ${
                isOvertime || isWarning ? 'text-rose-400 animate-pulse'
                : isOnTime ? 'text-emerald-400'
                : 'text-slate-400'
              }`} />
              <span className={`text-xs font-black uppercase tracking-widest mr-2 ${
                isOvertime || isWarning ? 'text-rose-300' : isOnTime ? 'text-emerald-300' : 'text-slate-400'
              }`}>
                {isOvertime ? 'OVERTIME:' : isWarning ? 'COUNTDOWN:' : isOnTime ? 'TIMER:' : 'PAUSED:'}
              </span>
              <span className={`text-5xl font-black tracking-wider ${
                isOvertime
                  ? 'text-rose-400 animate-pulse'
                  : isWarning
                  ? 'text-rose-400 animate-pulse'
                  : isOnTime
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }`}>
                {formatCountdown(secs)}
              </span>
            </div>
          ) : (
            /* CLOCK — shown only when timer is fully off */
            <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/40 px-5 py-2 rounded-2xl">
              <ClockIcon className="w-6 h-6 text-amber-400" />
              <span className="text-4xl font-black text-amber-400 tracking-wider">
                {stageState.clockTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PROPRESENTER STAGE MESSAGE ALERT BANNER */}
      {stageState.stageMessage && (
        <div
          className={`mt-4 px-8 py-4 rounded-2xl border-2 flex items-center justify-between shadow-2xl transition-all ${
            stageState.stageMessageFlash
              ? 'bg-rose-600/95 border-white text-white animate-pulse shadow-[0_0_40px_rgba(244,63,94,0.85)]'
              : 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-lg bg-black/40 text-xs font-black uppercase tracking-widest border border-white/20">
              STAGE MESSAGE
            </span>
            <span className="text-3xl font-black tracking-wide">
              {stageState.stageMessage}
            </span>
          </div>
        </div>
      )}

      {/* CENTER: CURRENT LIVE SLIDE DISPLAY */}
      {(() => {
        const currentSlide = stageState.currentSlide;
        const isMediaOnly = !!(currentSlide && currentSlide.backgroundUrl && !currentSlide.content?.trim());
        const isVideo = isVideoMediaSlide(currentSlide);

        return (
          <div
            className={`flex-1 min-h-0 my-4 bg-[#0d1320] border-2 border-emerald-500/80 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col justify-between ${
              isMediaOnly ? 'p-0 bg-black' : 'p-8'
            }`}
          >
            {/* Header Bar: Floating overlay when displaying full-bleed Video/Picture, standard header for text slides */}
            <div
              className={
                isMediaOnly
                  ? 'absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none'
                  : 'flex items-center justify-between border-b border-slate-800 pb-3'
              }
            >
              <span
                className={`font-black text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-2 ${
                  isMediaOnly ? 'bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40 shadow-lg' : ''
                }`}
              >
                {isMediaOnly ? (
                  isVideo ? (
                    <>
                      <Film className="w-4 h-4 text-emerald-400" /> PLAYING VIDEO LIVE
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 text-emerald-400" /> DISPLAYING PICTURE LIVE
                    </>
                  )
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" /> CURRENT SLIDE LIVE
                  </>
                )}
              </span>

              <div className="flex items-center gap-2">
                {/* Verse reference or Media title badge */}
                {currentSlide?.title && (showVerseRefOnStage || (currentSlide.sectionLabel !== 'Scripture' && !currentSlide.bibleMeta)) && (
                  <span className="text-xs font-black text-amber-300 bg-amber-950/90 border border-amber-500/60 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    {currentSlide.title}
                  </span>
                )}
                {currentSlide?.sectionLabel && (
                  <span className="text-xs font-black uppercase px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full">
                    {currentSlide.sectionLabel}
                  </span>
                )}
              </div>
            </div>

            {isMediaOnly && currentSlide?.backgroundUrl ? (
              /* FULL-SECTION VIDEO OR PICTURE DISPLAY */
              <div className="w-full h-full flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                {isVideo ? (
                  <video
                    ref={stageVideoRef}
                    key={currentSlide.backgroundUrl}
                    src={currentSlide.backgroundUrl}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <img
                    key={currentSlide.backgroundUrl}
                    src={currentSlide.backgroundUrl}
                    alt={currentSlide.title || 'Stage Media'}
                    className="w-full h-full object-contain bg-black"
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 text-center px-4 overflow-hidden flex flex-col gap-3 items-center justify-center">
                {currentSlide ? (
                  <>
                    <div
                      ref={nearContainerRef}
                      className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
                    >
                      <div
                        ref={nearTextRef}
                        className="font-extrabold text-white leading-tight whitespace-pre-line tracking-wide drop-shadow w-full"
                        style={{
                          ...getFlexibleFontSize(currentSlide.content, 48),
                          ...(nearFittedPx ? { fontSize: `${nearFittedPx}px` } : {})
                        }}
                      >
                        {currentSlide.content}
                      </div>
                    </div>
                    {/* Bible translation & verse badge — controlled by Stage Monitor setting */}
                    {currentSlide.subtitle && (showVerseRefOnStage || (currentSlide.sectionLabel !== 'Scripture' && !currentSlide.bibleMeta)) && (
                      <div className="flex justify-center shrink-0">
                        <span className="text-xs font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-4 py-1.5 rounded-full tracking-wider uppercase">
                          📖 {currentSlide.subtitle}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-slate-600 text-2xl font-bold uppercase tracking-widest">
                    [ OUTPUT CLEAR ]
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* BOTTOM GRID: NEXT SLIDE PREVIEW & SPEAKER NOTES */}
      <div className="grid grid-cols-2 gap-4 h-40">
        {/* NEXT SLIDE PREVIEW CARD */}
        <div className="bg-[#0f1624] border border-blue-500/60 rounded-xl p-4 flex flex-col justify-between shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 shrink-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-400">
              <ArrowRight className="w-4 h-4" /> UPCOMING NEXT SLIDE
            </div>
            {stageState.nextSlide?.title && (
              <span className="text-[11px] font-bold text-blue-300 bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-500/50 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-blue-400" />
                {stageState.nextSlide.title}
              </span>
            )}
          </div>
          <div className="text-slate-300 font-bold text-center my-auto overflow-y-auto max-h-[90px]">
            {stageState.nextSlide?.content ? (
              <div style={getFlexibleFontSize(stageState.nextSlide.content, 16)}>
                {stageState.nextSlide.content}
              </div>
            ) : (
              <span className="text-slate-600 text-xs font-semibold">End of item</span>
            )}
          </div>
        </div>

        {/* SPEAKER / PASTOR NOTES CARD */}
        <div className="bg-[#0f1624] border border-amber-500/50 rounded-xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 border-b border-slate-800 pb-1">
            <FileText className="w-4 h-4" /> SPEAKER & STAGE NOTES
          </div>
          <div className="text-amber-200/90 text-sm font-medium line-clamp-3 my-auto">
            {stageState.speakerNotes || <span className="text-slate-600 text-xs italic">No notes attached</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
