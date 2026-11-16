/**
 * StreamingModal — Live stream to YouTube, Twitch, or Facebook Live.
 * Uses Electron's main process to spawn ffmpeg, capturing the audience
 * output window via desktopCapturer and pushing to the RTMP endpoint.
 * Falls back gracefully if ffmpeg is not installed, showing setup instructions.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, FieldGroup } from './ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ListHeader } from './ui/primitives';

// Platform configurations
const PLATFORMS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube Live',
    rtmpBase: 'rtmp://a.rtmp.youtube.com/live2',
    keyPlaceholder: 'xxxx-xxxx-xxxx-xxxx-xxxx',
    keyHelp: 'YouTube Studio → Go Live → Stream key',
    docsUrl: 'https://support.google.com/youtube/answer/2907883',
    quality: '1080p' as const,
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    rtmpBase: 'rtmp://live.twitch.tv/live',
    keyPlaceholder: 'live_xxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelp: 'Twitch Dashboard → Settings → Stream → Primary stream key',
    docsUrl: 'https://dashboard.twitch.tv/u/YOUR_USERNAME/settings/stream',
    quality: '720p60' as const,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Live',
    rtmpBase: 'rtmps://live-api-s.facebook.com:443/rtmp',
    keyPlaceholder: 'FB-xxxxxxxxxxxxxxxxxxxx-x-xxxxxxxxxx',
    keyHelp: 'Facebook → Create a live video → Use stream key',
    docsUrl: 'https://www.facebook.com/live/producer',
    quality: '720p' as const,
  },
} as const;

type PlatformId = keyof typeof PLATFORMS;

const QUALITY_OPTIONS = [
  { label: '1080p 60fps', value: '1080p60', bitrate: 6000, res: '1920x1080', fps: 60 },
  { label: '1080p 30fps', value: '1080p', bitrate: 4500, res: '1920x1080', fps: 30 },
  { label: '720p 60fps', value: '720p60', bitrate: 3500, res: '1280x720', fps: 60 },
  { label: '720p 30fps', value: '720p', bitrate: 2500, res: '1280x720', fps: 30 },
  { label: '480p 30fps', value: '480p', bitrate: 1500, res: '854x480', fps: 30 },
];

interface StreamKey {
  key: string;
  customRtmp: string;
  quality: string;
}

interface StreamingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getIpc() {
  try {
    if ((window as any).require) {
      return (window as any).require('electron').ipcRenderer;
    }
  } catch (e) {}
  return null;
}

/** Log lines carry their own level marker; colour is state, never decoration. */
function logLineClass(line: string): string {
  if (line.startsWith('✅')) return 'text-success';
  if (line.startsWith('❌')) return 'text-destructive';
  if (line.startsWith('⚠')) return 'text-warning';
  if (line.startsWith('▶')) return 'text-foreground';
  return 'text-muted-foreground';
}

export const StreamingModal: React.FC<StreamingModalProps> = ({ isOpen, onClose }) => {
  const [activePlatform, setActivePlatform] = useState<PlatformId>('youtube');
  const [streamKeys, setStreamKeys] = useState<Record<PlatformId, StreamKey>>(() => {
    try {
      return JSON.parse(localStorage.getItem('live_psalms_stream_keys_v1') || '{}');
    } catch { return {} as any; }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPlatform, setStreamingPlatform] = useState<PlatformId | null>(null);
  const [streamStartTime, setStreamStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [ffmpegStatus, setFfmpegStatus] = useState<'checking' | 'available' | 'missing'>('checking');
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ipc = getIpc();

  // Check ffmpeg availability on open
  useEffect(() => {
    if (!isOpen) return;
    setFfmpegStatus('checking');
    if (ipc) {
      ipc.invoke('check-ffmpeg').then((ok: boolean) => {
        setFfmpegStatus(ok ? 'available' : 'missing');
      }).catch(() => setFfmpegStatus('missing'));
    } else {
      // Browser preview — treat as unavailable
      setFfmpegStatus('missing');
    }
  }, [isOpen]);

  // Elapsed timer
  useEffect(() => {
    if (isStreaming && streamStartTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - streamStartTime.getTime()) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setElapsed(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed('00:00:00');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStreaming, streamStartTime]);

  // Listen for stream status from main process
  useEffect(() => {
    if (!ipc) return;
    const onStreamLog = (_event: any, msg: string) => {
      setStreamLog(prev => [...prev.slice(-50), msg]);
    };
    const onStreamEnded = () => {
      setIsStreaming(false);
      setStreamingPlatform(null);
      setStreamStartTime(null);
      setStreamLog(prev => [...prev, '— Stream ended —']);
    };
    ipc.on('stream-log', onStreamLog);
    ipc.on('stream-ended', onStreamEnded);
    return () => {
      ipc.removeListener('stream-log', onStreamLog);
      ipc.removeListener('stream-ended', onStreamEnded);
    };
  }, [ipc]);

  const saveKeys = (updated: Record<PlatformId, StreamKey>) => {
    setStreamKeys(updated);
    localStorage.setItem('live_psalms_stream_keys_v1', JSON.stringify(updated));
  };

  const updateKey = (platform: PlatformId, field: keyof StreamKey, value: string) => {
    const updated = {
      ...streamKeys,
      [platform]: { ...(streamKeys[platform] || { key: '', customRtmp: '', quality: '1080p' }), [field]: value }
    };
    saveKeys(updated as Record<PlatformId, StreamKey>);
  };

  const getKey = (platform: PlatformId): StreamKey =>
    streamKeys[platform] || { key: '', customRtmp: '', quality: '1080p' };

  const getRtmpUrl = (platform: PlatformId): string => {
    const p = PLATFORMS[platform];
    const k = getKey(platform);
    if (k.customRtmp) return `${k.customRtmp}/${k.key}`;
    return `${p.rtmpBase}/${k.key}`;
  };

  const startStream = async () => {
    const key = getKey(activePlatform);
    if (!key.key.trim()) {
      setStreamLog(['❌ Please enter a stream key first.']);
      return;
    }
    const q = QUALITY_OPTIONS.find(q => q.value === (key.quality || '1080p')) || QUALITY_OPTIONS[1];
    const rtmpUrl = getRtmpUrl(activePlatform);

    setStreamLog([`▶ Starting stream to ${PLATFORMS[activePlatform].name}...`]);

    if (ipc) {
      try {
        const result = await ipc.invoke('start-stream', {
          rtmpUrl,
          resolution: q.res,
          fps: q.fps,
          bitrate: q.bitrate,
          platform: activePlatform
        });
        if (result.success) {
          setIsStreaming(true);
          setStreamingPlatform(activePlatform);
          setStreamStartTime(new Date());
          setStreamLog(prev => [...prev, '✅ Stream started successfully']);
        } else {
          setStreamLog(prev => [...prev, `❌ Failed: ${result.error}`]);
        }
      } catch (e: any) {
        setStreamLog(prev => [...prev, `❌ Error: ${e.message}`]);
      }
    } else {
      setStreamLog(['⚠ Streaming requires the Electron desktop app. Use the RTMP URL below with OBS.']);
    }
  };

  const stopStream = async () => {
    if (ipc) {
      await ipc.invoke('stop-stream').catch(() => {});
    }
    setIsStreaming(false);
    setStreamingPlatform(null);
    setStreamStartTime(null);
    setStreamLog(prev => [...prev, '⏹ Stream stopped by operator.']);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (!isOpen) return null;

  const platform = PLATFORMS[activePlatform];
  const keyConfig = getKey(activePlatform);
  const rtmpUrl = getRtmpUrl(activePlatform);
  const qualityObj = QUALITY_OPTIONS.find(q => q.value === (keyConfig.quality || '1080p')) || QUALITY_OPTIONS[1];
  const keyVisible = Boolean(showKey[activePlatform]);

  return (
    <Dialog open={isOpen} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(88vh,40rem)] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Streaming</DialogTitle>
          <DialogDescription>Send the audience output to a live platform over RTMP.</DialogDescription>
        </DialogHeader>

        {/* Connection status */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-2">
          <Badge variant={isStreaming ? 'live' : 'outline'}>{isStreaming ? 'Live' : 'Idle'}</Badge>
          {isStreaming && streamingPlatform ? (
            <>
              <span className="text-2xs text-muted-foreground">{PLATFORMS[streamingPlatform].name}</span>
              <span className="tabular font-mono text-2xs text-muted-foreground">{elapsed}</span>
            </>
          ) : (
            <span className="text-2xs text-muted-foreground">No stream is running.</span>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-2xs text-muted-foreground">ffmpeg</span>
            <Badge
              variant={
                ffmpegStatus === 'available' ? 'success' : ffmpegStatus === 'missing' ? 'warning' : 'muted'
              }
            >
              {ffmpegStatus === 'checking' ? 'Checking' : ffmpegStatus === 'available' ? 'Ready' : 'Not found'}
            </Badge>
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Destination */}
            <FieldGroup title="Destination" description={platform.keyHelp}>
              <Tabs value={activePlatform} onValueChange={value => setActivePlatform(value as PlatformId)}>
                <TabsList className="w-full">
                  {(Object.keys(PLATFORMS) as PlatformId[]).map(pid => (
                    <TabsTrigger key={pid} value={pid}>
                      {PLATFORMS[pid].name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <Field
                label="Stream key"
                htmlFor="stream-key"
                action={
                  <span className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setShowKey(prev => ({ ...prev, [activePlatform]: !prev[activePlatform] }))
                      }
                    >
                      {keyVisible ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => copyToClipboard(keyConfig.key, `key-${activePlatform}`)}
                    >
                      {copied === `key-${activePlatform}` ? 'Copied' : 'Copy'}
                    </Button>
                  </span>
                }
              >
                <Input
                  id="stream-key"
                  type={keyVisible ? 'text' : 'password'}
                  value={keyConfig.key}
                  onChange={e => updateKey(activePlatform, 'key', e.target.value)}
                  placeholder={platform.keyPlaceholder}
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </Field>

              <Field
                label="RTMP endpoint"
                action={
                  <Button variant="ghost" size="xs" onClick={() => copyToClipboard(rtmpUrl, 'rtmp')}>
                    {copied === 'rtmp' ? 'Copied' : 'Copy'}
                  </Button>
                }
                hint="Read-only. The stream key is appended to this address."
              >
                <div className="break-all rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">
                  {rtmpUrl}
                </div>
              </Field>

              <Field
                label="Custom server"
                htmlFor="stream-custom-rtmp"
                hint={`Leave blank to use the ${platform.name} default.`}
              >
                <Input
                  id="stream-custom-rtmp"
                  type="text"
                  value={keyConfig.customRtmp}
                  onChange={e => updateKey(activePlatform, 'customRtmp', e.target.value)}
                  placeholder="rtmp://your-server/live"
                  className="font-mono text-xs"
                />
              </Field>

              <Button variant="ghost" size="xs" asChild className="w-fit px-0">
                <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer">
                  Where to find the stream key
                </a>
              </Button>
            </FieldGroup>

            {/* Encoding */}
            <FieldGroup title="Encoding">
              <Field label="Quality" hint="Higher presets need more upload bandwidth.">
                <Select
                  value={keyConfig.quality || '1080p'}
                  onValueChange={value => updateKey(activePlatform, 'quality', value)}
                >
                  <SelectTrigger aria-label="Stream quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map(q => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Output" hint="Captured from the audience output window.">
                <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">
                  {qualityObj.res} · {qualityObj.fps} fps · {qualityObj.bitrate} kbps
                </div>
              </Field>
            </FieldGroup>
          </div>

          {/* ffmpeg missing instructions */}
          {ffmpegStatus === 'missing' && (
            <section className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <h3 className="text-xs font-medium text-foreground">ffmpeg is not installed</h3>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                Install ffmpeg to stream from the app, then restart Live Psalms. Until then, copy the
                RTMP endpoint into OBS.
              </p>
              <div className="space-y-1">
                {[
                  { os: 'Windows', cmd: 'winget install ffmpeg' },
                  { os: 'macOS', cmd: 'brew install ffmpeg' },
                  { os: 'Ubuntu/Debian', cmd: 'sudo apt install ffmpeg' },
                ].map(({ os, cmd }) => (
                  <div key={os} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-2xs text-muted-foreground">{os}</span>
                    <code className="min-w-0 flex-1 truncate rounded-sm border border-border bg-background px-2 py-1 font-mono text-2xs text-foreground">
                      {cmd}
                    </code>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => copyToClipboard(cmd, `cmd-${os}`)}
                      className="shrink-0"
                    >
                      {copied === `cmd-${os}` ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stream log */}
          {streamLog.length > 0 && (
            <section className="space-y-2">
              <ListHeader>Log</ListHeader>
              <div className="h-28 overflow-y-auto rounded-md border border-border bg-background p-2 font-mono text-2xs">
                {streamLog.map((line, i) => (
                  <div key={i} className={logLineClass(line)}>
                    {line}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="justify-between gap-4">
          <p className="max-w-sm text-2xs leading-relaxed text-muted-foreground">
            {ffmpegStatus === 'available'
              ? 'Captures the audience output window. Open it before you go live.'
              : 'Install ffmpeg to stream from the app, or copy the RTMP endpoint for OBS.'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {isStreaming && streamingPlatform === activePlatform ? (
              <Button variant="secondary" size="sm" onClick={stopStream}>
                Stop stream
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={startStream}
                disabled={
                  !keyConfig.key.trim() ||
                  ffmpegStatus === 'missing' ||
                  (isStreaming && streamingPlatform !== activePlatform)
                }
              >
                Go live
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
