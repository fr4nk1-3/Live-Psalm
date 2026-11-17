/**
 * Broadcast scenes: a small, fixed set of layouts that compose the programme
 * output, the camera, a lower third and the countdown into one canvas frame.
 * The canvas is what gets streamed and what the preview shows, so the operator
 * sees exactly what leaves the machine.
 */

export type SceneLayout = 'program' | 'camera' | 'split' | 'pip';

export interface BroadcastSceneSettings {
  layout: SceneLayout;
  cameraDeviceId: string;
  showLowerThird: boolean;
  showCountdown: boolean;
  lowerThirdTitle: string;
  lowerThirdSubtitle: string;
}

export const SCENE_LAYOUTS: { id: SceneLayout; label: string; hint: string }[] = [
  { id: 'program', label: 'Programme', hint: 'The live slide, full frame.' },
  { id: 'camera', label: 'Camera', hint: 'Camera only, full frame.' },
  { id: 'split', label: 'Split', hint: 'Slide and camera side by side.' },
  { id: 'pip', label: 'Picture in picture', hint: 'Camera over the slide, bottom right.' }
];

const STORAGE_KEY = 'live_psalms_broadcast_scene_v1';

export const DEFAULT_SCENE: BroadcastSceneSettings = {
  layout: 'program',
  cameraDeviceId: '',
  showLowerThird: false,
  showCountdown: false,
  lowerThirdTitle: '',
  lowerThirdSubtitle: ''
};

export function loadSceneSettings(): BroadcastSceneSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SCENE };
    const parsed = JSON.parse(raw) as Partial<BroadcastSceneSettings>;
    return {
      layout: SCENE_LAYOUTS.some(layout => layout.id === parsed.layout) ? (parsed.layout as SceneLayout) : 'program',
      cameraDeviceId: parsed.cameraDeviceId || '',
      showLowerThird: Boolean(parsed.showLowerThird),
      showCountdown: Boolean(parsed.showCountdown),
      lowerThirdTitle: parsed.lowerThirdTitle || '',
      lowerThirdSubtitle: parsed.lowerThirdSubtitle || ''
    };
  } catch {
    return { ...DEFAULT_SCENE };
  }
}

export function saveSceneSettings(settings: BroadcastSceneSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- live store

let current = loadSceneSettings();
const listeners = new Set<(settings: BroadcastSceneSettings) => void>();

export function getSceneSettings(): BroadcastSceneSettings {
  return current;
}

export function updateSceneSettings(patch: Partial<BroadcastSceneSettings>) {
  current = { ...current, ...patch };
  saveSceneSettings(current);
  listeners.forEach(listener => listener(current));
}

export function subscribeSceneSettings(listener: (settings: BroadcastSceneSettings) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}