import React, { useState, useEffect, useRef } from 'react';
import {
  X, Radio, Video, Mic, Volume2, VolumeX, Eye, EyeOff, Lock, Unlock,
  Plus, Trash2, Copy, ArrowUp, ArrowDown, ArrowRight, Layers, Monitor,
  Settings, Sliders, Circle, Square, Undo2, ShieldAlert, CheckCircle2,
  AlertTriangle, Download, Upload, RefreshCw, Tv, MonitorPlay, Film
} from 'lucide-react';
import {
  BroadcastScene,
  BroadcastSource,
  BroadcastSourceType,
  BroadcastStudioProjectData,
  BroadcastTransitionType
} from '../types/broadcastStudio';
import { Slide, MediaAsset, ChurchProfile } from '../types/presentation';
import { loadBroadcastStudioData, saveBroadcastStudioData } from '../services/broadcastStudioStorage';
import { renderBroadcastScene } from '../services/broadcastCompositor';

interface StreamingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveSlide: Slide | null;
  countdownSeconds: number;
  countdownTitle: string;
  lowerThird: { title?: string; subtitle?: string; content?: string } | null;
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

export const StreamingStudioModal: React.FC<StreamingStudioModalProps> = ({
  isOpen,
  onClose,
  liveSlide,
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
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [previousProgramSceneId, setPreviousProgramSceneId] = useState<string | null>(null);

  // Sub-panels / drawers
  const [activeTab, setActiveTab] = useState<'studio' | 'outputs' | 'settings'>('studio');
  const [showAddSourceMenu, setShowAddSourceMenu] = useState(false);

  // Live broadcast & recording state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [broadcastBlack, setBroadcastBlack] = useState(false);
  const [streamElapsed, setStreamElapsed] = useState(0);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [availableEncoders, setAvailableEncoders] = useState<string[]>(['libx264']);
  const [sysStats, setSysStats] = useState<{ rssMb: number; usedMemPct: number; load1m: number; cpuCount: number } | null>(null);
  const [connTestResult, setConnTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lastRecordingPath, setLastRecordingPath] = useState<string>('');
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

  // Devices & live streams
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [channelLevels, setChannelLevels] = useState<Record<string, number>>({});

  // Canvas & media element caches
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const programCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const cameraStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioNodesRef = useRef<Map<string, { gain: GainNode; analyser: AnalyserNode }>>(new Map());
  const streamRecorderRef = useRef<MediaRecorder | null>(null);
  const recordRecorderRef = useRef<MediaRecorder | null>(null);

  // Transition state
  const transitionSnapshotRef = useRef<{ active: boolean; startedAt: number; durationMs: number; img: HTMLCanvasElement | null }>({
    active: false,
    startedAt: 0,
    durationMs: 400,
    img: null
  });

  // Drag / Resize state on Preview canvas
  const dragStateRef = useRef<{
    mode: 'move' | 'resize';
    sourceId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Latest shared props ref for 30/60fps render loop without restarting loop
  const sharedRef = useRef({
    liveSlide,
    countdownSeconds,
    countdownTitle,
    lowerThird,
    churchProfile,
    broadcastBlack,
    studio
  });
  sharedRef.current = {
    liveSlide,
    countdownSeconds,
    countdownTitle,
    lowerThird,
    churchProfile,
    broadcastBlack,
    studio
  };

  // Persist studio state
  useEffect(() => {
    saveBroadcastStudioData(studio);
  }, [studio]);

  const programScene = studio.scenes.find(s => s.id === studio.activeProgramSceneId) || studio.scenes[0] || null;
  const previewScene = studio.scenes.find(s => s.id === studio.activePreviewSceneId) || studio.scenes[0] || null;
  const selectedSource = previewScene?.sources.find(s => s.id === selectedSourceId) || null;

  const [resW, resH] = (() => {
    if (studio.outputConfig.resolution === 'custom') {
      return [Math.max(640, studio.outputConfig.customWidth || 1920), Math.max(360, studio.outputConfig.customHeight || 1080)];
    }
    const [w, h] = studio.outputConfig.resolution.split('x').map(Number);
    return [w || 1920, h || 1080];
  })();

  // Enumerate devices & detect encoders/stats when Studio opens
  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      let devs = await navigator.mediaDevices.enumerateDevices();
      if (devs.some(d => (d.kind === 'videoinput' || d.kind === 'audioinput') && !d.label)) {
        try {
          const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          tmp.getTracks().forEach(t => t.stop());
          devs = await navigator.mediaDevices.enumerateDevices();
        } catch {}
      }
      setVideoDevices(devs.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devs.filter(d => d.kind === 'audioinput'));
    } catch {}
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
          if (dir) {
            setStudio(prev => ({
              ...prev,
              outputConfig: { ...prev.outputConfig, recordingDir: dir }
            }));
          }
        }).catch(() => {});
      }
      const statsTimer = setInterval(() => {
        ipc.invoke('get-system-stats').then((st: any) => st && setSysStats(st)).catch(() => {});
      }, 2500);
      return () => clearInterval(statsTimer);
    }
  }, [isOpen]);

  // Listen to stream/recording IPC events
  useEffect(() => {
    if (!ipc) return;
    const onLog = (_: any, msg: string) => setStreamLogs(prev => [...prev.slice(-40), msg]);
    const onEnded = () => {
      setIsStreaming(false);
      setStreamLogs(prev => [...prev, '— Broadcast stream ended —']);
    };
    const onRecEnded = (_: any, info: { filePath?: string }) => {
      setIsRecording(false);
      if (info?.filePath) setLastRecordingPath(info.filePath);
    };
    ipc.on('stream-log', onLog);
    ipc.on('stream-ended', onEnded);
    ipc.on('recording-ended', onRecEnded);
    return () => {
      ipc.removeListener('stream-log', onLog);
      ipc.removeListener('stream-ended', onEnded);
      ipc.removeListener('recording-ended', onRecEnded);
    };
  }, [ipc]);

  // Elapsed timers
  useEffect(() => {
    if (!isStreaming) {
      setStreamElapsed(0);
      return;
    }
    const t = setInterval(() => setStreamElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isStreaming]);

  useEffect(() => {
    if (!isRecording) {
      setRecordElapsed(0);
      return;
    }
    const t = setInterval(() => setRecordElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  // Acquire active camera streams needed by any visible source in Preview or Program
  useEffect(() => {
    if (!isOpen) return;
    const neededCamKeys = new Set<string>();
    [previewScene, programScene].forEach(sc => {
      sc?.sources.forEach(src => {
        if (src.visible && src.type === 'camera') {
          neededCamKeys.add(src.deviceId || 'default-camera');
        }
      });
    });

    neededCamKeys.forEach(async (camKey) => {
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
  }, [isOpen, previewScene, programScene, resW, resH, studio.outputConfig.fps]);

  // Preload image & logo elements
  useEffect(() => {
    if (!isOpen) return;
    const urls = new Set<string>();
    if (churchProfile.logoUrl) urls.add(churchProfile.logoUrl);
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
  }, [isOpen, studio.scenes, churchProfile.logoUrl]);

  // Setup AudioContext Mixer for broadcast channels
  useEffect(() => {
    if (!isOpen) return;
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
      if (!ch.deviceId || ch.deviceId === 'none') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: ch.deviceId ? { exact: ch.deviceId } : undefined,
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
      const levels: Record<string, number> = {};
      audioNodesRef.current.forEach((node, chId) => {
        const ch = sharedRef.current.studio.audioChannels.find(c => c.id === chId);
        if (!ch || ch.muted) {
          levels[chId] = 0;
          return;
        }
        const buf = new Uint8Array(node.analyser.frequencyBinCount);
        node.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        levels[chId] = Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 280 * ch.volume));
      });
      setChannelLevels(levels);
    }, 80);

    return () => clearInterval(meterTimer);
  }, [isOpen, studio.audioChannels]);

  // Cleanup hardware streams when Studio closes (unless actively streaming/recording)
  useEffect(() => {
    if (isOpen) return;
    if (!isStreaming && !isRecording) {
      cameraStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
      cameraStreamsRef.current.clear();
      audioStreamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
      audioStreamsRef.current.clear();
      videoElementsRef.current.clear();
      audioNodesRef.current.clear();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        audioDestRef.current = null;
      }
    }
  }, [isOpen, isStreaming, isRecording]);

  // Main Compositor Render Loop (Preview + Program Canvases)
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    let lastDraw = 0;
    const frameInterval = 1000 / studio.outputConfig.fps;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (now - lastDraw < frameInterval) return;
      lastDraw = now;

      const s = sharedRef.current;
      const pScene = s.studio.scenes.find(sc => sc.id === s.studio.activePreviewSceneId) || s.studio.scenes[0] || null;
      const gScene = s.studio.scenes.find(sc => sc.id === s.studio.activeProgramSceneId) || s.studio.scenes[0] || null;

      const sharedData = {
        liveSlide: s.liveSlide,
        countdownSeconds: s.countdownSeconds,
        countdownTitle: s.countdownTitle,
        lowerThird: s.lowerThird,
        churchProfile: s.churchProfile,
        emergencyBlack: s.broadcastBlack,
        videoElements: videoElementsRef.current,
        imageElements: imageElementsRef.current
      };

      const prevCanvas = previewCanvasRef.current;
      if (prevCanvas) {
        const ctx = prevCanvas.getContext('2d');
        if (ctx) renderBroadcastScene(ctx, prevCanvas.width, prevCanvas.height, pScene, sharedData);
      }

      const progCanvas = programCanvasRef.current;
      if (progCanvas) {
        const ctx = progCanvas.getContext('2d');
        if (ctx) {
          renderBroadcastScene(ctx, progCanvas.width, progCanvas.height, gScene, sharedData);

          const tr = transitionSnapshotRef.current;
          if (tr.active && tr.img) {
            const elapsed = performance.now() - tr.startedAt;
            const progress = Math.min(1, elapsed / Math.max(1, tr.durationMs));
            if (progress < 1) {
              ctx.save();
              ctx.globalAlpha = 1 - progress;
              ctx.drawImage(tr.img, 0, 0, progCanvas.width, progCanvas.height);
              ctx.restore();
            } else {
              tr.active = false;
              tr.img = null;
            }
          }
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, studio.outputConfig.fps]);

  if (!isOpen) return null;

  // ── Scene & Source Actions ──
  const updatePreviewScene = (updater: (sc: BroadcastScene) => BroadcastScene) => {
    if (!previewScene) return;
    setStudio(prev => ({
      ...prev,
      scenes: prev.scenes.map(sc => (sc.id === previewScene.id ? updater(sc) : sc))
    }));
  };

  const handleTakeTransition = (typeOverride?: BroadcastTransitionType) => {
    if (!previewScene) return;
    const trType = typeOverride || previewScene.transitionType || 'fade';
    const trDur = trType === 'cut' ? 0 : (previewScene.transitionDurationMs || 400);

    if (trDur > 0 && programCanvasRef.current) {
      const snap = document.createElement('canvas');
      snap.width = programCanvasRef.current.width;
      snap.height = programCanvasRef.current.height;
      snap.getContext('2d')?.drawImage(programCanvasRef.current, 0, 0);
      transitionSnapshotRef.current = {
        active: true,
        startedAt: performance.now(),
        durationMs: trDur,
        img: snap
      };
    }

    setPreviousProgramSceneId(studio.activeProgramSceneId);
    setStudio(prev => ({
      ...prev,
      activeProgramSceneId: previewScene.id
    }));
  };

  const handleReturnPreviousScene = () => {
    if (!previousProgramSceneId) return;
    const target = previousProgramSceneId;
    setPreviousProgramSceneId(studio.activeProgramSceneId);
    setStudio(prev => ({ ...prev, activeProgramSceneId: target }));
  };

  const addScene = () => {
    const name = `Scene ${studio.scenes.length + 1}`;
    const newScene: BroadcastScene = {
      id: `scene-${Date.now()}`,
      name,
      transitionType: 'fade',
      transitionDurationMs: 400,
      sources: [
        {
          id: `src-${Date.now()}`,
          name: 'Backdrop',
          type: 'color_bg',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1,
          bgColor: '#090d1a'
        }
      ]
    };
    setStudio(prev => ({
      ...prev,
      scenes: [...prev.scenes, newScene],
      activePreviewSceneId: newScene.id
    }));
  };

  const duplicatePreviewScene = () => {
    if (!previewScene) return;
    const copy: BroadcastScene = {
      ...previewScene,
      id: `scene-${Date.now()}`,
      name: `${previewScene.name} (Copy)`,
      sources: previewScene.sources.map(s => ({ ...s, id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))
    };
    setStudio(prev => ({
      ...prev,
      scenes: [...prev.scenes, copy],
      activePreviewSceneId: copy.id
    }));
  };

  const deletePreviewScene = () => {
    if (!previewScene || studio.scenes.length <= 1) return;
    const remaining = studio.scenes.filter(s => s.id !== previewScene.id);
    setStudio(prev => ({
      ...prev,
      scenes: remaining,
      activePreviewSceneId: remaining[0].id,
      activeProgramSceneId: prev.activeProgramSceneId === previewScene.id ? remaining[0].id : prev.activeProgramSceneId
    }));
  };

  const addSourceToPreview = (type: BroadcastSourceType) => {
    if (!previewScene) return;
    const defaults: Record<BroadcastSourceType, Partial<BroadcastSource>> = {
      camera: { name: 'Camera Input', x: 0, y: 0, width: 100, height: 100, deviceId: videoDevices[0]?.deviceId || '' },
      screen: { name: 'Screen Capture', x: 0, y: 0, width: 100, height: 100 },
      live_slide: { name: 'Live Psalm Slide', x: 0, y: 0, width: 100, height: 100, bgColor: '#090d1a', textColor: '#ffffff', fontSize: 54 },
      lyrics_overlay: { name: 'Lyrics Overlay', x: 6, y: 72, width: 88, height: 22, bgColor: 'rgba(6,10,22,0.78)', textColor: '#ffffff', fontSize: 42, borderRadius: 14 },
      bible_overlay: { name: 'Bible Verse Overlay', x: 5, y: 68, width: 90, height: 27, bgColor: 'rgba(10,15,32,0.85)', textColor: '#ffffff', fontSize: 38, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(245,158,11,0.7)' },
      lower_third: { name: 'Lower Third Banner', x: 4, y: 84, width: 92, height: 11, bgColor: 'rgba(15,23,42,0.9)', textColor: '#ffffff', fontSize: 30, borderRadius: 10 },
      countdown: { name: 'Countdown Timer', x: 15, y: 30, width: 70, height: 42, textColor: '#ffffff', fontSize: 110 },
      logo: { name: 'Church Logo', x: 86, y: 4, width: 10, height: 14 },
      image: { name: 'Image Overlay', x: 10, y: 10, width: 40, height: 40, mediaUrl: mediaList.find(m => m.type === 'image')?.url || '' },
      video: { name: 'Video Overlay', x: 0, y: 0, width: 100, height: 100, mediaUrl: mediaList.find(m => m.type === 'video')?.url || '' },
      text: { name: 'Custom Text', x: 10, y: 8, width: 80, height: 14, text: churchProfile.name || 'Welcome to Worship', textColor: '#ffffff', bgColor: 'rgba(0,0,0,0.6)', fontSize: 40, borderRadius: 10 },
      color_bg: { name: 'Color Backdrop', x: 0, y: 0, width: 100, height: 100, bgColor: '#090d1a' }
    };
    const d = defaults[type];
    const maxZ = previewScene.sources.reduce((acc, s) => Math.max(acc, s.zIndex), 0);
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
    updatePreviewScene(sc => ({ ...sc, sources: [...sc.sources, newSrc] }));
    setSelectedSourceId(newSrc.id);
    setShowAddSourceMenu(false);
  };

  const captureScreenSource = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      cameraStreamsRef.current.set('screen', stream);
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.srcObject = stream;
      await vid.play().catch(() => {});
      videoElementsRef.current.set('screen', vid);
    } catch {}
  };

  // ── Canvas Drag & Resize Handlers ──
  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewScene) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;

    // Check resize handle on currently selected source first
    if (selectedSource && !selectedSource.locked && selectedSource.visible) {
      const rx = selectedSource.x + selectedSource.width;
      const ry = selectedSource.y + selectedSource.height;
      if (Math.abs(px - rx) < 4 && Math.abs(py - ry) < 5) {
        dragStateRef.current = {
          mode: 'resize',
          sourceId: selectedSource.id,
          startX: px,
          startY: py,
          origX: selectedSource.x,
          origY: selectedSource.y,
          origW: selectedSource.width,
          origH: selectedSource.height
        };
        return;
      }
    }

    // Hit-test topmost visible unlocked source
    const hit = [...previewScene.sources]
      .sort((a, b) => b.zIndex - a.zIndex)
      .find(s => s.visible && px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height);

    if (hit) {
      setSelectedSourceId(hit.id);
      if (!hit.locked) {
        dragStateRef.current = {
          mode: 'move',
          sourceId: hit.id,
          startX: px,
          startY: py,
          origX: hit.x,
          origY: hit.y,
          origW: hit.width,
          origH: hit.height
        };
      }
    } else {
      setSelectedSourceId(null);
    }
  };

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const dx = px - drag.startX;
    const dy = py - drag.startY;

    updatePreviewScene(sc => ({
      ...sc,
      sources: sc.sources.map(src => {
        if (src.id !== drag.sourceId) return src;
        if (drag.mode === 'move') {
          return {
            ...src,
            x: Math.round(Math.max(-50, Math.min(95, drag.origX + dx)) * 10) / 10,
            y: Math.round(Math.max(-50, Math.min(95, drag.origY + dy)) * 10) / 10
          };
        }
        return {
          ...src,
          width: Math.round(Math.max(5, Math.min(100, drag.origW + dx)) * 10) / 10,
          height: Math.round(Math.max(5, Math.min(100, drag.origH + dy)) * 10) / 10
        };
      })
    }));
  };

  const handlePreviewMouseUp = () => {
    dragStateRef.current = null;
  };

  // ── Start / Stop Broadcast Stream & Local Recording ──
  const buildCombinedProgramStream = (): MediaStream | null => {
    const canvas = programCanvasRef.current;
    if (!canvas) return null;
    const vStream = canvas.captureStream(studio.outputConfig.fps);
    const tracks: MediaStreamTrack[] = [...vStream.getVideoTracks()];
    if (audioDestRef.current) {
      tracks.push(...audioDestRef.current.stream.getAudioTracks());
    }
    return new MediaStream(tracks);
  };

  const startBroadcastStream = async () => {
    const dest = studio.destinations.find(d => d.id === studio.activeDestinationId) || studio.destinations[0];
    if (!dest || !dest.serverUrl.trim() || !dest.streamKey.trim()) {
      setStreamLogs(prev => [...prev, '❌ Configure a Destination Server URL & Stream Key in Broadcast Settings first.']);
      setActiveTab('settings');
      return;
    }
    if (!ipc) {
      setStreamLogs(prev => [...prev, '⚠ Streaming requires the Electron desktop app.']);
      return;
    }
    const rtmpUrl = dest.serverUrl.endsWith('/') ? `${dest.serverUrl}${dest.streamKey}` : `${dest.serverUrl}/${dest.streamKey}`;
    const resStr = `${resW}x${resH}`;

    const result = await ipc.invoke('start-stream', {
      rtmpUrl,
      resolution: resStr,
      fps: studio.outputConfig.fps,
      bitrate: studio.outputConfig.videoBitrateKbps,
      useMediaPipe: true,
      hasVideo: true,
      hasAudio: true
    });

    if (!result?.success) {
      setStreamLogs(prev => [...prev, `❌ Failed to start stream: ${result?.error || 'Unknown error'}`]);
      return;
    }

    const combined = buildCombinedProgramStream();
    if (combined) {
      const mime = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(combined, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: Math.max(studio.outputConfig.videoBitrateKbps * 1000 * 1.4, 8000000),
        audioBitsPerSecond: studio.outputConfig.audioBitrateKbps * 1000
      });
      rec.ondataavailable = async (ev) => {
        if (ev.data && ev.data.size > 0) {
          const buf = await ev.data.arrayBuffer();
          ipc.send('stream-data', new Uint8Array(buf));
        }
      };
      rec.start(250);
      streamRecorderRef.current = rec;
    }
    setIsStreaming(true);
    setStreamLogs(prev => [...prev, `✅ Streaming LIVE to ${dest.name} (${resStr} @ ${studio.outputConfig.fps}fps)`]);
  };

  const stopBroadcastStream = async () => {
    setConfirmStopOpen(false);
    if (streamRecorderRef.current && streamRecorderRef.current.state !== 'inactive') {
      try { streamRecorderRef.current.stop(); } catch {}
      streamRecorderRef.current = null;
    }
    if (ipc) await ipc.invoke('stop-stream').catch(() => {});
    setIsStreaming(false);
    setStreamLogs(prev => [...prev, '⏹ Broadcast stream stopped.']);
  };

  const startLocalRecording = async () => {
    if (!ipc) return;
    const resStr = `${resW}x${resH}`;
    const result = await ipc.invoke('start-recording', {
      recordingDir: studio.outputConfig.recordingDir,
      format: studio.outputConfig.recordingFormat,
      resolution: resStr,
      fps: studio.outputConfig.fps,
      bitrate: studio.outputConfig.recordingQuality === 'high' ? Math.max(8000, studio.outputConfig.videoBitrateKbps) : studio.outputConfig.videoBitrateKbps,
      audioBitrate: studio.outputConfig.audioBitrateKbps
    });
    if (!result?.success) {
      setStreamLogs(prev => [...prev, `❌ Recording failed: ${result?.error}`]);
      return;
    }
    const combined = buildCombinedProgramStream();
    if (combined) {
      const mime = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(combined, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 10000000,
        audioBitsPerSecond: 256000
      });
      rec.ondataavailable = async (ev) => {
        if (ev.data && ev.data.size > 0) {
          const buf = await ev.data.arrayBuffer();
          ipc.send('recording-data', new Uint8Array(buf));
        }
      };
      rec.start(250);
      recordRecorderRef.current = rec;
    }
    setIsRecording(true);
    setLastRecordingPath(result.filePath || '');
    setStreamLogs(prev => [...prev, `⏺ Recording locally to ${result.filePath}`]);
  };

  const stopLocalRecording = async () => {
    if (recordRecorderRef.current && recordRecorderRef.current.state !== 'inactive') {
      try { recordRecorderRef.current.stop(); } catch {}
      recordRecorderRef.current = null;
    }
    if (ipc) await ipc.invoke('stop-recording').catch(() => {});
    setIsRecording(false);
    setStreamLogs(prev => [...prev, '⏹ Local recording saved.']);
  };

  const exportStudioConfig = () => {
    const safeData: BroadcastStudioProjectData = {
      ...studio,
      destinations: studio.destinations.map(d => ({ ...d, streamKey: '' })) // Never export exposed credentials
    };
    const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LivePsalms_StudioConfig_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importStudioConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.scenes)) {
          setStudio(prev => ({ ...prev, ...parsed }));
        }
      } catch {}
    };
    reader.readAsText(file);
  };

  const estBandwidthMbps = ((studio.outputConfig.videoBitrateKbps + studio.outputConfig.audioBitrateKbps) / 1000).toFixed(2);

  return (
    <div className="fixed inset-0 z-[110] bg-[#070b13] text-slate-100 flex flex-col select-none overflow-hidden font-sans">
      {/* ─── TOP STUDIO TOOLBAR ─── */}
      <header className="h-12 bg-[#0d1320] border-b border-[#26334a] px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-600 to-indigo-600">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-sm tracking-tight text-white">Streaming Studio</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              OBS Workflow
            </span>
          </div>

          <div className="h-5 w-px bg-[#26334a]" />

          {/* Workspace Tabs */}
          <div className="flex items-center gap-1 bg-[#080c15] p-1 rounded-lg border border-[#1f2b42]">
            {[
              { id: 'studio', label: 'Studio' },
              { id: 'outputs', label: 'Output Manager' },
              { id: 'settings', label: 'Broadcast Settings' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right Broadcast Controls */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-300 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE {fmtElapsed(streamElapsed)}</span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-300 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>REC {fmtElapsed(recordElapsed)}</span>
            </div>
          )}

          <button
            onClick={() => setBroadcastBlack(b => !b)}
            className={`h-8 px-2.5 rounded-lg border text-[11px] font-black uppercase flex items-center gap-1.5 transition ${
              broadcastBlack
                ? 'bg-rose-600 border-rose-400 text-white'
                : 'bg-[#151e30] border-[#26334a] text-slate-300 hover:border-slate-500'
            }`}
            title="Emergency Black on Broadcast Output ONLY (does not affect projector)"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{broadcastBlack ? 'Stream Black ON' : 'Black'}</span>
          </button>

          {previousProgramSceneId && (
            <button
              onClick={handleReturnPreviousScene}
              className="h-8 px-2.5 rounded-lg bg-[#151e30] hover:bg-[#1e2a42] border border-[#26334a] text-slate-200 text-[11px] font-bold flex items-center gap-1 transition"
              title="Return to previous live scene"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Prev Scene</span>
            </button>
          )}

          {/* Start/Stop Recording */}
          {isRecording ? (
            <button
              onClick={stopLocalRecording}
              className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 transition"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop Rec</span>
            </button>
          ) : (
            <button
              onClick={startLocalRecording}
              className="h-8 px-3 rounded-lg bg-[#182338] hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition"
              title="Record broadcast locally (works offline)"
            >
              <Circle className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Record</span>
            </button>
          )}

          {/* Start/Stop Streaming */}
          {isStreaming ? (
            <button
              onClick={() => setConfirmStopOpen(true)}
              className="h-8 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 transition shadow-lg"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop Stream</span>
            </button>
          ) : (
            <button
              onClick={startBroadcastStream}
              className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-xs flex items-center gap-1.5 transition shadow-lg"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Go Live</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="h-8 px-3 rounded-lg bg-[#182338] hover:bg-slate-700 border border-[#26334a] text-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
            title="Return to Presentation Console (streaming continues)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Back to Console</span>
          </button>
        </div>
      </header>

      {/* Stop Stream Confirmation Modal */}
      {confirmStopOpen && (
        <div className="fixed inset-0 z-[200] bg-black/75 flex items-center justify-center">
          <div className="bg-[#101726] border border-rose-500/50 rounded-2xl p-5 w-96 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-300 font-black text-sm">
              <AlertTriangle className="w-5 h-5" /> Stop Live Broadcast?
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your stream has been live for <strong>{fmtElapsed(streamElapsed)}</strong>. Are you sure you want to end the broadcast?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmStopOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
              >
                Keep Streaming
              </button>
              <button
                onClick={stopBroadcastStream}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-black text-white"
              >
                Yes, Stop Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BODY ─── */}
      {activeTab === 'studio' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">
          {/* TOP HALF: PREVIEW | TRANSITION | PROGRAM */}
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_140px_1fr] gap-3 items-stretch">
            {/* PREVIEW MONITOR (Interactive Composition Editor) */}
            <div className="bg-[#0d1320] border border-sky-500/40 rounded-xl p-2.5 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Preview: {previewScene?.name || 'None'}
                </span>
                <span className="text-[10px] text-slate-400">Drag or resize sources on canvas</span>
              </div>

              <div className="flex-1 min-h-0 flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
                <div
                  className="relative w-full h-full max-w-full max-h-full aspect-video cursor-crosshair"
                  onMouseDown={handlePreviewMouseDown}
                  onMouseMove={handlePreviewMouseMove}
                  onMouseUp={handlePreviewMouseUp}
                  onMouseLeave={handlePreviewMouseUp}
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={resW}
                    height={resH}
                    className="w-full h-full object-contain block"
                  />
                  {/* Interactive bounding box for selected source */}
                  {selectedSource && selectedSource.visible && (
                    <div
                      className="absolute border-2 border-amber-400 pointer-events-none"
                      style={{
                        left: `${selectedSource.x}%`,
                        top: `${selectedSource.y}%`,
                        width: `${selectedSource.width}%`,
                        height: `${selectedSource.height}%`
                      }}
                    >
                      <span className="absolute -top-5 left-0 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap">
                        {selectedSource.name} ({Math.round(selectedSource.x)}%, {Math.round(selectedSource.y)}%)
                      </span>
                      {!selectedSource.locked && (
                        <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 border border-black rounded-sm" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TRANSITION CONTROLS */}
            <div className="bg-[#0d1320] border border-[#26334a] rounded-xl p-2.5 flex flex-col items-center justify-center gap-2.5">
              <button
                onClick={() => handleTakeTransition()}
                className="w-full py-3 px-2 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider flex flex-col items-center gap-1 shadow-lg transition"
                title="Transition Preview Scene to Program (Live)"
              >
                <ArrowRight className="w-5 h-5" />
                <span>Transition</span>
                <span className="text-[9px] opacity-80 font-bold">TAKE LIVE</span>
              </button>

              <div className="w-full space-y-1.5 pt-1 border-t border-slate-800">
                <label className="text-[9px] font-black uppercase text-slate-400 block text-center">Transition</label>
                <select
                  value={previewScene?.transitionType || 'fade'}
                  onChange={e => updatePreviewScene(sc => ({ ...sc, transitionType: e.target.value as BroadcastTransitionType }))}
                  className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none"
                >
                  <option value="cut">Cut</option>
                  <option value="fade">Fade</option>
                  <option value="dissolve">Dissolve</option>
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    step={50}
                    value={previewScene?.transitionDurationMs ?? 400}
                    onChange={e => updatePreviewScene(sc => ({ ...sc, transitionDurationMs: Number(e.target.value) || 0 }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-mono text-white outline-none"
                  />
                  <span className="text-[9px] text-slate-500">ms</span>
                </div>
              </div>

              <button
                onClick={() => handleTakeTransition('cut')}
                className="w-full py-1.5 rounded-lg bg-[#151e30] hover:bg-slate-700 border border-[#26334a] text-[10px] font-bold text-slate-300 transition"
              >
                Quick Cut
              </button>
            </div>

            {/* PROGRAM OUTPUT MONITOR */}
            <div className="bg-[#0d1320] border border-rose-500/50 rounded-xl p-2.5 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-rose-500 animate-pulse' : 'bg-rose-400'}`} />
                  Program: {programScene?.name || 'None'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {resW}×{resH} • {studio.outputConfig.fps}fps • {studio.outputConfig.videoBitrateKbps}k
                </span>
              </div>

              <div className="flex-1 min-h-0 flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
                <canvas
                  ref={programCanvasRef}
                  width={resW}
                  height={resH}
                  className="w-full h-full object-contain block"
                />
                {isStreaming && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600/90 text-white text-[9px] font-black uppercase tracking-widest">
                    ON AIR
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LOWER HALF: SCENES | SOURCES | AUDIO MIXER | SOURCE PROPERTIES */}
          <div className="h-64 shrink-0 grid grid-cols-12 gap-3 min-h-0">
            {/* SCENES (3 cols) */}
            <div className="col-span-3 bg-[#0d1320] border border-[#26334a] rounded-xl p-2.5 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Scenes</span>
                <div className="flex items-center gap-1">
                  <button onClick={addScene} className="p-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200" title="Add Scene"><Plus className="w-3 h-3" /></button>
                  <button onClick={duplicatePreviewScene} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300" title="Duplicate Scene"><Copy className="w-3 h-3" /></button>
                  <button onClick={deletePreviewScene} className="p-1 rounded bg-slate-800 hover:bg-rose-600/60 text-slate-300" title="Delete Scene"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {studio.scenes.map(sc => {
                  const isPrev = sc.id === studio.activePreviewSceneId;
                  const isProg = sc.id === studio.activeProgramSceneId;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        setStudio(prev => ({ ...prev, activePreviewSceneId: sc.id }));
                        setSelectedSourceId(null);
                      }}
                      onDoubleClick={() => {
                        setStudio(prev => ({ ...prev, activePreviewSceneId: sc.id, activeProgramSceneId: sc.id }));
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer border transition ${
                        isPrev
                          ? 'bg-sky-500/20 border-sky-500/60 text-white'
                          : 'bg-[#080d16] border-slate-800/80 text-slate-300 hover:border-slate-600'
                      }`}
                      title="Click to Preview, Double-Click to Send Live"
                    >
                      <span className="truncate">{sc.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPrev && <span className="px-1 py-0.5 rounded bg-sky-500/30 text-sky-200 text-[8px] font-black">PVW</span>}
                        {isProg && <span className="px-1 py-0.5 rounded bg-rose-500/30 text-rose-200 text-[8px] font-black">PGM</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SOURCES (3 cols) */}
            <div className="col-span-3 bg-[#0d1320] border border-[#26334a] rounded-xl p-2.5 flex flex-col min-h-0 relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-400" /> Sources
                </span>
                <button
                  onClick={() => setShowAddSourceMenu(v => !v)}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {showAddSourceMenu && (
                <div className="absolute top-9 right-2 z-50 w-52 bg-[#101726] border border-indigo-500/50 rounded-xl shadow-2xl p-1.5 grid grid-cols-1 gap-0.5 max-h-52 overflow-y-auto">
                  {[
                    { type: 'camera', label: 'Camera / Capture Card' },
                    { type: 'screen', label: 'Screen / Window Capture' },
                    { type: 'lyrics_overlay', label: 'Live Psalm Lyrics Overlay' },
                    { type: 'bible_overlay', label: 'Bible Verse Overlay' },
                    { type: 'live_slide', label: 'Full Presentation Slide' },
                    { type: 'countdown', label: 'Countdown Timer' },
                    { type: 'lower_third', label: 'Lower-Third Banner' },
                    { type: 'logo', label: 'Church Logo' },
                    { type: 'image', label: 'Image Overlay' },
                    { type: 'video', label: 'Video File' },
                    { type: 'text', label: 'Custom Text' },
                    { type: 'color_bg', label: 'Color Backdrop' }
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => {
                        if (item.type === 'screen') captureScreenSource();
                        addSourceToPreview(item.type as BroadcastSourceType);
                      }}
                      className="text-left px-2.5 py-1 rounded-lg hover:bg-indigo-600/30 text-[11px] font-semibold text-slate-200"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {[...(previewScene?.sources || [])].sort((a, b) => b.zIndex - a.zIndex).map(src => (
                  <div
                    key={src.id}
                    onClick={() => setSelectedSourceId(src.id)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border ${
                      selectedSourceId === src.id
                        ? 'bg-amber-500/15 border-amber-500/60 text-white'
                        : 'bg-[#080d16] border-slate-800/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="truncate flex-1">{src.name}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePreviewScene(sc => ({
                          ...sc,
                          sources: sc.sources.map(s => (s.id === src.id ? { ...s, zIndex: s.zIndex + 1 } : s))
                        }));
                      }}
                      className="text-slate-500 hover:text-white"
                      title="Move Layer Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePreviewScene(sc => ({
                          ...sc,
                          sources: sc.sources.map(s => (s.id === src.id ? { ...s, zIndex: Math.max(0, s.zIndex - 1) } : s))
                        }));
                      }}
                      className="text-slate-500 hover:text-white"
                      title="Move Layer Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePreviewScene(sc => ({
                          ...sc,
                          sources: sc.sources.map(s => (s.id === src.id ? { ...s, visible: !s.visible } : s))
                        }));
                      }}
                      className={src.visible ? 'text-emerald-400' : 'text-slate-600'}
                      title="Show / Hide"
                    >
                      {src.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePreviewScene(sc => ({
                          ...sc,
                          sources: sc.sources.map(s => (s.id === src.id ? { ...s, locked: !s.locked } : s))
                        }));
                      }}
                      className={src.locked ? 'text-amber-400' : 'text-slate-600'}
                      title="Lock / Unlock"
                    >
                      {src.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePreviewScene(sc => ({
                          ...sc,
                          sources: sc.sources.filter(s => s.id !== src.id)
                        }));
                        if (selectedSourceId === src.id) setSelectedSourceId(null);
                      }}
                      className="text-slate-600 hover:text-rose-400"
                      title="Remove Source"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AUDIO MIXER (3 cols) */}
            <div className="col-span-3 bg-[#0d1320] border border-[#26334a] rounded-xl p-2.5 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <Mic className="w-3 h-3 text-emerald-400" /> Broadcast Audio Mixer
                </span>
                <button onClick={refreshDevices} className="text-slate-400 hover:text-white" title="Refresh audio devices">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {studio.audioChannels.map(ch => {
                  const lvl = channelLevels[ch.id] || 0;
                  return (
                    <div key={ch.id} className="bg-[#080d16] border border-slate-800 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-slate-200 truncate">{ch.name}</span>
                        <button
                          onClick={() => {
                            setStudio(prev => ({
                              ...prev,
                              audioChannels: prev.audioChannels.map(c => (c.id === ch.id ? { ...c, muted: !c.muted } : c))
                            }));
                          }}
                          className={`p-1 rounded ${ch.muted ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                          title={ch.muted ? 'Unmute' : 'Mute'}
                        >
                          {ch.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                      </div>
                      <select
                        value={ch.deviceId}
                        onChange={e => {
                          const val = e.target.value;
                          setStudio(prev => ({
                            ...prev,
                            audioChannels: prev.audioChannels.map(c => (c.id === ch.id ? { ...c, deviceId: val } : c))
                          }));
                        }}
                        className="w-full bg-[#0d1320] border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200 outline-none"
                      >
                        <option value="">Default Input</option>
                        {audioDevices.map((d, idx) => (
                          <option key={d.deviceId || idx} value={d.deviceId}>{d.label || `Audio Input ${idx + 1}`}</option>
                        ))}
                        <option value="none">Disabled</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={150}
                          value={Math.round(ch.volume * 100)}
                          onChange={e => {
                            const v = Number(e.target.value) / 100;
                            setStudio(prev => ({
                              ...prev,
                              audioChannels: prev.audioChannels.map(c => (c.id === ch.id ? { ...c, volume: v } : c))
                            }));
                          }}
                          className="flex-1 accent-emerald-500 h-1.5"
                        />
                        <span className="text-[10px] font-mono text-slate-400 w-9 text-right">{Math.round(ch.volume * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-75 ${lvl > 85 ? 'bg-rose-500' : lvl > 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${ch.muted ? 0 : lvl}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SOURCE PROPERTIES (3 cols) */}
            <div className="col-span-3 bg-[#0d1320] border border-[#26334a] rounded-xl p-2.5 flex flex-col min-h-0">
              <div className="border-b border-slate-800 pb-1.5 mb-1.5 shrink-0 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-amber-400" /> Source Properties
                </span>
                {selectedSource && (
                  <button
                    onClick={() => {
                      const copy: BroadcastSource = {
                        ...selectedSource,
                        id: `src-${Date.now()}`,
                        name: `${selectedSource.name} Copy`,
                        x: Math.min(80, selectedSource.x + 3),
                        y: Math.min(80, selectedSource.y + 3),
                        zIndex: selectedSource.zIndex + 1
                      };
                      updatePreviewScene(sc => ({ ...sc, sources: [...sc.sources, copy] }));
                      setSelectedSourceId(copy.id);
                    }}
                    className="text-[9px] font-bold text-indigo-300 hover:text-white"
                  >
                    Duplicate
                  </button>
                )}
              </div>

              {selectedSource ? (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px]">
                  <input
                    type="text"
                    value={selectedSource.name}
                    onChange={e => updatePreviewScene(sc => ({
                      ...sc,
                      sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, name: e.target.value } : s))
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white outline-none"
                  />

                  {selectedSource.type === 'camera' && (
                    <select
                      value={selectedSource.deviceId || ''}
                      onChange={e => updatePreviewScene(sc => ({
                        ...sc,
                        sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, deviceId: e.target.value } : s))
                      }))}
                      className="w-full bg-[#080d16] border border-slate-700 rounded px-2 py-1 text-[11px] text-white outline-none"
                    >
                      <option value="">Default Camera</option>
                      {videoDevices.map((d, idx) => (
                        <option key={d.deviceId || idx} value={d.deviceId}>{d.label || `Camera ${idx + 1}`}</option>
                      ))}
                    </select>
                  )}

                  {(selectedSource.type === 'image' || selectedSource.type === 'video') && (
                    <select
                      value={selectedSource.mediaUrl || ''}
                      onChange={e => updatePreviewScene(sc => ({
                        ...sc,
                        sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, mediaUrl: e.target.value } : s))
                      }))}
                      className="w-full bg-[#080d16] border border-slate-700 rounded px-2 py-1 text-[11px] text-white outline-none"
                    >
                      <option value="">-- Select from Media Library --</option>
                      {mediaList.filter(m => m.type === selectedSource.type).map(m => (
                        <option key={m.id} value={m.url}>{m.name}</option>
                      ))}
                    </select>
                  )}

                  {selectedSource.type === 'text' && (
                    <input
                      type="text"
                      value={selectedSource.text || ''}
                      onChange={e => updatePreviewScene(sc => ({
                        ...sc,
                        sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, text: e.target.value } : s))
                      }))}
                      placeholder="Overlay text..."
                      className="w-full bg-[#080d16] border border-slate-700 rounded px-2 py-1 text-[11px] text-white outline-none"
                    />
                  )}

                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'width', 'height'] as const).map(k => (
                      <div key={k}>
                        <span className="text-[9px] uppercase text-slate-500 block">{k}</span>
                        <input
                          type="number"
                          value={Math.round(selectedSource[k])}
                          onChange={e => updatePreviewScene(sc => ({
                            ...sc,
                            sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, [k]: Number(e.target.value) || 0 } : s))
                          }))}
                          className="w-full bg-[#080d16] border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-white"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Opacity</span>
                      <span>{Math.round(selectedSource.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round(selectedSource.opacity * 100)}
                      onChange={e => updatePreviewScene(sc => ({
                        ...sc,
                        sources: sc.sources.map(s => (s.id === selectedSource.id ? { ...s, opacity: Number(e.target.value) / 100 } : s))
                      }))}
                      className="w-full accent-indigo-500 h-1.5"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500 text-center px-3">
                  Select a source on the Preview canvas or Sources list to edit properties.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── OUTPUT MANAGER TAB ─── */}
      {activeTab === 'outputs' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-5">
          <div>
            <h2 className="text-lg font-black text-white">Independent Output Routing Manager</h2>
            <p className="text-xs text-slate-400">
              Every output operates independently. Switching Broadcast scenes never alters your Audience projector or Stage confidence monitor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: 'Audience / Main Projector',
                type: 'Display Output',
                active: isAudienceActive,
                content: liveSlide ? `${liveSlide.title || 'Active Slide'}` : 'Standby / Clear',
                res: 'Display Native',
                icon: Tv,
                color: 'text-rose-400'
              },
              {
                name: 'Stage Confidence Monitor',
                type: 'Stage Output',
                active: isStageActive,
                content: 'Current Slide, Next Slide / Far Stage Counter & Notes',
                res: 'Display Native',
                icon: MonitorPlay,
                color: 'text-amber-400'
              },
              {
                name: 'LED Wall Output',
                type: 'External Display',
                active: isLedActive,
                content: 'Dedicated LED Presentation Layer',
                res: 'Display Native',
                icon: Monitor,
                color: 'text-sky-400'
              },
              {
                name: 'Broadcast / Livestream Output',
                type: `${studio.outputConfig.protocol.toUpperCase()} Stream`,
                active: isStreaming,
                content: `Program Scene: ${programScene?.name || 'None'} (${programScene?.sources.filter(s => s.visible).length || 0} active sources)`,
                res: `${resW}×${resH} @ ${studio.outputConfig.fps}fps`,
                icon: Radio,
                color: 'text-emerald-400'
              },
              {
                name: 'Local Recording Output',
                type: `Local File (.${studio.outputConfig.recordingFormat})`,
                active: isRecording,
                content: lastRecordingPath || (studio.outputConfig.recordingDir || 'Videos/LivePsalms-Recordings'),
                res: `${resW}×${resH} @ ${studio.outputConfig.fps}fps`,
                icon: Film,
                color: 'text-indigo-400'
              }
            ].map((out, i) => {
              const Icon = out.icon;
              return (
                <div key={i} className="bg-[#0d1320] border border-[#26334a] rounded-xl p-4 flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#080d16] border border-slate-800">
                    <Icon className={`w-5 h-5 ${out.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-sm text-white truncate">{out.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        out.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {out.active ? 'Active' : 'Standby'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{out.type} • {out.res}</div>
                    <div className="text-xs text-slate-200 font-semibold mt-1.5 truncate">{out.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BROADCAST SETTINGS TAB ─── */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Broadcast Output &amp; Destination Settings</h2>
              <p className="text-xs text-slate-400">Configure resolution, encoder, bitrate, recording, and RTMP/RTMPS/SRT destinations.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportStudioConfig} className="px-3 py-1.5 rounded-lg bg-[#151e30] hover:bg-slate-700 border border-[#26334a] text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export Studio Config
              </button>
              <label className="px-3 py-1.5 rounded-lg bg-[#151e30] hover:bg-slate-700 border border-[#26334a] text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import Config
                <input type="file" accept=".json" onChange={importStudioConfig} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Video & Encoder Settings */}
            <div className="bg-[#0d1320] border border-[#26334a] rounded-xl p-4 space-y-3">
              <div className="font-black text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> Video, Encoder &amp; Quality
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Preset</label>
                  <select
                    value={studio.outputConfig.preset}
                    onChange={e => {
                      const p = e.target.value as any;
                      const map: Record<string, any> = {
                        low: { resolution: '1280x720', fps: 30, videoBitrateKbps: 2000, audioBitrateKbps: 128 },
                        standard: { resolution: '1920x1080', fps: 30, videoBitrateKbps: 4500, audioBitrateKbps: 192 },
                        high: { resolution: '1920x1080', fps: 60, videoBitrateKbps: 6500, audioBitrateKbps: 256 }
                      };
                      setStudio(prev => ({
                        ...prev,
                        outputConfig: { ...prev.outputConfig, preset: p, ...(map[p] || {}) }
                      }));
                    }}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value="low">Low Bandwidth (720p30)</option>
                    <option value="standard">Standard HD (1080p30)</option>
                    <option value="high">High Quality (1080p60)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Resolution</label>
                  <select
                    value={studio.outputConfig.resolution}
                    onChange={e => setStudio(prev => ({
                      ...prev,
                      outputConfig: { ...prev.outputConfig, resolution: e.target.value as any, preset: 'custom' }
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value="1920x1080">1920 × 1080 (Full HD)</option>
                    <option value="1280x720">1280 × 720 (HD)</option>
                    <option value="3840x2160">3840 × 2160 (4K)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Frame Rate</label>
                  <select
                    value={studio.outputConfig.fps}
                    onChange={e => setStudio(prev => ({
                      ...prev,
                      outputConfig: { ...prev.outputConfig, fps: Number(e.target.value) as 30 | 60 }
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Video Encoder</label>
                  <select
                    value={studio.outputConfig.encoder}
                    onChange={e => setStudio(prev => ({
                      ...prev,
                      outputConfig: { ...prev.outputConfig, encoder: e.target.value as any }
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    {availableEncoders.map(enc => (
                      <option key={enc} value={enc}>{enc === 'libx264' ? 'x264 Software' : `${enc} (Hardware)`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Video Bitrate (kbps)</label>
                  <input
                    type="number"
                    min={500}
                    max={25000}
                    step={250}
                    value={studio.outputConfig.videoBitrateKbps}
                    onChange={e => setStudio(prev => ({
                      ...prev,
                      outputConfig: { ...prev.outputConfig, videoBitrateKbps: Number(e.target.value) || 4500, preset: 'custom' }
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Audio Bitrate (kbps)</label>
                  <select
                    value={studio.outputConfig.audioBitrateKbps}
                    onChange={e => setStudio(prev => ({
                      ...prev,
                      outputConfig: { ...prev.outputConfig, audioBitrateKbps: Number(e.target.value) || 192 }
                    }))}
                    className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value={128}>128 kbps AAC</option>
                    <option value={192}>192 kbps AAC (Broadcast)</option>
                    <option value={256}>256 kbps AAC (Studio)</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-sky-300 bg-sky-950/40 border border-sky-500/30 rounded-lg px-3 py-1.5">
                Estimated Upload Bandwidth Required: <strong>{estBandwidthMbps} Mbps</strong> (recommend ≥ {(Number(estBandwidthMbps) * 1.5).toFixed(1)} Mbps upload)
              </div>
            </div>

            {/* Destinations & Recording Settings */}
            <div className="bg-[#0d1320] border border-[#26334a] rounded-xl p-4 space-y-3">
              <div className="font-black text-xs uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <Radio className="w-4 h-4" /> Streaming Destination &amp; Recording
              </div>

              <div className="space-y-2 text-xs">
                <select
                  value={studio.activeDestinationId}
                  onChange={e => {
                    setConnTestResult(null);
                    setStudio(prev => ({ ...prev, activeDestinationId: e.target.value }));
                  }}
                  className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                >
                  {studio.destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.protocol.toUpperCase()})</option>
                  ))}
                </select>

                {(() => {
                  const dest = studio.destinations.find(d => d.id === studio.activeDestinationId) || studio.destinations[0];
                  return (
                    <>
                      <input
                        type="text"
                        value={dest.serverUrl}
                        onChange={e => setStudio(prev => ({
                          ...prev,
                          destinations: prev.destinations.map(d => (d.id === dest.id ? { ...d, serverUrl: e.target.value } : d))
                        }))}
                        placeholder="Server URL (e.g. rtmp://a.rtmp.youtube.com/live2)"
                        className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={dest.streamKey}
                          onChange={e => setStudio(prev => ({
                            ...prev,
                            destinations: prev.destinations.map(d => (d.id === dest.id ? { ...d, streamKey: e.target.value } : d))
                          }))}
                          placeholder="Stream Key (stored securely, masked)"
                          autoComplete="off"
                          className="flex-1 bg-[#080d16] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                        />
                        <button
                          onClick={async () => {
                            if (!ipc) return;
                            const url = dest.serverUrl.endsWith('/') ? `${dest.serverUrl}${dest.streamKey}` : `${dest.serverUrl}/${dest.streamKey}`;
                            const res = await ipc.invoke('test-rtmp-connection', { rtmpUrl: url });
                            setConnTestResult({ ok: !!res.success, msg: res.message || res.error || 'Tested' });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shrink-0"
                        >
                          Test Connection
                        </button>
                      </div>
                      {connTestResult && (
                        <div className={`text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                          connTestResult.ok ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                        }`}>
                          {connTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{connTestResult.msg}</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Recording Format</label>
                    <select
                      value={studio.outputConfig.recordingFormat}
                      onChange={e => setStudio(prev => ({
                        ...prev,
                        outputConfig: { ...prev.outputConfig, recordingFormat: e.target.value as any }
                      }))}
                      className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                    >
                      <option value="mp4">MP4 (Universal)</option>
                      <option value="mkv">MKV (Crash-Safe)</option>
                      <option value="flv">FLV</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Recording Folder</label>
                    <input
                      type="text"
                      value={studio.outputConfig.recordingDir}
                      onChange={e => setStudio(prev => ({
                        ...prev,
                        outputConfig: { ...prev.outputConfig, recordingDir: e.target.value }
                      }))}
                      placeholder="~/Videos/LivePsalms-Recordings"
                      className="w-full bg-[#080d16] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-[10px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {streamLogs.length > 0 && (
            <div className="bg-black/70 border border-slate-800 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-0.5">
              {streamLogs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ─── BOTTOM STATUS BAR ─── */}
      <footer className="h-7 bg-[#090d16] border-t border-[#26334a] px-4 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>LIVE: {isStreaming ? fmtElapsed(streamElapsed) : 'OFFLINE'}</span>
          <span>REC: {isRecording ? fmtElapsed(recordElapsed) : 'IDLE'}</span>
          <span>CANVAS: {resW}×{resH} @ {studio.outputConfig.fps}fps</span>
          <span>ENCODER: {studio.outputConfig.encoder}</span>
        </div>
        <div className="flex items-center gap-4">
          {sysStats && (
            <>
              <span>CPU LOAD: {sysStats.load1m} ({sysStats.cpuCount}c)</span>
              <span>MEM: {sysStats.rssMb} MB ({sysStats.usedMemPct}%)</span>
            </>
          )}
          <span className="text-emerald-400">INDEPENDENT OUTPUTS ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};
