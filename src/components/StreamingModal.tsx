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
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { AudioMeterRow } from './AudioMeter';
import { useAudioLevels, useAudioSettings } from '../hooks/useAudio';
import { streamStatus } from '../services/streamStatus';
import { audioMonitor, type AudioSource } from '../services/audioMonitor';
import { getActiveScene, useSceneLibrary } from '../scene/store';
import { getSceneAudioTracks } from '../scene/sceneAudio';
import { audioOutputMonitor, loadMonitorSettings, saveMonitorSettings, MonitorSettings } from '../services/audioMonitorOut';
import { getSceneCanvas } from '../services/sceneCanvas';
import type { Slide, Theme } from '../types/presentation';

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
  liveSlide?: Slide | null;
  theme?: Theme;
  countdownSeconds?: number;
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

export const StreamingModal: React.FC<StreamingModalProps> = ({
  isOpen,
  onClose,
  liveSlide = null,
  theme,
  countdownSeconds = 0
}) => {
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
  const [ffmpegStatus, setFfmpegStatus] = useState<'checking' | 'available' | 'missing' | 'desktop'>('checking');
  const [ffmpegInfo, setFfmpegInfo] = useState<{ path?: string | null; version?: string | null; error?: string | null } | null>(null);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [audio, updateAudio] = useAudioSettings();

  const audioLevels = useAudioLevels();
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [lutPath, setLutPath] = useState<string>(() => localStorage.getItem('live_psalms_stream_lut') || '');
  const [encoder, setEncoder] = useState<string>(() => localStorage.getItem('live_psalms_stream_encoder') || 'libx264');
  const [audioDelayMs, setAudioDelayMs] = useState<number>(() => Number(localStorage.getItem('live_psalms_audio_delay_ms') || 0));
  const [monitor, setMonitor] = useState<MonitorSettings>(() => loadMonitorSettings());
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  React.useEffect(() => {
    if (!isOpen) return;
    void audioOutputMonitor.apply(monitor, audio.deviceId);
  }, [isOpen, monitor, audio.deviceId]);
  React.useEffect(() => () => audioOutputMonitor.stop(), []);
  const sceneLibrary = useSceneLibrary();
  const activeScene = getActiveScene(sceneLibrary);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const sceneStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);


  const stopCapture = () => {
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {
        /* already stopped */
      }
      recorderRef.current = null;
    }
    sceneStreamRef.current?.getTracks().forEach(track => track.stop());
    sceneStreamRef.current = null;
    micStreamRef.current?.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;
  };
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ipc = getIpc();

  // Listen to the input only while this dialog is open, so nothing is captured
  // in the background.
  useEffect(() => {
    if (!isOpen) return;
    audioMonitor.retain();
    return () => audioMonitor.release();
  }, [isOpen]);

  // Enumerate audio inputs on open, and follow device hot-plug
  useEffect(() => {
    if (!isOpen || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    const loadDevices = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
          if (cancelled) return;
          setAudioDevices(devices.filter(device => device.kind === 'audioinput'));
          setVideoDevices(devices.filter(device => device.kind === 'videoinput'));
        })
        .catch(() => {});
    };
    loadDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', loadDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.('devicechange', loadDevices);
    };
  }, [isOpen]);

  // Probe the encoder whenever the dialog opens. The main process reports the
  // resolved binary so a stale PATH is visible instead of just "not found".
  useEffect(() => {
    if (!isOpen) return;
    if (!ipc) {
      // Browser preview: there is no main process to spawn ffmpeg from.
      setFfmpegStatus('desktop');
      return;
    }
    setFfmpegStatus('checking');
    ipc
      .invoke('check-ffmpeg')
      .then((info: any) => {
        if (typeof info === 'boolean') {
          setFfmpegStatus(info ? 'available' : 'missing');
          return;
        }
        setFfmpegInfo(info || null);
        setFfmpegStatus(info?.available ? 'available' : 'missing');
      })
      .catch(() => setFfmpegStatus('missing'));
  }, [isOpen, ipc]);

  const locateFfmpeg = async () => {
    if (!ipc) return;
    const result = await ipc.invoke('browse-ffmpeg').catch(() => null);
    if (!result || result.canceled) return;
    setFfmpegInfo(result);
    if (result.available) {
      setFfmpegStatus('available');
      setStreamLog(prev => [...prev, `✅ ffmpeg ready: ${result.path}`]);
    } else {
      setFfmpegStatus('missing');
      setStreamLog(prev => [...prev, `❌ ${result.error || 'That file cannot be used as ffmpeg.'}`]);
    }
  };

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
    const stopLocal = () => {
      setIsStreaming(false);
      setStreamingPlatform(null);
      setStreamStartTime(null);
    };
    const onStreamEnded = () => {
      streamStatus.finish();
      stopLocal();
      setStreamLog(prev => [...prev, '— Stream ended —']);
    };
    const onStreamState = (_event: any, payload: { state?: string; error?: string }) => {
      if (!payload?.state) return;
      if (payload.state === 'live') {
        streamStatus.markLive();
        setIsStreaming(true);
      } else if (payload.state === 'ended') {
        streamStatus.finish();
        stopLocal();
      } else if (payload.state === 'error') {
        streamStatus.finish(payload.error || 'The stream stopped unexpectedly.');
        stopLocal();
        setStreamLog(prev => [...prev, `❌ ${payload.error || 'Stream stopped unexpectedly.'}`]);
      }
    };
    const onStreamStats = (_event: any, stats: Record<string, number>) => {
      if (stats) streamStatus.applyStats(stats);
    };
    ipc.on('stream-log', onStreamLog);
    ipc.on('stream-ended', onStreamEnded);
    ipc.on('stream-state', onStreamState);
    ipc.on('stream-stats', onStreamStats);
    return () => {
      ipc.removeListener('stream-log', onStreamLog);
      ipc.removeListener('stream-ended', onStreamEnded);
      ipc.removeListener('stream-state', onStreamState);
      ipc.removeListener('stream-stats', onStreamStats);
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
    const quality = QUALITY_OPTIONS.find(option => option.value === (key.quality || '1080p')) || QUALITY_OPTIONS[1];
    const rtmpUrl = getRtmpUrl(activePlatform);

    if (!ipc) {
      streamStatus.finish('Streaming needs the desktop app.');
      setStreamLog(['⚠ Streaming requires the Electron desktop app. Use the RTMP URL below with OBS.']);
      return;
    }

    // Prefer the mounted broadcast canvas; a registry reference can outlive a remount.
    const canvas =
      document.querySelector<HTMLCanvasElement>('canvas[data-scene-role="broadcast"]') || getSceneCanvas();
    if (!canvas) {
      setStreamLog(['❌ The scene preview is not ready yet.']);
      return;
    }

    streamStatus.begin(PLATFORMS[activePlatform].name);
    setStreamLog([`▶ Starting stream to ${PLATFORMS[activePlatform].name}...`]);

    try {
      const result = await ipc.invoke('start-stream', {
        rtmpUrl,
        resolution: quality.res,
        fps: quality.fps,
        bitrate: quality.bitrate,
        platform: activePlatform,
        mode: 'scene',
        lut: lutPath,
        encoder,
        audio: {
          source: audio.source,
          device: audioDevices.find(device => device.deviceId === audio.deviceId)?.label || audio.deviceId,
          gain: audio.gain,
          muted: audio.muted,
          delayMs: audioDelayMs
        }
      });

      if (!result.success) {
        streamStatus.finish(result.error || 'Could not start the encoder.');
        setStreamLog(prev => [...prev, `❌ Failed: ${result.error}`]);
        return;
      }

      void audioOutputMonitor.apply(monitor, audio.deviceId);
      const sceneStream = canvas.captureStream(quality.fps);
      sceneStreamRef.current = sceneStream;
      const tracks: MediaStreamTrack[] = [...sceneStream.getVideoTracks()];

      // Audio-input elements in the live scene take precedence over the mic.
      const sceneAudio = getSceneAudioTracks();
      if (sceneAudio.length > 0) {
        tracks.push(...sceneAudio);
      }

      if (audio.source === 'device' && sceneAudio.length === 0) {
        // Never let a permission prompt hold the stream hostage: ask, but start
        // with video even if the microphone has not been granted yet.
        const micRequest = navigator.mediaDevices
          .getUserMedia({ audio: audio.deviceId ? { deviceId: { exact: audio.deviceId } } : true })
          .catch(() => null);
        const mic = await Promise.race([
          micRequest,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2500))
        ]);
        if (mic) {
          micStreamRef.current = mic;
          if (!audio.muted) tracks.push(...mic.getAudioTracks());
        } else {
          micRequest.then(late => late?.getTracks().forEach(track => track.stop())).catch(() => {});
          setStreamLog(prev => [...prev, '⚠ Starting without microphone audio.']);
        }
      }

      const liveTracks = tracks.filter(track => track.readyState === 'live');
      setStreamLog(prev => [
        ...prev,
        `▶ Capture: ${liveTracks.filter(track => track.kind === 'video').length} video, ${liveTracks.filter(track => track.kind === 'audio').length} audio`
      ]);
      const combined = new MediaStream(liveTracks);
      const hasAudio = liveTracks.some(track => track.kind === 'audio');
      const candidates = hasAudio
        ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
        : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
      const mimeType =
        candidates.find(candidate => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) ||
        '';
      const recorder = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: quality.bitrate * 1000,
        ...(hasAudio ? { audioBitsPerSecond: 128000 } : {})
      });
      let sentFirstChunk = false;
      recorder.ondataavailable = async event => {
        if (!event.data || event.data.size === 0) return;
        const bytes = new Uint8Array(await event.data.arrayBuffer());
        ipc.send('stream-data', bytes);
        if (!sentFirstChunk) {
          sentFirstChunk = true;
          setStreamLog(prev => [...prev, `▶ Capturing scene (${mimeType || 'default webm'})`]);
        }
      };
      recorder.onerror = event => {
        const message = (event as unknown as { error?: Error }).error?.message || 'recorder error';
        setStreamLog(prev => [...prev, `❌ ${message}`]);
      };
      recorder.start(250);
      recorderRef.current = recorder;

      setIsStreaming(true);
      setStreamingPlatform(activePlatform);
      setStreamStartTime(new Date());
      setStreamLog(prev => [...prev, '✅ Stream started successfully']);
    } catch (error) {
      stopCapture();
      streamStatus.finish(error instanceof Error ? error.message : 'Could not start streaming.');
      setStreamLog(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'unknown'}`]);
    }
  };
  const stopStream = async () => {
    stopCapture();
    if (ipc) {
      await ipc.invoke('stop-stream').catch(() => {});
    }
    setIsStreaming(false);
    setStreamingPlatform(null);
    setStreamStartTime(null);
    streamStatus.finish();
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
                ffmpegStatus === 'available'
                  ? 'success'
                  : ffmpegStatus === 'missing'
                  ? 'warning'
                  : 'muted'
              }
            >
              {ffmpegStatus === 'checking'
                ? 'Checking'
                : ffmpegStatus === 'available'
                ? 'Ready'
                : ffmpegStatus === 'desktop'
                ? 'Desktop app'
                : 'Not found'}
            </Badge>
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <FieldGroup
            title="Look"
            description="A 3D LUT (.cube) is applied by the encoder, so it lands in the stream feed."
          >
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                {lutPath ? lutPath : 'No LUT — colours pass through unchanged'}
              </span>
              <Button
                size="xs"
                variant="secondary"
                onClick={async () => {
                  const selected = await ipc.invoke('browse-lut');
                  if (selected) {
                    setLutPath(selected);
                    localStorage.setItem('live_psalms_stream_lut', selected);
                  }
                }}
              >
                Choose LUT…
              </Button>
              {lutPath && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setLutPath('');
                    localStorage.removeItem('live_psalms_stream_lut');
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </FieldGroup>
          <FieldGroup
            title="Scene"
            description="Scenes are prepared in the Scenes panel. The stream sends whatever is live."
          >
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs text-foreground">{activeScene?.name || 'No scene'}</div>
                <div className="text-2xs text-muted-foreground">
                  {activeScene
                    ? `${activeScene.elements.length} element${activeScene.elements.length === 1 ? '' : 's'}`
                    : 'Add a scene first'}
                </div>
              </div>
              <Badge variant={isStreaming ? 'live' : 'outline'}>{isStreaming ? 'On air' : 'Ready'}</Badge>
            </div>
          </FieldGroup>
          {/* Encoder status */}
          {ffmpegStatus === 'desktop' && (
            <section className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <h3 className="text-xs font-medium text-foreground">Streaming runs from the desktop app</h3>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                This browser preview can render the interface but cannot start the encoder. Open Live Psalms
                from the desktop app to go live, or copy the RTMP endpoint into OBS.
              </p>
            </section>
          )}

          {ffmpegStatus === 'missing' && (
            <section className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-foreground">ffmpeg was not found</h3>
                <Button variant="secondary" size="xs" onClick={locateFfmpeg}>
                  Locate ffmpeg…
                </Button>
              </div>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                {ffmpegInfo?.error
                  ? ffmpegInfo.error
                  : 'Live Psalms looks on PATH and in the usual install folders. If you just installed it, a packaged app can still hold the PATH it started with — point it at the executable once, or restart the app.'}
              </p>
              {ffmpegInfo?.path && (
                <p className="break-all font-mono text-2xs text-muted-foreground/80">Tried: {ffmpegInfo.path}</p>
              )}
              <div className="space-y-1">
                {[
                  { os: 'Windows', cmd: 'winget install Gyan.FFmpeg' },
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

          {ffmpegStatus === 'available' && ffmpegInfo?.path && (
            <section className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="text-2xs text-muted-foreground">Encoder</span>
              <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground/80" title={ffmpegInfo.path}>
                {ffmpegInfo.path}
              </span>
              <Button variant="ghost" size="xs" onClick={locateFfmpeg} className="shrink-0">
                Change
              </Button>
            </section>
          )}

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

            <div className="space-y-5">
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

              <Field label="Video encoder" hint="Hardware encoders offload the CPU; use the fallback if one fails.">
                <Select
                  value={encoder}
                  onValueChange={value => {
                    setEncoder(value);
                    localStorage.setItem('live_psalms_stream_encoder', value);
                  }}
                >
                  <SelectTrigger aria-label="Video encoder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="libx264">x264 (CPU, safest)</SelectItem>
                    <SelectItem value="h264_nvenc">NVIDIA NVENC</SelectItem>
                    <SelectItem value="h264_qsv">Intel Quick Sync</SelectItem>
                    <SelectItem value="h264_amf">AMD AMF</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          <FieldGroup
            title="Audio"
            description="What the stream sends. The meter shows the level after gain."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <Field label="Source">
                  <Select value={audio.source} onValueChange={value => updateAudio({ source: value as AudioSource })}>
                    <SelectTrigger aria-label="Broadcast audio source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="device">Microphone / line</SelectItem>
                      <SelectItem value="program">Programme audio</SelectItem>
                      <SelectItem value="silent">Silent</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {audio.source === 'device' && (
                  <Field
                    label="Input device"
                    hint={
                      audioDevices.length === 0
                        ? 'Grant microphone access to list inputs.'
                        : 'Device names come from the operating system.'
                    }
                  >
                    <Select
                      value={audio.deviceId || 'default'}
                      onValueChange={value => updateAudio({ deviceId: value === 'default' ? '' : value })}
                    >
                      <SelectTrigger aria-label="Audio input device">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System default</SelectItem>
                        {audioDevices.map(device => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || 'Audio input'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <p className="text-2xs leading-relaxed text-muted-foreground">
                  {audio.source === 'program'
                    ? 'Meters the media player audio. Use a loopback device to send desktop audio to the stream.'
                    : audio.source === 'silent'
                    ? 'The stream carries no audio.'
                    : 'Meters the selected input and sends it to the stream.'}
                </p>
              </div>

              <div className="space-y-3">
                <Field
                  label="Input gain"
                  action={
                    <span className="tabular text-2xs text-muted-foreground">{Math.round(audio.gain * 100)}%</span>
                  }
                >
                  <Slider
                    value={[audio.gain * 100]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) => updateAudio({ gain: value / 100 })}
                    aria-label="Broadcast audio gain"
                  />
                </Field>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label>Mute</Label>
                    <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                      Sends silence while the meter keeps running.
                    </p>
                  </div>
                  <Switch
                    checked={audio.muted}
                    onCheckedChange={muted => updateAudio({ muted })}
                    aria-label="Mute the broadcast audio"
                  />
                </div>

                <Field label="Output level" hint={audioLevels.error}>
                  <AudioMeterRow levels={audioLevels} />
                </Field>

                <Field label="Sync offset" hint="Delays the streamed audio against the video, in milliseconds.">
                  <Input
                    type="number"
                    min={0}
                    max={5000}
                    step={10}
                    value={audioDelayMs}
                    onChange={event => {
                      const value = Math.max(0, Math.min(5000, Number(event.target.value) || 0));
                      setAudioDelayMs(value);
                      localStorage.setItem('live_psalms_audio_delay_ms', String(value));
                    }}
                    className="h-7 w-28 text-2xs"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label>Monitor audio</Label>
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    Plays the selected input on an output device for confidence.
                  </p>
                </div>
                <Switch
                  checked={monitor.enabled}
                  onCheckedChange={enabled => {
                    const next = { ...monitor, enabled };
                    setMonitor(next);
                    saveMonitorSettings(next);
                  }}
                  aria-label="Monitor audio"
                />
              </div>

              {monitor.enabled && (
                <>
                  <Field label="Output device" hint="Where monitoring is played.">
                    <Select
                      value={monitor.outputDeviceId || 'default'}
                      onValueChange={value => {
                        const next = { ...monitor, outputDeviceId: value === 'default' ? '' : value };
                        setMonitor(next);
                        saveMonitorSettings(next);
                      }}
                    >
                      <SelectTrigger className="h-7 text-2xs" aria-label="Monitor output device">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System default</SelectItem>
                        {outputDevices.map(device => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || 'Output'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Monitor volume"
                    action={<span className="tabular text-2xs text-muted-foreground">{Math.round(monitor.volume * 100)}%</span>}
                  >
                    <Slider
                      value={[monitor.volume * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([value]) => {
                        const next = { ...monitor, volume: value / 100 };
                        setMonitor(next);
                        saveMonitorSettings(next);
                      }}
                      aria-label="Monitor volume"
                    />
                  </Field>
                </>
              )}
            </div>
          </FieldGroup>
            </div>
          </div>

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
              : ffmpegStatus === 'desktop'
              ? 'This preview cannot start the encoder. Use the desktop app, or copy the RTMP endpoint for OBS.'
              : 'Install ffmpeg or locate the executable, then try again.'}
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
                  ffmpegStatus !== 'available' ||
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
