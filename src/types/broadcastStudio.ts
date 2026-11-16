export type BroadcastSourceType =
  | 'camera'
  | 'screen'
  | 'live_slide'
  | 'bible_overlay'
  | 'lyrics_overlay'
  | 'image'
  | 'video'
  | 'text'
  | 'lower_third'
  | 'logo'
  | 'countdown'
  | 'color_bg';

export interface BroadcastSourceCrop {
  top: number;    // 0-45 (%)
  right: number;  // 0-45 (%)
  bottom: number; // 0-45 (%)
  left: number;   // 0-45 (%)
}

export interface BroadcastSource {
  id: string;
  name: string;
  type: BroadcastSourceType;
  visible: boolean;
  locked: boolean;
  /** Position & size in percentage (0-100) of the broadcast canvas */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0-1
  zIndex: number;
  crop?: BroadcastSourceCrop;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  deviceId?: string;
  mediaUrl?: string;
  text?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number; // px relative to 1080p canvas
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
}

export type BroadcastTransitionType = 'cut' | 'fade' | 'dissolve';

export interface BroadcastScene {
  id: string;
  name: string;
  sources: BroadcastSource[];
  transitionType?: BroadcastTransitionType;
  transitionDurationMs?: number;
}

export interface BroadcastAudioChannel {
  id: string;
  name: string;
  deviceId: string; // 'none' or MediaDeviceInfo.deviceId
  kind: 'mic' | 'interface' | 'capture' | 'media';
  volume: number; // 0 to 1.5
  muted: boolean;
}

export interface BroadcastOutputConfig {
  resolution: '1920x1080' | '1280x720' | '3840x2160' | 'custom';
  customWidth: number;
  customHeight: number;
  aspectRatio: '16:9' | '4:3';
  fps: 30 | 60;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  encoder: 'libx264' | 'h264_nvenc' | 'h264_vaapi' | 'h264_qsv';
  preset: 'low' | 'standard' | 'high' | 'custom';
  keyframeIntervalSec: number;
  protocol: 'rtmp' | 'rtmps' | 'srt';
  recordingFormat: 'mp4' | 'mkv' | 'flv';
  recordingQuality: 'stream' | 'high';
  recordingDir: string;
}

export interface StreamingDestination {
  id: string;
  name: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'custom';
  protocol: 'rtmp' | 'rtmps' | 'srt';
  serverUrl: string;
  streamKey: string;
}

export interface BroadcastStudioProjectData {
  scenes: BroadcastScene[];
  activeProgramSceneId: string;
  activePreviewSceneId: string;
  audioChannels: BroadcastAudioChannel[];
  outputConfig: BroadcastOutputConfig;
  destinations: StreamingDestination[];
  activeDestinationId: string;
}
