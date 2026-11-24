import { useEffect, useState } from 'react';
import { cameraLayoutScenes, defaultScenes } from './presets';
import { normaliseScene, SceneDocument, SceneElement } from './types';

const STORAGE_KEY = 'live_psalms_scene_library_v1';

const TRANSPARENT_SHAPE_FILL_MIGRATIONS: Record<string, string> = {
  'rgba(8, 8, 10, 0.86)': 'rgba(8, 8, 14, 0.45)',
  'rgba(8, 8, 10, 0.82)': 'rgba(8, 8, 14, 0.45)',
  'rgba(2, 6, 23, 0.90)': 'rgba(2, 6, 23, 0.45)',
  'rgba(2, 6, 23, 0.80)': 'rgba(2, 6, 23, 0.54)',
  'rgba(2, 6, 23, 0.82)': 'rgba(2, 6, 23, 0.52)'
};

function migrateSceneTransparency(scene: SceneDocument): SceneDocument {
  let changed = false;
  let elements = scene.elements.map(el => {
    if (el.type === 'shape' && TRANSPARENT_SHAPE_FILL_MIGRATIONS[el.fill]) {
      changed = true;
      return { ...el, fill: TRANSPARENT_SHAPE_FILL_MIGRATIONS[el.fill] };
    }
    if (
      el.type === 'text' &&
      !el.binding &&
      (el.name === 'Time' || /^\d{1,2}:\d{2}$/.test((el.content || '').trim())) &&
      scene.name.toLowerCase().includes('countdown')
    ) {
      changed = true;
      return { ...el, binding: 'countdown.time' as const };
    }
    return el;
  });

  // If a scene has both a slide layout lower-third backdrop AND leftover Speaker introduction Strap/Speaker/Role elements, strip the leftovers
  const hasLayoutBackdrop = elements.some(
    el =>
      el.type === 'shape' &&
      (el.name === 'Lower third backdrop' ||
        el.name === 'Top banner backdrop' ||
        el.name === 'Left split card' ||
        el.name === 'Right split card' ||
        el.name === 'Boxed card')
  );
  if (hasLayoutBackdrop) {
    const filtered = elements.filter(el => {
      if (el.type === 'shape' && (el.name === 'Strap' || el.name === 'Lower third bar')) return false;
      if (
        el.type === 'text' &&
        !el.binding &&
        ((el.name === 'Speaker' && el.content === 'Pastor name') ||
          (el.name === 'Role' && el.content === 'Role or church'))
      ) {
        return false;
      }
      return true;
    });
    if (filtered.length !== elements.length) {
      elements = filtered;
      changed = true;
    }
  }

  let background = scene.canvas.background;
  const hasFullFrameCamera = elements.some(
    el => el.type === 'camera' && el.frame.width >= 1600 && el.frame.height >= 900
  );

  // Full-frame camera presets should not auto-bleed the slide background behind the camera
  if (hasFullFrameCamera && (background.followLiveBackground || scene.name === 'Camera + Lower third' || scene.name === 'Speaker introduction')) {
    if (background.followLiveBackground || background.assetId === 'media-img-1' || background.src?.includes('photo-1518837695005')) {
      background = {
        type: 'solid',
        color: '#050508',
        followLiveBackground: false
      };
      changed = true;
    }
  } else if (
    !hasFullFrameCamera &&
    background.followLiveBackground === undefined &&
    !background.src &&
    !background.assetId &&
    (scene.name === 'Full screen presentation' ||
      scene.name === 'Scripture display' ||
      scene.name === 'Worship lyrics' ||
      scene.name === 'Centered layout' ||
      scene.layoutOverride === 'centered')
  ) {
    background = {
      ...background,
      followLiveBackground: true
    };
    changed = true;
  }

  return changed
    ? {
        ...scene,
        canvas: { ...scene.canvas, background },
        elements
      }
    : scene;
}

export interface SceneLibrary {
  scenes: SceneDocument[];
  /** The scene currently on air (what the stream and live output render). */
  activeSceneId: string;
  /** The scene being prepared; never shown on an output. */
  previewSceneId: string;
}

type Listener = (library: SceneLibrary) => void;

function freshLibrary(): SceneLibrary {
  const scenes = defaultScenes();
  return { scenes, activeSceneId: scenes[0].id, previewSceneId: scenes[0].id };
}

function persistLibrary(library: SceneLibrary) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* storage unavailable */
  }
}

function loadLibrary(): SceneLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = freshLibrary();
      persistLibrary(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<SceneLibrary> & { version?: number };
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) return freshLibrary();
    const scenes = parsed.scenes.map(scene => migrateSceneTransparency(normaliseScene(scene)));
    const existingNames = new Set(scenes.map(s => s.name));
    let addedDefaults = false;
    for (const preset of cameraLayoutScenes()) {
      if (!existingNames.has(preset.scene.name)) {
        scenes.push(preset.scene);
        existingNames.add(preset.scene.name);
        addedDefaults = true;
      }
    }
    const activeSceneId =
      typeof parsed.activeSceneId === 'string' && scenes.some(scene => scene.id === parsed.activeSceneId)
        ? parsed.activeSceneId
        : scenes[0].id;
    const previewSceneId =
      typeof parsed.previewSceneId === 'string' && scenes.some(scene => scene.id === parsed.previewSceneId)
        ? parsed.previewSceneId
        : activeSceneId;
    const loaded = { scenes, activeSceneId, previewSceneId };
    if (addedDefaults) persistLibrary(loaded);
    return loaded;
  } catch {
    return freshLibrary();
  }
}

class SceneLibraryStore {
  private library: SceneLibrary = loadLibrary();
  private listeners = new Set<Listener>();

  get(): SceneLibrary {
    return this.library;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.library);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: SceneLibrary, persist = true) {
    this.library = next;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    }
    this.listeners.forEach(listener => listener(next));
  }

  private replaceScene(id: string, update: (scene: SceneDocument) => SceneDocument) {
    const scenes = this.library.scenes.map(scene =>
      scene.id === id ? { ...update(scene), updatedAt: Date.now() } : scene
    );
    this.commit({ ...this.library, scenes });
  }

  addScene(scene: SceneDocument) {
    this.commit({ ...this.library, scenes: [...this.library.scenes, scene], previewSceneId: scene.id });
  }

  duplicateScene(id: string): SceneDocument | null {
    const source = this.library.scenes.find(scene => scene.id === id);
    if (!source) return null;
    const copy: SceneDocument = {
      ...source,
      id: `${source.id}-copy-${Math.random().toString(36).slice(2, 6)}`,
      name: `${source.name} copy`,
      elements: source.elements.map(element => ({
        ...element,
        id: `${element.id}-copy-${Math.random().toString(36).slice(2, 6)}`
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const index = this.library.scenes.findIndex(scene => scene.id === id);
    const scenes = [...this.library.scenes];
    scenes.splice(index + 1, 0, copy);
    this.commit({ ...this.library, scenes, previewSceneId: copy.id });
    return copy;
  }

  renameScene(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.replaceScene(id, scene => ({ ...scene, name: trimmed }));
  }

  deleteScene(id: string) {
    if (this.library.scenes.length <= 1) return;
    const scenes = this.library.scenes.filter(scene => scene.id !== id);
    const fallback = scenes[0].id;
    this.commit({
      scenes,
      activeSceneId: this.library.activeSceneId === id ? fallback : this.library.activeSceneId,
      previewSceneId: this.library.previewSceneId === id ? fallback : this.library.previewSceneId
    });
  }

  moveScene(id: string, direction: 'up' | 'down') {
    const index = this.library.scenes.findIndex(scene => scene.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= this.library.scenes.length) return;
    const scenes = [...this.library.scenes];
    const [moved] = scenes.splice(index, 1);
    scenes.splice(target, 0, moved);
    this.commit({ ...this.library, scenes });
  }

  updateScene(id: string, update: (scene: SceneDocument) => SceneDocument) {
    this.replaceScene(id, update);
  }

  setActiveScene(id: string) {
    if (!this.library.scenes.some(scene => scene.id === id)) return;
    this.commit({ ...this.library, activeSceneId: id });
  }

  setPreviewScene(id: string) {
    if (!this.library.scenes.some(scene => scene.id === id)) return;
    this.commit({ ...this.library, previewSceneId: id });
  }

  updateElement(sceneId: string, elementId: string, patch: Partial<SceneElement>) {
    this.replaceScene(sceneId, scene => ({
      ...scene,
      elements: scene.elements.map(element =>
        element.id === elementId ? ({ ...element, ...patch } as SceneElement) : element
      )
    }));
  }
}

export const sceneLibrary = new SceneLibraryStore();

export function useSceneLibrary(): SceneLibrary {
  const [library, setLibrary] = useState<SceneLibrary>(() => sceneLibrary.get());
  useEffect(() => sceneLibrary.subscribe(setLibrary), []);
  return library;
}

export function getActiveScene(library: SceneLibrary): SceneDocument | null {
  return library.scenes.find(scene => scene.id === library.activeSceneId) || null;
}

export function getPreviewScene(library: SceneLibrary): SceneDocument | null {
  return library.scenes.find(scene => scene.id === library.previewSceneId) || null;
}
