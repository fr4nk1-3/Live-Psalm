import React, { useRef, useState } from 'react';
import { EmergencyState, TransitionSettings, TransitionType, MediaAsset } from '../types/presentation';
import { cn } from '../lib/utils';
import { useStreamStatus } from '../hooks/useAudio';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  /** Opens the stream setup dialog from the status cluster. */
  onOpenStreamSettings?: () => void;
}

const TRANSITIONS: TransitionType[] = ['fade', 'cut', 'dissolve', 'slide', 'zoom'];

const BUILTIN_PRESETS = [
  { id: 'service', shortLabel: 'Service', label: 'SERVICE STARTING IN', overtimeLabel: 'SERVICE IN PROGRESS' },
  { id: 'newyear', shortLabel: 'New Year', label: 'NEW YEAR COUNTDOWN', overtimeLabel: 'HAPPY NEW YEAR!' },
  { id: 'worship', shortLabel: 'Worship', label: 'WORSHIP STARTING IN', overtimeLabel: 'WORSHIP IN PROGRESS' },
  { id: 'sermon', shortLabel: 'Sermon', label: 'SERMON STARTING IN', overtimeLabel: 'WORD IN PROGRESS' },
  { id: 'conference', shortLabel: 'Conference', label: 'CONFERENCE SESSION IN', overtimeLabel: 'SESSION IN PROGRESS' },
  { id: 'break', shortLabel: 'Break', label: 'BREAK / INTERMISSION', overtimeLabel: 'RESUMING NOW' },
  { id: 'prayer', shortLabel: 'Prayer', label: 'PRAYER SESSION IN', overtimeLabel: 'PRAYER IN PROGRESS' }
];

const pad = (value: number) => String(value).padStart(2, '0');

const toLocalDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatTime = (secs: number) => {
  const overtime = secs < 0;
  const total = Math.abs(secs);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  let formatted: string;
  if (d > 0) formatted = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  else if (h > 0) formatted = `${h}:${pad(m)}:${pad(s)}`;
  else formatted = `${pad(m)}:${pad(s)}`;
  return overtime ? `+${formatted}` : formatted;
};

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
  mediaList = [],
  onOpenStreamSettings
}) => {
  const [localCountUp, setLocalCountUp] = useState(false);
  const countUp = countUpProp !== undefined ? countUpProp : localCountUp;

  const toggleCountUp = () => {
    const next = !countUp;
    setLocalCountUp(next);
    onToggleCountUp?.(next);
  };

  const [customPresets, setCustomPresets] = useState<{ id: string; label: string; overtimeLabel: string }[]>(() => {
    try {
      const raw = localStorage.getItem('live_psalms_countdown_presets_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [targetDateTimeInput, setTargetDateTimeInput] = useState<string>(() => {
    const date = new Date();
    date.setHours(24, 0, 0, 0);
    return toLocalDateTime(date);
  });

  const saveCustomPreset = () => {
    const trimmed = countdownTitle.trim();
    if (!trimmed) return;
    const next = [
      ...customPresets.filter(p => p.label.toLowerCase() !== trimmed.toLowerCase()),
      { id: `custom-${Date.now()}`, label: trimmed, overtimeLabel: countdownOvertimeTitle.trim() || 'IN PROGRESS' }
    ];
    setCustomPresets(next);
    try {
      localStorage.setItem('live_psalms_countdown_presets_v1', JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const deleteCustomPreset = (id: string) => {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    try {
      localStorage.setItem('live_psalms_countdown_presets_v1', JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const [editHours, setEditHours] = useState('0');
  const [editMins, setEditMins] = useState('05');
  const [editSecs, setEditSecs] = useState('00');
  const [isEditing, setIsEditing] = useState(false);
  const hoursRef = useRef<HTMLInputElement>(null);

  const stream = useStreamStatus();
  const streamLive = stream.state === 'live';
  const streamLabel =
    stream.state === 'live'
      ? stream.platform
        ? `Live · ${stream.platform}`
        : 'Live'
      : stream.state === 'connecting'
      ? 'Connecting'
      : stream.state === 'error'
      ? 'Stream error'
      : stream.state === 'ended'
      ? 'Stream ended'
      : 'Stream offline';

  const streamUptime = (() => {
    const seconds =
      typeof stream.stats.timeSeconds === 'number'
        ? stream.stats.timeSeconds
        : stream.startedAt
        ? Math.max(0, (Date.now() - stream.startedAt) / 1000)
        : 0;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  const streamBitrate =
    typeof stream.stats.bitrateKbps === 'number'
      ? stream.stats.bitrateKbps >= 1000
        ? `${(stream.stats.bitrateKbps / 1000).toFixed(1)} Mbps`
        : `${Math.round(stream.stats.bitrateKbps)} kbps`
      : null;

  const streamFrames =
    typeof stream.stats.frames === 'number' ? stream.stats.frames.toLocaleString() : null;

  React.useEffect(() => {
    if (isCountdownRunning) setIsEditing(false);
  }, [isCountdownRunning]);

  const startFromInputs = () => {
    const total = (parseInt(editHours) || 0) * 3600 + (parseInt(editMins) || 0) * 60 + (parseInt(editSecs) || 0);
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

  const startEditing = () => {
    if (!isCountdownRunning) {
      setIsEditing(true);
      setTimeout(() => hoursRef.current?.focus(), 50);
    }
  };

  const isOvertime = isCountdownRunning && countdownSeconds < 0;
  const isWarning = isCountdownRunning && countdownSeconds >= 0 && countdownSeconds <= 180;
  const isRunning = isCountdownRunning;

  return (
    <footer className="z-30 flex h-14 shrink-0 items-center gap-3 border-t border-border bg-card px-3">
      {/* Transport */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={onPrevSlide} title="Previous slide (↑)">
          Previous
        </Button>
        <Button variant="live" size="sm" onClick={onGoLiveCurrent} className="px-4" title="Take the preview slide live (Enter)">
          Go live
        </Button>
        <Button variant="secondary" size="sm" onClick={onNextSlide} title="Next slide (↓)">
          Next
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Transition */}
      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        <span className="field-label">Transition</span>
        <Select
          value={transition.type}
          onValueChange={value => onChangeTransition({ type: value as TransitionType })}
        >
          <SelectTrigger className="h-7 w-[104px] text-xs capitalize" aria-label="Transition type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSITIONS.map(type => (
              <SelectItem key={type} value={type} className="capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stream telemetry */}
      <button
        type="button"
        onClick={onOpenStreamSettings}
        disabled={!onOpenStreamSettings}
        title="Broadcast status. Click to open stream setup."
        className="hidden shrink-0 items-center gap-2 rounded-md border border-border bg-background/50 px-2 py-1 text-2xs transition-colors hover:bg-accent/60 disabled:pointer-events-none lg:flex"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            streamLive ? 'bg-live' : stream.state === 'error' ? 'bg-warning' : 'bg-muted-foreground/40'
          )}
          aria-hidden
        />
        <span className={cn('whitespace-nowrap', streamLive ? 'text-live' : 'text-muted-foreground')}>{streamLabel}</span>

        {streamLive && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>·</span>
            <span className="tabular hidden font-mono text-muted-foreground 2xl:inline">{streamUptime}</span>
            <span className="text-muted-foreground/40" aria-hidden>·</span>
            <span className="tabular font-mono text-foreground/80">{streamBitrate ?? '—'}</span>
            <span className="hidden text-muted-foreground/40 2xl:inline" aria-hidden>·</span>
            <span className="tabular hidden font-mono text-muted-foreground 2xl:inline">
              {stream.stats.fps ? `${Math.round(stream.stats.fps)} fps` : '—'}
            </span>
            <span className="text-muted-foreground/40" aria-hidden>·</span>
            <span className="tabular font-mono text-muted-foreground">
              {streamFrames ? `${streamFrames} frames` : '—'}
            </span>
          </>
        )}

        {stream.state === 'connecting' && (
          <span className="text-muted-foreground">waiting for encoder</span>
        )}
        {stream.state === 'error' && stream.error && (
          <span className="max-w-[200px] truncate text-warning">{stream.error}</span>
        )}
      </button>

      <div className="flex-1" />

      {/* Timer */}
      <div
        className={cn(
          'flex h-9 shrink-0 items-center gap-2 rounded-md border px-2 transition-colors',
          isOvertime || isWarning
            ? 'border-live/40 bg-live/10'
            : isRunning
            ? 'border-success/30 bg-success/5'
            : 'border-border bg-background/50'
        )}
      >
        <button
          type="button"
          onClick={toggleCountUp}
          title={countUp ? 'Counting up — click to count down' : 'Counting down — click to count up'}
          className="w-6 shrink-0 text-center text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {countUp ? '↑' : '↓'}
        </button>

        {isEditing && !isRunning ? (
          <div className="flex items-center gap-0.5">
            <TimeInput ref={hoursRef} value={editHours} onChange={setEditHours} max={23} onEnter={startFromInputs} label="Hours" />
            <span className="text-muted-foreground">:</span>
            <TimeInput value={editMins} onChange={setEditMins} max={59} onEnter={startFromInputs} label="Minutes" />
            <span className="text-muted-foreground">:</span>
            <TimeInput value={editSecs} onChange={setEditSecs} max={59} onEnter={startFromInputs} label="Seconds" />
            <Button size="xs" className="ml-1" onClick={startFromInputs}>
              Start
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className={cn(
              'tabular min-w-[62px] px-0.5 text-center font-mono text-[15px] leading-none tracking-tight transition-opacity hover:opacity-70',
              isOvertime || isWarning ? 'text-live' : isRunning ? 'text-foreground' : 'text-foreground/80'
            )}
            title={isOvertime ? `Overtime ${formatTime(countdownSeconds)}` : 'Click to set a countdown'}
          >
            {formatTime(countdownSeconds)}
          </button>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1">
            {isRunning ? (
              <>
                <Button size="xs" variant="secondary" onClick={() => (onPauseCountdown ? onPauseCountdown() : onStopCountdown())}>
                  Pause
                </Button>
                <Button size="xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onStopCountdown}>
                  Stop
                </Button>
              </>
            ) : (
              <>
                {countdownSeconds !== 0 ? (
                  <>
                    <Button size="xs" variant="secondary" onClick={() => onStartCountdown(countdownSeconds)}>
                      Resume
                    </Button>
                    <Button size="xs" variant="ghost" onClick={handleReset}>
                      Reset
                    </Button>
                  </>
                ) : (
                  [1, 5, 10].map(min => (
                    <Button
                      key={min}
                      size="xs"
                      variant="ghost"
                      className="tabular px-1.5 text-muted-foreground"
                      onClick={() => {
                        setEditHours('0');
                        setEditMins(String(min));
                        setEditSecs('00');
                        onStartCountdown(min * 60);
                      }}
                      title={`Start a ${min}-minute countdown`}
                    >
                      {min}m
                    </Button>
                  ))
                )}
              </>
            )}
          </div>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button size="xs" variant="ghost" className="shrink-0 px-1.5 text-muted-foreground">
              Options
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-[360px] p-0">
            <div className="max-h-[68vh] space-y-4 overflow-y-auto p-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Count direction</Label>
                    <p className="mt-0.5 text-2xs text-muted-foreground">Count up for elapsed service time.</p>
                  </div>
                  <div className="flex rounded-md border border-border bg-background/60 p-0.5">
                    {[
                      { value: false, label: 'Down' },
                      { value: true, label: 'Up' }
                    ].map(option => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          if (countUp !== option.value) toggleCountUp();
                        }}
                        className={cn(
                          'h-6 rounded-sm px-2 text-2xs font-medium transition-colors',
                          countUp === option.value
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="full-slide-timer">Full-slide timer</Label>
                    <p className="mt-0.5 text-2xs text-muted-foreground">Fill the screen with the timer.</p>
                  </div>
                  <Switch
                    id="full-slide-timer"
                    checked={isFullSlideCountdown}
                    onCheckedChange={checked => onToggleFullSlideCountdown?.(checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="countdown-heading">Heading</Label>
                <Input
                  id="countdown-heading"
                  value={countdownTitle}
                  onChange={e => onChangeCountdownLabels?.(e.target.value, countdownOvertimeTitle)}
                  placeholder="SERVICE STARTING IN"
                />
                <Label htmlFor="countdown-overtime">When it reaches zero</Label>
                <Input
                  id="countdown-overtime"
                  value={countdownOvertimeTitle}
                  onChange={e => onChangeCountdownLabels?.(countdownTitle, e.target.value)}
                  placeholder="HAPPY NEW YEAR!"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {BUILTIN_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onChangeCountdownLabels?.(preset.label, preset.overtimeLabel)}
                      className={cn(
                        'h-6 rounded-sm border px-1.5 text-2xs transition-colors',
                        countdownTitle === preset.label
                          ? 'border-border bg-accent text-accent-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      {preset.shortLabel}
                    </button>
                  ))}
                  {customPresets.map(preset => (
                    <span
                      key={preset.id}
                      className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-2xs',
                        countdownTitle === preset.label
                          ? 'border-border bg-accent text-accent-foreground'
                          : 'border-transparent text-muted-foreground'
                      )}
                    >
                      <button type="button" onClick={() => onChangeCountdownLabels?.(preset.label, preset.overtimeLabel)}>
                        {preset.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomPreset(preset.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${preset.label}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={saveCustomPreset}
                    className="h-6 rounded-sm border border-dashed border-border px-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
                    title="Save the current heading as a preset"
                  >
                    Save preset
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Clock target</Label>
                  {countdownTargetTimestamp && (
                    <button
                      type="button"
                      onClick={() => onClearClockCountdown?.()}
                      className="text-2xs text-destructive hover:underline"
                    >
                      Unlink
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="datetime-local"
                    value={targetDateTimeInput}
                    onChange={e => setTargetDateTimeInput(e.target.value)}
                    className="h-7 text-xs"
                    aria-label="Countdown target date and time"
                  />
                  <Button
                    size="xs"
                    onClick={() => {
                      const ms = new Date(targetDateTimeInput).getTime();
                      if (!Number.isNaN(ms)) onStartClockCountdown?.(ms);
                    }}
                  >
                    Start
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    {
                      label: 'Midnight',
                      get: () => {
                        const date = new Date();
                        date.setHours(24, 0, 0, 0);
                        return date;
                      }
                    },
                    {
                      label: 'New Year',
                      get: () => new Date(new Date().getFullYear() + 1, 0, 1, 0, 0, 0, 0)
                    },
                    {
                      label: 'Next hour',
                      get: () => {
                        const date = new Date();
                        date.setHours(date.getHours() + 1, 0, 0, 0);
                        return date;
                      }
                    }
                  ].map(shortcut => (
                    <Button
                      key={shortcut.label}
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        const date = shortcut.get();
                        setTargetDateTimeInput(toLocalDateTime(date));
                        onStartClockCountdown?.(date.getTime());
                      }}
                    >
                      {shortcut.label}
                    </Button>
                  ))}
                </div>
                {countdownTargetTimestamp && (
                  <p className="text-2xs text-muted-foreground">
                    Linked to {new Date(countdownTargetTimestamp).toLocaleString()}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Shown on</Label>
                <Select
                  value={countdownTargetScreen}
                  onValueChange={value => onChangeCountdownTargetScreen?.(value as 'audience' | 'stage' | 'both')}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Audience and stage</SelectItem>
                    <SelectItem value="audience">Audience screen</SelectItem>
                    <SelectItem value="stage">Stage display</SelectItem>
                  </SelectContent>
                </Select>

                <Label>When the timer ends</Label>
                <Select
                  value={countdownEndAction}
                  onValueChange={value => {
                    const next = value as 'none' | 'play_video' | 'start_playlist' | 'go_live_active';
                    onChangeCountdownEndAction?.(next);
                    if (next === 'play_video' && !countdownEndVideoId) {
                      const first = mediaList.find(m => m.type === 'video');
                      if (first && onChangeCountdownEndVideoId) onChangeCountdownEndVideoId(first.id);
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Continue into overtime</SelectItem>
                    <SelectItem value="play_video">Play a video</SelectItem>
                    <SelectItem value="start_playlist">Start the service</SelectItem>
                    <SelectItem value="go_live_active">Take the selected slide live</SelectItem>
                  </SelectContent>
                </Select>

                {countdownEndAction === 'play_video' && (
                  <Select
                    value={countdownEndVideoId}
                    onValueChange={value => onChangeCountdownEndVideoId?.(value)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Choose a video" />
                    </SelectTrigger>
                    <SelectContent>
                      {mediaList.filter(m => m.type === 'video').length === 0 && (
                        <SelectItem value="__none__" disabled>
                          No videos in the library
                        </SelectItem>
                      )}
                      {mediaList
                        .filter(m => m.type === 'video')
                        .map(asset => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Screen overrides */}
      <div className="flex shrink-0 items-center gap-1">
        <span className="field-label hidden xl:inline">Screen</span>
        {(
          [
            { key: 'isBlack', label: 'Black', destructive: true, hint: 'Black out the screen (B)' },
            { key: 'isClear', label: 'Clear', destructive: false, hint: 'Clear the slide text (Esc)' },
            { key: 'isLogo', label: 'Logo', destructive: false, hint: 'Show the church logo (L)' },
            { key: 'isFreeze', label: 'Freeze', destructive: false, hint: 'Hold the current frame (F)' }
          ] as const
        ).map(action => {
          const active = Boolean(emergency[action.key]);
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => onToggleEmergency(action.key)}
              title={action.hint}
              aria-pressed={active}
              className={cn(
                'h-7 rounded-md px-2 text-2xs font-medium transition-colors',
                active
                  ? action.destructive
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </footer>
  );
};

const TimeInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    max: number;
    label: string;
    onEnter: () => void;
  }
>(({ value, onChange, max, label, onEnter }, ref) => (
  <input
    ref={ref}
    type="number"
    min={0}
    max={max}
    value={value}
    aria-label={label}
    onChange={e => onChange(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter') onEnter();
    }}
    className="tabular h-7 w-8 rounded-sm border border-input bg-background px-0 text-center font-mono text-xs text-foreground outline-none focus:border-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
  />
));
TimeInput.displayName = 'TimeInput';
