import { BroadcastStudioProjectData, BroadcastScene } from '../types/broadcastStudio';

const STUDIO_STORAGE_KEY = 'live_psalms_broadcast_studio_v3';

export function createDefaultBroadcastScenes(): BroadcastScene[] {
  return [
    {
      id: 'scene-cam-lyrics',
      name: 'Camera + Lyrics',
      transitionType: 'fade',
      transitionDurationMs: 400,
      sources: [
        {
          id: 'src-cam-1',
          name: 'Main Sanctuary Camera',
          type: 'camera',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1
        },
        {
          id: 'src-lyrics-1',
          name: 'Live Lyrics Lower-Third',
          type: 'lyrics_overlay',
          visible: true,
          locked: false,
          x: 6,
          y: 72,
          width: 88,
          height: 22,
          opacity: 0.96,
          zIndex: 2,
          textColor: '#ffffff',
          bgColor: 'rgba(6, 10, 22, 0.78)',
          fontSize: 44,
          borderRadius: 16,
          align: 'center'
        },
        {
          id: 'src-logo-1',
          name: 'Church Logo Watermark',
          type: 'logo',
          visible: true,
          locked: false,
          x: 88,
          y: 4,
          width: 8,
          height: 12,
          opacity: 0.85,
          zIndex: 3
        }
      ]
    },
    {
      id: 'scene-cam-bible',
      name: 'Camera + Bible Verses',
      transitionType: 'fade',
      transitionDurationMs: 400,
      sources: [
        {
          id: 'src-cam-bible',
          name: 'Main Sanctuary Camera',
          type: 'camera',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1
        },
        {
          id: 'src-bible-1',
          name: 'Bible Verse Overlay',
          type: 'bible_overlay',
          visible: true,
          locked: false,
          x: 5,
          y: 68,
          width: 90,
          height: 27,
          opacity: 0.96,
          zIndex: 2,
          textColor: '#ffffff',
          bgColor: 'rgba(10, 15, 32, 0.85)',
          fontSize: 38,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: 'rgba(245, 158, 11, 0.7)',
          align: 'left'
        }
      ]
    },
    {
      id: 'scene-presentation',
      name: 'Presentation Slide Full',
      transitionType: 'fade',
      transitionDurationMs: 350,
      sources: [
        {
          id: 'src-slide-full',
          name: 'Audience Screen Output',
          type: 'live_slide',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1,
          textColor: '#ffffff',
          bgColor: '#090d1a',
          fontSize: 54,
          align: 'center'
        }
      ]
    },
    {
      id: 'scene-pip-slide',
      name: 'PiP (Slide + Camera)',
      transitionType: 'fade',
      transitionDurationMs: 350,
      sources: [
        {
          id: 'src-pip-slide',
          name: 'Audience Screen Output',
          type: 'live_slide',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1,
          textColor: '#ffffff',
          bgColor: '#090d1a',
          fontSize: 50,
          align: 'center'
        },
        {
          id: 'src-pip-cam',
          name: 'Camera Corner PiP',
          type: 'camera',
          visible: true,
          locked: false,
          x: 72,
          y: 64,
          width: 25,
          height: 30,
          opacity: 1,
          zIndex: 2,
          borderRadius: 16,
          borderWidth: 3,
          borderColor: '#6366f1'
        }
      ]
    },
    {
      id: 'scene-split-cam-slide',
      name: 'Split Screen (Cam | Slide)',
      transitionType: 'fade',
      transitionDurationMs: 350,
      sources: [
        {
          id: 'src-split-cam',
          name: 'Sanctuary Camera',
          type: 'camera',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 50,
          height: 100,
          opacity: 1,
          zIndex: 1
        },
        {
          id: 'src-split-slide',
          name: 'Presentation Slide',
          type: 'live_slide',
          visible: true,
          locked: false,
          x: 50,
          y: 0,
          width: 50,
          height: 100,
          opacity: 1,
          zIndex: 2,
          textColor: '#ffffff',
          bgColor: '#090d1a',
          fontSize: 42,
          align: 'center'
        }
      ]
    },
    {
      id: 'scene-live-cam',
      name: 'Live Camera Only',
      transitionType: 'cut',
      transitionDurationMs: 250,
      sources: [
        {
          id: 'src-cam-full',
          name: 'Main Sanctuary Camera',
          type: 'camera',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1
        },
        {
          id: 'src-logo-only',
          name: 'Church Logo Watermark',
          type: 'logo',
          visible: true,
          locked: false,
          x: 88,
          y: 4,
          width: 8,
          height: 12,
          opacity: 0.85,
          zIndex: 2
        }
      ]
    },
    {
      id: 'scene-cam-lower-third',
      name: 'Camera + Lower Third',
      transitionType: 'fade',
      transitionDurationMs: 350,
      sources: [
        {
          id: 'src-cam-lt',
          name: 'Main Sanctuary Camera',
          type: 'camera',
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1
        },
        {
          id: 'src-lt-full',
          name: 'Announcement Lower-Third',
          type: 'lower_third',
          visible: true,
          locked: false,
          x: 4,
          y: 84,
          width: 92,
          height: 11,
          opacity: 0.95,
          zIndex: 2,
          textColor: '#ffffff',
          bgColor: 'rgba(15, 23, 42, 0.9)',
          fontSize: 30,
          borderRadius: 12,
          align: 'left'
        }
      ]
    },
    {
      id: 'scene-countdown',
      name: 'Opening Countdown',
      transitionType: 'fade',
      transitionDurationMs: 500,
      sources: [
        {
          id: 'src-bg-cd',
          name: 'Backdrop',
          type: 'color_bg',
          visible: true,
          locked: true,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1,
          bgColor: '#070b18'
        },
        {
          id: 'src-logo-cd',
          name: 'Church Logo',
          type: 'logo',
          visible: true,
          locked: false,
          x: 42,
          y: 12,
          width: 16,
          height: 22,
          opacity: 1,
          zIndex: 2
        },
        {
          id: 'src-timer-cd',
          name: 'Service Countdown Timer',
          type: 'countdown',
          visible: true,
          locked: false,
          x: 15,
          y: 38,
          width: 70,
          height: 42,
          opacity: 1,
          zIndex: 3,
          textColor: '#ffffff',
          fontSize: 120,
          align: 'center'
        }
      ]
    }
  ];
}

export function getDefaultBroadcastStudioData(): BroadcastStudioProjectData {
  const scenes = createDefaultBroadcastScenes();
  return {
    scenes,
    activeProgramSceneId: scenes[0].id,
    activePreviewSceneId: scenes[1].id,
    audioChannels: [
      { id: 'aud-mic', name: 'Main Mixer / Mic', deviceId: '', kind: 'mic', volume: 1, muted: false },
      { id: 'aud-aux', name: 'Aux / Backup Audio', deviceId: 'none', kind: 'interface', volume: 0.8, muted: false }
    ],
    outputConfig: {
      resolution: '1920x1080',
      customWidth: 1920,
      customHeight: 1080,
      aspectRatio: '16:9',
      fps: 30,
      videoBitrateKbps: 4500,
      audioBitrateKbps: 192,
      encoder: 'libx264',
      preset: 'standard',
      keyframeIntervalSec: 2,
      protocol: 'rtmp',
      recordingFormat: 'mp4',
      recordingQuality: 'high',
      recordingDir: ''
    },
    destinations: [
      {
        id: 'dest-yt',
        name: 'YouTube Live',
        platform: 'youtube',
        protocol: 'rtmp',
        serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: ''
      },
      {
        id: 'dest-fb',
        name: 'Facebook Live',
        platform: 'facebook',
        protocol: 'rtmps',
        serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
        streamKey: ''
      },
      {
        id: 'dest-custom',
        name: 'Custom RTMP / SRT',
        platform: 'custom',
        protocol: 'rtmp',
        serverUrl: '',
        streamKey: ''
      }
    ],
    activeDestinationId: 'dest-yt'
  };
}

export function loadBroadcastStudioData(): BroadcastStudioProjectData {
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = getDefaultBroadcastStudioData();
      return {
        ...def,
        ...parsed,
        scenes: Array.isArray(parsed.scenes) && parsed.scenes.length > 0 ? parsed.scenes : def.scenes,
        audioChannels: Array.isArray(parsed.audioChannels) && parsed.audioChannels.length > 0 ? parsed.audioChannels : def.audioChannels,
        outputConfig: { ...def.outputConfig, ...(parsed.outputConfig || {}) },
        destinations: Array.isArray(parsed.destinations) && parsed.destinations.length > 0 ? parsed.destinations : def.destinations
      };
    }
  } catch (e) {}
  return getDefaultBroadcastStudioData();
}

export function saveBroadcastStudioData(data: BroadcastStudioProjectData): void {
  try {
    localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}
