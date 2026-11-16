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
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
      className={cn(
        'z-30 shrink-0 select-none overflow-hidden border-t border-border bg-card transition-[height] duration-200',
        isMinimized ? 'h-10' : 'h-[72px]'
      )}
    >
      {/* Hidden master timekeeper so seek, duration and end behaviour work without the output windows open. */}
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
        <div className="flex h-10 items-center gap-3 px-3">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{activeMedia.name}</span>
          <span className="tabular shrink-0 font-mono text-2xs text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)} (-{formatTime(remaining)})
          </span>
          <Button size="xs" variant="secondary" onClick={handlePlayPause}>
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleStop}
          >
            Stop
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setIsMinimized(false)}>
            Expand
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-between px-3 py-1.5">
          {/* Timeline */}
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 shrink-0 items-baseline gap-2">
              <span className="max-w-[200px] truncate text-xs font-medium text-foreground">{activeMedia.name}</span>
              <span
                className={cn(
                  'state-label shrink-0',
                  isPlaying ? 'text-live' : 'text-muted-foreground'
                )}
              >
                {isPlaying ? 'On air' : 'Paused'}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="tabular w-11 shrink-0 text-right font-mono text-2xs text-muted-foreground">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex flex-1 items-center">
                <div className="h-1 w-full overflow-hidden rounded-full bg-input">
                  <div
                    className={cn('h-full rounded-full transition-[width]', isEndingSoon ? 'bg-warning' : 'bg-foreground/70')}
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
                  aria-label="Video position"
                  className="absolute inset-0 h-5 w-full cursor-pointer opacity-0"
                />
              </div>
              <span className="tabular shrink-0 font-mono text-2xs text-muted-foreground">{formatTime(duration)}</span>
              <span
                className={cn('tabular shrink-0 font-mono text-2xs', isEndingSoon ? 'text-warning' : 'text-muted-foreground')}
                title="Remaining video time"
              >
                -{formatTime(remaining)}
              </span>
            </div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button size="xs" variant={isPlaying ? 'secondary' : 'default'} onClick={handlePlayPause}>
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button size="xs" variant="ghost" onClick={handleRestart} title="Restart from 0:00">
                Restart
              </Button>
              <Button size="xs" variant="ghost" onClick={() => skip(-10)} title="Rewind 10 seconds">
                -10s
              </Button>
              <Button size="xs" variant="ghost" onClick={() => skip(10)} title="Forward 10 seconds">
                +10s
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleStop}
                title="Stop video and clear the output"
              >
                Stop
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant={loop || endBehavior === 'loop' ? 'secondary' : 'ghost'}
                onClick={handleToggleLoop}
                title="Loop the video continuously"
              >
                Loop
              </Button>
              <span className="field-label">Speed</span>
              <Select value={String(playbackRate)} onValueChange={value => handleChangeSpeed(parseFloat(value))}>
                <SelectTrigger className="h-7 w-[68px] text-2xs" aria-label="Playback speed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <SelectItem key={rate} value={String(rate)}>
                      {rate}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="field-label">At the end</span>
              <Select
                value={endBehavior}
                onValueChange={value => {
                  const val = value as typeof endBehavior;
                  setEndBehavior(val);
                  const isLooping = val === 'loop';
                  setLoop(isLooping);
                  if (masterVideoRef.current) masterVideoRef.current.loop = isLooping;
                  BroadcastService.postMessage({ type: 'MEDIA_CMD_LOOP', mediaCmd: { loop: isLooping } });
                }}
              >
                <SelectTrigger className="h-7 w-[130px] text-2xs" aria-label="What happens when the video ends">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Stop and clear</SelectItem>
                  <SelectItem value="hold">Hold the last frame</SelectItem>
                  <SelectItem value="loop">Loop continuously</SelectItem>
                  <SelectItem value="logo">Go to the logo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMuteToggle}
                className="text-2xs text-muted-foreground transition-colors hover:text-foreground"
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                aria-label="Volume"
                title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                className="h-1 w-20 cursor-pointer accent-foreground"
              />
              <Button size="xs" variant="ghost" onClick={() => setIsMinimized(true)}>
                Minimize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
