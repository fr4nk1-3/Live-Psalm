import React, { useState, useEffect } from 'react';
import { Slide, Theme, EmergencyState } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { Megaphone } from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';

export const ObsOutputWindow: React.FC = () => {
  const [liveSlide, setLiveSlide] = useState<Slide | null>(null);
  const [lowerThirdAnnouncement, setLowerThirdAnnouncement] = useState<{ title?: string; subtitle?: string; content?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('live_psalms_active_ticker_v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [theme, setTheme] = useState<Theme>({
    id: 'default',
    name: 'Modern Worship',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: true,
    accentColor: '#6366f1'
  });
  const [emergency, setEmergency] = useState<EmergencyState>({
    isBlack: false,
    isClear: false,
    isLogo: false,
    isFreeze: false,
    isStopMedia: false
  });

  useEffect(() => {
    const unsubscribe = BroadcastService.subscribe((payload: BroadcastPayload) => {
      if (payload.type === 'LIVE_SLIDE_CHANGE' && payload.liveSlide !== undefined) {
        setLiveSlide(payload.liveSlide);
      }
      if (payload.type === 'LOWER_THIRD_TRIGGER') {
        setLowerThirdAnnouncement(payload.lowerThirdText || null);
      }
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        setTheme(payload.theme);
      }
      if (payload.type === 'EMERGENCY_STATE_CHANGE' && payload.emergency) {
        setEmergency(payload.emergency);
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'live_psalms_active_ticker_v1') {
        try {
          setLowerThirdAnnouncement(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {
          setLowerThirdAnnouncement(null);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (emergency.isBlack) {
    return <div className="w-screen h-screen bg-black" />;
  }

  return (
    <div className="w-screen h-screen bg-transparent text-white relative overflow-hidden select-none flex flex-col justify-between">
      {/* OBS TRANSPARENT LOWER THIRD SLIDE DISPLAY */}
      {!emergency.isClear && liveSlide && (
        <div className="relative z-20 w-full h-full p-8 flex flex-col justify-end animate-slide-fade">
          <div className="w-full max-w-5xl bg-[#090d18]/95 border-l-8 border-indigo-500 p-6 rounded-r-2xl shadow-2xl backdrop-blur-md text-left border border-slate-800">
            {liveSlide.title && (
              <span className="text-xs font-black uppercase text-indigo-400 tracking-widest block mb-1">
                {liveSlide.title}
              </span>
            )}
            <div 
              className="font-extrabold text-white text-3xl leading-snug whitespace-pre-line drop-shadow"
              style={{ fontFamily: theme.fontFamily }}
            >
              {liveSlide.content}
            </div>
            {liveSlide.subtitle && (
              <div className="text-xs text-indigo-300 font-semibold mt-2">
                {liveSlide.subtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OBS CRAWL LINE TICKER OVERLAY */}
      {lowerThirdAnnouncement && (
        <div className="absolute bottom-4 left-0 right-0 z-30 bg-[#070b15]/95 border-y-2 border-purple-500/80 shadow-2xl backdrop-blur-md flex items-center overflow-hidden h-14 animate-slide-fade">
          <div className="h-full px-5 bg-gradient-to-r from-purple-700 to-indigo-700 flex items-center gap-2 text-white font-black text-xs uppercase tracking-wider shrink-0 z-10">
            <Megaphone className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>ANNOUNCEMENT</span>
          </div>

          <div className="flex-1 overflow-hidden relative flex items-center h-full">
            <div className="animate-crawl-line font-extrabold text-white text-xl tracking-wide flex items-center gap-8">
              <span>{lowerThirdAnnouncement.content}</span>
              {lowerThirdAnnouncement.subtitle && (
                <span className="text-purple-300 text-base font-bold">
                  — {lowerThirdAnnouncement.subtitle}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
