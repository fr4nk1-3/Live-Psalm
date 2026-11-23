import React, { useState, useEffect, useRef } from 'react';
import { Slide, StageDisplayState, AudienceViewMode } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { StorageService } from '../services/storage';
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
  // Uploaded images are blob: URLs with no extension; the slide already says
  // it is an image, so do not fall through to the video heuristic.
  if (slide.backgroundType === 'image') return false;
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
    { minPx: 22, maxPx: 190, startVw: 9 }
  );

  const nearFittedPx = useAutoFitFontSize(
    nearContainerRef,
    nearTextRef,
    [stageViewMode, stageState.currentSlide?.id, stageState.currentSlide?.content],
    { minPx: 20, maxPx: 150, startVw: 7 }
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

  const currentSlide = stageState.currentSlide;
  const nextSlide = stageState.nextSlide;
  const isFar = stageViewMode === 'far';
  const isMediaOnly = !!(currentSlide && currentSlide.backgroundUrl && !currentSlide.content?.trim());
  const isVideo = isVideoMediaSlide(currentSlide);

  const meta = currentSlide?.bibleMeta;
  const reference = meta
    ? `${meta.book} ${meta.chapter}:${meta.verse}`
    : currentSlide?.title || stageState.currentItemTitle || '';
  const nextReference = nextSlide?.bibleMeta
    ? `${nextSlide.bibleMeta.book} ${nextSlide.bibleMeta.chapter}:${nextSlide.bibleMeta.verse}`
    : nextSlide?.title || '';

  const primaryTrans = formatTranslationBadge(meta?.translationId);
  const parallelTrans = formatTranslationBadge(meta?.parallelTranslationId);
  const translation = primaryTrans ? (parallelTrans ? `${primaryTrans} + ${parallelTrans}` : primaryTrans) : '';

  const subtitleText = currentSlide?.subtitle || '';
  const subtitle =
    subtitleText &&
    !/^scripture/i.test(subtitleText) &&
    subtitleText.toLowerCase() !== reference.toLowerCase() &&
    (showVerseRefOnStage || (currentSlide?.sectionLabel !== 'Scripture' && !currentSlide?.bibleMeta))
      ? subtitleText
      : '';

  const timerLabel = isOvertime ? 'Overtime' : isWarning ? 'Time left' : isOnTime ? 'Time left' : 'Paused';
  const urgent = isOvertime || isWarning;

  const itemLabel =
    stageState.currentItemTitle &&
    !/^scripture/i.test(stageState.currentItemTitle) &&
    stageState.currentItemTitle !== reference
      ? stageState.currentItemTitle
      : '';

  const fitted = isFar ? farFittedPx : nearFittedPx;
  const textStyle = isFar
    ? getOutputFontSize(currentSlide?.content || '', 4.8, typeof window !== 'undefined' ? window.screen.width : 1920, 'far')
    : { ...getFlexibleFontSize(currentSlide?.content || '', 48), maxWidth: '100%' };

  return (
    <div
      onClick={() => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      }}
      onDoubleClick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }}
      className="flex h-screen w-screen select-none flex-col overflow-hidden bg-[#08080a] font-sans text-white"
    >
      {/* Header: what is on, where we are, and the time */}
      <header className="stage-header flex shrink-0 items-center justify-between gap-[2vw] border-b border-white/10 px-[2vw]">
        <div className="flex min-w-0 items-baseline gap-[1.2vw]">
          <span className="stage-label shrink-0 text-white/35">Stage</span>
          {reference ? (
            <span className="stage-reference truncate font-semibold text-white/90">{reference}</span>
          ) : (
            <span className="stage-reference truncate text-white/50">Nothing live</span>
          )}
          {translation && <span className="stage-meta shrink-0 text-white/40">{translation}</span>}
          {subtitle && subtitle !== translation && subtitle.length <= 40 && (
            <span className="stage-meta hidden shrink-0 truncate text-white/40 lg:inline">{subtitle}</span>
          )}
          {itemLabel && !isFar && (
            <span className="stage-meta hidden shrink-0 truncate text-white/35 xl:inline">{itemLabel}</span>
          )}
        </div>

        <div className="flex shrink-0 items-baseline gap-[0.8vw]">
          <span className="stage-label text-white/35">{showTimer ? timerLabel : 'Time'}</span>
          <span
            className={`stage-clock font-mono tabular leading-none tracking-tight ${
              showTimer && urgent ? 'text-live' : 'text-white/90'
            }`}
          >
            {showTimer ? formatCountdown(secs) : stageState.clockTime}
          </span>
        </div>
      </header>

      {/* Cue message from the operator */}
      {stageState.stageMessage && (
        <div
          className={`stage-cue flex shrink-0 items-center gap-[1.2vw] border-b ${
            stageState.stageMessageFlash
              ? 'border-live bg-live text-live-foreground'
              : 'border-live/30 bg-live/10 text-white'
          }`}
        >
          <span
            className={`stage-cue-label shrink-0 ${
              stageState.stageMessageFlash ? 'text-live-foreground/70' : 'text-live'
            }`}
          >
            Cue
          </span>
          <span className="stage-cue-text min-w-0 font-medium">{stageState.stageMessage}</span>
        </div>
      )}

      {/* Current slide */}
      <main className="flex min-h-0 flex-1 flex-col">
        <div
          ref={isFar ? farContainerRef : nearContainerRef}
          className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-[3vw] py-[2vh]"
        >
          {isMediaOnly && currentSlide?.backgroundUrl ? (
            <div className="flex h-full w-full items-center justify-center bg-black">
              {isVideo ? (
                <video
                  ref={stageVideoRef}
                  key={currentSlide.backgroundUrl}
                  src={currentSlide.backgroundUrl}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  key={currentSlide.backgroundUrl}
                  src={currentSlide.backgroundUrl}
                  alt={currentSlide.title || 'Stage media'}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          ) : currentSlide ? (
            <div
              ref={isFar ? farTextRef : nearTextRef}
              className={`w-full whitespace-pre-line text-center font-semibold text-white ${
                isFar ? 'tracking-tight' : 'leading-tight'
              }`}
              style={{
                fontSize: fitted ? `${fitted}px` : textStyle.fontSize,
                lineHeight: isFar ? textStyle.lineHeight : '1.25',
                letterSpacing: isFar ? '0.01em' : 'normal',
                maxWidth: isFar ? textStyle.maxWidth : '100%'
              }}
            >
              {currentSlide.content}
            </div>
          ) : (
            <span className="stage-panel-text text-white/30">The screen is clear</span>
          )}
        </div>

        {/* Next slide and notes, for close viewing */}
        {!isFar && (
          <div className="stage-panel grid shrink-0 grid-cols-2 border-t border-white/10">
            <section className="flex min-h-0 flex-col gap-[1vh] border-r border-white/10 px-[2vw] py-[1.6vh]">
              <div className="flex items-baseline justify-between gap-[1vw]">
                <span className="stage-panel-title text-white/35">Next</span>
                {nextReference && <span className="stage-panel-meta truncate text-white/45">{nextReference}</span>}
              </div>
              <div className="stage-panel-text min-h-0 flex-1 overflow-hidden text-white/70">
                {nextSlide?.content ? (
                  <p className="whitespace-pre-line">{nextSlide.content}</p>
                ) : (
                  <span className="text-white/30">End of this item</span>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col gap-[1vh] px-[2vw] py-[1.6vh]">
              <div className="flex items-baseline justify-between gap-[1vw]">
                <span className="stage-panel-title text-white/35">Notes</span>
                {stageState.speakerNotes ? (
                  <span className="stage-panel-meta text-white/25">Operator and stage only</span>
                ) : null}
              </div>
              <div className="stage-panel-text min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-white/75">
                {stageState.speakerNotes || <span className="text-white/30">No notes for this item</span>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
