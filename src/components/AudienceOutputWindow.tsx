import React, { useState, useEffect } from 'react';
import { Slide, Theme, EmergencyState, TransitionSettings } from '../types/presentation';
import { BroadcastService, BroadcastPayload } from '../services/broadcast';
import { StorageService } from '../services/storage';
import { Flame, Megaphone } from 'lucide-react';
import { getFlexibleFontSize } from '../utils/fontSize';

export const AudienceOutputWindow: React.FC = () => {
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
    fontSize: 52,
    fontWeight: '800',
    textColor: '#ffffff',
    align: 'center',
    scrimOpacity: 0.5,
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
  const [transition, setTransition] = useState<TransitionSettings>({
    type: 'fade',
    durationMs: 400
  });

  const churchProfile = StorageService.getChurchProfile();

  useEffect(() => {
    // Listen for live updates from operator control screen
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
      if (payload.type === 'TRANSITION_CHANGE' && payload.transition) {
        setTransition(payload.transition);
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

  // Determine active background image/video
  const bgUrl = liveSlide?.backgroundUrl || theme.backgroundUrl;
  const isVideoBg = liveSlide?.backgroundType === 'video' || (bgUrl && (bgUrl.endsWith('.mp4') || bgUrl.endsWith('.webm') || bgUrl.endsWith('.mov') || bgUrl.startsWith('data:video')));

  return (
    <div className="w-screen h-screen bg-black text-white relative overflow-hidden select-none flex flex-col justify-between">
      {/* BLACK EMERGENCY OVERRIDE */}
      {emergency.isBlack ? (
        <div className="absolute inset-0 bg-black z-50" />
      ) : emergency.isLogo ? (
        /* LOGO WALLPAPER OVERRIDE WITH CHURCH PROFILE & UPLOADED LOGO */
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center z-40 p-8 text-center">
          {churchProfile.logoUrl ? (
            <img 
              src={churchProfile.logoUrl} 
              alt={churchProfile.name} 
              className="max-h-44 object-contain mb-6 drop-shadow-2xl animate-pulse" 
            />
          ) : (
            <div className="p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl mb-4">
              <Flame className="w-16 h-16 text-white animate-pulse" />
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent uppercase">
            {churchProfile.name || 'GRACE COMMUNITY CHURCH'}
          </h1>
          <p className="text-indigo-300 font-semibold text-sm mt-2 uppercase tracking-widest">
            {churchProfile.tagline || 'Welcome To Worship'}
          </p>
        </div>
      ) : (
        <>
          {/* MOTION / VIDEO BACKGROUND LAYER */}
          {bgUrl && (
            isVideoBg ? (
              <video
                src={bgUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-60"
              />
            ) : (
              <img
                src={bgUrl}
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-60"
              />
            )
          )}

          {/* DARK OVERLAY SCRIM */}
          <div 
            className="absolute inset-0 transition-opacity duration-300 z-10"
            style={{ backgroundColor: `rgba(0,0,0,${theme.scrimOpacity})` }}
          />

          {/* MAIN LIVE PRESENTATION TEXT LAYER */}
          {!emergency.isClear && liveSlide && (
            <div className="relative z-20 w-full h-full p-16 flex flex-col justify-center items-center text-center animate-slide-fade">
              {/* LOWER THIRD MODE vs CENTER FULLSCREEN MODE */}
              {theme.lowerThirdStyle ? (
                <div className="mt-auto w-full max-w-4xl bg-slate-950/90 border-l-8 border-emerald-500 p-6 rounded-r-2xl shadow-2xl backdrop-blur-md text-left">
                  {liveSlide.sectionLabel && (
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-widest block mb-1">
                      {liveSlide.sectionLabel}
                    </span>
                  )}
                  <div 
                    className="font-extrabold text-white text-3xl leading-snug"
                    style={{ fontFamily: theme.fontFamily }}
                  >
                    {liveSlide.content}
                  </div>
                  {liveSlide.subtitle && (
                    <div className="text-xs text-slate-400 font-semibold mt-2">
                      {liveSlide.subtitle}
                    </div>
                  )}
                </div>
              ) : (
                /* CENTERED WORSHIP / SCRIPTURE SLIDE */
                <div className="max-w-5xl my-auto">
                  {liveSlide.title && (
                    <div className="text-xs font-black uppercase text-indigo-300 tracking-[0.25em] mb-4 bg-indigo-950/60 px-4 py-1.5 rounded-full inline-block border border-indigo-500/40">
                      {liveSlide.title}
                    </div>
                  )}

                  <div 
                    className="font-extrabold text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] whitespace-pre-line"
                    style={{ 
                      fontFamily: theme.fontFamily,
                      fontSize: getFlexibleFontSize(liveSlide.content, theme.fontSize).fontSize,
                      lineHeight: getFlexibleFontSize(liveSlide.content, theme.fontSize).lineHeight,
                      textAlign: theme.align,
                      letterSpacing: theme.letterSpacing || 'normal',
                      textTransform: theme.textTransform || 'none'
                    }}
                  >
                    {liveSlide.content}
                  </div>

                  {liveSlide.subtitle && (
                    <div className="text-sm font-bold text-indigo-200 mt-6 tracking-wider uppercase opacity-90">
                      {liveSlide.subtitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* INDEPENDENT LOWER THIRD ANNOUNCEMENT CRAWL LINE TICKER OVERLAY */}
          {lowerThirdAnnouncement && (
            <div className="absolute bottom-6 left-0 right-0 z-30 bg-[#070b15]/95 border-y-2 border-purple-500/80 shadow-[0_10px_35px_rgba(0,0,0,0.95)] backdrop-blur-md flex items-center overflow-hidden h-16 animate-slide-fade">
              {/* Fixed Badge on Left */}
              <div className="h-full px-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 flex items-center gap-2.5 text-white font-black text-sm uppercase tracking-wider shrink-0 z-10 shadow-xl border-r border-purple-400/40">
                <Megaphone className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>ANNOUNCEMENT</span>
                {lowerThirdAnnouncement.title && (
                  <span className="text-xs font-extrabold text-purple-200 bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-400/40">
                    {lowerThirdAnnouncement.title}
                  </span>
                )}
              </div>

              {/* Smooth Scrolling Marquee Crawl Line */}
              <div className="flex-1 overflow-hidden relative flex items-center h-full">
                <div className="animate-crawl-line font-extrabold text-white text-2xl tracking-wide flex items-center gap-8">
                  <span>{lowerThirdAnnouncement.content}</span>
                  {lowerThirdAnnouncement.subtitle && (
                    <span className="text-purple-300 text-lg font-bold">
                      — {lowerThirdAnnouncement.subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
