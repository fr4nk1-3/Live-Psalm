/**
 * FullscreenVideoPlayer — clean, auto-hiding controls media player
 * for the audience output window. No browser native controls.
 * Controls auto-hide after 3s of inactivity, appear on hover/move.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X
} from 'lucide-react';

interface FullscreenVideoPlayerProps {
  src: string;
  onEnded?: () => void;
  onClose?: () => void;
  /** Whether this is a background video (no controls at all) */
  isBackground?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export const FullscreenVideoPlayer: React.FC<FullscreenVideoPlayerProps> = ({
  src,
  onEnded,
  onClose,
  isBackground = false,
  autoPlay = true,
  loop = false,
  muted = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);

  // Auto-hide controls
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => setCurrentTime(vid.currentTime);
    const onDuration = () => setDuration(vid.duration);
    const onProgress = () => {
      if (vid.buffered.length > 0) {
        setBuffered((vid.buffered.end(vid.buffered.length - 1) / vid.duration) * 100);
      }
    };
    const onEnded_ = () => { setPlaying(false); setShowControls(true); onEnded?.(); };
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);

    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('loadedmetadata', onDuration);
    vid.addEventListener('progress', onProgress);
    vid.addEventListener('ended', onEnded_);
    document.addEventListener('fullscreenchange', onFsChange);

    if (autoPlay) {
      vid.play().catch(() => {});
    }

    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('loadedmetadata', onDuration);
      vid.removeEventListener('progress', onProgress);
      vid.removeEventListener('ended', onEnded_);
      document.removeEventListener('fullscreenchange', onFsChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [src, autoPlay, onEnded]);

  useEffect(() => {
    if (playing) scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, scheduleHide]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); } else { vid.pause(); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    vid.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const v = parseFloat(e.target.value);
    vid.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const skip = (seconds: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.currentTime + seconds, duration));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
    return `${m}:${sec.toString().padStart(2,'0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // Background mode: just a plain looping video, zero UI
  if (isBackground) {
    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black flex items-center justify-center group"
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={togglePlay}
    >
      {/* The video itself — no native controls */}
      <video
        ref={videoRef}
        key={src}
        src={src}
        loop={loop}
        muted={isMuted}
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Big centre play/pause icon — flashes briefly on toggle */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/50 rounded-full p-6 backdrop-blur-sm">
            <Play className="w-16 h-16 text-white fill-white" style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.6))' }} />
          </div>
        </div>
      )}

      {/* Close button — top-right, always visible */}
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 z-40 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100"
          title="Close video"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Controls overlay — auto-hides */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient scrim behind controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-4 pt-8 space-y-2">
          {/* Seek bar */}
          <div className="relative h-1 group/seek cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const vid = videoRef.current;
            if (vid && duration) { vid.currentTime = pct * duration; }
          }}>
            {/* Track */}
            <div className="absolute inset-0 bg-white/20 rounded-full" />
            {/* Buffered */}
            <div className="absolute top-0 left-0 h-full bg-white/30 rounded-full" style={{ width: `${buffered}%` }} />
            {/* Progress */}
            <div className="absolute top-0 left-0 h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: play controls + time */}
            <div className="flex items-center gap-3">
              <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition p-1" title="−10s">
                <SkipBack className="w-4 h-4" />
              </button>

              <button onClick={togglePlay} className="text-white hover:text-white/80 transition p-1" title={playing ? 'Pause' : 'Play'}>
                {playing
                  ? <Pause className="w-6 h-6 fill-white" />
                  : <Play className="w-6 h-6 fill-white" />
                }
              </button>

              <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition p-1" title="+10s">
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <button onClick={toggleMute} className="text-white/70 hover:text-white transition p-1">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  className="w-20 accent-white cursor-pointer h-1"
                />
              </div>

              {/* Time display */}
              <span className="text-white/80 text-xs font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: fullscreen */}
            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition p-1" title="Fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
