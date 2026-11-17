/**
 * Scene documents.
 *
 * A scene is a canvas plus an ordered list of elements. Element frames use the
 * canvas coordinate space (1920x1080 by default) and are scaled when rendered,
 * so a scene looks the same at 720p and 1080p.
 *
 * The format is versioned; new element types extend the union and the loader
 * fills defaults for anything missing.
 */

export const SCENE_VERSION = 1 as const;
export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;

export interface SceneFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
}

export interface SceneBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  from?: string;
  to?: string;
  angle?: number;
  src?: string;
}

interface BaseElement {
  id: string;
  name: string;
  frame: SceneFrame;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  /** When set, content comes from the live presentation instead of the literal text. */
  binding?: 'slide.title' | 'slide.content' | 'slide.subtitle' | 'slide.reference' | 'theme.name' | null;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  shadow: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  padding: number;
  radius: number;
  uppercase?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  fit: 'cover' | 'contain';
  radius: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  kind: 'rect' | 'circle';
  fill: string;
  radius: number;
}

export interface CameraElement extends BaseElement {
  type: 'camera';
  deviceId: string;
  fit: 'cover' | 'contain';
  radius: number;
  mirror: boolean;
}

export interface CaptureElement extends BaseElement {
  type: 'display' | 'window';
  /** Desktop source id from the main process (screen:0:0, window:123:0). */
  sourceId: string;
  sourceName?: string;
  fit: 'cover' | 'contain';
  radius: number;
}

export type VideoDeviceElement = BaseElement & {
  type: 'videoDevice';
  deviceId: string;
  fit: 'cover' | 'contain';
  radius: number;
  mirror: boolean;
};

export type AudioInputElement = BaseElement & {
  type: 'audioInput';
  deviceId: string;
  muted: boolean;
};

export type MediaElement = BaseElement & {
  type: 'media';
  /** File URL, data URL or media library URL. */
  src: string;
  loop: boolean;
  muted: boolean;
  fit: 'cover' | 'contain';
  radius: number;
};

export type SceneSourceElement = BaseElement & {
  type: 'scene';
  /** The nested scene document drawn inside this frame. */
  sceneId: string;
  fit: 'cover' | 'contain';
  radius: number;
};

export type BrowserElement = BaseElement & {
  type: 'browser';
  url: string;
  radius: number;
};

export type SceneElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | CameraElement
  | CaptureElement
  | VideoDeviceElement
  | AudioInputElement
  | MediaElement
  | SceneSourceElement
  | BrowserElement;

export interface TransitionSettings {
  type: 'cut' | 'fade' | 'crossfade' | 'slide-left' | 'zoom';
  durationMs: number;
}

export interface SceneDocument {
  version: typeof SCENE_VERSION;
  id: string;
  name: string;
  description?: string;
  canvas: { width: number; height: number; background: SceneBackground };
  elements: SceneElement[];
  transition: TransitionSettings;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_TRANSITION: TransitionSettings = { type: 'fade', durationMs: 400 };

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_TEXT: Omit<TextElement, 'id' | 'name' | 'frame' | 'zIndex'> = {
  type: 'text',
  visible: true,
  locked: false,
  content: 'Text',
  binding: null,
  fontFamily: 'Inter',
  fontSize: 64,
  fontWeight: '600',
  color: '#ffffff',
  align: 'center',
  lineHeight: 1.25,
  letterSpacing: 0,
  shadow: true,
  backgroundOpacity: 0,
  padding: 24,
  radius: 0
};

export function createTextElement(patch: Partial<TextElement> = {}): TextElement {
  return {
    ...DEFAULT_TEXT,
    id: createId('el'),
    name: 'Text',
    zIndex: 1,
    frame: { x: 260, y: 420, width: 1400, height: 240 },
    ...patch
  };
}

export function createShapeElement(patch: Partial<ShapeElement> = {}): ShapeElement {
  return {
    type: 'shape',
    kind: 'rect',
    fill: 'rgba(10, 10, 12, 0.72)',
    radius: 16,
    id: createId('el'),
    name: 'Shape',
    zIndex: 0,
    frame: { x: 0, y: 820, width: 1920, height: 180 },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createCameraElement(patch: Partial<CameraElement> = {}): CameraElement {
  return {
    type: 'camera',
    deviceId: '',
    fit: 'cover',
    radius: 16,
    mirror: true,
    id: createId('el'),
    name: 'Camera',
    zIndex: 2,
    frame: { x: 1320, y: 660, width: 520, height: 293 },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createImageElement(patch: Partial<ImageElement> = {}): ImageElement {
  return {
    type: 'image',
    src: '',
    fit: 'contain',
    radius: 12,
    id: createId('el'),
    name: 'Image',
    zIndex: 2,
    frame: { x: 720, y: 300, width: 480, height: 480 },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createCaptureElement(kind: 'display' | 'window', patch: Partial<CaptureElement> = {}): CaptureElement {
  return {
    type: kind,
    sourceId: '',
    sourceName: '',
    fit: 'cover',
    radius: 0,
    id: createId('el'),
    name: kind === 'display' ? 'Display capture' : 'Window capture',
    zIndex: 1,
    frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createVideoDeviceElement(patch: Partial<VideoDeviceElement> = {}): VideoDeviceElement {
  return {
    type: 'videoDevice',
    deviceId: '',
    fit: 'cover',
    radius: 0,
    mirror: true,
    id: createId('el'),
    name: 'Video capture device',
    zIndex: 1,
    frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createAudioInputElement(patch: Partial<AudioInputElement> = {}): AudioInputElement {
  return {
    type: 'audioInput',
    deviceId: '',
    muted: false,
    id: createId('el'),
    name: 'Audio input',
    zIndex: 0,
    frame: { x: 0, y: 0, width: 0, height: 0 },
    visible: false,
    locked: false,
    ...patch
  };
}

export function createMediaElement(patch: Partial<MediaElement> = {}): MediaElement {
  return {
    type: 'media',
    src: '',
    loop: true,
    muted: true,
    fit: 'contain',
    radius: 12,
    id: createId('el'),
    name: 'Media',
    zIndex: 2,
    frame: { x: 660, y: 290, width: 600, height: 500 },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createSceneSourceElement(patch: Partial<SceneSourceElement> = {}): SceneSourceElement {
  return {
    type: 'scene',
    sceneId: '',
    fit: 'contain',
    radius: 12,
    id: createId('el'),
    name: 'Scene',
    zIndex: 2,
    frame: { x: 660, y: 290, width: 600, height: 500 },
    visible: true,
    locked: false,
    ...patch
  };
}

export function createBrowserElement(patch: Partial<BrowserElement> = {}): BrowserElement {
  return {
    type: 'browser',
    url: 'https://',
    radius: 8,
    id: createId('el'),
    name: 'Browser',
    zIndex: 2,
    frame: { x: 560, y: 240, width: 800, height: 600 },
    visible: true,
    locked: false,
    ...patch
  };
}
export function createScene(name: string, patch: Partial<SceneDocument> = {}): SceneDocument {
  const now = Date.now();
  return {
    version: SCENE_VERSION,
    id: createId('scene'),
    name,
    canvas: { width: SCENE_WIDTH, height: SCENE_HEIGHT, background: { type: 'solid', color: '#0e0e10' } },
    elements: [],
    transition: { ...DEFAULT_TRANSITION },
    createdAt: now,
    updatedAt: now,
    ...patch
  };
}

/** Fills fields that an older or hand-edited document may be missing. */
export function normaliseScene(input: Partial<SceneDocument>): SceneDocument {
  const base = createScene(input.name || 'Untitled scene');
  return {
    ...base,
    ...input,
    version: SCENE_VERSION,
    canvas: {
      width: input.canvas?.width || SCENE_WIDTH,
      height: input.canvas?.height || SCENE_HEIGHT,
      background: input.canvas?.background || base.canvas.background
    },
    transition: { ...DEFAULT_TRANSITION, ...(input.transition || {}) },
    elements: (input.elements || []).map((element, index) => {
      const sourceFrame = (element.frame || {}) as Partial<SceneFrame>;
      const frame: SceneFrame = {
        x: sourceFrame.x ?? 0,
        y: sourceFrame.y ?? 0,
        width: sourceFrame.width ?? 400,
        height: sourceFrame.height ?? 200,
        rotation: sourceFrame.rotation,
        opacity: sourceFrame.opacity
      };
      return {
        ...element,
        visible: element.visible ?? true,
        locked: element.locked ?? false,
        zIndex: element.zIndex ?? index,
        frame
      } as SceneElement;
    })
  };
}
