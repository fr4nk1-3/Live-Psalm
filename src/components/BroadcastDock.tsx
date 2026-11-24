import React, { useState, useEffect, useRef } from 'react';
import {
  Radio, Video, Mic, Volume2, VolumeX, Eye, EyeOff, Circle, Square,
  ShieldAlert, Settings, RefreshCw, Plus, Trash2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Tv, MonitorPlay, Layers, Film, Sliders, X, Maximize2, Minimize2
} from 'lucide-react';
import {
  BroadcastScene,
  BroadcastSource,
  BroadcastSourceType,
  BroadcastStudioProjectData
} from '../types/broadcastStudio';
import { Slide, MediaAsset, ChurchProfile, Theme } from '../types/presentation';
import { loadBroadcastStudioData, saveBroadcastStudioData } from '../services/broadcastStudioStorage';
import { renderBroadcastScene } from '../services/broadcastCompositor';
import { BroadcastService } from '../services/broadcast';
import { StorageService } from '../services/storage';
import { streamStatus } from '../services/streamStatus';

interface BroadcastDockProps {
  isOpen: boolean;
  onClose: () => void;
  liveSlide: Slide | null;
  activeTheme?: Theme;
  globalVideoBgUrl?: string | null;
  itemVideoBgUrl?: string | null;
  isFullSlideCountdown?: boolean;
  isCountdownRunning?: boolean;
  countdownTargetScreen?: 'audience' | 'stage' | 'both';
  countdownSeconds: number;
  countdownTitle: string;
  lowerThird: { title?: string; subtitle?: string; content?: string; speed?: 'slow' | 'normal' | 'fast' } | null;
  churchProfile: ChurchProfile;
  mediaList: MediaAsset[];
  isAudienceActive: boolean;
  isStageActive: boolean;
  isLedActive: boolean;
}

function getIpc() {
  try {
    if ((window as any).require) {
      return (window as any).require('electron').ipcRenderer;
    }
  } catch {}
  return null;
}

function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600).toString().padStart(2, '0');
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export const BroadcastDock: React.FC<BroadcastDockProps> = ({
  isOpen,
  onClose,
  liveSlide,
  activeTheme,
  globalVideoBgUrl = null,
  itemVideoBgUrl = null,
  isFullSlideCountdown = false,
  isCountdownRunning = false,
  countdownTargetScreen = 'both',
  countdownSeconds,
  countdownTitle,
  lowerThird,
  churchProfile,
  mediaList,
  isAudienceActive,
  isStageActive,
  isLedActive
}) => {
  const ipc = getIpc();
  const [studio, setStudio] = useState<BroadcastStudioProjectData>(() => loadBroadcastStudioData());
  const [subPanel, setSubPanel] = useState<'live' | 'multiview' | 'layers' | 'setup'>('live');
  const [multiviewEnabled, setMultiviewEnabled] = useState<boolean>(
    () => Boolean(StorageService.getSettings().broadcastMultiviewEnabled)
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [broadcastBlack, setBroadcastBlack] = useState(false);
  const [streamElapsed, setStreamElapsed] = useState(0);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [streamStatusMsg, setStreamStatusMsg] = useState<string>('');
  const [connTest, setConnTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [availableEncoders, setAvailableEncoders] = useState<string[]>(['libx264']);
  const [lastRecPath, setLastRecPath] = useState<string>('');

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [nativeDevices, setNativeDevices] = useState<{ video: { id: string; label: string }[]; audio: { id: string; label: string }[] }>({ video: [], audio: [] });
  const [nativeEngine, setNativeEngine] = useState<{ available: boolean; version?: string; cores?: number; v4l2?: boolean } | null>(null);
  const [nativeBench, setNativeBench] = useState<{ fps: number; throughputMBps: number; elapsedMs: number } | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string>('');
  const [isBroadcastExpanded, setIsBroadcastExpanded] = useState<boolean>(false);
  const [autoFollowLive, setAutoFollowLive] = useState<boolean>(true);
  const [activeMediaVideoUrl, setActiveMediaVideoUrl] = useState<string | null>(null);
  const [channelLevels, setChannelLevels] = useState<Record<string, number>>({});

  const programCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const multiviewCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const cameraStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioNodesRef = useRef<Map<string, { gain: GainNode; analyser: AnalyserNode }>>(new Map());
  const streamRecorderRef = useRef<MediaRecorder | null>(null);
  const recordRecorderRef = useRef<MediaRecorder | null>(null);

  const dragRef = useRef<{
    sourceId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const sharedRef = useRef({
    liveSlide,
    activeMediaVideoUrl,
    globalVideoBgUrl,
    itemVideoBgUrl,
    activeTheme,
    countdownSeconds,
    countdownTitle,
    lowerThird,
    churchProfile,
    broadcastBlack,
    studio,
    subPanel,
    multiviewEnabled
  });
  sharedRef.current = {
    liveSlide,
    activeMediaVideoUrl,
    globalVideoBgUrl,
    itemVideoBgUrl,
    activeTheme,
    countdownSeconds,
    countdownTitle,
    lowerThird,
    churchProfile,
    broadcastBlack,
    studio,
    subPanel,
    multiviewEnabled
  };

  // Sync Broadcast Multiview activation from System Settings
  useEffect(() => {
    const syncSetting = () => {
      const enabled = Boolean(StorageService.getSettings().broadcastMultiviewEnabled);
      setMultiviewEnabled(enabled);
      if (!enabled) {
        setSubPanel(prev => (prev === 'multiview' ? 'live' : prev));
      }
    };
    window.addEventListener('app-settings-updated', syncSetting);
    return () => window.removeEventListener('app-settings-updated', syncSetting);
  }, []);

  // Probe Native C Engine status
  useEffect(() => {
    if (ipc) {
      ipc.invoke('get-native-engine-status').then((res: any) => {
        if (res) setNativeEngine(res);
      }).catch(() => {});
    } else {
      fetch('/api/system/native-engine')
        .then(r => r.json())
        .then(res => setNativeEngine(res))
        .catch(() => {});
    }
  }, [ipc]);

  // Listen to MediaPlayerBar transport commands so live media playback broadcasts cleanly
  useEffect(() => {
    const unsub = BroadcastService.subscribe((payload) => {
      if (payload.type === 'MEDIA_CMD_PLAY' && payload.mediaCmd?.url) {
        const url = payload.mediaCmd.url;
        setActiveMediaVideoUrl(url);
        let vid = videoElementsRef.current.get(url);
        if (!vid) {
          vid = document.createElement('video');
          vid.muted = true;
          vid.playsInline = true;
          vid.src = url;
          videoElementsRef.current.set(url, vid);
        }
        if (payload.mediaCmd.loop !== undefined) vid.loop = payload.mediaCmd.loop;
        if (payload.mediaCmd.playbackRate !== undefined) vid.playbackRate = payload.mediaCmd.playbackRate;
        vid.play().catch(() => {});
      } else if (payload.type === 'MEDIA_CMD_PAUSE' && activeMediaVideoUrl) {
        videoElementsRef.current.get(activeMediaVideoUrl)?.pause();
      } else if (payload.type === 'MEDIA_CMD_RESUME' && activeMediaVideoUrl) {
        videoElementsRef.current.get(activeMediaVideoUrl)?.play().catch(() => {});
      } else if (payload.type === 'MEDIA_CMD_SEEK' && payload.mediaCmd?.seekTo !== undefined && activeMediaVideoUrl) {
        const vid = videoElementsRef.current.get(activeMediaVideoUrl);
        if (vid) vid.currentTime = payload.mediaCmd.seekTo;
      } else if (payload.type === 'MEDIA_CMD_STOP') {
        if (activeMediaVideoUrl) videoElementsRef.current.get(activeMediaVideoUrl)?.pause();
        setActiveMediaVideoUrl(null);
      }
    });
    return () => unsub();
  }, [activeMediaVideoUrl]);

  // Auto-follow live presentation content when enabled
  useEffect(() => {
    if (!autoFollowLive) return;
    let targetSceneId: string | null = null;
    const isPublicEventCountdown =
      isFullSlideCountdown &&
      isCountdownRunning &&
      countdownTargetScreen !== 'stage' &&
      !/preach|sermon\s*time/i.test(countdownTitle || '');
    const isPureMedia = !!(activeMediaVideoUrl || (liveSlide?.backgroundUrl && !liveSlide?.content?.trim()));

    if (isPublicEventCountdown) {
      targetSceneId = 'scene-countdown';
    } else if (isPureMedia) {
      targetSceneId = 'scene-presentation';
    } else if (liveSlide && (liveSlide.bibleMeta || liveSlide.sectionLabel === 'Scripture')) {
      targetSceneId = 'scene-presentation';
    } else if (liveSlide && liveSlide.content?.trim()) {
      targetSceneId = 'scene-cam-lyrics';
    } else if (lowerThird && (lowerThird.content || lowerThird.title)) {
      targetSceneId = 'scene-cam-lower-third';
    }
    if (targetSceneId && studio.scenes.some(s => s.id === targetSceneId) && studio.activeProgramSceneId !== targetSceneId) {
      setStudio(prev => ({
        ...prev,
        activeProgramSceneId: targetSceneId!,
        activePreviewSceneId: targetSceneId!
      }));
    }
  }, [autoFollowLive, activeMediaVideoUrl, liveSlide?.id, liveSlide?.backgroundUrl, liveSlide?.content, liveSlide?.bibleMeta, liveSlide?.sectionLabel, isFullSlideCountdown, isCountdownRunning, countdownTargetScreen, countdownTitle, lowerThird?.content]);

  useEffect(() => {
    saveBroadcastStudioData(studio);
  }, [studio]);

  const activeScene = studio.scenes.find(s => s.id === studio.activeProgramSceneId) || studio.scenes[0] || null;
  const selectedSource = activeScene?.sources.find(s => s.id === selectedSourceId) || null;

  const [resW, resH] = (() => {
    if (studio.outputConfig.resolution === 'custom') {
      return [Math.max(640, studio.outputConfig.customWidth || 1920), Math.max(360, studio.outputConfig.customHeight || 1080)];
    }
    const [w, h] = studio.outputConfig.resolution.split('x').map(Number);
    return [w || 1920, h || 1080];
  })();

  const refreshDevices = async () => {
    setDeviceStatus('Scanning cameras & audio...');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        // Request video and audio separately so one missing device doesn't block the other
        try {
          const vTmp = await navigator.mediaDevices.getUserMedia({ video: true });
          vTmp.getTracks().forEach(t => t.stop());
        } catch {}
        try {
          const aTmp = await navigator.mediaDevices.getUserMedia({ audio: true });
          aTmp.getTracks().forEach(t => t.stop());
        } catch {}
      }

      let vids: MediaDeviceInfo[] = [];
      let auds: MediaDeviceInfo[] = [];
      if (navigator.mediaDevices?.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        vids = devs.filter(d => d.kind === 'videoinput');
        auds = devs.filter(d => d.kind === 'audioinput');
      }
      setVideoDevices(vids);
      setAudioDevices(auds);

      let nat = { video: [] as { id: string; label: string }[], audio: [] as { id: string; label: string }[] };
      if (ipc) {
        try {
          nat = await ipc.invoke('get-native-media-devices');
          setNativeDevices(nat || { video: [], audio: [] });
        } catch {}
      }

      const vCount = vids.length || nat.video.length;
      const aCount = auds.length || nat.audio.length;
      setDeviceStatus(`${vCount} cam(s), ${aCount} audio input(s)`);

      // Auto-bind first detected audio device if currently empty
      if (auds.length > 0) {
        setStudio(prev => ({
          ...prev,
          audioChannels: prev.audioChannels.map((ch, idx) =>
            idx === 0 && !ch.deviceId ? { ...ch, deviceId: auds[0].deviceId } : ch
          )
        }));
      }
    } catch (e: any) {
      setDeviceStatus(e?.message || 'Device scan failed');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshDevices();
    if (ipc) {
      ipc.invoke('detect-encoders').then((encs: string[]) => {
        if (Array.isArray(encs) && encs.length > 0) setAvailableEncoders(encs);
      }).catch(() => {});
      if (!studio.outputConfig.recordingDir) {
        ipc.invoke('get-default-recording-dir').then((dir: string) => {
          if (dir) setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, recordingDir: dir } }));
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!ipc) return;
    const onEnded = () => {
      setIsStreaming(false);
      setStreamStatusMsg('Stream ended');
      streamStatus.finish();
    };
    const onState = (_: any, payload: { state?: string; error?: string }) => {
      if (payload?.state === 'live') {
        streamStatus.markLive();
      } else if (payload?.state === 'error') {
        streamStatus.finish(payload.error || 'Stream error');
      }
    };
    const onStats = (_: any, stats: Record<string, number>) => {
      if (stats) streamStatus.applyStats(stats);
    };
    const onRecEnded = (_: any, info: { filePath?: string }) => {
      setIsRecording(false);
      if (info?.filePath) setLastRecPath(info.filePath);
    };
    ipc.on('stream-ended', onEnded);
    ipc.on('stream-state', onState);
    ipc.on('stream-stats', onStats);
    ipc.on('recording-ended', onRecEnded);
    return () => {
      ipc.removeListener('stream-ended', onEnded);
      ipc.removeListener('stream-state', onState);
      ipc.removeListener('stream-stats', onStats);
      ipc.removeListener('recording-ended', onRecEnded);
    };
  }, [ipc]);

  useEffect(() => {
    if (!isStreaming) { setStreamElapsed(0); return; }
    const t = setInterval(() => setStreamElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isStreaming]);

  useEffect(() => {
    if (!isRecording) { setRecordElapsed(0); return; }
    const t = setInterval(() => setRecordElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Camera capture for active scene sources
  useEffect(() => {
    if (!isOpen && !isStreaming && !isRecording) return;
    const camKeys = new Set<string>();
    activeScene?.sources.forEach(src => {
      if (src.visible && src.type === 'camera') camKeys.add(src.deviceId || 'default-camera');
    });
    camKeys.forEach(async (camKey) => {
      if (cameraStreamsRef.current.has(camKey)) return;
      try {
        const constraint: MediaTrackConstraints = camKey === 'default-camera'
          ? { width: { ideal: resW }, height: { ideal: resH }, frameRate: { ideal: studio.outputConfig.fps } }
          : { deviceId: { exact: camKey }, width: { ideal: resW }, height: { ideal: resH }, frameRate: { ideal: studio.outputConfig.fps } };
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraint, audio: false });
        cameraStreamsRef.current.set(camKey, stream);
        const vid = document.createElement('video');
        vid.muted = true;
        vid.playsInline = true;
        vid.srcObject = stream;
        await vid.play().catch(() => {});
        videoElementsRef.current.set(camKey, vid);
      } catch {}
    });
  }, [isOpen, isStreaming, isRecording, activeScene, resW, resH, studio.outputConfig.fps]);

  // Preload images, logos, and live slide video/image media
  useEffect(() => {
    if (!isOpen && !isStreaming && !isRecording) return;
    const isVidUrl = (u?: string | null, t?: Slide['backgroundType']) =>
      !!u && (t === 'video' || /\.(mp4|webm|mov|mkv|m4v)(\?|$)/i.test(u) || u.startsWith('data:video') || u.startsWith('blob:'));

    const ensureLoopVideo = (url?: string | null) => {
      if (!url || videoElementsRef.current.has(url)) return;
      const vid = document.createElement('video');
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.src = url;
      vid.play().catch(() => {});
      videoElementsRef.current.set(url, vid);
    };

    ensureLoopVideo(globalVideoBgUrl);
    ensureLoopVideo(itemVideoBgUrl);

    const urls = new Set<string>();
    if (churchProfile.logoUrl) urls.add(churchProfile.logoUrl);
    if (activeTheme?.backgroundUrl) {
      if (isVidUrl(activeTheme.backgroundUrl)) ensureLoopVideo(activeTheme.backgroundUrl);
      else urls.add(activeTheme.backgroundUrl);
    }
    if (liveSlide?.backgroundUrl) {
      if (isVidUrl(liveSlide.backgroundUrl, liveSlide.backgroundType)) {
        if (!videoElementsRef.current.has(liveSlide.backgroundUrl)) {
          const vid = document.createElement('video');
          vid.muted = true;
          vid.loop = !!liveSlide.content?.trim();
          vid.playsInline = true;
          vid.src = liveSlide.backgroundUrl;
          vid.play().catch(() => {});
          videoElementsRef.current.set(liveSlide.backgroundUrl, vid);
        }
      } else {
        urls.add(liveSlide.backgroundUrl);
      }
    }
    studio.scenes.forEach(sc => sc.sources.forEach(src => {
      if (src.mediaUrl && src.type === 'image') urls.add(src.mediaUrl);
      if (src.mediaUrl && src.type === 'video' && !videoElementsRef.current.has(src.mediaUrl)) {
        const vid = document.createElement('video');
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.src = src.mediaUrl;
        vid.play().catch(() => {});
        videoElementsRef.current.set(src.mediaUrl, vid);
      }
    }));
    urls.forEach(url => {
      if (!imageElementsRef.current.has(url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        imageElementsRef.current.set(url, img);
      }
    });
  }, [isOpen, isStreaming, isRecording, studio.scenes, churchProfile.logoUrl, activeTheme?.backgroundUrl, liveSlide?.backgroundUrl, globalVideoBgUrl, itemVideoBgUrl]);

  // Audio Mixer (48kHz Studio Raw Audio)
  useEffect(() => {
    if (!isOpen && !isStreaming && !isRecording) return;
    if (!audioCtxRef.current) {
      const ctx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = ctx;
      audioDestRef.current = ctx.createMediaStreamDestination();
    }
    const ctx = audioCtxRef.current;
    const dest = audioDestRef.current!;

    studio.audioChannels.forEach(async (ch) => {
      const existing = audioNodesRef.current.get(ch.id);
      if (existing) {
        existing.gain.gain.value = ch.muted ? 0 : ch.volume;
        return;
      }
      if (ch.deviceId === 'none') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(ch.deviceId ? { deviceId: { exact: ch.deviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: { ideal: 48000 },
            channelCount: { ideal: 2 }
          },
          video: false
        });
        audioStreamsRef.current.set(ch.id, stream);
        const srcNode = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = ch.muted ? 0 : ch.volume;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        srcNode.connect(gainNode);
        gainNode.connect(analyser);
        gainNode.connect(dest);
        audioNodesRef.current.set(ch.id, { gain: gainNode, analyser });
      } catch {}
    });

    const meterTimer = setInterval(() => {
      const lvls: Record<string, number> = {};
      audioNodesRef.current.forEach((node, chId) => {
        const ch = sharedRef.current.studio.audioChannels.find(c => c.id === chId);
        if (!ch || ch.muted) { lvls[chId] = 0; return; }
        const buf = new Uint8Array(node.analyser.frequencyBinCount);
        node.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        lvls[chId] = Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 280 * ch.volume));
      });
      setChannelLevels(lvls);
    }, 90);

    return () => clearInterval(meterTimer);
  }, [isOpen, isStreaming, isRecording, studio.audioChannels]);

  // Render loop for live Broadcast Program canvas (keeps running while streaming/recording even if drawer is collapsed)
  useEffect(() => {
    if (!isOpen && !isStreaming && !isRecording) return;
    let rafId = 0;
    let lastDraw = 0;
    let lastMultiviewDraw = 0;
    const interval = 1000 / studio.outputConfig.fps;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (now - lastDraw < interval) return;
      lastDraw = now;

      const s = sharedRef.current;
      const sc = s.studio.scenes.find(x => x.id === s.studio.activeProgramSceneId) || s.studio.scenes[0] || null;
      const sharedRenderData = {
        liveSlide: s.liveSlide,
        activeMediaVideoUrl: s.activeMediaVideoUrl,
        globalVideoBgUrl: s.globalVideoBgUrl,
        itemVideoBgUrl: s.itemVideoBgUrl,
        activeTheme: s.activeTheme,
        countdownSeconds: s.countdownSeconds,
        countdownTitle: s.countdownTitle,
        lowerThird: s.lowerThird,
        churchProfile: s.churchProfile,
        emergencyBlack: s.broadcastBlack,
        videoElements: videoElementsRef.current,
        imageElements: imageElementsRef.current
      };

      const canvas = programCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderBroadcastScene(ctx, canvas.width, canvas.height, sc, sharedRenderData);
        }
      }

      if (s.multiviewEnabled && s.subPanel === 'multiview' && now - lastMultiviewDraw >= 80) {
        lastMultiviewDraw = now;
        const pvwScene = s.studio.scenes.find(x => x.id === s.studio.activePreviewSceneId) || sc;
        const pvwCanvas = previewCanvasRef.current;
        if (pvwCanvas && pvwScene) {
          const pvwCtx = pvwCanvas.getContext('2d');
          if (pvwCtx) {
            renderBroadcastScene(pvwCtx, pvwCanvas.width, pvwCanvas.height, pvwScene, {
              ...sharedRenderData,
              emergencyBlack: false
            });
          }
        }
        s.studio.scenes.forEach(scene => {
          const mCanvas = multiviewCanvasRefs.current.get(scene.id);
          if (!mCanvas) return;
          const mCtx = mCanvas.getContext('2d');
          if (!mCtx) return;
          renderBroadcastScene(mCtx, mCanvas.width, mCanvas.height, scene, {
            ...sharedRenderData,
            emergencyBlack: false
          });
        });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, isStreaming, isRecording, studio.outputConfig.fps]);

  const updateActiveScene = (fn: (sc: BroadcastScene) => BroadcastScene) => {
    if (!activeScene) return;
    setStudio(prev => ({
      ...prev,
      scenes: prev.scenes.map(sc => (sc.id === activeScene.id ? fn(sc) : sc))
    }));
  };

  const buildCombinedStream = (): MediaStream | null => {
    const canvas = programCanvasRef.current;
    if (!canvas) return null;
    const vStream = canvas.captureStream(studio.outputConfig.fps);
    const tracks: MediaStreamTrack[] = [...vStream.getVideoTracks()];
    if (audioDestRef.current) tracks.push(...audioDestRef.current.stream.getAudioTracks());
    return new MediaStream(tracks);
  };

  const startBroadcast = async () => {
    const dest = studio.destinations.find(d => d.id === studio.activeDestinationId) || studio.destinations[0];
    if (!dest?.serverUrl.trim() || !dest?.streamKey.trim()) {
      setStreamStatusMsg('Enter Server URL & Stream Key in Broadcast Setup first.');
      setSubPanel('setup');
      return;
    }
    if (!ipc) {
      setStreamStatusMsg('Live RTMP streaming requires the Electron desktop app.');
      return;
    }
    streamStatus.begin(dest.name);
    const rtmpUrl = dest.serverUrl.endsWith('/') ? `${dest.serverUrl}${dest.streamKey}` : `${dest.serverUrl}/${dest.streamKey}`;
    const res = await ipc.invoke('start-stream', {
      rtmpUrl,
      resolution: `${resW}x${resH}`,
      fps: studio.outputConfig.fps,
      bitrate: studio.outputConfig.videoBitrateKbps,
      mode: 'native-c',
      reencode: true,
      hardwareEncoder: studio.outputConfig.encoder || 'libx264',
      encoder: studio.outputConfig.encoder || 'libx264',
      useMediaPipe: true,
      hasVideo: true,
      hasAudio: true
    });
    if (!res?.success) {
      streamStatus.finish(res?.error || 'Failed to start stream');
      setStreamStatusMsg(res?.error || 'Failed to start stream');
      return;
    }
    const combined = buildCombinedStream();
    if (combined) {
      const mime = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(combined, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: Math.max(studio.outputConfig.videoBitrateKbps * 1000 * 1.4, 8000000),
        audioBitsPerSecond: studio.outputConfig.audioBitrateKbps * 1000
      });
      rec.ondataavailable = async (ev) => {
        if (ev.data?.size > 0) ipc.send('stream-data', new Uint8Array(await ev.data.arrayBuffer()));
      };
      rec.start(250);
      streamRecorderRef.current = rec;
    }
    setIsStreaming(true);
    setStreamStatusMsg(`Streaming LIVE to ${dest.name} (${res.engine || 'Native C Engine'})`);
  };

  const stopBroadcast = async () => {
    setConfirmStop(false);
    if (streamRecorderRef.current && streamRecorderRef.current.state !== 'inactive') {
      try { streamRecorderRef.current.stop(); } catch {}
      streamRecorderRef.current = null;
    }
    if (ipc) await ipc.invoke('stop-stream').catch(() => {});
    streamStatus.finish();
    setIsStreaming(false);
    setStreamStatusMsg('Broadcast stopped');
  };

  const startRecording = async () => {
    if (!ipc) return;
    const res = await ipc.invoke('start-recording', {
      recordingDir: studio.outputConfig.recordingDir,
      format: studio.outputConfig.recordingFormat,
      resolution: `${resW}x${resH}`,
      fps: studio.outputConfig.fps,
      bitrate: Math.max(6000, studio.outputConfig.videoBitrateKbps),
      audioBitrate: studio.outputConfig.audioBitrateKbps
    });
    if (!res?.success) {
      setStreamStatusMsg(res?.error || 'Recording failed');
      return;
    }
    const combined = buildCombinedStream();
    if (combined) {
      const mime = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(combined, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 10000000,
        audioBitsPerSecond: 256000
      });
      rec.ondataavailable = async (ev) => {
        if (ev.data?.size > 0) ipc.send('recording-data', new Uint8Array(await ev.data.arrayBuffer()));
      };
      rec.start(250);
      recordRecorderRef.current = rec;
    }
    setIsRecording(true);
    setLastRecPath(res.filePath || '');
    setStreamStatusMsg(`Recording to ${res.filePath}`);
  };

  const stopRecording = async () => {
    if (recordRecorderRef.current && recordRecorderRef.current.state !== 'inactive') {
      try { recordRecorderRef.current.stop(); } catch {}
      recordRecorderRef.current = null;
    }
    if (ipc) await ipc.invoke('stop-recording').catch(() => {});
    setIsRecording(false);
  };

  const addSource = (type: BroadcastSourceType) => {
    if (!activeScene) return;
    const defaults: Record<BroadcastSourceType, Partial<BroadcastSource>> = {
      camera: { name: 'Camera Input', x: 0, y: 0, width: 100, height: 100, deviceId: videoDevices[0]?.deviceId || '' },
      screen: { name: 'Screen Capture', x: 0, y: 0, width: 100, height: 100 },
      lyrics_overlay: { name: 'Live Lyrics Overlay', x: 6, y: 72, width: 88, height: 22, bgColor: 'rgba(6,10,22,0.78)', textColor: '#ffffff', fontSize: 42, borderRadius: 14 },
      bible_overlay: { name: 'Bible Verse Overlay', x: 5, y: 68, width: 90, height: 27, bgColor: 'rgba(10,15,32,0.85)', textColor: '#ffffff', fontSize: 38, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(245,158,11,0.7)' },
      live_slide: { name: 'Full Slide Output', x: 0, y: 0, width: 100, height: 100, bgColor: '#090d1a', textColor: '#ffffff', fontSize: 54 },
      lower_third: { name: 'Lower Third', x: 4, y: 84, width: 92, height: 11, bgColor: 'rgba(15,23,42,0.9)', textColor: '#ffffff', fontSize: 30, borderRadius: 10 },
      countdown: { name: 'Countdown Timer', x: 15, y: 30, width: 70, height: 42, textColor: '#ffffff', fontSize: 110 },
      logo: { name: 'Church Logo', x: 86, y: 4, width: 10, height: 14 },
      image: { name: 'Image Overlay', x: 10, y: 10, width: 40, height: 40, mediaUrl: mediaList.find(m => m.type === 'image')?.url || '' },
      video: { name: 'Video Overlay', x: 0, y: 0, width: 100, height: 100, mediaUrl: mediaList.find(m => m.type === 'video')?.url || '' },
      text: { name: 'Custom Text', x: 10, y: 8, width: 80, height: 14, text: churchProfile.name || 'Welcome', textColor: '#ffffff', bgColor: 'rgba(0,0,0,0.6)', fontSize: 40, borderRadius: 10 },
      color_bg: { name: 'Backdrop', x: 0, y: 0, width: 100, height: 100, bgColor: '#090d1a' }
    };
    const d = defaults[type];
    const maxZ = activeScene.sources.reduce((m, s) => Math.max(m, s.zIndex), 0);
    const newSrc: BroadcastSource = {
      id: `src-${Date.now()}`,
      name: d.name || type,
      type,
      visible: true,
      locked: false,
      x: d.x ?? 10,
      y: d.y ?? 10,
      width: d.width ?? 50,
      height: d.height ?? 50,
      opacity: 1,
      zIndex: maxZ + 1,
      ...d
    };
    updateActiveScene(sc => ({ ...sc, sources: [...sc.sources, newSrc] }));
    setSelectedSourceId(newSrc.id);
    setShowAddSource(false);
  };

  if (!isOpen && !isStreaming && !isRecording) return null;

  return (
    <div className={isOpen ? 'bg-card border-b border-border px-3 py-2.5 shrink-0 select-none' : 'hidden'}>
      {/* Confirm Stop Stream */}
      {confirmStop && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center">
          <div className="bg-popover border border-live/50 rounded-lg p-5 w-96 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-live font-medium text-sm">
              <AlertTriangle className="w-5 h-5" /> End Live Broadcast?
            </div>
            <p className="text-xs text-foreground">
              Your stream has been live for <strong>{fmtElapsed(streamElapsed)}</strong>. Stop streaming?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmStop(false)} className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-bold text-foreground">Keep Live</button>
              <button onClick={stopBroadcast} className="px-3 py-1.5 rounded-lg bg-live text-xs font-medium text-foreground">Stop Stream</button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast bar header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Broadcast</span>

          <div className="flex items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5">
            {[
              { id: 'live', label: 'Monitor' },
              ...(multiviewEnabled ? [{ id: 'multiview', label: 'Multiview' }] : []),
              { id: 'layers', label: 'Scenes' },
              { id: 'setup', label: 'Setup' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSubPanel(t.id as any)}
                className={`h-6 rounded-sm px-2 text-2xs font-medium transition-colors ${
                  subPanel === t.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 text-2xs lg:flex">
            <span className={isAudienceActive ? 'text-live' : 'text-muted-foreground/60'}>
              Projector {isAudienceActive ? 'on' : 'off'}
            </span>
            <span className={isStageActive ? 'text-live' : 'text-muted-foreground/60'}>
              Stage {isStageActive ? 'on' : 'off'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {streamStatusMsg && (
            <span className="max-w-[220px] truncate text-2xs text-muted-foreground">{streamStatusMsg}</span>
          )}

          <button
            onClick={() => setBroadcastBlack(b => !b)}
            className={`h-7 rounded-md px-2 text-2xs font-medium transition-colors ${
              broadcastBlack ? 'bg-live text-live-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            title="Black out the broadcast only; the projector stays live"
          >
            {broadcastBlack ? 'Stream black on' : 'Stream black'}
          </button>

          {isRecording ? (
            <button
              onClick={stopRecording}
              className="h-7 rounded-md bg-warning px-2 text-2xs font-medium text-warning-foreground"
            >
              Stop rec · {fmtElapsed(recordElapsed)}
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="h-7 rounded-md border border-border px-2 text-2xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Record
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={() => setConfirmStop(true)}
              className="h-7 rounded-md bg-live px-2.5 text-2xs font-medium text-live-foreground"
            >
              Live · {fmtElapsed(streamElapsed)}
            </button>
          ) : (
            <button
              onClick={startBroadcast}
              className="h-7 rounded-md bg-live px-2.5 text-2xs font-medium text-live-foreground transition-colors hover:bg-live/90"
            >
              Go live
            </button>
          )}

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close the broadcast panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── MAIN INTEGRATED CONTENT (Compact Strip or Expanded View) ── */}
      <div className={`flex items-stretch gap-3 ${subPanel === 'multiview' ? 'h-[320px]' : isBroadcastExpanded ? 'h-[290px]' : 'h-[146px]'}`}>
        {/* LIVE BROADCAST MONITOR (Always mounted so captureStream stays active) */}
        <div className={`${isBroadcastExpanded ? 'w-[490px]' : 'w-[254px]'} shrink-0 flex flex-col transition-all`}>
          <div className="bg-black rounded-md border border-live/50 overflow-hidden relative h-full w-full shadow-lg">
            <div
              className="w-full h-full relative"
              onMouseDown={e => {
                if (subPanel !== 'layers' || !activeScene) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * 100;
                const py = ((e.clientY - rect.top) / rect.height) * 100;
                const hit = [...activeScene.sources].sort((a, b) => b.zIndex - a.zIndex)
                  .find(s => s.visible && px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height);
                if (hit) {
                  setSelectedSourceId(hit.id);
                  if (!hit.locked) dragRef.current = { sourceId: hit.id, startX: px, startY: py, origX: hit.x, origY: hit.y };
                }
              }}
              onMouseMove={e => {
                const d = dragRef.current;
                if (!d) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * 100;
                const py = ((e.clientY - rect.top) / rect.height) * 100;
                updateActiveScene(sc => ({
                  ...sc,
                  sources: sc.sources.map(s => s.id === d.sourceId ? {
                    ...s,
                    x: Math.round(Math.max(-50, Math.min(95, d.origX + (px - d.startX))) * 10) / 10,
                    y: Math.round(Math.max(-50, Math.min(95, d.origY + (py - d.startY))) * 10) / 10
                  } : s)
                }));
              }}
              onMouseUp={() => { dragRef.current = null; }}
              onMouseLeave={() => { dragRef.current = null; }}
            >
              <canvas ref={programCanvasRef} width={resW} height={resH} className="w-full h-full object-contain block" />
              {subPanel === 'layers' && selectedSource && selectedSource.visible && (
                <div
                  className="absolute border-2 border-amber-400 pointer-events-none"
                  style={{ left: `${selectedSource.x}%`, top: `${selectedSource.y}%`, width: `${selectedSource.width}%`, height: `${selectedSource.height}%` }}
                />
              )}
            </div>
            <span className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-2xs font-medium text-live border border-live/40">
              OUTGOING BROADCAST • {resW}×{resH}
            </span>
            <button
              type="button"
              onClick={() => setIsBroadcastExpanded(v => !v)}
              className="absolute top-1 right-1.5 p-1 rounded bg-black/75 hover:bg-accent text-foreground border border-white/15 transition"
              title={isBroadcastExpanded ? 'Compact Broadcast Monitor' : 'Enlarge Broadcast Monitor'}
            >
              {isBroadcastExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* SUB-PANEL: MULTIVIEW (Activated in Settings -> Projection & Broadcast) */}
        {subPanel === 'multiview' && multiviewEnabled && (
          <div className="flex-1 min-w-0 flex gap-2.5 h-full">
            {/* Preview (PVW) + Take Controls */}
            <div className="w-[260px] shrink-0 bg-background/50 border border-emerald-500/40 rounded-md p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-medium uppercase tracking-wider text-success flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Preview (PVW)
                </span>
                <span className="text-2xs text-foreground font-bold truncate max-w-[135px]">
                  {studio.scenes.find(s => s.id === studio.activePreviewSceneId)?.name || activeScene?.name}
                </span>
              </div>
              <div className="bg-black rounded-lg border border-success/50 overflow-hidden aspect-video w-full my-1.5">
                <canvas ref={previewCanvasRef} width={384} height={216} className="w-full h-full object-contain block" />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextId = studio.activePreviewSceneId || studio.activeProgramSceneId;
                    setAutoFollowLive(false);
                    setStudio(p => ({ ...p, activeProgramSceneId: nextId }));
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-live hover:bg-live/90 text-foreground text-2xs font-medium uppercase tracking-wider transition shadow"
                  title="Send Preview scene live to Outgoing Broadcast (PGM)"
                >
                  Cut to Program
                </button>
                <button
                  type="button"
                  onClick={() => setAutoFollowLive(v => !v)}
                  className={`px-2 py-1.5 rounded-lg text-2xs font-bold border transition ${
                    autoFollowLive
                      ? 'bg-success/20 border-success/50 text-success'
                      : 'bg-background/60 border-border text-muted-foreground'
                  }`}
                  title="Automatically match broadcast layout to live Bible verses, songs, and countdowns"
                >
                  Auto: {autoFollowLive ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Live Scene Multiview Grid */}
            <div className="flex-1 min-w-0 bg-background/50 border border-border rounded-md p-2 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Broadcast Multiview ({studio.scenes.length} Scenes)
                </span>
                <span className="text-2xs text-muted-foreground">
                  Click = Preview (PVW) • Double-click or LIVE = Cut to Program (PGM)
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 overflow-y-auto pr-0.5 flex-1 content-start">
                {studio.scenes.map((sc, idx) => {
                  const isPgm = sc.id === studio.activeProgramSceneId;
                  const isPvw = sc.id === studio.activePreviewSceneId;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => setStudio(p => ({ ...p, activePreviewSceneId: sc.id }))}
                      onDoubleClick={() => {
                        setAutoFollowLive(false);
                        setStudio(p => ({ ...p, activeProgramSceneId: sc.id, activePreviewSceneId: sc.id }));
                      }}
                      className={`group relative rounded-lg overflow-hidden border-2 cursor-pointer transition bg-black ${
                        isPgm
                          ? 'border-live '
                          : isPvw
                          ? 'border-success '
                          : 'border-border hover:border-ring/60'
                      }`}
                    >
                      <div className="aspect-video w-full bg-black">
                        <canvas
                          ref={el => {
                            if (el) multiviewCanvasRefs.current.set(sc.id, el);
                            else multiviewCanvasRefs.current.delete(sc.id);
                          }}
                          width={320}
                          height={180}
                          className="w-full h-full object-contain block"
                        />
                      </div>
                      <div className="px-1.5 py-1 bg-background/60 border-t border-border flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-2xs font-mono font-bold text-muted-foreground">{idx + 1}</span>
                          <span className="text-2xs font-bold text-foreground truncate">{sc.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isPgm && (
                            <span className="px-1 py-0.2 rounded bg-live text-foreground text-2xs font-medium uppercase">PGM</span>
                          )}
                          {isPvw && !isPgm && (
                            <span className="px-1 py-0.2 rounded bg-success text-success-foreground text-2xs font-medium uppercase">PVW</span>
                          )}
                          {!isPgm && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setAutoFollowLive(false);
                                setStudio(p => ({ ...p, activeProgramSceneId: sc.id, activePreviewSceneId: sc.id }));
                              }}
                              className="px-1.5 py-0.5 rounded bg-secondary hover:bg-live text-foreground hover:text-foreground text-2xs font-medium uppercase transition"
                              title={`Cut ${sc.name} directly to Program`}
                            >
                              Live
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-PANEL: LIVE (Compact Layouts + Camera & Audio Strip) */}
        {subPanel === 'live' && (
          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2.5 h-full">
            <div className="col-span-6 bg-background/50 border border-border rounded-md p-2 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-medium uppercase text-muted-foreground tracking-wider">Broadcast Layout</span>
                <button
                  type="button"
                  onClick={() => setAutoFollowLive(v => !v)}
                  className={`px-2 py-0.5 rounded text-2xs font-bold border transition ${
                    autoFollowLive
                      ? 'bg-success/20 border-success/50 text-success'
                      : 'bg-background/60 border-border text-muted-foreground'
                  }`}
                  title="Automatically match broadcast layout to live Bible verses, songs, and countdowns"
                >
                  Auto-Follow: {autoFollowLive ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 overflow-y-auto pr-0.5">
                {studio.scenes.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setAutoFollowLive(false);
                      setStudio(p => ({ ...p, activeProgramSceneId: sc.id, activePreviewSceneId: sc.id }));
                    }}
                    className={`px-2 py-1 rounded-lg text-2xs font-bold border text-left truncate transition ${
                      sc.id === studio.activeProgramSceneId
                        ? 'bg-live/25 border-live text-foreground '
                        : 'bg-background/60 border-border text-foreground hover:border-ring/50'
                    }`}
                  >
                    {sc.name}
                  </button>
                ))}
              </div>
              <div className="text-2xs text-muted-foreground truncate pt-1">
                Live lyrics, Bible verses, countdown &amp; lower-thirds feed automatically into active overlays.
              </div>
            </div>

            <div className="col-span-6 bg-background/50 border border-border rounded-md p-2 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-medium uppercase text-success tracking-wider">Camera &amp; Audio Input</span>
                <div className="flex items-center gap-2">
                  {deviceStatus && <span className="text-2xs font-semibold text-muted-foreground">{deviceStatus}</span>}
                  <button onClick={refreshDevices} className="text-foreground hover:text-foreground flex items-center gap-1 text-2xs font-bold bg-secondary px-1.5 py-0.5 rounded">
                    <RefreshCw className="w-3 h-3" /> Detect
                  </button>
                </div>
              </div>

              {/* Camera quick selector */}
              {(() => {
                const camSrc = activeScene?.sources.find(s => s.type === 'camera');
                return (
                  <div className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <select
                      value={camSrc?.deviceId || ''}
                      onChange={e => {
                        const devId = e.target.value;
                        updateActiveScene(sc => ({
                          ...sc,
                          sources: sc.sources.map(s => s.type === 'camera' ? { ...s, deviceId: devId } : s)
                        }));
                      }}
                      className="flex-1 bg-background/60 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                    >
                      <option value="">Default Camera / Capture Card</option>
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                      ))}
                      {videoDevices.length === 0 && nativeDevices.video.map((d, i) => (
                        <option key={d.id || i} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* Audio quick selector + VU meter */}
              {studio.audioChannels.slice(0, 1).map(ch => {
                const lvl = channelLevels[ch.id] || 0;
                return (
                  <div key={ch.id} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-warning shrink-0" />
                      <select
                        value={ch.deviceId}
                        onChange={e => setStudio(p => ({ ...p, audioChannels: p.audioChannels.map(c => c.id === ch.id ? { ...c, deviceId: e.target.value } : c) }))}
                        className="flex-1 bg-background/60 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground outline-none"
                      >
                        <option value="">Default Audio Input (48kHz Raw)</option>
                        {audioDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mic ${i + 1}`}</option>)}
                        {audioDevices.length === 0 && nativeDevices.audio.map((d, i) => <option key={d.id || i} value={d.id}>{d.label}</option>)}
                        <option value="none">Muted / No Audio</option>
                      </select>
                      <button
                        onClick={() => setStudio(p => ({ ...p, audioChannels: p.audioChannels.map(c => c.id === ch.id ? { ...c, muted: !c.muted } : c) }))}
                        className={`p-1 rounded-lg ${ch.muted ? 'bg-rose-500/20 text-live' : 'bg-success/20 text-success'}`}
                      >
                        {ch.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={150}
                        value={Math.round(ch.volume * 100)}
                        onChange={e => setStudio(p => ({ ...p, audioChannels: p.audioChannels.map(c => c.id === ch.id ? { ...c, volume: Number(e.target.value) / 100 } : c) }))}
                        className="w-20 accent-foreground h-1.5"
                      />
                      <span className="text-2xs font-mono text-muted-foreground w-7 text-right">{Math.round(ch.volume * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-background/60 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-75 ${lvl > 85 ? 'bg-rose-500' : lvl > 60 ? 'bg-amber-400' : 'bg-success'}`} style={{ width: `${ch.muted ? 0 : lvl}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-PANEL: SCENES & LAYERS */}
        {subPanel === 'layers' && (
          <div className="flex-1 min-w-0 grid grid-cols-12 gap-2.5 h-full">
            <div className="col-span-7 bg-background/50 border border-border rounded-md p-2 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-1 relative">
                <span className="text-2xs font-medium uppercase text-muted-foreground">Layers in "{activeScene?.name}" (Drag on video)</span>
                <button onClick={() => setShowAddSource(v => !v)} className="px-2 py-0.5 rounded bg-secondary text-foreground text-2xs font-bold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Layer
                </button>
                {showAddSource && (
                  <div className="absolute top-6 right-0 z-50 w-48 bg-popover border border-border rounded-md shadow-2xl p-1 grid grid-cols-1 max-h-40 overflow-y-auto">
                    {[
                      { type: 'camera', label: 'Camera / Capture Card' },
                      { type: 'lyrics_overlay', label: 'Live Lyrics Overlay' },
                      { type: 'bible_overlay', label: 'Bible Verse Overlay' },
                      { type: 'countdown', label: 'Countdown Timer' },
                      { type: 'lower_third', label: 'Lower Third' },
                      { type: 'logo', label: 'Church Logo' },
                      { type: 'image', label: 'Image Overlay' },
                      { type: 'text', label: 'Custom Text' }
                    ].map(i => (
                      <button key={i.type} onClick={() => addSource(i.type as BroadcastSourceType)} className="text-left px-2 py-1 rounded hover:bg-secondary/30 text-[11px] text-foreground">
                        {i.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {[...(activeScene?.sources || [])].sort((a, b) => b.zIndex - a.zIndex).map(src => (
                  <div
                    key={src.id}
                    onClick={() => setSelectedSourceId(src.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border ${
                      selectedSourceId === src.id ? 'bg-amber-500/15 border-amber-500/60 text-foreground' : 'bg-background/60 border-border text-foreground'
                    }`}
                  >
                    <span className="truncate flex-1">{src.name}</span>
                    <button onClick={e => { e.stopPropagation(); updateActiveScene(sc => ({ ...sc, sources: sc.sources.map(s => s.id === src.id ? { ...s, visible: !s.visible } : s) })); }} className={src.visible ? 'text-success' : 'text-muted-foreground/70'}>
                      {src.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); updateActiveScene(sc => ({ ...sc, sources: sc.sources.filter(s => s.id !== src.id) })); }} className="text-muted-foreground hover:text-live">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-5 bg-background/50 border border-border rounded-md p-2 flex flex-col h-full overflow-y-auto">
              <span className="text-2xs font-medium uppercase text-warning mb-1">Layer Properties</span>
              {selectedSource ? (
                <div className="space-y-1.5 text-[11px]">
                  {selectedSource.type === 'camera' && (
                    <select
                      value={selectedSource.deviceId || ''}
                      onChange={e => updateActiveScene(sc => ({ ...sc, sources: sc.sources.map(s => s.id === selectedSource.id ? { ...s, deviceId: e.target.value } : s) }))}
                      className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground"
                    >
                      <option value="">Default Camera</option>
                      {videoDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                    </select>
                  )}
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'width', 'height'] as const).map(k => (
                      <div key={k}>
                        <span className="text-2xs uppercase text-muted-foreground block">{k}</span>
                        <input
                          type="number"
                          value={Math.round(selectedSource[k])}
                          onChange={e => updateActiveScene(sc => ({ ...sc, sources: sc.sources.map(s => s.id === selectedSource.id ? { ...s, [k]: Number(e.target.value) || 0 } : s) }))}
                          className="w-full bg-background/60 border border-border rounded px-1.5 py-0.5 text-2xs font-mono text-foreground"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-muted-foreground">Opacity</span>
                    <input type="range" min={10} max={100} value={Math.round(selectedSource.opacity * 100)} onChange={e => updateActiveScene(sc => ({ ...sc, sources: sc.sources.map(s => s.id === selectedSource.id ? { ...s, opacity: Number(e.target.value) / 100 } : s) }))} className="flex-1 accent-foreground h-1.5" />
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground my-auto text-center">Select a layer to adjust position, camera, or opacity.</span>
              )}
            </div>
          </div>
        )}

        {/* SUB-PANEL: STREAM & AUDIO SETUP */}
        {subPanel === 'setup' && (
          <div className="flex-1 min-w-0 bg-background/50 border border-border rounded-md p-2 grid grid-cols-3 gap-2.5 text-[11px] h-full overflow-y-auto">
            <div className="space-y-1.5">
              <span className="text-2xs font-medium uppercase text-live block">Destination</span>
              <select
                value={studio.activeDestinationId}
                onChange={e => { setConnTest(null); setStudio(p => ({ ...p, activeDestinationId: e.target.value })); }}
                className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-bold"
              >
                {studio.destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {(() => {
                const dest = studio.destinations.find(d => d.id === studio.activeDestinationId) || studio.destinations[0];
                return (
                  <>
                    <input
                      type="text"
                      value={dest.serverUrl}
                      onChange={e => setStudio(p => ({ ...p, destinations: p.destinations.map(d => d.id === dest.id ? { ...d, serverUrl: e.target.value } : d) }))}
                      placeholder="RTMP Server URL"
                      className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-mono text-2xs"
                    />
                    <div className="flex gap-1">
                      <input
                        type="password"
                        value={dest.streamKey}
                        onChange={e => setStudio(p => ({ ...p, destinations: p.destinations.map(d => d.id === dest.id ? { ...d, streamKey: e.target.value } : d) }))}
                        placeholder="Stream Key (masked)"
                        className="flex-1 min-w-0 bg-background/60 border border-border rounded px-2 py-1 text-foreground font-mono text-2xs"
                      />
                      <button
                        onClick={async () => {
                          if (!ipc) return;
                          const url = dest.serverUrl.endsWith('/') ? `${dest.serverUrl}${dest.streamKey}` : `${dest.serverUrl}/${dest.streamKey}`;
                          const res = await ipc.invoke('test-rtmp-connection', { rtmpUrl: url });
                          setConnTest({ ok: !!res.success, msg: res.message || res.error });
                        }}
                        className="px-2 py-1 rounded bg-secondary text-foreground font-bold text-2xs shrink-0"
                      >
                        Test
                      </button>
                    </div>
                    {connTest && <div className={`text-2xs ${connTest.ok ? 'text-success' : 'text-live'}`}>{connTest.msg}</div>}
                  </>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <span className="text-2xs font-medium uppercase text-muted-foreground block">Video Quality &amp; Encoder</span>
              <select
                value={studio.outputConfig.resolution}
                onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, resolution: e.target.value as any } }))}
                className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-bold"
              >
                <option value="1920x1080">1920×1080 (Full HD)</option>
                <option value="1280x720">1280×720 (HD)</option>
                <option value="3840x2160">3840×2160 (4K)</option>
              </select>
              <div className="grid grid-cols-2 gap-1">
                <select value={studio.outputConfig.fps} onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, fps: Number(e.target.value) as 30 | 60 } }))} className="bg-background/60 border border-border rounded px-2 py-1 text-foreground font-bold">
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
                <input type="number" min={500} max={20000} step={250} value={studio.outputConfig.videoBitrateKbps} onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, videoBitrateKbps: Number(e.target.value) || 4500 } }))} className="bg-background/60 border border-border rounded px-2 py-1 text-foreground font-mono" />
              </div>
              <select value={studio.outputConfig.encoder} onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, encoder: e.target.value as any } }))} className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-bold">
                {availableEncoders.map(enc => <option key={enc} value={enc}>{enc === 'libx264' ? 'x264 Software' : `${enc} Hardware`}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-2xs font-medium uppercase text-warning block">Local Recording</span>
              <select value={studio.outputConfig.recordingFormat} onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, recordingFormat: e.target.value as any } }))} className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-bold">
                <option value="mp4">MP4</option>
                <option value="mkv">MKV</option>
                <option value="flv">FLV</option>
              </select>
              <input
                type="text"
                value={studio.outputConfig.recordingDir}
                onChange={e => setStudio(p => ({ ...p, outputConfig: { ...p.outputConfig, recordingDir: e.target.value } }))}
                placeholder="~/Videos/LivePsalms-Recordings"
                className="w-full bg-background/60 border border-border rounded px-2 py-1 text-foreground font-mono text-2xs"
              />
              {lastRecPath && <div className="text-2xs text-success truncate">Saved: {lastRecPath}</div>}
              <div className="pt-1 border-t border-border/70 flex items-center justify-between gap-1.5">
                <span className={`text-2xs font-medium ${nativeEngine?.available ? 'text-success' : 'text-muted-foreground'}`}>
                  C Engine: {nativeEngine?.available ? `v${nativeEngine.version} (${nativeEngine.cores}c)` : 'FFmpeg fallback'}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = ipc
                      ? await ipc.invoke('benchmark-native-engine', { width: 1920, height: 1080, frames: 60 }).catch(() => null)
                      : await fetch('/api/system/native-benchmark', { method: 'POST' }).then(r => r.json()).catch(() => null);
                    if (res?.ok) setNativeBench(res);
                  }}
                  className="px-2 py-0.5 rounded bg-secondary text-foreground text-2xs font-medium hover:bg-accent transition"
                >
                  Benchmark 1080p
                </button>
              </div>
              {nativeBench && (
                <div className="text-2xs font-mono text-muted-foreground">
                  {nativeBench.fps} fps • {nativeBench.throughputMBps} MB/s
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
