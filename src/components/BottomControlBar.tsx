import React, { useState, useRef } from 'react';
import { 
  EmergencyState, 
  TransitionSettings, 
  TransitionType,
  MediaAsset
} from '../types/presentation';
import { 
  Square, 
  EyeOff, 
  Image as ImageIcon, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Clock,
  Settings,
  X,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  StopCircle
} from 'lucide-react';

interface BottomControlBarProps {
  emergency: EmergencyState;
  onToggleEmergency: (key: keyof EmergencyState) => void;
  transition: TransitionSettings;
  onChangeTransition: (updated: Partial<TransitionSettings>) => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onGoLiveCurrent: () => void;
  countdownSeconds: number;
  isCountdownRunning: boolean;
  onStartCountdown: (seconds: number) => void;
  onPauseCountdown?: () => void;
  onStopCountdown: () => void;
  countUp?: boolean;
  onToggleCountUp?: (enabled: boolean) => void;
  isFullSlideCountdown?: boolean;
  onToggleFullSlideCountdown?: (enabled: boolean) => void;
  countdownTargetScreen?: 'audience' | 'stage' | 'both';
  onChangeCountdownTargetScreen?: (screen: 'audience' | 'stage' | 'both') => void;
  countdownTitle?: string;
  countdownOvertimeTitle?: string;
  onChangeCountdownLabels?: (title: string, overtimeTitle: string) => void;
  countdownTargetTimestamp?: number | null;
  onStartClockCountdown?: (targetTimestampMs: number) => void;
  onClearClockCountdown?: () => void;
  countdownEndAction?: 'none' | 'play_video' | 'start_playlist' | 'go_live_active';
  onChangeCountdownEndAction?: (action: 'none' | 'play_video' | 'start_playlist' | 'go_live_active') => void;
  countdownEndVideoId?: string;
  onChangeCountdownEndVideoId?: (videoId: string) => void;
  mediaList?: MediaAsset[];
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  emergency,
  onToggleEmergency,
  transition,
  onChangeTransition,
  onPrevSlide,
  onNextSlide,
  onGoLiveCurrent,
  countdownSeconds,
  isCountdownRunning,
  onStartCountdown,
  onPauseCountdown,
  onStopCountdown,
  countUp: countUpProp,
  onToggleCountUp,
  isFullSlideCountdown = false,
  onToggleFullSlideCountdown,
  countdownTargetScreen = 'both',
  onChangeCountdownTargetScreen,
  countdownTitle = 'SERVICE STARTING IN',
  countdownOvertimeTitle = 'SERVICE IN PROGRESS',
  onChangeCountdownLabels,
  countdownTargetTimestamp = null,
  onStartClockCountdown,
  onClearClockCountdown,
  countdownEndAction = 'none',
  onChangeCountdownEndAction,
  countdownEndVideoId = '',
  onChangeCountdownEndVideoId,
  mediaList = []
}) => {
  // ProPresenter-style timer state
  const [localCountUp, setLocalCountUp] = useState(false);           // count up vs count down
  const countUp = countUpProp !== undefined ? countUpProp : localCountUp;
  const toggleCountUp = () => {
    const next = !countUp;
    setLocalCountUp(next);
    if (onToggleCountUp) onToggleCountUp(next);
  };
  const [showOptions, setShowOptions] = useState(false);
  const [editHours, setEditHours] = useState('0');
  const [customPresets, setCustomPresets] = useState<{ id: string; label: string; overtimeLabel: string }[]>(() => {
    try {
      const raw = localStorage.getItem('live_psalms_countdown_presets_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [targetDateTimeInput, setTargetDateTimeInput] = useState<string>(() => {
    const d = new Date();
    d.setHours(24, 0, 0, 0); // default tonight midnight
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const BUILTIN_COUNTDOWN_PRESETS = [
    { id: 'service', shortLabel: 'Service', label: 'SERVICE STARTING IN', overtimeLabel: 'SERVICE IN PROGRESS' },
    { id: 'newyear', shortLabel: 'New Year', label: 'NEW YEAR COUNTDOWN', overtimeLabel: 'HAPPY NEW YEAR!' },
    { id: 'worship', shortLabel: 'Worship', label: 'WORSHIP STARTING IN', overtimeLabel: 'WORSHIP IN PROGRESS' },
    { id: 'sermon', shortLabel: 'Sermon', label: 'SERMON STARTING IN', overtimeLabel: 'WORD IN PROGRESS' },
    { id: 'conference', shortLabel: 'Conference', label: 'CONFERENCE SESSION IN', overtimeLabel: 'SESSION IN PROGRESS' },
    { id: 'break', shortLabel: 'Break', label: 'BREAK / INTERMISSION', overtimeLabel: 'RESUMING NOW' },
    { id: 'prayer', shortLabel: 'Prayer', label: 'PRAYER SESSION IN', overtimeLabel: 'PRAYER IN PROGRESS' }
  ];

  const toLocalDateTimeStr = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const saveCustomCountdownPreset = () => {
    const trimmed = countdownTitle.trim();
    if (!trimmed) return;
    const overtime = countdownOvertimeTitle.trim() || 'IN PROGRESS';
    const next = [
      ...customPresets.filter(p => p.label.toLowerCase() !== trimmed.toLowerCase()),
      { id: `custom-${Date.now()}`, label: trimmed, overtimeLabel: overtime }
    ];
    setCustomPresets(next);
    try {
      localStorage.setItem('live_psalms_countdown_presets_v1', JSON.stringify(next));
    } catch (e) {}
  };

  const deleteCustomCountdownPreset = (id: string) => {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    try {
      localStorage.setItem('live_psalms_countdown_presets_v1', JSON.stringify(next));
    } catch (e) {}
  };
  const [editMins, setEditMins] = useState('05');
  const [editSecs, setEditSecs] = useState('00');
  const [isEditing, setIsEditing] = useState(false);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Format seconds — handles negative overtime (shown as +M:SS)
  const formatTime = (secs: number) => {
    const isOvertime = secs < 0;
    const totalSecs = Math.abs(secs);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    let formatted: string;
    if (d > 0) {
      formatted = `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else if (h > 0) {
      formatted = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return isOvertime ? `+${formatted}` : formatted;
  };

  const startFromInputs = () => {
    const h = parseInt(editHours) || 0;
    const m = parseInt(editMins) || 0;
    const s = parseInt(editSecs) || 0;
    const total = h * 3600 + m * 60 + s;
    if (total > 0 || countUp) {
      onStartCountdown(total);
      setIsEditing(false);
    }
  };

  const handleReset = () => {
    onStopCountdown();
    setIsEditing(true);
    setTimeout(() => hoursRef.current?.focus(), 50);
  };

  // When display is clicked and timer is stopped, open inline editor
  const handleDisplayClick = () => {
    if (!isCountdownRunning) {
      setIsEditing(true);
      setTimeout(() => hoursRef.current?.focus(), 50);
    }
  };

  // Navigate between fields on Tab / Enter inside time inputs
  const handleTimeKeyDown = (e: React.KeyboardEvent, _field: 'h' | 'm' | 's') => {
    if (e.key === 'Enter') {
      startFromInputs();
    }
  };

  // CRITICAL: force edit mode OFF whenever the timer is running (prevents glitch when overtime starts)
  React.useEffect(() => {
    if (isCountdownRunning) {
      setIsEditing(false);
    }
  }, [isCountdownRunning]);

  const isAtZero = countdownSeconds === 0 && !isCountdownRunning;
  const isOvertime = isCountdownRunning && countdownSeconds < 0;
  const isWarning = isCountdownRunning && countdownSeconds >= 0 && countdownSeconds <= 180; // < 3 min
  const isOnTime  = isCountdownRunning && countdownSeconds > 180;

  return (
    <footer className="min-h-14 py-1.5 bg-[#0c121e] border-t border-[#26334a] px-2.5 xl:px-4 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 xl:gap-4 select-none shrink-0 z-30">

      {/* ─── LEFT: EMERGENCY CONTROLS ─── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden xl:inline text-[10px] font-black uppercase text-slate-500 tracking-wider mr-1">EMERGENCY:</span>

        <button
          onClick={() => onToggleEmergency('isBlack')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isBlack ? 'bg-rose-600 text-white border-rose-400 glow-live' : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-rose-500/60'
          }`}
          title="Black screen (B)"
        >
          <Square className="w-3.5 h-3.5 fill-current" /> BLACK
        </button>

        <button
          onClick={() => onToggleEmergency('isClear')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isClear ? 'bg-amber-600 text-white border-amber-400' : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-amber-500/60'
          }`}
          title="Clear text (ESC)"
        >
          <EyeOff className="w-3.5 h-3.5" /> CLEAR
        </button>

        <button
          onClick={() => onToggleEmergency('isLogo')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isLogo ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-indigo-500/60'
          }`}
          title="Church logo (L)"
        >
          <ImageIcon className="w-3.5 h-3.5" /> LOGO
        </button>

        <button
          onClick={() => onToggleEmergency('isFreeze')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isFreeze ? 'bg-sky-600 text-white border-sky-400' : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-sky-500/60'
          }`}
          title="Freeze frame (F)"
        >
          <Pause className="w-3.5 h-3.5" /> FREEZE
        </button>
      </div>

      {/* ─── CENTER: TRANSITION & TIMER WIDGET ─── */}
      <div className="flex items-center gap-2 flex-wrap justify-center">

        {/* Transition selector (matches h-9 height of left/right controls) */}
        <div className="h-9 flex items-center gap-2 bg-[#121929] border border-[#26334a] px-2.5 rounded-lg text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Transition
          </span>
          <select
            value={transition.type}
            onChange={(e) => onChangeTransition({ type: e.target.value as TransitionType })}
            className="h-6 bg-[#0b101b] border border-slate-700 hover:border-indigo-500/60 rounded-md px-2 text-[11px] text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
          >
            {['fade', 'cut', 'dissolve', 'slide', 'zoom'].map(t => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* ═══ PROPRESENTER-STYLE TIMER WIDGET ═══ */}
        <div className={`relative h-9 flex items-center gap-1.5 px-2.5 rounded-lg border text-xs transition-all ${
          isOnTime
            ? 'bg-[#0a1a10] border-emerald-500/60 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
            : (isWarning || isOvertime)
            ? 'bg-[#1a0f0f] border-rose-500/70 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
            : 'bg-[#121929] border-[#26334a]'
        }`}>

          {/* Count direction toggle pill (Clock + Up/Down) */}
          <button
            type="button"
            onClick={toggleCountUp}
            className={`h-6 px-1.5 rounded-md border flex items-center gap-1 text-[10px] font-bold transition shrink-0 ${
              countUp
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0b101b] border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={countUp ? 'Counting Up (click for Countdown)' : 'Counting Down (click for Count Up)'}
          >
            <Clock className={`w-3 h-3 ${isCountdownRunning ? 'text-rose-400' : ''}`} />
            {countUp ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
          </button>

          {/* ── Main time display / inline editor ── */}
          {isEditing && !isCountdownRunning ? (
            <div className="flex items-center gap-0.5 font-mono font-black text-sm text-white">
              <input
                ref={hoursRef}
                type="number"
                min={0} max={23}
                value={editHours}
                onChange={e => setEditHours(e.target.value)}
                onKeyDown={e => handleTimeKeyDown(e, 'h')}
                className="w-7 h-6 bg-[#0b101b] border border-indigo-500/60 rounded text-center text-xs font-black text-white outline-none focus:border-indigo-400 [appearance:textfield]"
                title="Hours"
              />
              <span className="text-slate-500 text-[10px]">:</span>
              <input
                type="number"
                min={0} max={59}
                value={editMins}
                onChange={e => setEditMins(e.target.value)}
                onKeyDown={e => handleTimeKeyDown(e, 'm')}
                className="w-8 h-6 bg-[#0b101b] border border-indigo-500/60 rounded text-center text-xs font-black text-white outline-none focus:border-indigo-400 [appearance:textfield]"
                title="Minutes"
              />
              <span className="text-slate-500 text-[10px]">:</span>
              <input
                type="number"
                min={0} max={59}
                value={editSecs}
                onChange={e => setEditSecs(e.target.value)}
                onKeyDown={e => handleTimeKeyDown(e, 's')}
                className="w-8 h-6 bg-[#0b101b] border border-indigo-500/60 rounded text-center text-xs font-black text-white outline-none focus:border-indigo-400 [appearance:textfield]"
                title="Seconds"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDisplayClick}
              className={`font-mono font-black text-base tracking-wider px-1.5 text-center transition-colors hover:opacity-80 whitespace-nowrap ${
                isOvertime
                  ? 'text-rose-400 animate-pulse'
                  : isWarning
                  ? 'text-rose-400 animate-pulse'
                  : isOnTime
                  ? 'text-emerald-400'
                  : countdownSeconds !== 0
                  ? 'text-amber-300'
                  : 'text-slate-300'
              }`}
              title={isOvertime ? `OVERTIME: +${formatTime(countdownSeconds)}` : 'Click to set custom time'}
            >
              {formatTime(countdownSeconds)}
            </button>
          )}

          {/* ── Control buttons: Start / Pause / Resume / Stop / Reset / Presets ── */}
          <div className="flex items-center gap-1">
            {isEditing && !isCountdownRunning ? (
              <button
                type="button"
                onClick={startFromInputs}
                className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase rounded-md flex items-center gap-1 transition shadow"
              >
                <Play className="w-2.5 h-2.5 fill-current" /> Start
              </button>
            ) : isCountdownRunning ? (
              <>
                <button
                  type="button"
                  onClick={() => onPauseCountdown ? onPauseCountdown() : onStopCountdown()}
                  className="h-6 px-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase rounded-md flex items-center gap-1 transition shadow"
                  title="Pause timer"
                >
                  <Pause className="w-2.5 h-2.5" /> Pause
                </button>
                <button
                  type="button"
                  onClick={() => onStopCountdown()}
                  className="h-6 w-6 flex items-center justify-center bg-rose-900/60 hover:bg-rose-700 border border-rose-500/40 text-rose-300 hover:text-white rounded-md transition"
                  title="Stop and reset"
                >
                  <StopCircle className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                {countdownSeconds !== 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartCountdown(countdownSeconds)}
                      className="h-6 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase rounded-md flex items-center gap-1 transition shadow"
                      title="Resume"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" /> Resume
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="h-6 w-6 flex items-center justify-center bg-[#0b101b] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-md transition"
                      title="Reset timer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </>
                )}
              </>
            )}

            {/* Quick preset buttons */}
            {!isCountdownRunning && !isEditing && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
                {[1, 3, 5, 10].map(min => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      setEditMins(min.toString().padStart(2, '0'));
                      setEditHours('0');
                      setEditSecs('00');
                      onStartCountdown(min * 60);
                    }}
                    className="h-6 px-1.5 bg-[#0b101b] hover:bg-indigo-600 border border-slate-700 hover:border-indigo-400 text-slate-300 hover:text-white rounded-md text-[10px] font-bold transition"
                    title={`Start ${min}-minute countdown`}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Options gear */}
          <button
            type="button"
            onClick={() => setShowOptions(v => !v)}
            className={`h-6 w-6 flex items-center justify-center rounded-md transition ${
              showOptions
                ? 'text-amber-300 bg-slate-800 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Timer display options"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* ── Advanced options popover (compact 2-column layout anchored above timer widget) ── */}
          {showOptions && (
            <div className="absolute bottom-11 right-0 bg-[#0e1524] border border-amber-500/40 p-3.5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3 z-[200] w-[92vw] sm:w-[540px] max-h-[76vh] overflow-y-auto">
              {/* Header + Full-Slide Toggle */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-black text-amber-300 text-xs tracking-wide">Timer &amp; Clock Options</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080d16] border border-slate-700 hover:border-amber-500/50 cursor-pointer text-[11px] font-bold text-slate-200 transition">
                    <input
                      type="checkbox"
                      checked={isFullSlideCountdown}
                      onChange={e => onToggleFullSlideCountdown && onToggleFullSlideCountdown(e.target.checked)}
                      className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span>Full-Slide</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOptions(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2-Column Body */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* LEFT: Countdown Title & Custom Options */}
                <div className="space-y-2 bg-[#080d16] p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                        Countdown Event
                      </label>
                      <button
                        type="button"
                        onClick={saveCustomCountdownPreset}
                        className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded text-[9px] font-bold text-indigo-200 transition"
                        title="Save current heading & done label as a reusable option"
                      >
                        + Save
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {BUILTIN_COUNTDOWN_PRESETS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onChangeCountdownLabels?.(p.label, p.overtimeLabel)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                            countdownTitle === p.label
                              ? 'bg-indigo-600 border-indigo-400 text-white'
                              : 'bg-[#0f172a] border-slate-700/80 text-slate-300 hover:border-indigo-400/60'
                          }`}
                        >
                          {p.shortLabel}
                        </button>
                      ))}
                      {customPresets.map(p => (
                        <span
                          key={p.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            countdownTitle === p.label
                              ? 'bg-emerald-600/80 border-emerald-400 text-white'
                              : 'bg-[#0f172a] border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onChangeCountdownLabels?.(p.label, p.overtimeLabel)}
                          >
                            {p.label}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCustomCountdownPreset(p.id)}
                            className="text-slate-300 hover:text-rose-300 leading-none"
                            title="Remove saved option"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Active Heading</span>
                      <input
                        type="text"
                        value={countdownTitle}
                        onChange={e => onChangeCountdownLabels?.(e.target.value, countdownOvertimeTitle)}
                        placeholder="e.g. NEW YEAR COUNTDOWN"
                        className="w-full bg-[#0c121e] border border-slate-700 focus:border-indigo-500 rounded-lg px-2 py-1 text-[11px] text-white font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">When 00:00 Reached</span>
                      <input
                        type="text"
                        value={countdownOvertimeTitle}
                        onChange={e => onChangeCountdownLabels?.(countdownTitle, e.target.value)}
                        placeholder="e.g. HAPPY NEW YEAR!"
                        className="w-full bg-[#0c121e] border border-slate-700 focus:border-indigo-500 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT: System Clock Target + Display Routing */}
                <div className="space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2 bg-[#080d16] p-2.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                        System Clock Target
                      </label>
                      {countdownTargetTimestamp && (
                        <button
                          type="button"
                          onClick={() => onClearClockCountdown?.()}
                          className="text-[9px] font-bold text-rose-300 hover:text-rose-200 underline"
                        >
                          Unlink
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(24, 0, 0, 0);
                          setTargetDateTimeInput(toLocalDateTimeStr(d));
                          onStartClockCountdown?.(d.getTime());
                        }}
                        className="px-1.5 py-1 rounded-md bg-[#0f172a] hover:bg-amber-600/30 border border-slate-700 hover:border-amber-400 text-[9px] font-bold text-amber-200 transition truncate"
                        title="Count down to 12:00 AM tonight"
                      >
                        Midnight
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const d = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
                          setTargetDateTimeInput(toLocalDateTimeStr(d));
                          onChangeCountdownLabels?.('NEW YEAR COUNTDOWN', 'HAPPY NEW YEAR!');
                          onStartClockCountdown?.(d.getTime());
                        }}
                        className="px-1.5 py-1 rounded-md bg-[#0f172a] hover:bg-amber-600/30 border border-slate-700 hover:border-amber-400 text-[9px] font-bold text-amber-200 transition truncate"
                        title="Count down to Jan 1st 12:00 AM"
                      >
                        New Year
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(d.getHours() + 1, 0, 0, 0);
                          setTargetDateTimeInput(toLocalDateTimeStr(d));
                          onStartClockCountdown?.(d.getTime());
                        }}
                        className="px-1.5 py-1 rounded-md bg-[#0f172a] hover:bg-amber-600/30 border border-slate-700 hover:border-amber-400 text-[9px] font-bold text-amber-200 transition truncate"
                        title="Count down to top of the next hour"
                      >
                        Next Hour
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="datetime-local"
                        value={targetDateTimeInput}
                        onChange={e => setTargetDateTimeInput(e.target.value)}
                        className="flex-1 min-w-0 bg-[#0c121e] border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1 text-[10px] text-white font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const ms = new Date(targetDateTimeInput).getTime();
                          if (!isNaN(ms)) {
                            onStartClockCountdown?.(ms);
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] rounded-lg transition shrink-0"
                      >
                        Start
                      </button>
                    </div>

                    {countdownTargetTimestamp && (
                      <div className="text-[9px] font-semibold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-md px-2 py-0.5 truncate">
                        Clock: {new Date(countdownTargetTimestamp).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Target Display & End Action */}
                  <div className="space-y-2 bg-[#080d16] p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Target Display</label>
                      <select
                        value={countdownTargetScreen}
                        onChange={e => onChangeCountdownTargetScreen && onChangeCountdownTargetScreen(e.target.value as any)}
                        className="w-full bg-[#0c121e] border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-bold outline-none focus:border-amber-500"
                      >
                        <option value="both">Both (Audience + Stage)</option>
                        <option value="audience">Audience / Projector</option>
                        <option value="stage">Stage Monitor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">When Timer Ends</label>
                      <select
                        value={countdownEndAction}
                        onChange={e => {
                          const nextAction = e.target.value as any;
                          if (onChangeCountdownEndAction) onChangeCountdownEndAction(nextAction);
                          if (nextAction === 'play_video' && !countdownEndVideoId && onChangeCountdownEndVideoId) {
                            const firstVideo = mediaList.find(m => m.type === 'video');
                            if (firstVideo) onChangeCountdownEndVideoId(firstVideo.id);
                          }
                        }}
                        className="w-full bg-[#0c121e] border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-bold outline-none focus:border-amber-500"
                      >
                        <option value="none">Continue into overtime (+00:00)</option>
                        <option value="play_video">Play selected video</option>
                        <option value="start_playlist">Start first playlist item</option>
                        <option value="go_live_active">Go live with active slide</option>
                      </select>
                    </div>
                    {countdownEndAction === 'play_video' && (
                      <div>
                        <label className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider block mb-0.5">Video Asset</label>
                        <select
                          value={countdownEndVideoId}
                          onChange={e => onChangeCountdownEndVideoId && onChangeCountdownEndVideoId(e.target.value)}
                          className="w-full bg-[#0c121e] border border-amber-500/50 rounded-lg px-2 py-1 text-[11px] text-white font-bold outline-none focus:border-amber-500"
                        >
                          <option value="">-- Select Video --</option>
                          {mediaList.filter(m => m.type === 'video').map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                          {mediaList.filter(m => m.type === 'video').length === 0 && (
                            <option disabled value="">No videos uploaded yet</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: SLIDE NAVIGATION ─── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevSlide}
          className="h-9 px-3 bg-[#162032] hover:bg-indigo-600/30 border border-[#26334a] hover:border-indigo-500/60 rounded-lg text-slate-200 font-semibold text-xs flex items-center gap-1 transition active:scale-95"
          title="Previous Slide (↑)"
        >
          <ChevronLeft className="w-4 h-4" /> PREV
        </button>

        <button
          onClick={onGoLiveCurrent}
          className="h-9 px-4 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-1.5 transition active:scale-95"
          title="Go Live (Enter)"
        >
          <Play className="w-3.5 h-3.5 fill-current" /> GO LIVE
        </button>

        <button
          onClick={onNextSlide}
          className="h-9 px-3 bg-[#162032] hover:bg-indigo-600/30 border border-[#26334a] hover:border-indigo-500/60 rounded-lg text-slate-200 font-semibold text-xs flex items-center gap-1 transition active:scale-95"
          title="Next Slide (↓)"
        >
          NEXT <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
