import React, { useState, useEffect } from 'react';
import { Slide, StageDisplayState } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { Clock as ClockIcon, FileText, ArrowRight, Zap, Timer, BookOpen } from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';

export const StageDisplayWindow: React.FC = () => {
  const [stageState, setStageState] = useState<StageDisplayState>({
    clockTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    countdownRemaining: 0
  });

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
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isCountdownActive = stageState.countdownRemaining > 0;

  return (
    <div className="w-screen h-screen bg-[#070b12] text-white select-none p-6 flex flex-col justify-between overflow-hidden">
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
          {isCountdownActive ? (
            /* HUGE, ULTRA-VISIBLE COUNTDOWN TIMER DISPLAY WHEN COUNTDOWN IS ACTIVE */
            <div className="flex items-center gap-3 bg-rose-950/90 border-2 border-rose-500/90 px-6 py-2 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.5)] glow-live">
              <Timer className="w-8 h-8 text-rose-400 animate-pulse" />
              <span className="text-xs font-black text-rose-300 uppercase tracking-widest mr-2">COUNTDOWN:</span>
              <span className="text-5xl font-black text-rose-400 tracking-wider">
                {formatCountdown(stageState.countdownRemaining)}
              </span>
            </div>
          ) : (
            /* BIG SERVICE CLOCK DISPLAY WHEN COUNTDOWN IS NOT ACTIVE */
            <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/40 px-5 py-2 rounded-2xl">
              <ClockIcon className="w-6 h-6 text-amber-400" />
              <span className="text-4xl font-black text-amber-400 tracking-wider">
                {stageState.clockTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: CURRENT LIVE SLIDE DISPLAY */}
      <div className="flex-1 my-4 bg-[#0d1320] border-2 border-emerald-500/80 rounded-2xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="font-black text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <Zap className="w-4 h-4 fill-current" /> CURRENT SLIDE LIVE
          </span>

          <div className="flex items-center gap-2">
            {/* BOOK AND VERSE BADGE FOR STAGE DISPLAY */}
            {(stageState.currentSlide?.title || stageState.currentSlide?.subtitle) && (
              <span className="text-xs font-black text-amber-300 bg-amber-950/90 border border-amber-500/60 px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow glow-live">
                <BookOpen className="w-4 h-4 text-amber-400" />
                {stageState.currentSlide.title || stageState.currentSlide.subtitle}
              </span>
            )}
            {stageState.currentSlide?.sectionLabel && (
              <span className="text-xs font-black uppercase px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full">
                {stageState.currentSlide.sectionLabel}
              </span>
            )}
          </div>
        </div>

        <div className="my-auto text-center px-4 overflow-y-auto max-h-[70vh]">
          {stageState.currentSlide ? (
            <div 
              className="font-extrabold text-white leading-tight whitespace-pre-line tracking-wide drop-shadow"
              style={getFlexibleFontSize(stageState.currentSlide.content, 48)}
            >
              {stageState.currentSlide.content}
            </div>
          ) : (
            <span className="text-slate-600 text-2xl font-bold uppercase tracking-widest">
              [ OUTPUT CLEAR ]
            </span>
          )}
        </div>
      </div>

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
