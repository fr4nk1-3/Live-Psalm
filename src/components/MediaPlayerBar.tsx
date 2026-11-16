/**
 * MediaPlayerBar — ProPresenter-style Broadcast Video Transport Deck.
 * Features a built-in master timekeeper <video> so seek, duration, remaining timecode (-MM:SS),
 * playback speed (0.5x–2x), loop toggle, and end-behavior work whether external output windows
 * are open or closed, while keeping Program Monitor, Audience Output, and LED Wall in sync.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Film,
  ChevronDown,
  Repeat,
  Gauge,
  RotateCcw
} from 'lucide-react';
import { BroadcastService } from '../services/broadcast';
import { MediaAsset } from '../types/presentation';

interface MediaPlayerBarProps {
  activeMedia: MediaAsset | null;
  onClear: () => void;
  onTriggerLogo?: () => void;
}

export const MediaPlayerBar: React.FC<MediaPlayerBarProps> = ({
  activeMedia,
  onClear,
  onTriggerLogo
}) => {
  const masterVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [endBehavior, setEndBehavior] = useState<'clear' | 'hold' | 'loop' | 'logo'>('clear');

  // Initialize & sync when activeMedia changes
  useEffect(() => {
    if (!activeMedia) return;

    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);

    // Broadcast initial play command to all output windows
    BroadcastService.postMessage({
      type: 'MEDIA_CMD_PLAY',
      mediaCmd: {
        url: activeMedia.url,
        volume: isMuted ? 0 : volume,
        playbackRate,
        loop: endBehavior === 'loop' || loop
      }
    });

    const vid = masterVideoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.playbackRate = playbackRate;
      vid.loop = endBehavior === 'loop' || loop;
      vid.play().catch(() => {});
    }
  }, [activeMedia?.url]);

  // Listen for external MEDIA_STATUS if an output window reports metadata first
  useEffect(() => {
    if (!activeMedia) return;
    const unsub = BroadcastService.subscribe(payload => {
      if (payload.type === 'MEDIA_STATUS' && payload.mediaStatus) {
        const s = payload.mediaStatus;
        if (s.duration > 0 && duration === 0) {
          setDuration(s.duration);
        }
      }
    });
    return () => unsub();
  }, [activeMedia, duration]);

  // Master video event handlers
  const handleLoadedMetadata = () => {
    const vid = masterVideoRef.current;
    if (!vid) return;
    if (vid.duration && isFinite(vid.duration)) {
      setDuration(vid.duration);
    }
    vid.playbackRate = playbackRate;
    vid.loop = endBehavior === 'loop' || loop;
    if (isPlaying) {
      vid.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    const vid = masterVideoRef.current;
    if (!vid || isSeeking) return;
    setCurrentTime(vid.currentTime);
    if (vid.duration && isFinite(vid.duration) && vid.duration !== duration) {
      setDuration(vid.duration);
    }
    // Broadcast status so Program Monitor in CenterWorkspace stays synced
    BroadcastService.postMessage({
      type: 'MEDIA_STATUS',
      mediaStatus: {
        playing: !vid.paused,
        currentTime: vid.currentTime,
        duration: vid.duration || duration,
        url: activeMedia?.url || null,
        volume: isMuted ? 0 : volume,
        playbackRate,
        loop: endBehavior === 'loop' || loop
      }
    });
  };

  const handleVideoEnded = () => {
    if (endBehavior === 'loop' || loop) {
      const vid = masterVideoRef.current;
      if (vid) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      }
      BroadcastService.postMessage({ type: 'MEDIA_CMD_SEEK', mediaCmd: { seekTo: 0 } });
      BroadcastService.postMessage({ type: 'MEDIA_CMD_RESUME' });
      return;
    }

    setIsPlaying(false);
    BroadcastService.postMessage({ type: 'MEDIA_CMD_PAUSE' });

    if (endBehavior === 'clear') {
      handleStop();
    } else if (endBehavior === 'logo') {
      BroadcastService.postMessage({ type: 'MEDIA_CMD_STOP' });
      onClear();
      if (onTriggerLogo) onTriggerLogo();
    }
    // 'hold' keeps the final frame paused on screen
  };

  const handlePlayPause = () => {
    const vid = masterVideoRef.current;
    if (isPlaying) {
      vid?.pause();
      BroadcastService.postMessage({ type: 'MEDIA_CMD_PAUSE' });
      setIsPlaying(false);
    } else {
      vid?.play().catch(() => {});
      BroadcastService.postMessage({ type: 'MEDIA_CMD_RESUME' });
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    const vid = masterVideoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
    setCurrentTime(0);
    setIsPlaying(true);
    BroadcastService.postMessage({ type: 'MEDIA_CMD_SEEK', mediaCmd: { seekTo: 0 } });
    BroadcastService.postMessage({ type: 'MEDIA_CMD_RESUME' });
  };

  const handleSeekStart = () => setIsSeeking(true);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (masterVideoRef.current) {
      masterVideoRef.current.currentTime = t;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_SEEK', mediaCmd: { seekTo: t } });
  };

  const handleSeekEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const t = parseFloat((e.target as HTMLInputElement).value);
    if (masterVideoRef.current) {
      masterVideoRef.current.currentTime = t;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_SEEK', mediaCmd: { seekTo: t } });
    setCurrentTime(t);
    setIsSeeking(false);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (masterVideoRef.current) {
      masterVideoRef.current.volume = v;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_VOLUME', mediaCmd: { volume: v } });
  };

  const handleMuteToggle = () => {
    const newVol = isMuted ? (volume > 0 ? volume : 0.8) : 0;
    setIsMuted(!isMuted);
    if (masterVideoRef.current) {
      masterVideoRef.current.volume = newVol;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_VOLUME', mediaCmd: { volume: newVol } });
  };

  const handleToggleLoop = () => {
    const nextLoop = !loop;
    setLoop(nextLoop);
    if (nextLoop && endBehavior !== 'loop') setEndBehavior('loop');
    if (!nextLoop && endBehavior === 'loop') setEndBehavior('clear');
    if (masterVideoRef.current) {
      masterVideoRef.current.loop = nextLoop;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_LOOP', mediaCmd: { loop: nextLoop } });
  };

  const handleChangeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (masterVideoRef.current) {
      masterVideoRef.current.playbackRate = rate;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_SPEED', mediaCmd: { playbackRate: rate } });
  };

  const handleStop = () => {
    masterVideoRef.current?.pause();
    BroadcastService.postMessage({ type: 'MEDIA_CMD_STOP' });
    onClear();
  };

  const skip = (seconds: number) => {
    const maxDur = duration || masterVideoRef.current?.duration || 100;
    const t = Math.max(0, Math.min(currentTime + seconds, maxDur));
    if (masterVideoRef.current) {
      masterVideoRef.current.currentTime = t;
    }
    BroadcastService.postMessage({ type: 'MEDIA_CMD_SEEK', mediaCmd: { seekTo: t } });
    setCurrentTime(t);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!activeMedia) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const remaining = Math.max(0, duration - currentTime);
  const isEndingSoon = isPlaying && duration > 0 && remaining <= 10;

  return (
    <div
      className={`bg-[#0b1120] border-t-2 border-sky-500/70 select-none transition-all duration-300 shadow-[0_-8px_25px_rgba(0,0,0,0.6)] ${
        isMinimized ? 'h-10' : 'h-[78px]'
      } overflow-hidden shrink-0 z-30`}
    >
      {/* Hidden Master Timekeeper Video (muted if Audience Output is open so audio doesn't double) */}
      <video
        ref={masterVideoRef}
        src={activeMedia.url}
        muted={BroadcastService.isAudienceOpen() || isMuted}
        playsInline
        className="hidden"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
      />

      {isMinimized ? (
        <div className="h-10 flex items-center px-4 gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-5 h-5 rounded bg-sky-700/60 flex items-center justify-center shrink-0">
              <Film className="w-3 h-3 text-sky-300" />
            </div>
            <span className="text-sky-300 text-xs font-bold truncate">{activeMedia.name}</span>
            <span className="text-slate-400 text-xs font-mono shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)} (-{formatTime(remaining)})
            </span>
          </div>
          <button
            onClick={handlePlayPause}
            className="p-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-full transition"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
          </button>
          <button
            onClick={handleStop}
            className="p-1.5 bg-rose-900 hover:bg-rose-700 text-rose-300 hover:text-white rounded-full transition"
            title="Stop video"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 text-slate-400 hover:text-white transition"
            title="Expand transport bar"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
        </div>
      ) : (
        <div className="h-full flex flex-col justify-between px-4 py-2">
          {/* Top row: video title + interactive timeline scrubber + remaining timecode */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-sky-600/20 border border-sky-500/50 flex items-center justify-center">
                <Film className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-black truncate max-w-[180px]">
                  {activeMedia.name}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider">
                  {isPlaying ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
                      ON AIR VIDEO
                    </span>
                  ) : (
                    <span className="text-amber-400">PAUSED</span>
                  )}
                </div>
              </div>
            </div>

            {/* Scrubber */}
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <span className="text-sky-300 text-xs font-mono font-bold shrink-0 w-11 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 relative flex items-center">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all ${
                      isEndingSoon
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.05}
                  value={currentTime}
                  onMouseDown={handleSeekStart}
                  onTouchStart={handleSeekStart}
                  onChange={handleSeek}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
                />
              </div>
              <span className="text-slate-400 text-xs font-mono shrink-0">
                {formatTime(duration)}
              </span>
              <span
                className={`text-xs font-mono font-black px-2 py-0.5 rounded border shrink-0 ${
                  isEndingSoon
                    ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
                title="Remaining video time"
              >
                -{formatTime(remaining)}
              </span>
            </div>
          </div>

          {/* Bottom row: ProPresenter Transport Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Play / Pause / Restart / Skip / Stop */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePlayPause}
                className={`h-7 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition shadow ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3 h-3" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Play
                  </>
                )}
              </button>

              <button
                onClick={handleRestart}
                className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                title="Restart video from 0:00"
              >
                <RotateCcw className="w-3 h-3" /> 0:00
              </button>

              <button
                onClick={() => skip(-10)}
                className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 transition"
                title="Rewind 10 seconds"
              >
                <SkipBack className="w-3 h-3" /> -10s
              </button>

              <button
                onClick={() => skip(10)}
                className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 transition"
                title="Forward 10 seconds"
              >
                <SkipForward className="w-3 h-3" /> +10s
              </button>

              <button
                onClick={handleStop}
                className="h-7 px-2.5 bg-rose-900/70 hover:bg-rose-700 border border-rose-500/40 text-rose-200 hover:text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition"
                title="Stop video and clear output"
              >
                <Square className="w-2.5 h-2.5 fill-current" /> Stop
              </button>
            </div>

            {/* Center: Loop, Playback Speed, End Behavior */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleLoop}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border transition ${
                  loop || endBehavior === 'loop'
                    ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Loop video continuously"
              >
                <Repeat className="w-3 h-3" /> Loop
              </button>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 h-7">
                <Gauge className="w-3 h-3 text-sky-400" />
                <select
                  value={playbackRate}
                  onChange={e => handleChangeSpeed( parseFloat(e.target.value) )}
                  className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
                  title="Playback speed"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                    <option key={r} value={r} className="bg-[#0b1120]">
                      {r}x
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 h-7">
                <span className="text-[9px] font-bold text-slate-400 uppercase">On End:</span>
                <select
                  value={endBehavior}
                  onChange={e => {
                    const val = e.target.value as any;
                    setEndBehavior(val);
                    const isLooping = val === 'loop';
                    setLoop(isLooping);
                    if (masterVideoRef.current) masterVideoRef.current.loop = isLooping;
                    BroadcastService.postMessage({ type: 'MEDIA_CMD_LOOP', mediaCmd: { loop: isLooping } });
                  }}
                  className="bg-transparent text-[10px] font-bold text-sky-300 outline-none cursor-pointer"
                >
                  <option value="clear" className="bg-[#0b1120]">Stop & Clear</option>
                  <option value="hold" className="bg-[#0b1120]">Hold Final Frame</option>
                  <option value="loop" className="bg-[#0b1120]">Loop Continuously</option>
                  <option value="logo" className="bg-[#0b1120]">Transition to Logo</option>
                </select>
              </div>
            </div>

            {/* Right: Audio Volume & Minimize */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleMuteToggle}
                className="text-slate-400 hover:text-white transition"
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-400" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                className="w-20 accent-sky-500 cursor-pointer h-1"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 text-slate-400 hover:text-white transition"
                title="Minimize transport bar"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
