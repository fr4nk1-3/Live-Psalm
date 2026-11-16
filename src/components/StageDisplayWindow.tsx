import React, { useState, useEffect, useRef } from 'react';
import { Slide, StageDisplayState } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { StorageService } from '../services/storage';
import { Clock as ClockIcon, FileText, ArrowRight, Zap, Timer, BookOpen, Film, Image as ImageIcon } from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';

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
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);

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
        setShowVerseRefOnStage(StorageService.getSettings().showVerseNumbers ?? true);
      }
    };
    const handleCustomSettings = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.showVerseNumbers === 'boolean') {
        setShowVerseRefOnStage(detail.showVerseNumbers);
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
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    let formatted: string;
    if (h > 0) {
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
            className={`flex-1 my-4 bg-[#0d1320] border-2 border-emerald-500/80 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col justify-between ${
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
              <div className="my-auto text-center px-4 overflow-y-auto max-h-[60vh] flex flex-col gap-3 items-center justify-center">
                {currentSlide ? (
                  <>
                    <div
                      className="font-extrabold text-white leading-tight whitespace-pre-line tracking-wide drop-shadow"
                      style={getFlexibleFontSize(currentSlide.content, 48)}
                    >
                      {currentSlide.content}
                    </div>
                    {/* Bible translation & verse badge — controlled by Stage Monitor setting */}
                    {currentSlide.subtitle && (showVerseRefOnStage || (currentSlide.sectionLabel !== 'Scripture' && !currentSlide.bibleMeta)) && (
                      <div className="flex justify-center mt-2">
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
