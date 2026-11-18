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
  const [outputFontWeight, setOutputFontWeight] = useState<string>('800');
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const farContainerRef = useRef<HTMLDivElement | null>(null);
  const farTextRef = useRef<HTMLDivElement | null>(null);
  const nearContainerRef = useRef<HTMLDivElement | null>(null);
  const nearTextRef = useRef<HTMLDivElement | null>(null);
  const nextContainerRef = useRef<HTMLDivElement | null>(null);
  const nextTextRef = useRef<HTMLDivElement | null>(null);

  const farFittedPx = useAutoFitFontSize(
    farContainerRef,
    farTextRef,
    [stageViewMode, stageState.currentSlide?.id, stageState.currentSlide?.content],
    { minPx: 24, maxPx: 220, startVw: 9.5 }
  );

  const nearFittedPx = useAutoFitFontSize(
    nearContainerRef,
    nearTextRef,
    [stageViewMode, stageState.currentSlide?.id, stageState.currentSlide?.content, stageState.countdownRunning],
    { minPx: 22, maxPx: 160, startVw: 6.2 }
  );

  const nextFittedPx = useAutoFitFontSize(
    nextContainerRef,
    nextTextRef,
    [stageViewMode, stageState.nextSlide?.id, stageState.nextSlide?.content],
    { minPx: 11, maxPx: 29, startVw: 1.75 }
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
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        setOutputFontWeight(payload.theme.fontWeight || '800');
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
      className="flex h-screen w-screen select-none flex-col overflow-hidden bg-background font-sans text-foreground"
    >
      {/* Top Status Rail */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/70 px-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              currentSlide
                ? 'border-live/40 bg-live/15 text-live'
                : 'border-border bg-secondary text-muted-foreground'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                currentSlide ? 'bg-live' : 'bg-muted-foreground/60'
              }`}
            />
            {currentSlide ? 'Live' : 'Standby'}
          </span>

          <div className="flex min-w-0 items-center gap-3">
            {reference ? (
              <span
                className={`truncate font-extrabold tracking-tight text-foreground ${
                  isFar ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                }`}
              >
                {reference}
              </span>
            ) : (
              <span className="truncate text-base font-medium text-muted-foreground">Waiting for live slide</span>
            )}
            {translation && (
              <span
                className={`shrink-0 rounded-md border border-primary/30 bg-primary/15 px-2.5 py-0.5 font-bold uppercase tracking-wider text-foreground ${
                  isFar ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                }`}
              >
                {translation}
              </span>
            )}
            {subtitle && subtitle !== translation && subtitle.length <= 45 && (
              <span className="hidden shrink-0 truncate text-xs text-muted-foreground lg:inline">
                {subtitle}
              </span>
            )}
            {itemLabel && !isFar && (
              <span className="hidden shrink-0 truncate text-xs text-muted-foreground/80 xl:inline">
                · {itemLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
            {stageViewMode} view
          </span>
        </div>
      </header>

      {/* Operator Cue Banner */}
      {stageState.stageMessage && (
        <div
          className={`flex shrink-0 items-center gap-3 border-b px-5 py-2.5 ${
            stageState.stageMessageFlash
              ? 'border-live bg-live text-live-foreground'
              : 'border-border border-l-4 border-l-live bg-card text-foreground'
          }`}
        >
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              stageState.stageMessageFlash
                ? 'bg-black/20 text-live-foreground'
                : 'bg-live/15 text-live'
            }`}
          >
            Cue
          </span>
          <span className="min-w-0 text-base font-semibold leading-snug">{stageState.stageMessage}</span>
        </div>
      )}

      {/* Center Focus: Prominent Countdown OR Clock (Clock hidden whenever countdown is active) + Main Slide Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
        {/* Centered Focal Timer / Clock Bar */}
        <div className="flex shrink-0 items-center justify-center">
          {showTimer ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-2">
              <span
                className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                  isOvertime
                    ? 'border-live/40 bg-live/15 text-live'
                    : isWarning
                    ? 'border-warning/40 bg-warning/15 text-warning'
                    : isOnTime
                    ? 'border-success/40 bg-success/15 text-success'
                    : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                {timerLabel}
              </span>
              <span
                className={`tabular font-mono font-bold leading-none tracking-tight ${
                  isFar ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'
                } ${
                  isOvertime
                    ? 'text-live'
                    : isWarning
                    ? 'text-warning'
                    : isOnTime
                    ? 'text-success'
                    : 'text-foreground'
                }`}
              >
                {formatCountdown(secs)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Clock
              </span>
              <span
                className={`tabular font-mono font-bold leading-none tracking-tight text-foreground ${
                  isFar ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                }`}
              >
                {stageState.clockTime}
              </span>
            </div>
          )}
        </div>

        {/* Dominant Center Slide Content */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div
            ref={isFar ? farContainerRef : nearContainerRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-[4vw] py-[2.5vh]"
          >
            {isMediaOnly && currentSlide?.backgroundUrl ? (
              <div className="flex h-full w-full items-center justify-center rounded bg-black">
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
                className={`w-full whitespace-pre-line text-center text-foreground ${
                  isFar ? 'tracking-tight' : 'leading-tight'
                }`}
                style={{
                  fontWeight: outputFontWeight,
                  fontSize: fitted ? `${fitted}px` : textStyle.fontSize,
                  lineHeight: isFar ? textStyle.lineHeight : '1.22',
                  letterSpacing: isFar ? '0.01em' : 'normal',
                  maxWidth: isFar ? textStyle.maxWidth : '100%'
                }}
              >
                {currentSlide.content}
              </div>
            ) : (
              <span className="text-lg text-muted-foreground">The screen is clear</span>
            )}
          </div>
        </section>

        {/* Compact Bottom Confidence Strip (Near View only: Next + Notes) */}
        {!isFar && (
          <div className="grid h-[23vh] min-h-[130px] max-h-[210px] shrink-0 grid-cols-2 gap-3">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-preview" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-preview">
                    Next
                  </span>
                </div>
                {nextReference && (
                  <span className="truncate text-2xs font-medium text-muted-foreground">{nextReference}</span>
                )}
              </div>
              <div
                ref={nextContainerRef}
                className="flex min-h-0 flex-1 items-center overflow-hidden px-3.5 py-2 text-foreground/85"
              >
                {nextSlide?.content ? (
                  <p
                    ref={nextTextRef}
                    className="w-full whitespace-pre-line leading-snug"
                    style={{
                      fontWeight: outputFontWeight,
                      fontSize: nextFittedPx ? `${nextFittedPx}px` : '13px'
                    }}
                  >
                    {nextSlide.content}
                  </p>
                ) : (
                  <span className="text-xs text-muted-foreground">End of this item</span>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </span>
                <span className="text-2xs text-muted-foreground/70">Stage only</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line px-3 py-2 text-sm leading-relaxed text-foreground/85">
                {stageState.speakerNotes || (
                  <span className="text-xs text-muted-foreground">No notes for this item</span>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
