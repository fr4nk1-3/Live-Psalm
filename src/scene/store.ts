import { useEffect, useState } from 'react';
import { defaultScenes } from './presets';
import { normaliseScene, SceneDocument, SceneElement } from './types';

const STORAGE_KEY = 'live_psalms_scene_library_v1';

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
    const scenes = parsed.scenes.map(scene => normaliseScene(scene));
    const activeSceneId =
      typeof parsed.activeSceneId === 'string' && scenes.some(scene => scene.id === parsed.activeSceneId)
        ? parsed.activeSceneId
        : scenes[0].id;
    const previewSceneId =
      typeof parsed.previewSceneId === 'string' && scenes.some(scene => scene.id === parsed.previewSceneId)
        ? parsed.previewSceneId
        : activeSceneId;
    return { scenes, activeSceneId, previewSceneId };
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
