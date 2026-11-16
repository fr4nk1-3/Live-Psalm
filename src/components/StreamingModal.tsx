/**
 * StreamingModal — Live stream to YouTube, Twitch, or Facebook Live.
 * Uses Electron's main process to spawn ffmpeg, capturing the audience
 * output window via desktopCapturer and pushing to the RTMP endpoint.
 * Falls back gracefully if ffmpeg is not installed, showing setup instructions.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Radio, Youtube, Twitch, Facebook, Square,
  CheckCircle2, AlertTriangle, Copy, ExternalLink,
  Eye, EyeOff, RefreshCw, Video, Mic, Volume2
} from 'lucide-react';

// Platform configurations
const PLATFORMS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube Live',
    icon: Youtube,
    color: '#ff0000',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-950/30 border-red-700/50',
    activeClass: 'bg-red-600',
    rtmpBase: 'rtmp://a.rtmp.youtube.com/live2',
    keyPlaceholder: 'xxxx-xxxx-xxxx-xxxx-xxxx',
    keyHelp: 'Go to YouTube Studio → Go Live → Stream Key',
    docsUrl: 'https://support.google.com/youtube/answer/2907883',
    quality: '1080p' as const,
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    icon: Twitch,
    color: '#9146ff',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-950/30 border-purple-700/50',
    activeClass: 'bg-purple-600',
    rtmpBase: 'rtmp://live.twitch.tv/live',
    keyPlaceholder: 'live_xxxxxxxxxxxxxxxxxxxxxxxxxx',
    keyHelp: 'Twitch Dashboard → Settings → Stream → Primary Stream Key',
    docsUrl: 'https://dashboard.twitch.tv/u/YOUR_USERNAME/settings/stream',
    quality: '720p60' as const,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Live',
    icon: Facebook,
    color: '#1877f2',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-950/30 border-blue-700/50',
    activeClass: 'bg-blue-600',
    rtmpBase: 'rtmps://live-api-s.facebook.com:443/rtmp',
    keyPlaceholder: 'FB-xxxxxxxxxxxxxxxxxxxx-x-xxxxxxxxxx',
    keyHelp: 'Facebook → Create a live video → Use Stream Key',
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
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ipc = getIpc();

  // ── Media Input Devices (Camera / Capture Card + Audio Mixer / Mic) ──
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem('live_psalms_stream_devices_v1') || '{}').videoId || ''; } catch { return ''; }
  });
  const [selectedAudioId, setSelectedAudioId] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem('live_psalms_stream_devices_v1') || '{}').audioId || ''; } catch { return ''; }
  });
  const [studioAudioMode, setStudioAudioMode] = useState<boolean>(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [actualStreamStats, setActualStreamStats] = useState<string>('');
  const [deviceError, setDeviceError] = useState<string>('');
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeMediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);

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

  // Enumerate connected video & audio input devices
  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setDeviceError('');
    try {
      // Request permission briefly if labels are empty so device names appear
      let devs = await navigator.mediaDevices.enumerateDevices();
      if (devs.some(d => (d.kind === 'videoinput' || d.kind === 'audioinput') && !d.label)) {
        try {
          const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          temp.getTracks().forEach(t => t.stop());
          devs = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          // Try audio-only or video-only permission if one is missing
          try {
            const tempA = await navigator.mediaDevices.getUserMedia({ audio: true });
            tempA.getTracks().forEach(t => t.stop());
          } catch {}
          try {
            const tempV = await navigator.mediaDevices.getUserMedia({ video: true });
            tempV.getTracks().forEach(t => t.stop());
          } catch {}
          devs = await navigator.mediaDevices.enumerateDevices();
        }
      }
      const vids = devs.filter(d => d.kind === 'videoinput');
      const auds = devs.filter(d => d.kind === 'audioinput');
      setVideoDevices(vids);
      setAudioDevices(auds);
      if (!selectedVideoId && vids.length > 0) setSelectedVideoId(vids[0].deviceId);
      if (!selectedAudioId && auds.length > 0) setSelectedAudioId(auds[0].deviceId);
    } catch (e: any) {
      setDeviceError(e?.message || 'Unable to list media devices');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Persist selected devices
  useEffect(() => {
    try {
      localStorage.setItem('live_psalms_stream_devices_v1', JSON.stringify({
        videoId: selectedVideoId,
        audioId: selectedAudioId
      }));
    } catch {}
  }, [selectedVideoId, selectedAudioId]);

  // Open live preview MediaStream & Audio VU meter whenever devices or quality change while modal is open
  useEffect(() => {
    if (!isOpen || isStreaming) return;
    let cancelled = false;

    const stopPreview = () => {
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (activeMediaStreamRef.current) {
        activeMediaStreamRef.current.getTracks().forEach(t => t.stop());
        activeMediaStreamRef.current = null;
      }
      setAudioLevel(0);
      setActualStreamStats('');
    };

    const startPreview = async () => {
      stopPreview();
      if (!navigator.mediaDevices?.getUserMedia) return;
      if (selectedVideoId === 'none' && selectedAudioId === 'none') return;

      const keyCfg = streamKeys[activePlatform] || { quality: '1080p' };
      const q = QUALITY_OPTIONS.find(o => o.value === (keyCfg.quality || '1080p')) || QUALITY_OPTIONS[1];
      const [w, h] = q.res.split('x').map(Number);

      const videoConstraint: boolean | MediaTrackConstraints =
        selectedVideoId === 'none'
          ? false
          : {
              ...(selectedVideoId ? { deviceId: { exact: selectedVideoId } } : {}),
              width: { ideal: w || 1920 },
              height: { ideal: h || 1080 },
              frameRate: { ideal: q.fps || 30 }
            };

      const audioConstraint: boolean | MediaTrackConstraints =
        selectedAudioId === 'none'
          ? false
          : {
              ...(selectedAudioId ? { deviceId: { exact: selectedAudioId } } : {}),
              echoCancellation: !studioAudioMode,
              noiseSuppression: !studioAudioMode,
              autoGainControl: !studioAudioMode,
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 2 }
            };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: audioConstraint
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        activeMediaStreamRef.current = stream;
        setDeviceError('');

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => {});
        }

        const vTrack = stream.getVideoTracks()[0];
        const aTrack = stream.getAudioTracks()[0];
        const parts: string[] = [];
        if (vTrack) {
          const s = vTrack.getSettings();
          parts.push(`${s.width || '?'}×${s.height || '?'} @ ${Math.round(s.frameRate || q.fps)}fps`);
        }
        if (aTrack) {
          const s = aTrack.getSettings();
          parts.push(`${s.sampleRate ? Math.round(s.sampleRate / 1000) + 'kHz' : '48kHz'} ${s.channelCount === 2 ? 'Stereo' : 'Audio'}`);
        }
        setActualStreamStats(parts.join(' • '));

        if (aTrack) {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(new MediaStream([aTrack]));
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (cancelled) return;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            setAudioLevel(Math.min(100, Math.round(rms * 280)));
            levelRafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch (e: any) {
        if (!cancelled) {
          setDeviceError(e?.message || 'Could not open selected media device');
        }
      }
    };

    startPreview();
    return () => {
      cancelled = true;
      if (!isStreaming) stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedVideoId, selectedAudioId, studioAudioMode, activePlatform, streamKeys, isStreaming]);

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
        const stream = activeMediaStreamRef.current;
        const hasVideo = !!(stream && stream.getVideoTracks().length > 0);
        const hasAudio = !!(stream && stream.getAudioTracks().length > 0);
        const useMediaPipe = !!(stream && (hasVideo || hasAudio));

        const result = await ipc.invoke('start-stream', {
          rtmpUrl,
          resolution: q.res,
          fps: q.fps,
          bitrate: q.bitrate,
          platform: activePlatform,
          useMediaPipe,
          hasVideo,
          hasAudio
        });
        if (result.success) {
          if (useMediaPipe && stream) {
            const mimeCandidates = [
              'video/webm;codecs=h264,opus',
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm'
            ];
            const mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
            const recorder = new MediaRecorder(stream, {
              ...(mimeType ? { mimeType } : {}),
              videoBitsPerSecond: Math.max(q.bitrate * 1000 * 1.5, 8000000),
              audioBitsPerSecond: 256000
            });
            recorder.ondataavailable = async (ev) => {
              if (ev.data && ev.data.size > 0) {
                const buf = await ev.data.arrayBuffer();
                ipc.send('stream-data', new Uint8Array(buf));
              }
            };
            recorder.start(250);
            mediaRecorderRef.current = recorder;
            setStreamLog(prev => [...prev, `🎥 Capturing ${actualStreamStats || q.res} (${mimeType || 'webm'}) → RTMP`]);
          }
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
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
  const PlatformIcon = platform.icon;
  const keyConfig = getKey(activePlatform);
  const rtmpUrl = getRtmpUrl(activePlatform);
  const qualityObj = QUALITY_OPTIONS.find(q => q.value === (keyConfig.quality || '1080p')) || QUALITY_OPTIONS[1];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0f1e] border border-[#26334a] rounded-2xl shadow-2xl w-[820px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#26334a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-700 to-pink-700 rounded-xl shadow-lg">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg">Live Streaming</h2>
              <p className="text-slate-400 text-xs">Stream directly to YouTube, Twitch, or Facebook Live</p>
            </div>
          </div>

          {/* Stream status indicator */}
          {isStreaming && streamingPlatform && (
            <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/20 border border-rose-500/60 rounded-full">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-rose-300 font-black text-sm uppercase tracking-wider">LIVE</span>
              <span className="text-rose-300 font-mono text-sm">{elapsed}</span>
              <span className="text-rose-400 text-xs">{PLATFORMS[streamingPlatform].name}</span>
            </div>
          )}

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Platform Sidebar */}
          <div className="w-48 border-r border-[#26334a] flex flex-col p-3 gap-1 shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 px-2">Platform</div>
            {(Object.keys(PLATFORMS) as PlatformId[]).map(pid => {
              const p = PLATFORMS[pid];
              const Icon = p.icon;
              const isActive = activePlatform === pid;
              const isLive = isStreaming && streamingPlatform === pid;
              return (
                <button
                  key={pid}
                  onClick={() => setActivePlatform(pid)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition ${
                    isActive
                      ? `bg-white/10 border border-white/20 text-white`
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${p.colorClass}`} />
                  <span className="text-xs font-bold flex-1">{p.name}</span>
                  {isLive && (
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0" />
                  )}
                </button>
              );
            })}

            <div className="mt-auto">
              {/* ffmpeg status */}
              <div className={`mt-3 p-2 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 ${
                ffmpegStatus === 'available'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/40'
                  : ffmpegStatus === 'missing'
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-700/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {ffmpegStatus === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {ffmpegStatus === 'available' && <CheckCircle2 className="w-3 h-3" />}
                {ffmpegStatus === 'missing' && <AlertTriangle className="w-3 h-3" />}
                <span>
                  {ffmpegStatus === 'checking' ? 'Checking...' :
                   ffmpegStatus === 'available' ? 'ffmpeg ready' : 'ffmpeg not found'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Platform header */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${platform.bgClass}`}>
              <PlatformIcon className={`w-8 h-8 ${platform.colorClass}`} />
              <div>
                <div className="text-white font-black text-base">{platform.name}</div>
                <div className="text-slate-400 text-xs">{platform.keyHelp}</div>
              </div>
              <a
                href={platform.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Get Key</span>
              </a>
            </div>

            {/* Stream Key */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                Stream Key *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showKey[activePlatform] ? 'text' : 'password'}
                  value={keyConfig.key}
                  onChange={e => updateKey(activePlatform, 'key', e.target.value)}
                  placeholder={platform.keyPlaceholder}
                  className="w-full bg-[#0d1320] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-white font-mono text-sm outline-none pr-20"
                  autoComplete="off"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    onClick={() => setShowKey(prev => ({ ...prev, [activePlatform]: !prev[activePlatform] }))}
                    className="p-1.5 text-slate-500 hover:text-white transition"
                  >
                    {showKey[activePlatform] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(keyConfig.key, `key-${activePlatform}`)}
                    className="p-1.5 text-slate-500 hover:text-white transition"
                    title="Copy stream key"
                  >
                    {copied === `key-${activePlatform}`
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Media Input Devices (Camera / Capture Card + Audio Mixer / Mic) */}
            <div className="bg-[#0d1320] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-emerald-400" /> Media Input Devices (Broadcast Capture)
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer bg-[#080d16] px-2 py-1 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      checked={studioAudioMode}
                      onChange={e => setStudioAudioMode(e.target.checked)}
                      disabled={isStreaming}
                      className="accent-emerald-500 w-3 h-3 rounded"
                    />
                    <span>Studio Audio (Raw 48kHz, No DSP)</span>
                  </label>
                  <button
                    type="button"
                    onClick={refreshDevices}
                    disabled={isStreaming}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-[10px] font-bold text-slate-200 transition"
                    title="Rescan connected cameras, capture cards, and audio interfaces"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Live Camera / Capture Card Preview */}
                <div className="bg-black rounded-xl border border-slate-800 overflow-hidden relative aspect-video flex items-center justify-center">
                  <video
                    ref={previewVideoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-contain ${selectedVideoId === 'none' ? 'hidden' : ''}`}
                  />
                  {selectedVideoId === 'none' && (
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Video Disabled (Blank)</span>
                  )}
                  {actualStreamStats && (
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[9px] font-mono font-bold text-emerald-300">
                      {actualStreamStats}
                    </span>
                  )}
                </div>

                {/* Selectors + Live Audio VU Meter */}
                <div className="flex flex-col justify-between space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                      <Video className="w-3 h-3 text-sky-400" /> Video Input (Camera / Capture Card)
                    </label>
                    <select
                      value={selectedVideoId}
                      onChange={e => setSelectedVideoId(e.target.value)}
                      disabled={isStreaming}
                      className="w-full bg-[#080d16] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none disabled:opacity-50"
                    >
                      {videoDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>
                          {d.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                      <option value="none">None (Black Screen)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                      <Mic className="w-3 h-3 text-amber-400" /> Audio Input (Mixer / USB Interface / Mic)
                    </label>
                    <select
                      value={selectedAudioId}
                      onChange={e => setSelectedAudioId(e.target.value)}
                      disabled={isStreaming}
                      className="w-full bg-[#080d16] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none disabled:opacity-50"
                    >
                      {audioDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>
                          {d.label || `Microphone ${idx + 1}`}
                        </option>
                      ))}
                      <option value="none">None (Silent Audio)</option>
                    </select>
                  </div>

                  {/* Live Audio Level Meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1"><Volume2 className="w-3 h-3 text-emerald-400" /> Audio Input Level</span>
                      <span className="font-mono text-slate-300">{selectedAudioId === 'none' ? 'Muted' : `${audioLevel}%`}</span>
                    </div>
                    <div className="h-2 w-full bg-[#080d16] rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-75 ${
                          audioLevel > 85 ? 'bg-rose-500' : audioLevel > 55 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${selectedAudioId === 'none' ? 0 : audioLevel}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {deviceError && (
                <div className="text-[11px] font-semibold text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded-lg px-3 py-1.5">
                  {deviceError}
                </div>
              )}
            </div>

            {/* Stream Quality */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                Stream Quality
              </label>
              <div className="grid grid-cols-5 gap-2">
                {QUALITY_OPTIONS.map(q => (
                  <button
                    key={q.value}
                    onClick={() => updateKey(activePlatform, 'quality', q.value)}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold border transition text-center ${
                      (keyConfig.quality || '1080p') === q.value
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-[#0d1320] border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 flex gap-4">
                <span>Resolution: {qualityObj.res}</span>
                <span>FPS: {qualityObj.fps}</span>
                <span>Bitrate: {qualityObj.bitrate} kbps</span>
              </div>
            </div>

            {/* RTMP URL Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  RTMP Endpoint (read-only)
                </label>
                <button
                  onClick={() => copyToClipboard(rtmpUrl, 'rtmp')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition"
                >
                  {copied === 'rtmp' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
              <div className="bg-[#0a0f1e] border border-slate-800 rounded-lg px-3 py-2 font-mono text-[11px] text-slate-400 break-all">
                {rtmpUrl}
              </div>
            </div>

            {/* Custom RTMP override */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">
                Custom RTMP Server (optional override)
              </label>
              <input
                type="text"
                value={keyConfig.customRtmp}
                onChange={e => updateKey(activePlatform, 'customRtmp', e.target.value)}
                placeholder={`Leave blank to use ${platform.name} default`}
                className="w-full bg-[#0d1320] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-white font-mono text-sm outline-none"
              />
            </div>

            {/* ffmpeg missing instructions */}
            {ffmpegStatus === 'missing' && (
              <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  ffmpeg not detected — Manual OBS Setup Required
                </div>
                <p className="text-amber-200/80 text-xs leading-relaxed">
                  Live Psalms uses <strong>ffmpeg</strong> to stream directly from the app. 
                  Install it, or use OBS with the RTMP URL above.
                </p>
                <div className="space-y-1">
                  {[
                    { os: 'Windows', cmd: 'winget install ffmpeg' },
                    { os: 'macOS', cmd: 'brew install ffmpeg' },
                    { os: 'Ubuntu/Debian', cmd: 'sudo apt install ffmpeg' },
                  ].map(({ os, cmd }) => (
                    <div key={os} className="flex items-center gap-2">
                      <span className="text-amber-400 text-[10px] font-black w-20 shrink-0">{os}</span>
                      <code className="flex-1 bg-black/50 px-2 py-1 rounded text-[11px] text-amber-100 font-mono">{cmd}</code>
                      <button onClick={() => copyToClipboard(cmd, `cmd-${os}`)} className="text-slate-500 hover:text-white transition">
                        {copied === `cmd-${os}` ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-amber-200/60 text-[10px]">After installing, restart Live Psalms for ffmpeg to be detected.</p>
              </div>
            )}

            {/* Stream log */}
            {streamLog.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider block">Stream Log</label>
                <div className="bg-black/70 border border-slate-800 rounded-lg p-3 h-28 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-0.5">
                  {streamLog.map((line, i) => (
                    <div key={i} className={
                      line.startsWith('✅') ? 'text-emerald-400' :
                      line.startsWith('❌') ? 'text-rose-400' :
                      line.startsWith('⚠') ? 'text-amber-400' :
                      line.startsWith('▶') ? 'text-sky-400' :
                      line.startsWith('⏹') ? 'text-slate-500' : 'text-slate-400'
                    }>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — Start/Stop Stream */}
        <div className="border-t border-[#26334a] p-4 flex items-center justify-between gap-4">
          <div className="text-[11px] text-slate-500 max-w-sm">
            {ffmpegStatus === 'available'
              ? 'Streaming captures the audience output window. Ensure it is open before going live.'
              : 'Install ffmpeg to enable in-app streaming. Or copy the RTMP URL for OBS.'}
          </div>

          <div className="flex items-center gap-3">
            {isStreaming && streamingPlatform === activePlatform ? (
              <button
                onClick={stopStream}
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-black rounded-xl transition shadow-lg"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop Stream
              </button>
            ) : (
              <button
                onClick={startStream}
                disabled={!keyConfig.key.trim() || ffmpegStatus === 'missing' || (isStreaming && streamingPlatform !== activePlatform)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition shadow-lg"
              >
                <Radio className="w-4 h-4" />
                Go Live on {platform.name}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
