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
  dimmed?: boolean;
  itemVideoBgUrl?: string | null;
  globalVideoBgUrl?: string | null;
}> = ({ slide, theme, isLive, itemVideoBgUrl, globalVideoBgUrl }) => {
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
            className={`absolute inset-0 w-full h-full ${
              isPureForegroundVideo ? 'object-contain opacity-100' : `object-cover ${isLive ? 'opacity-70' : 'opacity-45'}`
            }`}
          />
        ) : (
          <img
            src={bgUrl}
            alt=""
            className={`absolute inset-0 w-full h-full ${
              isPureImageSlide ? 'object-contain opacity-100' : `object-cover ${isLive ? 'opacity-65' : 'opacity-40'}`
            }`}
          />
        ))}
      {!bgUrl && <div className="absolute inset-0 bg-gradient-to-br from-[#0d1320] via-[#111827] to-[#0d1320]" />}
      {/* Scrim (skip when playing pure foreground video clip or pure image slide) */}
      {!isPureMediaSlide && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${theme.scrimOpacity ?? 0.45})` }}
        />
      )}

      {/* Live Video Timecode Pill */}
      {isPureForegroundVideo && liveTimecode && liveTimecode.duration > 0 && (
        <div className="absolute bottom-2 left-2 z-30 px-2 py-0.5 bg-black/80 border border-amber-500/40 rounded text-[9px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
          <Film className="w-2.5 h-2.5 text-amber-400" />
          <span>
            {fmtSec(liveTimecode.current)} / {fmtSec(liveTimecode.duration)}
          </span>
        </div>
      )}

      {/* Text content (skip for pure video or pure image slides so the media is shown cleanly without the filename) */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-6 text-center">
        {slide ? (
          isPureMediaSlide ? null : (
            <>
              {slide.title && (
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-300/80 mb-1.5 bg-indigo-950/50 px-3 py-0.5 rounded-full border border-indigo-500/20">
                  {slide.title}
                </div>
              )}
              <div
                className="font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] whitespace-pre-line leading-tight"
                style={{
                  fontFamily: theme.fontFamily,
                  ...getFlexibleFontSize(slide.content, isLive ? 22 : 18),
                  textAlign: theme.align,
                  letterSpacing: theme.letterSpacing || 'normal',
                  textTransform: theme.textTransform || 'none'
                }}
              >
                {slide.content}
              </div>
              {slide.subtitle && (
                <div className="text-[9px] text-indigo-200/70 font-semibold mt-1.5 tracking-wider">
                  {slide.subtitle}
                </div>
              )}
            </>
          )
        ) : (
          <span
            className={`text-[10px] font-bold uppercase tracking-widest ${
              isLive ? 'text-rose-500/50' : 'text-slate-600'
            }`}
          >
            {isLive ? 'OUTPUT CLEAR' : 'NO SLIDE SELECTED'}
          </span>
        )}
      </div>
    </div>
  );
};

export const CenterWorkspace: React.FC<CenterWorkspaceProps> = ({
  activeItem,
  previewSlide,
  liveSlide,
  activeTheme,
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
  onClearBackground
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
  const [activeDockTab, setActiveDockTab] = useState<'none' | 'bgs' | 'stage-msg' | 'pager' | 'pads'>('none');
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
    <div className="flex-1 min-w-0 min-h-0 bg-[#1a1a1a] flex flex-col h-full overflow-hidden select-none">
      {/* ═══════════════════════════════════════════════════════════════
          OBS / PROPRESENTER DUAL MONITOR SECTION
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1a1a] border-b border-[#333] p-2.5 xl:p-3 shrink-0">
        <div className="flex gap-2.5 xl:gap-3">
          {/* ─── PREVIEW MONITOR (left) ─── */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-[#5b9bd5]" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#5b9bd5]">
                  Preview
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-[#555] font-mono">
                <span>1920×1080</span>
                <span className="text-[#444]">|</span>
                <span>{activeItem?.type?.toUpperCase() || 'IDLE'}</span>
              </div>
            </div>

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleMediaDrop(e, 'item')}
              className="relative w-full max-w-[calc(28vh*16/9)] mx-auto rounded overflow-hidden border-2 border-[#3a5f8a] shadow-[0_0_0_1px_#1a1a1a,0_4px_20px_rgba(0,0,0,0.8)]"
              style={{ aspectRatio: '16/9' }}
              title="Drop a Motion or Still Background here to apply to this song/item"
            >
              <SlideCanvas
                slide={previewSlide}
                theme={activeTheme}
                label="Preview"
                isLive={false}
                dimmed={true}
                itemVideoBgUrl={activeItem?.videoBackgroundUrl}
                globalVideoBgUrl={globalVideoBgUrl}
              />

              <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 bg-[#1c3a5c]/90 border border-[#3a5f8a]/70 rounded text-[#5b9bd5] font-black text-[9px] uppercase tracking-widest backdrop-blur-sm">
                <Eye className="w-2.5 h-2.5" />
                <span>PREVIEW</span>
              </div>

              {previewSlide && (
                <div className="absolute bottom-2 left-2 z-20 text-[8px] text-[#8ab4d4] font-mono bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[80%] backdrop-blur-sm">
                  {previewSlide.sectionLabel || previewSlide.title || 'Slide'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="text-[9px] text-[#555] font-mono truncate">
                {previewSlide ? `${previewSlide.content?.substring(0, 40) || '—'}...` : 'No slide in preview'}
              </div>
              <button
                onClick={() => previewSlide && onSendSlideLive(previewSlide)}
                disabled={!previewSlide}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#5b9bd5] hover:bg-[#4a8bc5] disabled:bg-[#2a3a4a] disabled:text-[#444] text-white font-black text-[10px] uppercase tracking-wider rounded transition shadow-lg active:scale-95"
                title="Transition preview to program output"
              >
                <MonitorPlay className="w-3 h-3" />
                Transition
              </button>
            </div>
          </div>

          {/* ─── PROGRAM / LIVE MONITOR (right) ─── */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center gap-1.5">
                <Circle
                  className={`w-2.5 h-2.5 fill-current ${
                    liveSlide ? 'text-[#e84040] animate-pulse' : 'text-[#555]'
                  }`}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                    liveSlide ? 'text-[#e84040]' : 'text-[#666]'
                  }`}
                >
                  Program
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-mono">
                {liveSlide ? (
                  <span className="text-[#e84040] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#e84040] rounded-full animate-pulse inline-block" />
                    ON AIR
                  </span>
                ) : (
                  <span className="text-[#555]">CLEAR</span>
                )}
              </div>
            </div>

            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleMediaDrop(e, 'global')}
              className={`relative w-full max-w-[calc(28vh*16/9)] mx-auto rounded overflow-hidden border-2 shadow-[0_0_0_1px_#1a1a1a,0_4px_20px_rgba(0,0,0,0.8)] transition-all duration-300 ${
                liveSlide
                  ? 'border-[#e84040] shadow-[0_0_0_1px_#1a1a1a,0_0_25px_rgba(232,64,64,0.4),0_4px_20px_rgba(0,0,0,0.8)]'
                  : 'border-[#3a2020]'
              }`}
              style={{ aspectRatio: '16/9' }}
              title="Drop a Motion or Still Background here to set as Global Live Layer Background"
            >
              <SlideCanvas
                slide={liveSlide}
                theme={activeTheme}
                label="Program"
                isLive={true}
                dimmed={false}
                itemVideoBgUrl={activeItem?.videoBackgroundUrl}
                globalVideoBgUrl={globalVideoBgUrl}
              />

              <div
                className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-widest backdrop-blur-sm border ${
                  liveSlide
                    ? 'bg-[#e84040]/90 border-[#ff6060]/50 text-white'
                    : 'bg-[#2a1010]/80 border-[#4a2020]/60 text-[#665555]'
                }`}
              >
                <Tv className={`w-2.5 h-2.5 ${liveSlide ? 'animate-pulse' : ''}`} />
                <span>{liveSlide ? 'ON AIR' : 'PROGRAM'}</span>
              </div>

              {/* Active Audience Alert indicator on Program Monitor */}
              {activeAlert && (
                <div className="absolute top-2 right-2 z-30 bg-amber-500/95 text-black px-2 py-0.5 rounded font-black text-[8px] uppercase flex items-center gap-1 shadow">
                  <Bell className="w-2.5 h-2.5 animate-bounce" />
                  <span>{activeAlert.code}</span>
                </div>
              )}

              {/* Active ticker indicator */}
              {activeLowerThirdText && (
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-purple-900/95 border-t border-purple-500/60 flex items-center justify-between gap-2 px-2 py-1 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <Megaphone className="w-3 h-3 text-amber-300 animate-pulse shrink-0" />
                    <div
                      className="animate-crawl-line font-bold text-white text-[9px] whitespace-nowrap"
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
                      {activeLowerThirdText.title ? `— (${activeLowerThirdText.title})` : ''}
                    </div>
                  </div>
                  <button
                    onClick={onClearLowerThirdAnnouncement}
                    className="shrink-0 p-0.5 bg-rose-700 hover:bg-rose-600 text-white rounded transition"
                    title="Stop ticker"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {liveSlide && (
                <div className="absolute bottom-2 right-2 z-20 text-[8px] text-[#ff9999] font-mono bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                  {liveSlide.sectionLabel || liveSlide.title || 'Live'}
                </div>
              )}
            </div>

            {/* Program status & ProPresenter Layer Clearing Bar */}
            <div className="flex items-center justify-between mt-2 gap-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                {liveSlide && onClearLiveSlide && (
                  <button
                    onClick={onClearLiveSlide}
                    className="px-2 py-1 bg-rose-950/80 hover:bg-rose-800 border border-rose-500/40 rounded text-[9px] font-black text-rose-300 uppercase flex items-center gap-1 transition"
                    title="Clear Slide Layer Only"
                  >
                    <Eraser className="w-2.5 h-2.5" /> Slide
                  </button>
                )}
                {activeLowerThirdText && (
                  <button
                    onClick={onClearLowerThirdAnnouncement}
                    className="px-2 py-1 bg-purple-950/80 hover:bg-purple-800 border border-purple-500/40 rounded text-[9px] font-black text-purple-300 uppercase flex items-center gap-1 transition"
                    title="Clear Announcement Ticker Layer"
                  >
                    <X className="w-2.5 h-2.5" /> Ticker
                  </button>
                )}
                {activeStageMsg && (
                  <button
                    onClick={handleClearStageMessage}
                    className="px-2 py-1 bg-amber-950/80 hover:bg-amber-800 border border-amber-500/40 rounded text-[9px] font-black text-amber-300 uppercase flex items-center gap-1 transition"
                    title="Clear Stage Message"
                  >
                    <X className="w-2.5 h-2.5" /> Stage Msg
                  </button>
                )}
                {activeAlert && (
                  <button
                    onClick={handleClearAudienceAlert}
                    className="px-2 py-1 bg-amber-950/80 hover:bg-amber-800 border border-amber-500/40 rounded text-[9px] font-black text-amber-300 uppercase flex items-center gap-1 transition"
                    title="Clear Nursery Pager Alert"
                  >
                    <X className="w-2.5 h-2.5" /> Alert ({activeAlert.code})
                  </button>
                )}
                {activePadKey && (
                  <button
                    onClick={stopWorshipPad}
                    className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-500/40 rounded text-[9px] font-black text-emerald-300 uppercase flex items-center gap-1 transition"
                    title="Fade Out Worship Pad"
                  >
                    <Music2 className="w-2.5 h-2.5 animate-pulse" /> Pad: {activePadKey}
                  </button>
                )}
              </div>
              <div className="shrink-0 text-[9px] font-mono text-[#666] bg-[#111] border border-[#2a2a2a] px-2 py-1 rounded">
                {activeTheme.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PROPRESENTER LIVE OPERATOR TOOLS BAR (Motion BGs / Stage Msg / Nursery Pager / Worship Pads)
      ══════════════════════════════════════════════════════════════ */}
      <div className="px-3 py-1.5 bg-[#121621] border-b border-[#26334a] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveDockTab(prev => (prev === 'bgs' ? 'none' : 'bgs'))}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 border transition ${
              activeDockTab === 'bgs' || globalVideoBgUrl || activeItem?.videoBackgroundUrl
                ? 'bg-indigo-500/25 border-indigo-500/70 text-indigo-200'
                : 'bg-[#1a2234] border-[#2a364f] text-slate-300 hover:text-white'
            }`}
            title="ProPresenter Quick Motion & Still Background Bin (switch backgrounds while staying on Songs/Bible)"
          >
            <Film className="w-3 h-3 text-indigo-400" />
            <span>Motion BGs</span>
            {(globalVideoBgUrl || activeItem?.videoBackgroundUrl) && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveDockTab(prev => (prev === 'stage-msg' ? 'none' : 'stage-msg'))}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 border transition ${
              activeDockTab === 'stage-msg' || activeStageMsg
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-[#1a2234] border-[#2a364f] text-slate-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span>Stage Message</span>
            {activeStageMsg && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
          </button>

          <button
            onClick={() => setActiveDockTab(prev => (prev === 'pager' ? 'none' : 'pager'))}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 border transition ${
              activeDockTab === 'pager' || activeAlert
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                : 'bg-[#1a2234] border-[#2a364f] text-slate-300 hover:text-white'
            }`}
          >
            <Bell className="w-3 h-3 text-rose-400" />
            <span>Nursery / Pager</span>
            {activeAlert && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
          </button>

          <button
            onClick={() => setActiveDockTab(prev => (prev === 'pads' ? 'none' : 'pads'))}
            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 border transition ${
              activeDockTab === 'pads' || activePadKey
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                : 'bg-[#1a2234] border-[#2a364f] text-slate-300 hover:text-white'
            }`}
          >
            <Music2 className="w-3 h-3 text-emerald-400" />
            <span>Worship Pads {activePadKey ? `(${activePadKey})` : ''}</span>
          </button>
        </div>

        {/* Auto-Advance Loop Timer & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#1a2234] border border-[#2a364f] rounded px-2 py-0.5">
            <Repeat className={`w-3 h-3 ${autoAdvanceSec > 0 ? 'text-indigo-400 animate-spin' : 'text-slate-500'}`} />
            <span className="text-[9px] font-bold text-slate-400 uppercase">Loop:</span>
            <select
              value={autoAdvanceSec}
              onChange={e => setAutoAdvanceSec(Number(e.target.value))}
              className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
              title="ProPresenter Auto-Advance Slide Loop Timer"
            >
              <option value={0} className="bg-[#0d1320]">Off</option>
              <option value={5} className="bg-[#0d1320]">5s</option>
              <option value={8} className="bg-[#0d1320]">8s</option>
              <option value={10} className="bg-[#0d1320]">10s</option>
              <option value={15} className="bg-[#0d1320]">15s</option>
              <option value={30} className="bg-[#0d1320]">30s</option>
            </select>
          </div>

          <div className="flex items-center bg-[#1a2234] border border-[#2a364f] rounded p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="ProPresenter Grid View"
            >
              <LayoutGrid className="w-3 h-3" /> Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="ProPresenter Table/List View"
            >
              <List className="w-3 h-3" /> List
            </button>
            <button
              onClick={() => setViewMode('reflow')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition ${
                viewMode === 'reflow' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="ProPresenter Reflow Slide Editor (Split/Merge/Edit inline)"
            >
              <AlignLeft className="w-3 h-3" /> Reflow
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDABLE OPERATOR DOCK DRAWER */}
      {activeDockTab === 'bgs' && (
        <div className="px-3 py-2 bg-[#0d1322] border-b border-indigo-500/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                1-Click Background Target:
              </span>
              {([
                { id: 'global', label: 'Live Layer (All Slides)' },
                { id: 'item', label: 'Current Song / Bible' },
                { id: 'slide', label: 'Selected Slide' }
              ] as const).map(sc => (
                <button
                  key={sc.id}
                  onClick={() => setQuickBgScope(sc.id)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border transition ${
                    quickBgScope === sc.id
                      ? 'bg-indigo-600 border-indigo-400 text-white'
                      : 'bg-[#162032] border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
            {onClearBackground && (
              <button
                onClick={onClearBackground}
                className="px-2.5 py-0.5 bg-rose-950/90 hover:bg-rose-700 border border-rose-500/50 rounded text-[9px] font-black text-rose-200 uppercase flex items-center gap-1 transition"
              >
                <Eraser className="w-2.5 h-2.5" /> Clear Active Background
              </button>
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
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/livepsalms-media', JSON.stringify(m));
                    }}
                    onClick={() => onApplyBackground && onApplyBackground(m, quickBgScope)}
                    className={`group relative w-28 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                      isCurrentBg
                        ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : 'border-slate-700 hover:border-indigo-400'
                    }`}
                    title={`Click to apply "${m.name}" (${quickBgScope}) or drag onto any slide/monitor`}
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
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-1">
                      <span
                        className={`self-start px-1 py-0.2 rounded text-[7px] font-black uppercase ${
                          m.type === 'video' ? 'bg-indigo-600/90 text-white' : 'bg-slate-800/90 text-slate-300'
                        }`}
                      >
                        {m.type === 'video' ? 'MOTION' : 'STILL'}
                      </span>
                      <span className="text-[8px] font-bold text-white truncate w-full text-left">{m.name}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {activeDockTab === 'stage-msg' && (
        <div className="px-3 py-2.5 bg-[#0e1422] border-b border-amber-500/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={stageMsgInput}
              onChange={e => setStageMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendStageMessage()}
              placeholder="Type message for Stage Confidence Monitor only (e.g. 'Wrap up in 2 mins')..."
              className="flex-1 bg-[#162032] border border-slate-700 focus:border-amber-500 rounded px-2.5 py-1 text-xs text-white outline-none"
            />
            <label className="flex items-center gap-1 text-[10px] font-bold text-amber-300 cursor-pointer">
              <input
                type="checkbox"
                checked={stageMsgFlash}
                onChange={e => setStageMsgFlash(e.target.checked)}
                className="accent-amber-500"
              />
              Flash
            </label>
            <button
              onClick={() => handleSendStageMessage()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase rounded transition"
            >
              Send to Stage
            </button>
            {activeStageMsg && (
              <button
                onClick={handleClearStageMessage}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white font-black text-[10px] uppercase rounded transition"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Quick Presets:</span>
            {[
              'Wrap up in 2 minutes',
              'Time is up — please conclude',
              'Worship team come to stage',
              'Check microphone / hold closer',
              'Pastor coming up next'
            ].map(preset => (
              <button
                key={preset}
                onClick={() => handleSendStageMessage(preset)}
                className="px-2 py-0.5 bg-[#1a2438] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 rounded text-[9px] text-slate-300 hover:text-amber-200 transition"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDockTab === 'pager' && (
        <div className="px-3 py-2.5 bg-[#0e1422] border-b border-rose-500/40 flex items-center gap-2 shrink-0 flex-wrap">
          <input
            type="text"
            value={pagerLabel}
            onChange={e => setPagerLabel(e.target.value)}
            placeholder="Header (e.g. NURSERY PAGER)"
            className="w-40 bg-[#162032] border border-slate-700 focus:border-rose-500 rounded px-2.5 py-1 text-xs text-amber-300 font-bold outline-none"
          />
          <input
            type="text"
            value={pagerCode}
            onChange={e => setPagerCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendAudienceAlert()}
            placeholder="Pager # or License Plate (e.g. #142)"
            className="flex-1 min-w-[180px] bg-[#162032] border border-slate-700 focus:border-rose-500 rounded px-2.5 py-1 text-xs text-white font-black outline-none"
          />
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={pagerAutoClear}
              onChange={e => setPagerAutoClear(e.target.checked)}
              className="accent-rose-500"
            />
            Auto-hide (30s)
          </label>
          <button
            onClick={handleSendAudienceAlert}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase rounded transition"
          >
            Show Corner Alert
          </button>
          {activeAlert && (
            <button
              onClick={handleClearAudienceAlert}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] uppercase rounded transition"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {activeDockTab === 'pads' && (
        <div className="px-3 py-2.5 bg-[#0e1422] border-b border-emerald-500/40 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-black uppercase text-emerald-400 mr-1">Key:</span>
            {PAD_KEYS.map(k => (
              <button
                key={k.key}
                onClick={() => playWorshipPad(k)}
                className={`w-7 h-7 rounded font-black text-[10px] border transition ${
                  activePadKey === k.key
                    ? 'bg-emerald-500 border-emerald-300 text-black shadow-[0_0_12px_rgba(16,185,129,0.6)] scale-105'
                    : 'bg-[#162032] border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                }`}
              >
                {k.key}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={padVolume}
              onChange={e => setPadVolume(Number(e.target.value))}
              className="w-24 accent-emerald-500 cursor-pointer"
            />
            {activePadKey && (
              <button
                onClick={stopWorshipPad}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white font-black text-[9px] uppercase rounded transition"
              >
                Fade Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          QUICK PINNED ITEMS BAR
      ══════════════════════════════════════════════════════════════ */}
      {quickPinnedItems && quickPinnedItems.length > 0 && (
        <div className="px-3 py-1.5 bg-[#111] border-b border-[#333] flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[9px] font-extrabold text-amber-500/80 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Pin className="w-3 h-3" /> Pinned:
          </span>
          {quickPinnedItems.map(item => {
            const isActivePin =
              activeItem &&
              (activeItem.id === item.id || activeItem.title.toLowerCase() === item.title.toLowerCase());
            const rememberedId =
              item.lastViewedSlideId ||
              lastViewedSlideMap[item.id] ||
              lastViewedSlideMap[item.title.toLowerCase()];
            const rememberedSlide = rememberedId
              ? item.slides.find(s => s.id === rememberedId)
              : undefined;
            const rememberedVerseNum =
              rememberedSlide?.bibleMeta?.verse ??
              (rememberedSlide?.title?.includes(':') ? rememberedSlide.title.split(':')[1] : null);

            return (
              <div
                key={item.id}
                className={`rounded px-2.5 py-1 flex items-center gap-1.5 text-[10px] shrink-0 transition cursor-pointer border ${
                  isActivePin
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-200 font-black'
                    : 'bg-[#1e1e1e] border-[#333] hover:border-amber-500/40 text-slate-300 font-semibold'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onLoadQuickPinnedSlides) onLoadQuickPinnedSlides(item.slides, item.title, item.id);
                    else if (item.slides.length > 0) onSelectSlidePreview(rememberedSlide || item.slides[0]);
                  }}
                  className="flex items-center gap-1.5"
                  title={
                    rememberedVerseNum
                      ? `Resume ${item.title} at verse ${rememberedVerseNum}`
                      : `Open ${item.title}`
                  }
                >
                  <span>{item.type === 'bible' ? '📖' : item.type === 'song' ? '🎵' : '📢'}</span>
                  <span className="max-w-[140px] truncate">{item.title}</span>
                  {item.type === 'bible' && rememberedVerseNum && (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-600/80 text-white font-black">
                      v.{rememberedVerseNum}
                    </span>
                  )}
                  <span
                    className={`text-[8px] px-1 rounded font-bold ${
                      isActivePin ? 'bg-amber-500 text-black' : 'bg-[#2a2a2a] text-slate-400'
                    }`}
                  >
                    {item.slides.length}
                  </span>
                </button>
                {onUnpinFromQuickSection && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onUnpinFromQuickSection(item.id);
                    }}
                    className="text-[#444] hover:text-rose-400 transition ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          COLOR-CODED PROPRESENTER SECTION JUMP BAR
      ══════════════════════════════════════════════════════════════ */}
      {availableSections.length > 0 && (
        <div className="px-3 py-1.5 bg-[#111] border-b border-[#2a2a2a] flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[9px] font-bold text-[#555] uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-amber-500/60" /> Groups:
          </span>
          {availableSections.map(sec => {
            const groupStyle = getSectionGroupColor(sec);
            return (
              <button
                key={sec}
                onClick={() => onJumpSection(sec)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition shrink-0 hover:brightness-125 ${groupStyle.badge}`}
              >
                {sec}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PARALLEL TRANSLATION BAR (Shown when Parallel Translation is selected)
      {/* ═══════════════════════════════════════════════════════════════
          SLIDE AREA — GRID VIEW / LIST VIEW / REFLOW EDITOR
      ══════════════════════════════════════════════════════════════ */}
      <div ref={slideGridContainerRef} className="flex-1 overflow-y-auto bg-[#141414] p-3">
        {activeItem ? (
          <div>
            {/* Item header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-[11px] text-white tracking-wide truncate max-w-xs">
                  {activeItem.title}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#222] text-[#888] font-bold border border-[#333] uppercase tracking-wider">
                  {activeItem.type}
                </span>
                <span className="text-[9px] text-[#555] font-mono">
                  {activeItem.slides.length} slides
                </span>
              </div>
              <span className="text-[9px] text-[#555] font-mono">
                {viewMode === 'reflow'
                  ? 'Reflow Editor: Edit lyrics inline, Split or Merge slides'
                  : 'Click = preview  •  Dbl-click = live'}
              </span>
            </div>

            {/* 1. PROPRESENTER GRID VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                {activeItem.slides.map((slide, sIdx) => {
                  const isPreviewed = previewSlide?.id === slide.id;
                  const isLive = liveSlide?.id === slide.id;
                  const groupColor = getSectionGroupColor(slide.sectionLabel);

                  return (
                    <div
                      key={slide.id}
                      data-slide-id={slide.id}
                      onClick={() => onSelectSlidePreview(slide)}
                      onDoubleClick={() => onSendSlideLive(slide)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleMediaDrop(e, 'slide', slide)}
                      className={`relative rounded overflow-hidden cursor-pointer transition-all duration-150 border-2 group ${
                        isLive
                          ? 'border-[#e84040] shadow-[0_0_14px_rgba(232,64,64,0.5)] scale-[1.01]'
                          : isPreviewed
                          ? 'border-[#3a6f9a] shadow-[0_0_10px_rgba(91,155,213,0.35)]'
                          : 'border-[#2a2a2a] hover:border-[#444]'
                      }`}
                      style={{ aspectRatio: '16/9' }}
                    >
                      <div className="absolute inset-0 bg-[#111]" />
                      {(slide.backgroundUrl || activeItem.videoBackgroundUrl || globalVideoBgUrl) && (
                        slide.backgroundType === 'video' || (!slide.backgroundUrl && (activeItem.videoBackgroundUrl || globalVideoBgUrl)) ? (
                          <video
                            src={slide.backgroundUrl || activeItem.videoBackgroundUrl || globalVideoBgUrl || ''}
                            muted
                            playsInline
                            className={`absolute inset-0 w-full h-full pointer-events-none ${
                              !slide.content?.trim() && slide.backgroundUrl ? 'object-contain opacity-95' : 'object-cover opacity-30'
                            }`}
                          />
                        ) : (
                          <img
                            src={slide.backgroundUrl}
                            alt=""
                            className={`absolute inset-0 w-full h-full pointer-events-none ${
                              !slide.content?.trim() && slide.backgroundUrl ? 'object-contain opacity-95' : 'object-cover opacity-30'
                            }`}
                          />
                        )
                      )}

                      {/* ProPresenter Color-Coded Group Top Ribbon */}
                      <div className={`absolute top-0 left-0 right-0 h-1 z-30 ${groupColor.bar}`} />

                      {/* Slide text content */}
                      <div className="absolute inset-0 flex items-center justify-center p-2.5 pt-4 text-center z-10">
                        <div
                          className="font-bold text-white whitespace-pre-line leading-tight drop-shadow-lg"
                          style={getFlexibleFontSize(slide.content, 11)}
                        >
                          {slide.content}
                        </div>
                      </div>

                      {/* Top bar: slide number + color-coded section tag */}
                      <div className="absolute top-1 left-0 right-0 flex items-center justify-between px-1.5 py-0.5 z-20 bg-gradient-to-b from-black/80 to-transparent">
                        <span className="text-[8px] font-mono font-black text-slate-400 bg-black/60 px-1 rounded">
                          {sIdx + 1}
                        </span>
                        {slide.sectionLabel && (
                          <span
                            className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${groupColor.badge}`}
                          >
                            {slide.sectionLabel}
                          </span>
                        )}
                      </div>

                      {/* Live / Preview status badge */}
                      {(isLive || isPreviewed) && (
                        <div className="absolute inset-0 border-0 z-10 pointer-events-none rounded">
                          <div
                            className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-1 pointer-events-auto ${
                              isLive ? 'bg-[#e84040]/90' : 'bg-[#1c3a5c]/90'
                            }`}
                          >
                            <span className="text-[8px] font-black uppercase text-white flex items-center gap-1">
                              {isLive ? (
                                <>
                                  <Tv className="w-2.5 h-2.5 animate-pulse" /> ON AIR
                                </>
                              ) : (
                                <>
                                  <Eye className="w-2.5 h-2.5" /> PREVIEW
                                </>
                              )}
                            </span>
                            <div className="flex gap-1">
                              {(activeItem.type === 'bible' || slide.sectionLabel === 'Scripture') &&
                                targetParallelVersionId &&
                                onTranslateActiveBible && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onTranslateActiveBible(undefined, slide);
                                    }}
                                    className="px-1.5 py-0.5 bg-purple-600/95 hover:bg-purple-500 text-white font-black rounded text-[7px] uppercase transition flex items-center gap-0.5 shadow"
                                    title="Translate this verse & chapter to Parallel Translation"
                                  >
                                    <Globe className="w-2 h-2" /> TRANSLATE
                                  </button>
                                )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onTriggerLowerThirdAnnouncement(slide);
                                }}
                                className="px-1.5 py-0.5 bg-purple-700/90 hover:bg-purple-600 text-white font-bold rounded text-[7px] uppercase transition flex items-center gap-0.5"
                                title="Trigger as crawl ticker"
                              >
                                <Megaphone className="w-2 h-2" />
                              </button>
                              {!isLive && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    onSendSlideLive(slide);
                                  }}
                                  className="px-1.5 py-0.5 bg-[#e84040]/90 hover:bg-[#c03030] text-white font-bold rounded text-[7px] uppercase transition"
                                >
                                  LIVE
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Hover overlay with action buttons */}
                      {!isLive && !isPreviewed && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-end justify-end p-1.5 gap-1 z-20 opacity-0 group-hover:opacity-100">
                          {(activeItem.type === 'bible' || slide.sectionLabel === 'Scripture') &&
                            targetParallelVersionId &&
                            onTranslateActiveBible && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onTranslateActiveBible(undefined, slide);
                                }}
                                className="px-1.5 py-0.5 bg-purple-600/95 hover:bg-purple-500 text-white font-black rounded text-[7px] uppercase transition flex items-center gap-0.5 shadow-lg"
                                title="Translate this verse & chapter to Parallel Translation"
                              >
                                <Globe className="w-2 h-2" /> TRANSLATE
                              </button>
                            )}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onTriggerLowerThirdAnnouncement(slide);
                            }}
                            className="px-1.5 py-0.5 bg-purple-700/90 hover:bg-purple-600 text-white font-bold rounded text-[7px] uppercase transition flex items-center gap-0.5 shadow-lg"
                            title="Trigger as crawl ticker"
                          >
                            <Megaphone className="w-2 h-2" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onSendSlideLive(slide);
                            }}
                            className="px-2 py-0.5 bg-[#e84040]/90 hover:bg-[#c03030] text-white font-black rounded text-[7px] uppercase transition shadow-lg"
                          >
                            LIVE
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. PROPRESENTER LIST / OUTLINE VIEW */}
            {viewMode === 'list' && (
              <div className="flex flex-col gap-1.5">
                {activeItem.slides.map((slide, sIdx) => {
                  const isPreviewed = previewSlide?.id === slide.id;
                  const isLive = liveSlide?.id === slide.id;
                  const groupColor = getSectionGroupColor(slide.sectionLabel);

                  return (
                    <div
                      key={slide.id}
                      data-slide-id={slide.id}
                      onClick={() => onSelectSlidePreview(slide)}
                      onDoubleClick={() => onSendSlideLive(slide)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        isLive
                          ? 'bg-rose-950/30 border-rose-500 text-white'
                          : isPreviewed
                          ? 'bg-sky-950/30 border-sky-500/70 text-white'
                          : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#444] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 w-5">
                          #{sIdx + 1}
                        </span>
                        {slide.sectionLabel && (
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${groupColor.badge}`}
                          >
                            {slide.sectionLabel}
                          </span>
                        )}
                        <span className="text-xs font-semibold truncate">
                          {(slide.content || '').replace(/\r?\n/g, '  /  ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(activeItem.type === 'bible' || slide.sectionLabel === 'Scripture') &&
                          targetParallelVersionId &&
                          onTranslateActiveBible && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onTranslateActiveBible(undefined, slide);
                              }}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-1"
                              title="Translate this verse & chapter to Parallel Translation"
                            >
                              <Globe className="w-3 h-3" /> Translate
                            </button>
                          )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onTriggerLowerThirdAnnouncement(slide);
                          }}
                          className="px-2 py-1 bg-purple-800/80 hover:bg-purple-700 text-white rounded text-[9px] font-bold uppercase flex items-center gap-1"
                        >
                          <Megaphone className="w-3 h-3" /> Ticker
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onSendSlideLive(slide);
                          }}
                          className={`px-2.5 py-1 rounded text-[9px] font-black uppercase ${
                            isLive ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white'
                          }`}
                        >
                          {isLive ? 'ON AIR' : 'GO LIVE'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. PROPRESENTER REFLOW EDITOR VIEW */}
            {viewMode === 'reflow' && (
              <div className="flex flex-col gap-3">
                {activeItem.slides.map((slide, sIdx) => {
                  const isLive = liveSlide?.id === slide.id;
                  const groupColor = getSectionGroupColor(slide.sectionLabel);

                  return (
                    <div
                      key={slide.id}
                      className={`rounded-xl border bg-[#1b2230] p-3 flex flex-col gap-2 ${
                        isLive ? 'border-rose-500' : 'border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-black/50 text-slate-300">
                            Slide {sIdx + 1}
                          </span>
                          <select
                            value={slide.sectionLabel || 'Slide'}
                            onChange={e => handleReflowSectionChange(slide.id, e.target.value as SectionTag)}
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border outline-none cursor-pointer ${groupColor.badge}`}
                          >
                            {SECTION_TAGS.map(t => (
                              <option key={t} value={t} className="bg-[#0f172a] text-white">
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSplitSlide(sIdx)}
                            className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded text-[9px] font-bold flex items-center gap-1 transition"
                            title="Split slide into two slides"
                          >
                            <Scissors className="w-3 h-3" /> Split
                          </button>
                          {sIdx < activeItem.slides.length - 1 && (
                            <button
                              onClick={() => handleMergeWithNext(sIdx)}
                              className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded text-[9px] font-bold flex items-center gap-1 transition"
                              title="Merge with next slide"
                            >
                              <Merge className="w-3 h-3" /> Merge Down
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicateSlide(sIdx)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[9px] font-bold flex items-center gap-1 transition"
                            title="Duplicate slide"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleAddSlideAfter(sIdx)}
                            className="px-2 py-1 bg-emerald-800/70 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded text-[9px] font-bold flex items-center gap-1 transition"
                            title="Insert new slide below"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                          {activeItem.slides.length > 1 && (
                            <button
                              onClick={() => handleDeleteSlide(sIdx)}
                              className="px-2 py-1 bg-rose-950/70 hover:bg-rose-700 text-rose-300 hover:text-white rounded text-[9px] font-bold flex items-center gap-1 transition"
                              title="Delete slide"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => onSendSlideLive(slide)}
                            className="ml-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-black uppercase transition"
                          >
                            {isLive ? 'ON AIR' : 'Live'}
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={slide.content}
                        onChange={e => handleReflowTextChange(slide.id, e.target.value)}
                        className="w-full bg-[#0f1522] border border-slate-700 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white font-semibold leading-relaxed outline-none resize-y"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <MonitorPlay className="w-8 h-8 text-[#333]" />
            <p className="text-[#555] text-xs font-semibold">No Item Selected</p>
            <p className="text-[#3a3a3a] text-[10px]">Select an item from the playlist to begin</p>
          </div>
        )}
      </div>
    </div>
  );
};
