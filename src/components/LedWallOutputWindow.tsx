import React, { useState, useEffect } from 'react';
import { Slide, Theme, EmergencyState } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { getFlexibleFontSize } from '../utils/fontSize';

export const LedWallOutputWindow: React.FC = () => {
  const [liveSlide, setLiveSlide] = useState<Slide | null>(null);
  const [theme, setTheme] = useState<Theme>({
    id: 'default',
    name: 'Modern Worship',
    fontFamily: 'Inter',
    fontSize: 56,
    fontWeight: '900',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.3,
    blurAmount: 0,
    shadowColor: 'rgba(0,0,0,0.9)',
    lowerThirdStyle: false,
    accentColor: '#6366f1',
    backgroundUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80'
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
      if (payload.type === 'THEME_CHANGE' && payload.theme) {
        setTheme(payload.theme);
      }
      if (payload.type === 'EMERGENCY_STATE_CHANGE' && payload.emergency) {
        setEmergency(payload.emergency);
      }
    });

    return () => unsubscribe();
  }, []);

  const bgUrl = liveSlide?.backgroundUrl || theme.backgroundUrl;
  const isVideoBg = liveSlide?.backgroundType === 'video' || (bgUrl && (bgUrl.endsWith('.mp4') || bgUrl.endsWith('.webm') || bgUrl.startsWith('data:video')));

  return (
    <div className="w-screen h-screen bg-black text-white relative overflow-hidden select-none flex flex-col justify-between">
      {emergency.isBlack ? (
        <div className="absolute inset-0 bg-black z-50" />
      ) : (
        <>
          {/* MOTION GRAPHICS / VIDEO BACKGROUND LAYER */}
          {bgUrl && (
            isVideoBg ? (
              <video
                src={bgUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={bgUrl}
                alt="LED Wall Background"
                className="absolute inset-0 w-full h-full object-cover opacity-80 filter contrast-125 saturate-125"
              />
            )
          )}

          {/* SCRIM */}
          <div 
            className="absolute inset-0 z-10"
            style={{ backgroundColor: `rgba(0,0,0,${theme.scrimOpacity * 0.7})` }}
          />

          {/* LED WALL TEXT DISPLAY */}
          {!emergency.isClear && liveSlide && (
            <div className="relative z-20 w-full h-full p-12 flex flex-col justify-center items-center text-center animate-slide-fade">
              <div className="max-w-6xl my-auto">
                {liveSlide.title && (
                  <div className="text-sm font-black uppercase text-amber-400 tracking-[0.3em] mb-4 bg-black/60 px-6 py-2 rounded-full inline-block border border-amber-500/50 shadow-2xl">
                    {liveSlide.title}
                  </div>
                )}

                <div 
                  className="font-black text-white leading-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.95)] whitespace-pre-line tracking-wide uppercase"
                  style={{ 
                    fontFamily: theme.fontFamily,
                    fontSize: getFlexibleFontSize(liveSlide.content, 64).fontSize,
                    lineHeight: getFlexibleFontSize(liveSlide.content, 64).lineHeight,
                    textAlign: theme.align
                  }}
                >
                  {liveSlide.content}
                </div>

                {liveSlide.subtitle && (
                  <div className="text-base font-extrabold text-amber-300 mt-6 tracking-widest uppercase">
                    {liveSlide.subtitle}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
