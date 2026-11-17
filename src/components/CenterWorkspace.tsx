import React, { useState, useEffect, useRef } from 'react';
import { PlaylistItem, Slide, SectionTag, Theme, QuickPinnedItem, AudienceAlert, MediaAsset } from '../types/presentation';
import { BroadcastService } from '../services/broadcast';
import {
  Eye,
  Tv,
  Megaphone,
  Zap,
  X,
  Pin,
  MonitorPlay,
  Circle,
  LayoutGrid,
  List,
  AlignLeft,
  Scissors,
  Merge,
  Plus,
  Trash2,
  Copy,
  Repeat,
  MessageSquare,
  Bell,
  Music2,
  Volume2,
  Eraser,
  Film,
  Layers,
  BookOpen,
  Globe
} from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';
import { StorageService } from '../services/storage';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { EmptyState } from './ui/primitives';
import { AudioMeter } from './AudioMeter';
import { useAudioLevels, useAudioSettings, useStreamStatus } from '../hooks/useAudio';
import { audioMonitor } from '../services/audioMonitor';
import { SceneCanvas } from '../scene/SceneCanvas';
import { ScenePanel } from '../scene/ScenePanel';
import { getActiveScene, useSceneLibrary } from '../scene/store';
import { setSceneCanvas } from '../services/sceneCanvas';

const WORKSPACE_QUICK_BIBLE_VERSIONS = [
  { id: 'bible-eng-nkjv', abbr: 'NKJV' },
  { id: 'bible-eng-kjv', abbr: 'KJV' },
  { id: 'bible-eng-niv', abbr: 'NIV' },
  { id: 'bible-eng-amp', abbr: 'AMP' },
  { id: 'bible-eng-esv', abbr: 'ESV' },
  { id: 'bible-eng-nlt', abbr: 'NLT' },
  { id: 'bible-eng-tpt', abbr: 'TPT' },
  { id: 'bible-swh-suv', abbr: 'SUV (Swahili)' },
  { id: 'bible-kik-gky19', abbr: 'GKY19 (Kikuyu)' },
  { id: 'bible-luo-luo20', abbr: 'LUO20 (Luo)' },
  { id: 'bible-kal-klj19', abbr: 'KLJ19 (Kalenjin)' },
  { id: 'bible-kam-kmb', abbr: 'KMB (Kamba)' },
  { id: 'bible-mas-mas20', abbr: 'MAS20 (Maasai)' }
];

interface CenterWorkspaceProps {
  activeItem: PlaylistItem | null;
  previewSlide: Slide | null;
  liveSlide: Slide | null;
  activeTheme: Theme;
  audienceViewMode?: 'near' | 'far';
  quickPinnedItems?: QuickPinnedItem[];
  lastViewedSlideMap?: Record<string, string>;
  activeTranslationId?: string;
  parallelTranslationId?: string | null;
  targetParallelVersionId?: string | null;
  onTranslateActiveBible?: (targetVersionId?: string, specificSlide?: Slide) => void;
  onSwitchBibleTranslation?: (primaryId: string, parallelId: string | null) => void;
  mediaList?: MediaAsset[];
  /** Global persistent video BG URL for preview (from App state) */
  globalVideoBgUrl?: string | null;
  onSelectSlidePreview: (slide: Slide) => void;
  onSendSlideLive: (slide: Slide) => void;
  onJumpSection: (sectionLabel: SectionTag) => void;
  onTriggerLowerThirdAnnouncement: (slide: Slide) => void;
  onClearLowerThirdAnnouncement: () => void;
  activeLowerThirdText: { title?: string; content?: string } | null;
  onUnpinFromQuickSection?: (pinIdOrTitle: string) => void;
  onLoadQuickPinnedSlides?: (slides: Slide[], title: string, itemId?: string) => void;
  onUpdateItemSlides?: (itemId: string, updatedSlides: Slide[]) => void;
  onClearLiveSlide?: () => void;
  onApplyBackground?: (media: MediaAsset, scope: 'global' | 'item' | 'slide', targetSlide?: Slide) => void;
  onClearBackground?: () => void;
  /** Opens the slide settings sheet. */
  onOpenInspector?: () => void;
  /** Opens the stream setup dialog from the broadcast monitor. */
  onOpenStreamSettings?: () => void;
  /** Countdown seconds, mirrored into the broadcast scene. */
  countdownSeconds?: number;
}

function LayerChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-6 rounded-sm border border-border bg-background/60 px-1.5 text-2xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
    >
      {label}
    </button>
  );
}

const SECTION_TAGS: SectionTag[] = [
  'Verse 1',
  'Verse 2',
  'Verse 3',
  'Verse 4',
  'Pre-Chorus',
  'Chorus',
  'Chorus 2',
  'Bridge',
  'Tag',
  'Intro',
  'Outro',
  'Ending',
  'Scripture',
  'Slide',
  'Title'
];

/** ProPresenter-style color-coded group colors */
function getSectionGroupColor(tag?: SectionTag): { bar: string; badge: string; border: string } {
  if (!tag) return { bar: 'bg-slate-600', badge: 'bg-slate-800 text-slate-300 border-slate-600', border: 'border-slate-700' };
  if (tag.startsWith('Chorus')) {
    return { bar: 'bg-rose-500', badge: 'bg-rose-950/90 text-rose-300 border-rose-500/50', border: 'border-rose-500/50' };
  }
  if (tag.startsWith('Verse')) {
    return { bar: 'bg-blue-500', badge: 'bg-blue-950/90 text-blue-300 border-blue-500/50', border: 'border-blue-500/50' };
  }
  if (tag === 'Bridge') {
    return { bar: 'bg-purple-500', badge: 'bg-purple-950/90 text-purple-300 border-purple-500/50', border: 'border-purple-500/50' };
  }
  if (tag === 'Pre-Chorus') {
    return { bar: 'bg-amber-500', badge: 'bg-amber-950/90 text-amber-300 border-amber-500/50', border: 'border-amber-500/50' };
  }
  if (tag === 'Tag' || tag === 'Ending') {
    return { bar: 'bg-pink-500', badge: 'bg-pink-950/90 text-pink-300 border-pink-500/50', border: 'border-pink-500/50' };
  }
  if (tag === 'Intro' || tag === 'Outro') {
    return { bar: 'bg-emerald-500', badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50', border: 'border-emerald-500/50' };
  }
  if (tag === 'Scripture') {
    return { bar: 'bg-yellow-500', badge: 'bg-yellow-950/90 text-yellow-300 border-yellow-500/50', border: 'border-yellow-500/50' };
  }
  return { bar: 'bg-indigo-500', badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50', border: 'border-indigo-500/50' };
}

const PAD_KEYS: { key: string; freq: number }[] = [
  { key: 'C', freq: 130.81 },
  { key: 'C#', freq: 138.59 },
  { key: 'D', freq: 146.83 },
  { key: 'Eb', freq: 155.56 },
  { key: 'E', freq: 164.81 },
  { key: 'F', freq: 174.61 },
  { key: 'F#', freq: 185.0 },
  { key: 'G', freq: 196.0 },
  { key: 'Ab', freq: 207.65 },
  { key: 'A', freq: 220.0 },
  { key: 'Bb', freq: 233.08 },
  { key: 'B', freq: 246.94 }
];

/** Renders a 16:9 slide canvas — shared by both PREVIEW and PROGRAM monitors */
const SlideCanvas: React.FC<{
  slide: Slide | null;
  theme: Theme;
  label: string;
  isLive: boolean;
  audienceViewMode?: 'near' | 'far';
  dimmed?: boolean;
  itemVideoBgUrl?: string | null;
  globalVideoBgUrl?: string | null;
}> = ({ slide, theme, isLive, audienceViewMode = 'near', itemVideoBgUrl, globalVideoBgUrl }) => {
  const isFarPreview = isLive && audienceViewMode === 'far';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liveTimecode, setLiveTimecode] = useState<{ current: number; duration: number } | null>(null);

  const slideBgUrl = slide?.backgroundUrl ?? null;
  const isSlideVideoBg =
    slide?.backgroundType === 'video' ||
    !!(
      slideBgUrl &&
      (slideBgUrl.endsWith('.mp4') ||
        slideBgUrl.endsWith('.webm') ||
        slideBgUrl.endsWith('.mov') ||
        slideBgUrl.endsWith('.mkv') ||
        slideBgUrl.endsWith('.m4v') ||
        slideBgUrl.startsWith('data:video') ||
        slideBgUrl.startsWith('blob:'))
    );
  const isPureMediaSlide = !!(slide && slideBgUrl && !slide.content?.trim());
  const isPureForegroundVideo = !!(isPureMediaSlide && isSlideVideoBg);
  const isPureImageSlide = !!(isPureMediaSlide && !isSlideVideoBg);
  const activeMotionLoopUrl = isPureMediaSlide
    ? (isSlideVideoBg ? slideBgUrl : null)
    : (isSlideVideoBg ? slideBgUrl : (itemVideoBgUrl || globalVideoBgUrl || null));
  const bgUrl = isPureMediaSlide ? slideBgUrl : (activeMotionLoopUrl || slideBgUrl || theme.backgroundUrl);
  const isVideo = isPureMediaSlide ? isSlideVideoBg : !!activeMotionLoopUrl;

  // Sync Program Monitor foreground video with MediaPlayerBar transport commands
  useEffect(() => {
    if (!isPureForegroundVideo) {
      setLiveTimecode(null);
      return;
    }
    const unsub = BroadcastService.subscribe(payload => {
      const v = videoRef.current;
      if (!v) return;
      if (payload.type === 'MEDIA_CMD_PAUSE') {
        v.pause();
      } else if (payload.type === 'MEDIA_CMD_RESUME') {
        v.play().catch(() => {});
      } else if (payload.type === 'MEDIA_CMD_SEEK' && payload.mediaCmd?.seekTo !== undefined) {
        v.currentTime = payload.mediaCmd.seekTo;
      } else if (payload.type === 'MEDIA_CMD_SPEED' && payload.mediaCmd?.playbackRate !== undefined) {
        v.playbackRate = payload.mediaCmd.playbackRate;
      } else if (payload.type === 'MEDIA_CMD_LOOP' && payload.mediaCmd?.loop !== undefined) {
        v.loop = payload.mediaCmd.loop;
      } else if (payload.type === 'MEDIA_STATUS' && payload.mediaStatus) {
        setLiveTimecode({
          current: payload.mediaStatus.currentTime,
          duration: payload.mediaStatus.duration
        });
      }
    });
    return () => unsub();
  }, [isPureForegroundVideo]);

  const fmtSec = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const baseFontPx = isFarPreview ? 30 : isLive ? 22 : 18;
  const { fontSize: scaledFontPx, lineHeight } = getFlexibleFontSize(slide?.content || '', baseFontPx);
  const fontScale = parseFloat(scaledFontPx) / baseFontPx;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
      {/* Background layer */}
      {bgUrl &&
        (isVideo ? (
          <video
            ref={videoRef}
            src={bgUrl}
            autoPlay
            loop={!isPureForegroundVideo}
            muted
            playsInline
            className={`absolute inset-0 h-full w-full ${
              isPureForegroundVideo ? 'object-contain opacity-100' : `object-cover ${isLive ? 'opacity-70' : 'opacity-45'}`
            }`}
          />
        ) : (
          <img
            src={bgUrl}
            alt=""
            className={`absolute inset-0 h-full w-full ${
              isPureImageSlide ? 'object-contain opacity-100' : `object-cover ${isLive ? 'opacity-65' : 'opacity-40'}`
            }`}
          />
        ))}
      {!bgUrl && <div className="absolute inset-0 bg-neutral-950" />}

      {/* Scrim (skipped for full-frame media so the asset plays cleanly) */}
      {!isPureMediaSlide && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: isFarPreview
              ? `rgba(0,0,0,${Math.max(theme.scrimOpacity ?? 0.45, 0.88)})`
              : `rgba(0,0,0,${theme.scrimOpacity ?? 0.45})`
          }}
        />
      )}

      {/* Foreground video timecode */}
      {isPureForegroundVideo && liveTimecode && liveTimecode.duration > 0 && (
        <div className="absolute bottom-2 left-2 z-30 rounded-sm border border-white/15 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/75">
          {fmtSec(liveTimecode.current)} / {fmtSec(liveTimecode.duration)}
        </div>
      )}

      {/* Slide text */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-[6%] text-center">
        {slide ? (
          isPureMediaSlide ? null : (
            <>
              {slide.title && (
                <div
                  className="mb-[0.6em] whitespace-nowrap rounded-sm border border-white/15 bg-black/45 px-[0.8em] py-[0.15em] font-medium tracking-[0.08em] text-white/70"
                  style={{ fontSize: `clamp(8px, ${(fontScale * 3.4).toFixed(2)}cqh, 14px)` }}
                >
                  {slide.title}
                </div>
              )}
              <div
                className="whitespace-pre-line font-semibold text-white"
                style={{
                  fontFamily: theme.fontFamily,
                  fontSize: `clamp(10px, ${(fontScale * 11.5).toFixed(2)}cqh, 40px)`,
                  lineHeight,
                  textAlign: theme.align,
                  letterSpacing: isFarPreview ? '0.02em' : theme.letterSpacing || 'normal',
                  textTransform: theme.textTransform || 'none',
                  textShadow: '0 2px 10px rgba(0,0,0,0.85)',
                  maxWidth: '88%'
                }}
              >
                {slide.content}
              </div>
              {slide.subtitle && (
                <div
                  className="mt-[0.5em] text-white/70"
                  style={{ fontSize: `clamp(8px, ${(fontScale * 3.6).toFixed(2)}cqh, 15px)` }}
                >
                  {slide.subtitle}
                </div>
              )}
            </>
          )
        ) : (
          <span className="text-[11px] text-white/25">{isLive ? 'Output clear' : 'No slide selected'}</span>
        )}
      </div>
    </div>
  );
};

/**
 * Broadcast monitor: what is leaving the machine, with a stereo level meter for
 * the audio that is being sent. Sits next to the programme monitor so the
 * operator can compare stage output and stream output at a glance.
 */
const BroadcastMonitor: React.FC<{
  liveSlide: Slide | null;
  theme: Theme;
  audienceViewMode?: 'near' | 'far';
  itemVideoBgUrl?: string | null;
  globalVideoBgUrl?: string | null;
  activeAlert?: AudienceAlert | null;
  lowerThird?: { title?: string; content?: string; speed?: string } | null;
  countdownSeconds?: number;
  onOpenStreamSettings?: () => void;
}> = ({ liveSlide, theme, audienceViewMode = 'near', itemVideoBgUrl, globalVideoBgUrl, activeAlert, lowerThird, countdownSeconds = 0, onOpenStreamSettings }) => {
  const levels = useAudioLevels();
  const [audio] = useAudioSettings();
  const status = useStreamStatus();
  const library = useSceneLibrary();
  const activeScene = getActiveScene(library) || library.scenes[0];
  const handleCanvasReady = React.useCallback((canvas: HTMLCanvasElement | null) => {
    setSceneCanvas(canvas);
  }, []);

  // Keep the meter running while a stream is actually live.
  React.useEffect(() => {
    if (!status.live) return;
    audioMonitor.retain();
    return () => audioMonitor.release();
  }, [status.live]);

  const sourceLabel =
    audio.source === 'program' ? 'Programme audio' : audio.source === 'silent' ? 'Silent' : 'Microphone';

  return (
    <section className="hidden min-w-0 flex-[0.92] flex-col lg:flex">
      <header className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={cn('state-label', status.live ? 'text-live' : 'text-muted-foreground')}>Broadcast</span>
        <span className={cn('min-w-0 truncate text-2xs', status.live ? 'text-live' : 'text-muted-foreground')}>
          {status.live ? `Live${status.platform ? ` · ${status.platform}` : ''}` : 'Idle'}
        </span>
      </header>

      <div
        className={cn(
          'relative mx-auto w-full max-w-[calc(26vh*16/9)] overflow-hidden rounded border bg-black',
          status.live ? 'border-live/60' : 'border-border'
        )}
        style={{ aspectRatio: '16/9', containerType: 'size' }}
        title="What the live stream is sending"
      >
        {activeScene && (
          <SceneCanvas
            scene={activeScene}
            slide={liveSlide}
            theme={theme}
            onCanvasReady={handleCanvasReady}
            className="absolute inset-0"
          />
        )}

        {activeAlert && (
          <div className="absolute left-2 top-2 z-30">
            <Badge variant="warning">{activeAlert.code}</Badge>
          </div>
        )}

        {lowerThird?.content && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-white/10 bg-black/85 px-2 py-1">
            <div
              className="animate-crawl-line whitespace-nowrap text-2xs font-medium text-white"
              style={{
                animationDuration:
                  lowerThird.speed === 'slow' ? '32s' : lowerThird.speed === 'fast' ? '13s' : '22s'
              }}
            >
              {lowerThird.content}
              {lowerThird.title ? ` - (${lowerThird.title})` : ''}
            </div>
          </div>
        )}

        {/* Stereo meter, right edge, away from the slide text */}
        <div className="absolute bottom-1.5 right-1.5 top-1.5 z-30 flex items-end rounded-sm bg-black/45 p-1">
          <AudioMeter levels={levels} className="h-full" />
        </div>
      </div>

      <footer className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <span className={cn('tabular font-mono', levels.peak >= 0.985 && 'text-live')}>
              {levels.connected ? `${levels.peakDb.toFixed(1)} dB` : 'no input'}
            </span>
            <span aria-hidden>·</span>
            <span className={cn('truncate', audio.muted && 'text-warning')}>
              {sourceLabel}
              {audio.muted ? ' (muted)' : ''}
            </span>
          </span>
          {onOpenStreamSettings && (
            <Button size="xs" variant="ghost" onClick={onOpenStreamSettings}>
              Setup
            </Button>
          )}
        </div>
      </footer>
    </section>
  );
};
export const CenterWorkspace: React.FC<CenterWorkspaceProps> = ({
  activeItem,
  previewSlide,
  liveSlide,
  activeTheme,
  audienceViewMode = 'near',
  quickPinnedItems = [],
  lastViewedSlideMap = {},
  activeTranslationId = 'bible-eng-nkjv',
  parallelTranslationId = null,
  targetParallelVersionId = null,
  onTranslateActiveBible,
  onSwitchBibleTranslation,
  mediaList = [],
  globalVideoBgUrl,
  onSelectSlidePreview,
  onSendSlideLive,
  onJumpSection,
  onTriggerLowerThirdAnnouncement,
  onClearLowerThirdAnnouncement,
  activeLowerThirdText,
  onUnpinFromQuickSection,
  onLoadQuickPinnedSlides,
  onUpdateItemSlides,
  onClearLiveSlide,
  onApplyBackground,
  onClearBackground,
  onOpenInspector,
  onOpenStreamSettings,
  countdownSeconds = 0
}) => {
  const slideGridContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active preview/live slide card into view when stepping or switching pinned chapters
  useEffect(() => {
    const targetId = previewSlide?.id || liveSlide?.id;
    if (!targetId || !slideGridContainerRef.current) return;
    const el = slideGridContainerRef.current.querySelector(`[data-slide-id="${CSS.escape(targetId)}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [previewSlide?.id, liveSlide?.id, activeItem?.id]);
  // ProPresenter Workspace View Mode: Grid, List, or Reflow Editor
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'reflow'>('grid');

  // ProPresenter Auto-Advance Loop Timer (in seconds, 0 = Off)
  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number>(0);

  // ProPresenter Live Operator Dock Tab ('none' | 'bgs' | 'stage-msg' | 'pager' | 'pads')
  const [activeDockTab, setActiveDockTab] = useState<'none' | 'scenes' | 'bgs' | 'stage-msg' | 'pager' | 'pads'>('none');
  const [quickBgScope, setQuickBgScope] = useState<'global' | 'item' | 'slide'>('global');

  const handleMediaDrop = (e: React.DragEvent, scope: 'global' | 'item' | 'slide', targetSlide?: Slide) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/livepsalms-media');
      if (!raw || !onApplyBackground) return;
      const asset: MediaAsset = JSON.parse(raw);
      onApplyBackground(asset, scope, targetSlide);
    } catch (err) {}
  };

  // Stage Message state
  const [stageMsgInput, setStageMsgInput] = useState('');
  const [stageMsgFlash, setStageMsgFlash] = useState(true);
  const [activeStageMsg, setActiveStageMsg] = useState<string | null>(null);

  // Nursery / Parent Pager Alert state
  const [pagerCode, setPagerCode] = useState('');
  const [pagerLabel, setPagerLabel] = useState('NURSERY PAGER');
  const [pagerAutoClear, setPagerAutoClear] = useState(true);
  const [activeAlert, setActiveAlert] = useState<AudienceAlert | null>(null);
  const pagerTimerRef = useRef<any>(null);

  // Ambient Worship Synth Pad state (Web Audio API)
  const [activePadKey, setActivePadKey] = useState<string | null>(null);
  const [padVolume, setPadVolume] = useState<number>(0.45);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const padOscsRef = useRef<OscillatorNode[]>([]);

  // Auto-advance timer effect
  useEffect(() => {
    if (!autoAdvanceSec || autoAdvanceSec <= 0 || !activeItem || activeItem.slides.length === 0) return;
    const timer = setInterval(() => {
      const slides = activeItem.slides;
      if (slides.length === 0) return;
      const currentRef = liveSlide || previewSlide || slides[0];
      const idx = slides.findIndex(s => s.id === currentRef?.id);
      const nextIdx = idx >= 0 && idx < slides.length - 1 ? idx + 1 : 0;
      const nextSlide = slides[nextIdx];
      onSelectSlidePreview(nextSlide);
      onSendSlideLive(nextSlide);
    }, autoAdvanceSec * 1000);
    return () => clearInterval(timer);
  }, [autoAdvanceSec, activeItem, liveSlide, previewSlide]);

  // Ambient Worship Synth Pad engine
  const stopWorshipPad = () => {
    try {
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(0.0001, audioCtxRef.current.currentTime, 0.35);
      }
      const oldOscs = [...padOscsRef.current];
      padOscsRef.current = [];
      setTimeout(() => {
        oldOscs.forEach(o => {
          try {
            o.stop();
            o.disconnect();
          } catch (e) {}
        });
      }, 450);
    } catch (e) {}
    setActivePadKey(null);
  };

  const playWorshipPad = (keyObj: { key: string; freq: number }) => {
    if (activePadKey === keyObj.key) {
      stopWorshipPad();
      return;
    }

    try {
      // Stop previous oscillators cleanly
      padOscsRef.current.forEach(o => {
        try {
          o.stop();
          o.disconnect();
        } catch (e) {}
      });
      padOscsRef.current = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.setTargetAtTime(padVolume * 0.25, ctx.currentTime, 0.8);
      masterGainRef.current = masterGain;

      // Warm low-pass filter for atmospheric church pad sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Root, Fifth (1.498x), Octave (2x), and detuned shimmer voices
      const ratios = [
        { mult: 0.5, detune: -4, type: 'sine' as OscillatorType },
        { mult: 1.0, detune: -6, type: 'sawtooth' as OscillatorType },
        { mult: 1.0, detune: 6, type: 'triangle' as OscillatorType },
        { mult: 1.4983, detune: -3, type: 'sawtooth' as OscillatorType }, // Perfect 5th
        { mult: 2.0, detune: 5, type: 'sine' as OscillatorType } // Octave
      ];

      const createdOscs: OscillatorNode[] = [];
      ratios.forEach(r => {
        const osc = ctx.createOscillator();
        osc.type = r.type;
        osc.frequency.setValueAtTime(keyObj.freq * r.mult, ctx.currentTime);
        osc.detune.setValueAtTime(r.detune, ctx.currentTime);
        osc.connect(filter);
        osc.start();
        createdOscs.push(osc);
      });

      padOscsRef.current = createdOscs;
      setActivePadKey(keyObj.key);
    } catch (e) {}
  };

  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current && activePadKey) {
      masterGainRef.current.gain.setTargetAtTime(padVolume * 0.25, audioCtxRef.current.currentTime, 0.15);
    }
  }, [padVolume, activePadKey]);

  // Stage Message handlers
  const handleSendStageMessage = (msgText?: string) => {
    const text = (msgText !== undefined ? msgText : stageMsgInput).trim();
    if (!text) return;
    setActiveStageMsg(text);
    setStageMsgInput(text);
    BroadcastService.postMessage({
      type: 'STAGE_MESSAGE_CHANGE',
      stageMessage: text,
      stageMessageFlash: stageMsgFlash
    });
  };

  const handleClearStageMessage = () => {
    setActiveStageMsg(null);
    BroadcastService.postMessage({
      type: 'STAGE_MESSAGE_CHANGE',
      stageMessage: null,
      stageMessageFlash: false
    });
  };

  // Nursery Pager / Audience Alert handlers
  const handleSendAudienceAlert = () => {
    const code = pagerCode.trim();
    if (!code) return;
    const alertObj: AudienceAlert = {
      code,
      message: pagerLabel.trim() || 'NURSERY PAGER'
    };
    setActiveAlert(alertObj);
    BroadcastService.postMessage({
      type: 'AUDIENCE_ALERT_CHANGE',
      audienceAlert: alertObj
    });
    if (pagerTimerRef.current) clearTimeout(pagerTimerRef.current);
    if (pagerAutoClear) {
      pagerTimerRef.current = setTimeout(() => {
        handleClearAudienceAlert();
      }, 30000);
    }
  };

  const handleClearAudienceAlert = () => {
    if (pagerTimerRef.current) clearTimeout(pagerTimerRef.current);
    setActiveAlert(null);
    BroadcastService.postMessage({
      type: 'AUDIENCE_ALERT_CHANGE',
      audienceAlert: null
    });
  };

  // Reflow Editor Slide Manipulation Handlers
  const updateSlides = (newSlides: Slide[]) => {
    if (!activeItem || !onUpdateItemSlides) return;
    onUpdateItemSlides(activeItem.id, newSlides);
  };

  const handleReflowTextChange = (slideId: string, newContent: string) => {
    if (!activeItem) return;
    const nextSlides = activeItem.slides.map(s => (s.id === slideId ? { ...s, content: newContent } : s));
    updateSlides(nextSlides);
  };

  const handleReflowSectionChange = (slideId: string, newSection: SectionTag) => {
    if (!activeItem) return;
    const nextSlides = activeItem.slides.map(s => (s.id === slideId ? { ...s, sectionLabel: newSection } : s));
    updateSlides(nextSlides);
  };

  const handleSplitSlide = (index: number) => {
    if (!activeItem) return;
    const slide = activeItem.slides[index];
    if (!slide) return;
    const lines = (slide.content || '').split(/\r?\n/);
    const mid = Math.max(1, Math.ceil(lines.length / 2));
    const firstPart = lines.slice(0, mid).join('\n');
    const secondPart = lines.slice(mid).join('\n') || 'New slide line...';

    const updatedFirst: Slide = { ...slide, content: firstPart };
    const newSecond: Slide = {
      ...slide,
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      content: secondPart
    };
    const nextSlides = [...activeItem.slides];
    nextSlides.splice(index, 1, updatedFirst, newSecond);
    updateSlides(nextSlides);
  };

  const handleMergeWithNext = (index: number) => {
    if (!activeItem || index >= activeItem.slides.length - 1) return;
    const curr = activeItem.slides[index];
    const next = activeItem.slides[index + 1];
    const merged: Slide = {
      ...curr,
      content: [curr.content, next.content].filter(Boolean).join('\n')
    };
    const nextSlides = [...activeItem.slides];
    nextSlides.splice(index, 2, merged);
    updateSlides(nextSlides);
  };

  const handleDuplicateSlide = (index: number) => {
    if (!activeItem) return;
    const curr = activeItem.slides[index];
    const copy: Slide = {
      ...curr,
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    const nextSlides = [...activeItem.slides];
    nextSlides.splice(index + 1, 0, copy);
    updateSlides(nextSlides);
  };

  const handleAddSlideAfter = (index: number) => {
    if (!activeItem) return;
    const refSlide = activeItem.slides[index];
    const added: Slide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: refSlide?.title,
      sectionLabel: refSlide?.sectionLabel || 'Slide',
      content: 'Enter slide lyrics or text...',
      backgroundUrl: refSlide?.backgroundUrl,
      backgroundType: refSlide?.backgroundType
    };
    const nextSlides = [...activeItem.slides];
    nextSlides.splice(index + 1, 0, added);
    updateSlides(nextSlides);
  };

  const handleDeleteSlide = (index: number) => {
    if (!activeItem || activeItem.slides.length <= 1) return;
    const nextSlides = activeItem.slides.filter((_, idx) => idx !== index);
    updateSlides(nextSlides);
  };

  const availableSections: SectionTag[] = Array.from(
    new Set((activeItem?.slides || []).map(s => s.sectionLabel).filter(Boolean) as SectionTag[])
  );

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {/* Preview and program monitors */}
      <div className="flex shrink-0 items-start gap-4 border-b border-border px-4 py-3">
        {/* Preview */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="state-label text-preview">Preview</span>
            <span className="min-w-0 truncate text-2xs text-muted-foreground">
              {previewSlide ? previewSlide.sectionLabel || previewSlide.title || 'Slide' : 'Nothing selected'}
            </span>
          </header>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleMediaDrop(e, 'item')}
            className="relative mx-auto w-full max-w-[calc(26vh*16/9)] overflow-hidden rounded border border-border bg-black"
            style={{ aspectRatio: '16/9', containerType: 'size' }}
            title="Drop a background here to apply it to this item"
          >
            {previewSlide ? (
              <SlideCanvas
                slide={previewSlide}
                theme={activeTheme}
                label="Preview"
                isLive={false}
                dimmed={true}
                itemVideoBgUrl={activeItem?.videoBackgroundUrl}
                globalVideoBgUrl={globalVideoBgUrl}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xs text-white/30">No slide in preview</span>
              </div>
            )}
          </div>

          <footer className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-2xs text-muted-foreground">
              {previewSlide?.content?.slice(0, 64) || 'Choose an item in the service'}
            </span>
            <Button
              size="xs"
              variant="secondary"
              disabled={!previewSlide}
              onClick={() => previewSlide && onSendSlideLive(previewSlide)}
            >
              Take live
            </Button>
          </footer>
        </section>

        {/* Program */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className={cn('state-label', liveSlide ? 'text-live' : 'text-muted-foreground')}>Program</span>
            <span className={cn('min-w-0 truncate text-2xs', liveSlide ? 'text-live' : 'text-muted-foreground')}>{liveSlide ? 'On air' : 'Clear'}</span>
          </header>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleMediaDrop(e, 'global')}
            className={cn(
              'relative mx-auto w-full max-w-[calc(26vh*16/9)] overflow-hidden rounded border bg-black',
              liveSlide ? 'border-live/60' : 'border-border'
            )}
            style={{ aspectRatio: '16/9', containerType: 'size' }}
            title="Drop a background here to set the live layer background for every slide"
          >
            {liveSlide ? (
              <SlideCanvas
                slide={liveSlide}
                theme={activeTheme}
                label="Program"
                isLive={true}
                audienceViewMode={audienceViewMode}
                dimmed={false}
                itemVideoBgUrl={activeItem?.videoBackgroundUrl}
                globalVideoBgUrl={globalVideoBgUrl}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="state-label text-white/25">Clear</span>
                <span className="text-2xs text-white/20">Nothing is being projected</span>
              </div>
            )}

            {activeAlert && (
              <div className="absolute right-2 top-2 z-30">
                <Badge variant="warning">{activeAlert.code}</Badge>
              </div>
            )}

            {activeLowerThirdText && (
              <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-white/10 bg-black/85 px-2 py-1">
                <div
                  className="animate-crawl-line whitespace-nowrap text-2xs font-medium text-white"
                  style={{
                    animationDuration:
                      (activeLowerThirdText as any)?.speed === 'slow'
                        ? '32s'
                        : (activeLowerThirdText as any)?.speed === 'fast'
                        ? '13s'
                        : '22s'
                  }}
                >
                  {activeLowerThirdText.content}{' '}
                  {activeLowerThirdText.title ? ` - (${activeLowerThirdText.title})` : ''} 
                </div>
                <button
                  onClick={onClearLowerThirdAnnouncement}
                  className="ml-auto shrink-0 rounded-sm px-1 text-2xs text-white/60 transition-colors hover:text-white"
                  title="Stop the ticker"
                >
                  Stop
                </button>
              </div>
            )}

            {liveSlide && (
              <div className="absolute bottom-1.5 right-1.5 z-20 rounded-sm bg-black/60 px-1.5 py-0.5 text-2xs text-white/70">
                {liveSlide.sectionLabel || liveSlide.title || 'Live'}
              </div>
            )}
          </div>

          <footer className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {liveSlide && onClearLiveSlide && (
                <LayerChip onClick={onClearLiveSlide} label="Clear slide" />
              )}
              {activeLowerThirdText && (
                <LayerChip onClick={onClearLowerThirdAnnouncement} label="Stop ticker" />
              )}
              {activeStageMsg && <LayerChip onClick={handleClearStageMessage} label="Clear stage message" />}
              {activeAlert && <LayerChip onClick={handleClearAudienceAlert} label={`Dismiss ${activeAlert.code}`} />}
              {activePadKey && <LayerChip onClick={stopWorshipPad} label={`Stop pad ${activePadKey}`} />}
            </div>
            <span className="shrink-0 truncate text-2xs text-muted-foreground">{activeTheme.name}</span>
          </footer>
        </section>

        <BroadcastMonitor
          liveSlide={liveSlide}
          theme={activeTheme}
          audienceViewMode={audienceViewMode}
          itemVideoBgUrl={activeItem?.videoBackgroundUrl}
          globalVideoBgUrl={globalVideoBgUrl}
          activeAlert={activeAlert}
          lowerThird={activeLowerThirdText}
          countdownSeconds={countdownSeconds}
          onOpenStreamSettings={onOpenStreamSettings}
        />
      </div>

      {/* Operator toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-1.5">
        <div className="flex items-center gap-0.5">
          {[
            { id: 'scenes', label: 'Scenes', active: false },
            { id: 'bgs', label: 'Backgrounds', active: Boolean(globalVideoBgUrl || activeItem?.videoBackgroundUrl) },
            { id: 'stage-msg', label: 'Stage message', active: Boolean(activeStageMsg) },
            { id: 'pager', label: 'Pager', active: Boolean(activeAlert) },
            { id: 'pads', label: 'Pads', active: Boolean(activePadKey) }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDockTab(prev => (prev === tab.id ? 'none' : (tab.id as typeof prev)))}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2 text-2xs font-medium transition-colors',
                activeDockTab === tab.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.active && <span className="h-1 w-1 rounded-full bg-foreground/60" aria-hidden />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="field-label">Auto-advance</span>
            <Select value={String(autoAdvanceSec)} onValueChange={value => setAutoAdvanceSec(Number(value))}>
              <SelectTrigger className="h-7 w-[76px] text-2xs" aria-label="Auto-advance interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="5">5 s</SelectItem>
                <SelectItem value="8">8 s</SelectItem>
                <SelectItem value="10">10 s</SelectItem>
                <SelectItem value="15">15 s</SelectItem>
                <SelectItem value="30">30 s</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <div className="flex rounded-md border border-border bg-background/60 p-0.5">
            {[
              { id: 'grid', label: 'Slides' },
              { id: 'list', label: 'List' },
              { id: 'reflow', label: 'Reflow' }
            ].map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id as 'grid' | 'list' | 'reflow')}
                className={cn(
                  'h-6 rounded-sm px-2 text-2xs font-medium transition-colors',
                  viewMode === mode.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {onOpenInspector && (
            <Button size="xs" variant="secondary" onClick={onOpenInspector}>
              Slide settings
            </Button>
          )}
        </div>
      </div>

      {/* Operator drawers */}
      {activeDockTab === 'scenes' && (
        <div className="max-h-[300px] shrink-0 overflow-hidden border-b border-border bg-card/60 px-3 py-2">
          <ScenePanel className="h-[268px]" slide={liveSlide} theme={activeTheme} />
        </div>
      )}

      {activeDockTab === 'bgs' && (
        <div className="shrink-0 space-y-2 border-b border-border bg-card/60 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Apply to</span>
              <div className="flex rounded-md border border-border bg-background/60 p-0.5">
                {(
                  [
                    { id: 'global', label: 'Every slide' },
                    { id: 'item', label: 'This item' },
                    { id: 'slide', label: 'Selected slide' }
                  ] as const
                ).map(scope => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setQuickBgScope(scope.id)}
                    className={cn(
                      'h-6 rounded-sm px-2 text-2xs font-medium transition-colors',
                      quickBgScope === scope.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>
            {onClearBackground && (
              <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onClearBackground}>
                Clear background
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {mediaList
              .filter(m => m.type !== 'logo')
              .map(m => {
                const isCurrentBg =
                  globalVideoBgUrl === m.url ||
                  activeItem?.videoBackgroundUrl === m.url ||
                  previewSlide?.backgroundUrl === m.url;
                return (
                  <button
                    key={m.id}
                    type="button"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/livepsalms-media', JSON.stringify(m));
                    }}
                    onClick={() => onApplyBackground && onApplyBackground(m, quickBgScope)}
                    className={cn(
                      'group relative h-16 w-28 shrink-0 overflow-hidden rounded-sm border transition-colors',
                      isCurrentBg ? 'border-foreground/60 ring-1 ring-foreground/20' : 'border-border hover:border-ring/60'
                    )}
                    title={`Apply "${m.name}" or drag it onto a slide`}
                  >
                    {m.type === 'video' ? (
                      <video
                        src={m.url}
                        muted
                        loop
                        playsInline
                        onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={e => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-1 py-0.5">
                      <span className="truncate text-[10px] text-white/85">{m.name}</span>
                      <span className="shrink-0 text-[10px] text-white/50">{m.type === 'video' ? 'Motion' : 'Still'}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {activeDockTab === 'stage-msg' && (
        <div className="shrink-0 space-y-2 border-b border-border bg-card/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Input
              value={stageMsgInput}
              onChange={e => setStageMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendStageMessage()}
              placeholder="Message for the stage display only"
              className="h-8 flex-1"
              aria-label="Stage message"
            />
            <label className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
              <input
                type="checkbox"
                checked={stageMsgFlash}
                onChange={e => setStageMsgFlash(e.target.checked)}
                className="accent-foreground"
              />
              Flash
            </label>
            <Button size="xs" onClick={() => handleSendStageMessage()}>
              Send
            </Button>
            {activeStageMsg && (
              <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={handleClearStageMessage}>
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="field-label mr-1">Presets</span>
            {[
              'Wrap up in 2 minutes',
              'Time is up, please conclude',
              'Worship team come to stage',
              'Check microphone',
              'Pastor coming up next'
            ].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSendStageMessage(preset)}
                className="h-6 rounded-sm border border-border px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDockTab === 'pager' && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
          <Input
            value={pagerLabel}
            onChange={e => setPagerLabel(e.target.value)}
            placeholder="Header"
            className="h-8 w-36"
            aria-label="Alert header"
          />
          <Input
            value={pagerCode}
            onChange={e => setPagerCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendAudienceAlert()}
            placeholder="Pager number or plate"
            className="h-8 min-w-[160px] flex-1"
            aria-label="Pager number or plate"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pagerAutoClear}
              onChange={e => setPagerAutoClear(e.target.checked)}
              className="accent-foreground"
            />
            Hide after 30 seconds
          </label>
          <Button size="xs" variant="live" onClick={handleSendAudienceAlert}>
            Show alert
          </Button>
          {activeAlert && (
            <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={handleClearAudienceAlert}>
              Clear
            </Button>
          )}
        </div>
      )}

      {activeDockTab === 'pads' && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-3 py-2">
          <div className="flex items-center gap-1">
            <span className="field-label mr-1">Key</span>
            {PAD_KEYS.map(k => (
              <button
                key={k.key}
                type="button"
                onClick={() => playWorshipPad(k)}
                className={cn(
                  'h-7 w-8 rounded-sm border text-2xs font-medium transition-colors',
                  activePadKey === k.key
                    ? 'border-foreground/50 bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {k.key}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="field-label">Volume</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={padVolume}
              onChange={e => setPadVolume(Number(e.target.value))}
              aria-label="Pad volume"
              className="h-1 w-24 cursor-pointer accent-foreground"
            />
            {activePadKey && (
              <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={stopWorshipPad}>
                Fade out
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pinned shortcuts */}
      {quickPinnedItems && quickPinnedItems.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-1.5">
          <span className="field-label shrink-0">Pinned</span>
          {quickPinnedItems.map(item => {
            const isActivePin =
              activeItem &&
              (activeItem.id === item.id || activeItem.title.toLowerCase() === item.title.toLowerCase());
            const rememberedId =
              item.lastViewedSlideId || lastViewedSlideMap[item.id] || lastViewedSlideMap[item.title.toLowerCase()];
            const rememberedSlide = rememberedId ? item.slides.find(s => s.id === rememberedId) : undefined;
            const rememberedVerseNum =
              rememberedSlide?.bibleMeta?.verse ??
              (rememberedSlide?.title?.includes(':') ? rememberedSlide.title.split(':')[1] : null);

            return (
              <span
                key={item.id}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs',
                  isActivePin ? 'border-border bg-accent text-accent-foreground' : 'border-transparent text-muted-foreground'
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onLoadQuickPinnedSlides) onLoadQuickPinnedSlides(item.slides, item.title, item.id);
                    else if (item.slides.length > 0) onSelectSlidePreview(rememberedSlide || item.slides[0]);
                  }}
                  className="flex items-center gap-1.5"
                  title={
                    rememberedVerseNum ? `Resume ${item.title} at verse ${rememberedVerseNum}` : `Open ${item.title}`
                  }
                >
                  <span className="max-w-[140px] truncate">{item.title}</span>
                  {item.type === 'bible' && rememberedVerseNum && (
                    <span className="tabular text-[10px] text-muted-foreground">v{rememberedVerseNum}</span>
                  )}
                  <span className="tabular text-[10px] text-muted-foreground/70">{item.slides.length}</span>
                </button>
                {onUnpinFromQuickSection && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onUnpinFromQuickSection(item.id);
                    }}
                    className="text-muted-foreground/60 transition-colors hover:text-destructive"
                    aria-label={`Unpin ${item.title}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Section jump bar */}
      {availableSections.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-1.5">
          <span className="field-label shrink-0">Sections</span>
          <div className="flex items-center gap-0.5">
            {availableSections.map(sec => (
              <button
                key={sec}
                type="button"
                onClick={() => onJumpSection(sec)}
                className="h-6 shrink-0 rounded-sm px-2 text-2xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide area: grid, outline or reflow editor */}
      <div ref={slideGridContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-3">
        {activeItem ? (
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <h2 className="truncate text-xs font-medium text-foreground">{activeItem.title}</h2>
                <span className="text-2xs text-muted-foreground">
                  {activeItem.slides.length} {activeItem.slides.length === 1 ? 'slide' : 'slides'} · {activeItem.type}
                </span>
              </div>
              <span className="hidden shrink-0 text-2xs text-muted-foreground sm:inline">
                {viewMode === 'reflow' ? 'Edit text inline, split or merge slides' : 'Click to preview, double-click to take live'}
              </span>
            </div>

            {/* Grid */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {activeItem.slides.map((slide, sIdx) => {
                  const isPreviewed = previewSlide?.id === slide.id;
                  const isLive = liveSlide?.id === slide.id;
                  const canTranslate =
                    (activeItem.type === 'bible' || slide.sectionLabel === 'Scripture') &&
                    Boolean(targetParallelVersionId) &&
                    Boolean(onTranslateActiveBible);

                  return (
                    <div
                      key={slide.id}
                      data-slide-id={slide.id}
                      onClick={() => onSelectSlidePreview(slide)}
                      onDoubleClick={() => onSendSlideLive(slide)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleMediaDrop(e, 'slide', slide)}
                      className={cn(
                        'group relative cursor-pointer overflow-hidden rounded border bg-black transition-colors',
                        isLive
                          ? 'border-live ring-1 ring-live/40'
                          : isPreviewed
                          ? 'border-preview ring-1 ring-preview/30'
                          : 'border-border hover:border-ring/60'
                      )}
                      style={{ aspectRatio: '16/9', containerType: 'size' }}
                    >
                      <div className="absolute inset-0 bg-[#0b0b0c]" />

                      {(slide.backgroundUrl || activeItem.videoBackgroundUrl || globalVideoBgUrl) &&
                        (slide.backgroundType === 'video' ||
                        (!slide.backgroundUrl && (activeItem.videoBackgroundUrl || globalVideoBgUrl)) ? (
                          <video
                            src={slide.backgroundUrl || activeItem.videoBackgroundUrl || globalVideoBgUrl || ''}
                            muted
                            playsInline
                            className={cn(
                              'pointer-events-none absolute inset-0 h-full w-full',
                              !slide.content?.trim() && slide.backgroundUrl ? 'object-contain opacity-95' : 'object-cover opacity-30'
                            )}
                          />
                        ) : (
                          <img
                            src={slide.backgroundUrl}
                            alt=""
                            className={cn(
                              'pointer-events-none absolute inset-0 h-full w-full',
                              !slide.content?.trim() && slide.backgroundUrl ? 'object-contain opacity-95' : 'object-cover opacity-30'
                            )}
                          />
                        ))}

                      <div className="absolute inset-0 z-10 flex items-center justify-center p-3 text-center">
                        <div
                          className="whitespace-pre-line font-semibold leading-tight text-white drop-shadow"
                          style={getFlexibleFontSize(slide.content, 11)}
                        >
                          {slide.content}
                        </div>
                      </div>

                      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1 p-1.5">
                        <span className="tabular text-2xs text-white/60">{sIdx + 1}</span>
                        {slide.sectionLabel && (
                          <span className="rounded-sm bg-black/60 px-1 text-2xs text-white/70">{slide.sectionLabel}</span>
                        )}
                      </div>

                      {(isLive || isPreviewed) && (
                        <span
                          className={cn(
                            'absolute bottom-1.5 left-1.5 z-20 rounded-sm px-1.5 py-0.5 text-2xs font-medium',
                            isLive ? 'bg-live text-live-foreground' : 'bg-preview text-preview-foreground'
                          )}
                        >
                          {isLive ? 'Live' : 'Preview'}
                        </span>
                      )}

                      {!isLive && (
                        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {canTranslate && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onTranslateActiveBible?.(undefined, slide);
                              }}
                              className="rounded-sm bg-white/10 px-1.5 py-0.5 text-2xs text-white transition-colors hover:bg-white/20"
                            >
                              Translate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onTriggerLowerThirdAnnouncement(slide);
                            }}
                            className="rounded-sm bg-white/10 px-1.5 py-0.5 text-2xs text-white transition-colors hover:bg-white/20"
                          >
                            Ticker
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onSendSlideLive(slide);
                            }}
                            className="rounded-sm bg-white px-1.5 py-0.5 text-2xs font-medium text-black transition-colors hover:bg-white/90"
                          >
                            Take live
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Outline */}
            {viewMode === 'list' && (
              <div className="overflow-hidden rounded-md border border-border">
                {activeItem.slides.map((slide, sIdx) => {
                  const isPreviewed = previewSlide?.id === slide.id;
                  const isLive = liveSlide?.id === slide.id;
                  const canTranslate =
                    (activeItem.type === 'bible' || slide.sectionLabel === 'Scripture') &&
                    Boolean(targetParallelVersionId) &&
                    Boolean(onTranslateActiveBible);

                  return (
                    <div
                      key={slide.id}
                      data-slide-id={slide.id}
                      onClick={() => onSelectSlidePreview(slide)}
                      onDoubleClick={() => onSendSlideLive(slide)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-3 border-b border-border/70 px-3 py-2 transition-colors last:border-b-0',
                        isLive ? 'bg-live/10' : isPreviewed ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <span className="tabular w-6 shrink-0 text-2xs text-muted-foreground">{sIdx + 1}</span>
                      {slide.sectionLabel && (
                        <span className="w-20 shrink-0 truncate text-2xs text-muted-foreground">{slide.sectionLabel}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {(slide.content || '').replace(/\r?\n/g, ' / ')}
                      </span>
                      {isLive && <span className="state-label shrink-0 text-live">Live</span>}
                      <div className="flex shrink-0 items-center gap-1">
                        {canTranslate && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={e => {
                              e.stopPropagation();
                              onTranslateActiveBible?.(undefined, slide);
                            }}
                          >
                            Translate
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={e => {
                            e.stopPropagation();
                            onTriggerLowerThirdAnnouncement(slide);
                          }}
                        >
                          Ticker
                        </Button>
                        <Button
                          size="xs"
                          variant={isLive ? 'secondary' : 'ghost'}
                          onClick={e => {
                            e.stopPropagation();
                            onSendSlideLive(slide);
                          }}
                        >
                          {isLive ? 'On air' : 'Take live'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reflow editor */}
            {viewMode === 'reflow' && (
              <div className="space-y-3">
                {activeItem.slides.map((slide, sIdx) => {
                  const isLive = liveSlide?.id === slide.id;

                  return (
                    <div
                      key={slide.id}
                      className={cn(
                        'rounded-md border bg-card p-3',
                        isLive ? 'border-live/60' : 'border-border'
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular text-2xs text-muted-foreground">{sIdx + 1}</span>
                          <select
                            value={slide.sectionLabel || 'Slide'}
                            onChange={e => handleReflowSectionChange(slide.id, e.target.value as SectionTag)}
                            aria-label={`Section for slide ${sIdx + 1}`}
                            className="h-6 rounded-sm border border-input bg-background/60 px-1.5 text-2xs text-foreground outline-none focus:border-ring"
                          >
                            {SECTION_TAGS.map(t => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button size="xs" variant="ghost" onClick={() => handleSplitSlide(sIdx)}>
                            Split
                          </Button>
                          {sIdx < activeItem.slides.length - 1 && (
                            <Button size="xs" variant="ghost" onClick={() => handleMergeWithNext(sIdx)}>
                              Merge
                            </Button>
                          )}
                          <Button size="xs" variant="ghost" onClick={() => handleDuplicateSlide(sIdx)}>
                            Duplicate
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => handleAddSlideAfter(sIdx)}>
                            Add
                          </Button>
                          {activeItem.slides.length > 1 && (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSlide(sIdx)}
                            >
                              Delete
                            </Button>
                          )}
                          <Button size="xs" variant={isLive ? 'secondary' : 'default'} onClick={() => onSendSlideLive(slide)}>
                            {isLive ? 'On air' : 'Take live'}
                          </Button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={slide.content}
                        onChange={e => handleReflowTextChange(slide.id, e.target.value)}
                        className="w-full resize-y rounded-md border border-input bg-background/60 p-2.5 text-xs leading-relaxed text-foreground outline-none focus:border-ring"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No item selected"
            description="Choose a song, passage or slide in the service to see its slides here."
            className="h-56"
          />
        )}
      </div>
    </main>
  );
};
