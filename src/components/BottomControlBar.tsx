import React, { useState } from 'react';
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
  Zap,
  Plus,
  Settings,
  Tv,
  Video,
  X
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
  onStopCountdown: () => void;
  isFullSlideCountdown?: boolean;
  onToggleFullSlideCountdown?: (enabled: boolean) => void;
  countdownTargetScreen?: 'audience' | 'stage' | 'both';
  onChangeCountdownTargetScreen?: (screen: 'audience' | 'stage' | 'both') => void;
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
  onStopCountdown,
  isFullSlideCountdown = false,
  onToggleFullSlideCountdown,
  countdownTargetScreen = 'both',
  onChangeCountdownTargetScreen,
  countdownEndAction = 'none',
  onChangeCountdownEndAction,
  countdownEndVideoId = '',
  onChangeCountdownEndVideoId,
  mediaList = []
}) => {
  const [customMinutes, setCustomMinutes] = useState<string>('5');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [showCountdownOptions, setShowCountdownOptions] = useState<boolean>(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartCustomTimer = () => {
    const mins = parseFloat(customMinutes);
    if (!isNaN(mins) && mins > 0) {
      onStartCountdown(Math.round(mins * 60));
      setShowCustomInput(false);
    }
  };

  return (
    <footer className="h-16 bg-[#0c121e] border-t border-[#26334a] px-4 flex items-center justify-between gap-4 select-none shrink-0 z-30">
      {/* LEFT: EMERGENCY CONTROLS */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider mr-1">
          EMERGENCY:
        </span>

        {/* BLACK BUTTON */}
        <button
          onClick={() => onToggleEmergency('isBlack')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isBlack
              ? 'bg-rose-600 text-white border-rose-400 glow-live'
              : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-rose-500/60'
          }`}
          title="Black screen toggle (Hotkey: B)"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>BLACK</span>
        </button>

        {/* CLEAR BUTTON */}
        <button
          onClick={() => onToggleEmergency('isClear')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isClear
              ? 'bg-amber-600 text-white border-amber-400'
              : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-amber-500/60'
          }`}
          title="Clear text toggle (Hotkey: ESC)"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>CLEAR</span>
        </button>

        {/* LOGO BUTTON */}
        <button
          onClick={() => onToggleEmergency('isLogo')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isLogo
              ? 'bg-indigo-600 text-white border-indigo-400'
              : 'bg-[#162032] text-slate-300 border-[#26334a] hover:border-indigo-500/60'
          }`}
          title="Church logo wallpaper toggle (Hotkey: L)"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>LOGO</span>
        </button>

        {/* FREEZE BUTTON */}
        <button
          onClick={() => onToggleEmergency('isFreeze')}
          className={`h-9 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition border ${
            emergency.isFreeze
              ? 'bg-sky-600 text-white border-sky-400'
              : 'bg-[#162032] text-slate-[#300] border-[#26334a] hover:border-sky-500/60'
          }`}
          title="Freeze frame output toggle (Hotkey: F)"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>FREEZE</span>
        </button>
      </div>

      {/* CENTER: TRANSITION & MANUAL COUNTDOWN TIMER WIDGET */}
      <div className="flex items-center gap-4">
        {/* Transition Selector */}
        <div className="flex items-center gap-2 bg-[#141d2e] border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Transition:</span>
          <select
            value={transition.type}
            onChange={(e) => onChangeTransition({ type: e.target.value as TransitionType })}
            className="bg-[#0d1320] border border-slate-700 rounded px-2 py-0.5 text-white font-semibold outline-none focus:border-indigo-500"
          >
            {['fade', 'cut', 'dissolve', 'slide', 'zoom'].map(t => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400 font-mono">
            {transition.durationMs}ms
          </span>
        </div>

        {/* Countdown Timer Widget with Manual Input */}
        <div className="flex items-center gap-2 bg-[#141d2e] border border-slate-800 px-3 py-1.5 rounded-lg text-xs relative">
          {/* Gear icon for advanced countdown options */}
          <button
            type="button"
            onClick={() => {
              setShowCountdownOptions(!showCountdownOptions);
              setShowCustomInput(false);
            }}
            className={`p-1 rounded transition ${showCountdownOptions ? 'text-amber-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
            title="Configure full slide countdown, target screen, and completion actions"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Advanced Countdown Options Popover */}
          {showCountdownOptions && (
            <div className="absolute right-0 bottom-12 bg-[#101726] border border-amber-500/60 p-3.5 rounded-2xl shadow-2xl space-y-3 z-50 min-w-[290px] animate-scaleUp">
              <div className="font-extrabold text-amber-300 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-400" /> Countdown Display & Triggers
                </span>
                <button
                  type="button"
                  onClick={() => setShowCountdownOptions(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full Slide Countdown Toggle */}
              <div className="flex items-center justify-between bg-[#080d16] p-2 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isFullSlideCountdown}
                    onChange={(e) => onToggleFullSlideCountdown && onToggleFullSlideCountdown(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>Full Slide Countdown</span>
                </label>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isFullSlideCountdown ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {isFullSlideCountdown ? 'FULL SLIDE' : 'BADGE'}
                </span>
              </div>

              {/* Target Screen Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Target Display Screen</label>
                <select
                  value={countdownTargetScreen}
                  onChange={(e) => onChangeCountdownTargetScreen && onChangeCountdownTargetScreen(e.target.value as any)}
                  className="w-full bg-[#080d16] border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold outline-none focus:border-amber-500"
                >
                  <option value="both">📺🖥️ Both Screens (Audience & Stage)</option>
                  <option value="audience">📺 Audience Screen Only (Projector)</option>
                  <option value="stage">🖥️ Stage Display Only (Confidence Monitor)</option>
                </select>
              </div>

              {/* Completion Trigger Action at 00:00 */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Completion Action at 00:00</label>
                <select
                  value={countdownEndAction}
                  onChange={(e) => onChangeCountdownEndAction && onChangeCountdownEndAction(e.target.value as any)}
                  className="w-full bg-[#080d16] border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold outline-none focus:border-amber-500"
                >
                  <option value="none">None (Keep 00:00)</option>
                  <option value="play_video">▶️ Play Selected Video Asset</option>
                  <option value="start_playlist">📋 Start 1st Item in Playlist</option>
                  <option value="go_live_active">⚡ Go Live with Active Item</option>
                </select>
              </div>

              {/* Select Video Media Asset if play_video action chosen */}
              {countdownEndAction === 'play_video' && (
                <div className="space-y-1 pt-1.5 border-t border-slate-800">
                  <label className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">Select Media Video Asset</label>
                  <select
                    value={countdownEndVideoId}
                    onChange={(e) => onChangeCountdownEndVideoId && onChangeCountdownEndVideoId(e.target.value)}
                    className="w-full bg-[#080d16] border border-amber-500/50 rounded-lg p-1.5 text-xs text-white font-bold outline-none focus:border-amber-500"
                  >
                    <option value="">-- Select Video Asset --</option>
                    {mediaList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <span className="font-mono font-black text-sm text-rose-400 min-w-[50px]">
            {formatTime(countdownSeconds)}
          </span>

          {isCountdownRunning ? (
            <button
              onClick={onStopCountdown}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold uppercase transition shadow"
            >
              STOP
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onStartCountdown(180)}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] font-semibold transition"
                title="3 minutes"
              >
                3m
              </button>
              <button
                onClick={() => onStartCountdown(300)}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] font-semibold transition"
                title="5 minutes"
              >
                5m
              </button>
              <button
                onClick={() => onStartCountdown(600)}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] font-semibold transition"
                title="10 minutes"
              >
                10m
              </button>
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition flex items-center gap-0.5"
                title="Enter custom timer duration manually"
              >
                <span>Custom</span>
              </button>

              {/* Manual Timer Entry Popover */}
              {showCustomInput && (
                <div className="absolute right-0 bottom-12 bg-[#162032] border border-indigo-500/60 p-2.5 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-zoom-in">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Input Minutes</span>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartCustomTimer()}
                      placeholder="e.g. 7"
                      autoFocus
                      className="w-20 bg-[#0d1320] border border-slate-700 rounded px-2 py-1 text-white font-bold text-center outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleStartCustomTimer}
                    className="h-8 px-3 mt-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition shadow"
                  >
                    Start
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: MASTER SLIDE STEPPERS */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevSlide}
          className="h-9 px-3 bg-[#162032] hover:bg-indigo-600/30 border border-[#26334a] hover:border-indigo-500/60 rounded-lg text-slate-200 font-semibold text-xs flex items-center gap-1 transition active:scale-95"
          title="Previous Slide (Up / Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>PREV</span>
        </button>

        <button
          onClick={onGoLiveCurrent}
          className="h-9 px-4 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-1.5 transition transform active:scale-95"
          title="Go Live with Preview Slide (Enter)"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>GO LIVE</span>
        </button>

        <button
          onClick={onNextSlide}
          className="h-9 px-3 bg-[#162032] hover:bg-indigo-600/30 border border-[#26334a] hover:border-indigo-500/60 rounded-lg text-slate-200 font-semibold text-xs flex items-center gap-1 transition active:scale-95"
          title="Next Slide (Down / Right Arrow)"
        >
          <span>NEXT</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
