import React from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Field } from '../components/ui/field';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { SceneCanvas } from './SceneCanvas';
import { sceneLibrary, useSceneLibrary } from './store';
import { listAudioDevices, listDesktopSources, listVideoDevices } from './sources';
import {
  AudioInputElement,
  BrowserElement,
  CameraElement,
  CaptureElement,
  createAudioInputElement,
  createBrowserElement,
  createCameraElement,
  createCaptureElement,
  createImageElement,
  createMediaElement,
  createSceneSourceElement,
  createShapeElement,
  createTextElement,
  createVideoDeviceElement,
  MediaElement,
  SceneSourceElement,
  VideoDeviceElement,
  ImageElement,
  SceneDocument,
  SceneElement,
  SceneFrame,
  ShapeElement,
  TextElement
} from './types';
import { Slide, Theme } from '../types/presentation';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

const HANDLES: { id: Handle; x: number; y: number; cursor: string }[] = [
  { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { id: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { id: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { id: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { id: 'w', x: 0, y: 0.5, cursor: 'ew-resize' }
];

const MIN_SIZE = 24;
const GRID = 8;

const snapValue = (value: number, enabled: boolean) => (enabled ? Math.round(value / GRID) * GRID : Math.round(value));

interface SceneEditorProps {
  scene: SceneDocument | null;
  onClose: () => void;
  slide: Slide | null;
  theme: Theme;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, onClose, slide, theme }) => {
  const [draft, setDraft] = React.useState<SceneDocument | null>(scene);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(0.5);
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [guides, setGuides] = React.useState<{ x?: number; y?: number }>({});
  const [history, setHistory] = React.useState<SceneDocument[]>(scene ? [scene] : []);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const stageContainerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    frame: SceneFrame;
    centerX: number;
    centerY: number;
    startAngle: number;
  } | null>(null);

  React.useEffect(() => {
    setDraft(scene);
    setHistory(scene ? [scene] : []);
    setHistoryIndex(0);
    setSelectedId(scene?.elements[scene.elements.length - 1]?.id || null);
  }, [scene]);

  const selected = draft?.elements.find(element => element.id === selectedId) || null;

  const apply = React.useCallback(
    (next: SceneDocument, recordHistory = true) => {
      setDraft(next);
      if (!recordHistory) return;
      setHistory(previous => {
        const trimmed = previous.slice(0, historyIndex + 1);
        const withNext = [...trimmed, next].slice(-60);
        setHistoryIndex(withNext.length - 1);
        return withNext;
      });
    },
    [historyIndex]
  );

  const patchElement = React.useCallback(
    (elementId: string, patch: Partial<SceneElement>, recordHistory = true) => {
      if (!draft) return;
      const next: SceneDocument = {
        ...draft,
        elements: draft.elements.map(element =>
          element.id === elementId ? ({ ...element, ...patch } as SceneElement) : element
        )
      };
      apply(next, recordHistory);
    },
    [apply, draft]
  );

  const patchFrame = React.useCallback(
    (elementId: string, frame: Partial<SceneFrame>, recordHistory = false) => {
      if (!draft) return;
      const next: SceneDocument = {
        ...draft,
        elements: draft.elements.map(element =>
          element.id === elementId ? { ...element, frame: { ...element.frame, ...frame } } : element
        )
      };
      apply(next, recordHistory);
    },
    [apply, draft]
  );

  const fitToView = React.useCallback(() => {
    const container = stageContainerRef.current;
    if (!container || !draft) return;
    const available = container.clientWidth - 40;
    setZoom(Math.max(0.1, Math.min(1, available / draft.canvas.width)));
  }, [draft]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setDraft(history[nextIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setDraft(history[nextIndex]);
  };

  const scenePoint = (event: { clientX: number; clientY: number }) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !draft) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const hitTest = (x: number, y: number): SceneElement | null => {
    if (!draft) return null;
    const ordered = [...draft.elements].sort((a, b) => b.zIndex - a.zIndex);
    return (
      ordered.find(element => {
        if (!element.visible) return false;
        const { frame } = element;
        return x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
      }) || null
    );
  };

  const onStagePointerDown = (event: React.PointerEvent) => {
    if (!draft) return;
    const { x, y } = scenePoint(event);
    const hit = hitTest(x, y);
    setSelectedId(hit?.id || null);
    if (!hit || hit.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      handle: 'nw',
      startX: x,
      startY: y,
      frame: { ...hit.frame },
      centerX: hit.frame.x + hit.frame.width / 2,
      centerY: hit.frame.y + hit.frame.height / 2,
      startAngle: 0
    };
    moveState.current = { mode: 'move', elementId: hit.id };
  };

  const moveState = React.useRef<{ mode: 'move' | 'resize' | 'rotate'; elementId: string } | null>(null);

  const onHandlePointerDown = (event: React.PointerEvent, handle: Handle) => {
    if (!selected) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = scenePoint(event);
    dragRef.current = {
      handle,
      startX: x,
      startY: y,
      frame: { ...selected.frame },
      centerX: selected.frame.x + selected.frame.width / 2,
      centerY: selected.frame.y + selected.frame.height / 2,
      startAngle: Math.atan2(y - (selected.frame.y + selected.frame.height / 2), x - (selected.frame.x + selected.frame.width / 2))
    };
    moveState.current = { mode: handle === 'rotate' ? 'rotate' : 'resize', elementId: selected.id };
  };

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const state = moveState.current;
      if (!drag || !state || !draft) return;
      const { x, y } = scenePoint(event);
      const dx = x - drag.startX;
      const dy = y - drag.startY;

      if (state.mode === 'move') {
        let nextX = snapValue(drag.frame.x + dx, snapEnabled);
        let nextY = snapValue(drag.frame.y + dy, snapEnabled);
        const centreX = nextX + drag.frame.width / 2;
        const centreY = nextY + drag.frame.height / 2;
        const canvasCentreX = draft.canvas.width / 2;
        const canvasCentreY = draft.canvas.height / 2;
        const tolerance = 6;
        let guide: { x?: number; y?: number } = {};
        if (Math.abs(centreX - canvasCentreX) < tolerance) {
          nextX = canvasCentreX - drag.frame.width / 2;
          guide.x = canvasCentreX;
        }
        if (Math.abs(centreY - canvasCentreY) < tolerance) {
          nextY = canvasCentreY - drag.frame.height / 2;
          guide.y = canvasCentreY;
        }
        setGuides(guide);
        patchFrame(state.elementId, { x: Math.round(nextX), y: Math.round(nextY) });
        return;
      }

      if (state.mode === 'rotate') {
        const angle = Math.atan2(y - drag.centerY, x - drag.centerX);
        const degrees = Math.round(((angle * 180) / Math.PI + 90) % 360);
        patchFrame(state.elementId, { rotation: degrees });
        return;
      }

      const frame = { ...drag.frame };
      let { x: left, y: top, width, height } = frame;
      const right = left + width;
      const bottom = top + height;

      if (drag.handle.includes('w')) {
        const nextLeft = snapValue(left + dx, snapEnabled);
        width = right - nextLeft;
        left = nextLeft;
      }
      if (drag.handle.includes('e')) {
        width = snapValue(left + width + dx, snapEnabled) - left;
      }
      if (drag.handle.includes('n')) {
        const nextTop = snapValue(top + dy, snapEnabled);
        height = bottom - nextTop;
        top = nextTop;
      }
      if (drag.handle.includes('s')) {
        height = snapValue(top + height + dy, snapEnabled) - top;
      }

      if (width < MIN_SIZE) width = MIN_SIZE;
      if (height < MIN_SIZE) height = MIN_SIZE;
      patchFrame(state.elementId, { x: Math.round(left), y: Math.round(top), width: Math.round(width), height: Math.round(height) });
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      moveState.current = null;
      setGuides({});
      if (draft) apply(draft, true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [apply, draft, patchFrame, snapEnabled]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault();
        apply({ ...draft!, elements: draft!.elements.filter(element => element.id !== selected.id) });
        setSelectedId(null);
        return;
      }
      if (modifier && event.key.toLowerCase() === 'd' && selected) {
        event.preventDefault();
        duplicateElement(selected);
        return;
      }
      if (selected && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const frame = { ...selected.frame };
        if (event.key === 'ArrowLeft') frame.x -= step;
        if (event.key === 'ArrowRight') frame.x += step;
        if (event.key === 'ArrowUp') frame.y -= step;
        if (event.key === 'ArrowDown') frame.y += step;
        patchFrame(selected.id, frame, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addElement = (element: SceneElement) => {
    if (!draft) return;
    const maxZ = draft.elements.reduce((max, item) => Math.max(max, item.zIndex), 0);
    apply({ ...draft, elements: [...draft.elements, { ...element, zIndex: maxZ + 1 }] });
    setSelectedId(element.id);
  };

  const duplicateElement = (element: SceneElement) => {
    if (!draft) return;
    const copy = {
      ...element,
      id: `${element.id}-copy-${Math.random().toString(36).slice(2, 6)}`,
      frame: { ...element.frame, x: element.frame.x + 24, y: element.frame.y + 24 },
      zIndex: element.zIndex + 1
    } as SceneElement;
    apply({ ...draft, elements: [...draft.elements, copy] });
    setSelectedId(copy.id);
  };

  const removeElement = (elementId: string) => {
    if (!draft) return;
    apply({ ...draft, elements: draft.elements.filter(element => element.id !== elementId) });
    if (selectedId === elementId) setSelectedId(null);
  };

  const reorderElement = (elementId: string, direction: 'up' | 'down') => {
    if (!draft) return;
    const ordered = [...draft.elements].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex(element => element.id === elementId);
    const target = direction === 'up' ? index + 1 : index - 1;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    apply({ ...draft, elements: ordered.map((element, position) => ({ ...element, zIndex: position })) });
  };

  const save = () => {
    if (!draft) return;
    sceneLibrary.updateScene(draft.id, () => draft);
    onClose();
  };

  if (!scene || !draft) return null;

  const ordered = [...draft.elements].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <Dialog open={Boolean(scene)} onOpenChange={next => !next && onClose()}>
      <DialogContent className="h-[min(92vh,52rem)] max-w-[76rem]">
        <DialogHeader>
          <DialogTitle>Edit scene</DialogTitle>
          <DialogDescription>{draft.name}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 border-y border-border bg-background/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => addElement(createTextElement())}>
              Text
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createShapeElement())}>
              Shape
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createImageElement())}>
              Image
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createCameraElement())}>
              Camera
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createCaptureElement('display'))}>
              Display
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createCaptureElement('window'))}>
              Window
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createVideoDeviceElement())}>
              Video device
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createAudioInputElement())}>
              Audio in
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createMediaElement())}>
              Media
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createSceneSourceElement())}>
              Scene
            </Button>
            <Button size="xs" variant="secondary" onClick={() => addElement(createBrowserElement())}>
              Browser
            </Button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Button size="xs" variant="ghost" onClick={undo} disabled={historyIndex <= 0}>
              Undo
            </Button>
            <Button size="xs" variant="ghost" onClick={redo} disabled={historyIndex >= history.length - 1}>
              Redo
            </Button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} aria-label="Snap to grid" />
              Snap
            </label>
            <div className="ml-auto flex items-center gap-1">
              <Button size="xs" variant="ghost" onClick={fitToView}>
                Fit
              </Button>
              {[0.25, 0.5, 0.75, 1].map(value => (
                <Button
                  key={value}
                  size="xs"
                  variant={zoom === value ? 'secondary' : 'ghost'}
                  onClick={() => setZoom(value)}
                >
                  {value * 100}%
                </Button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 gap-3">
            {/* Layers */}
            <div className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-card/60 p-1.5">
              <span className="field-label px-1">Layers</span>
              {ordered.map(element => (
                <div
                  key={element.id}
                  onClick={() => setSelectedId(element.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-1 text-2xs',
                    selectedId === element.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{element.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={event => {
                      event.stopPropagation();
                      patchElement(element.id, { visible: !element.visible });
                    }}
                    aria-label={element.visible ? 'Hide element' : 'Show element'}
                  >
                    {element.visible ? '◉' : '○'}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={event => {
                      event.stopPropagation();
                      patchElement(element.id, { locked: !element.locked });
                    }}
                    aria-label={element.locked ? 'Unlock element' : 'Lock element'}
                  >
                    {element.locked ? '▣' : '▢'}
                  </button>
                </div>
              ))}
              {ordered.length === 0 && <p className="px-1 text-2xs text-muted-foreground">No elements yet.</p>}
            </div>

            {/* Stage */}
            <div ref={stageContainerRef} className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-[repeating-conic-gradient(#151519_0%_25%,#101014_0%_50%)] bg-[length:16px_16px] p-4">
              <div
                ref={stageRef}
                className="relative mx-auto"
                style={{ width: draft.canvas.width * zoom, height: draft.canvas.height * zoom }}
                onPointerDown={onStagePointerDown}
              >
                <SceneCanvas scene={draft} slide={slide} theme={theme} className="absolute inset-0" />

                {selected && (
                  <div
                    className="pointer-events-none absolute border border-live/80"
                    style={{
                      left: selected.frame.x * zoom,
                      top: selected.frame.y * zoom,
                      width: selected.frame.width * zoom,
                      height: selected.frame.height * zoom,
                      transform: selected.frame.rotation ? `rotate(${selected.frame.rotation}deg)` : undefined,
                      transformOrigin: 'center'
                    }}
                  >
                    {HANDLES.map(handle => (
                      <div
                        key={handle.id}
                        className="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] border border-live bg-background"
                        style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%`, cursor: handle.cursor }}
                        onPointerDown={event => onHandlePointerDown(event, handle.id)}
                      />
                    ))}
                    <div
                      className="pointer-events-auto absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-live bg-background"
                      style={{ top: -18, cursor: 'grab' }}
                      onPointerDown={event => onHandlePointerDown(event, 'rotate')}
                    />
                  </div>
                )}

                {guides.x !== undefined && (
                  <div className="pointer-events-none absolute inset-y-0 w-px bg-live/50" style={{ left: guides.x * zoom }} />
                )}
                {guides.y !== undefined && (
                  <div className="pointer-events-none absolute inset-x-0 h-px bg-live/50" style={{ top: guides.y * zoom }} />
                )}
              </div>
            </div>

            {/* Properties */}
            <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-card/60 p-2">
              <span className="field-label">Properties</span>
              {!selected && <p className="text-2xs text-muted-foreground">Select an element on the canvas.</p>}
              {selected && (
                <>
                  <Field label="Name">
                    <Input
                      value={selected.name}
                      onChange={event => patchElement(selected.id, { name: event.target.value }, false)}
                      className="h-7 text-2xs"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['x', 'y', 'width', 'height'] as const).map(key => (
                      <Field key={key} label={key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase()}>
                        <Input
                          type="number"
                          value={Math.round(selected.frame[key])}
                          onChange={event => patchFrame(selected.id, { [key]: Number(event.target.value) } as Partial<SceneFrame>)}
                          className="h-7 text-2xs"
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field label="Rotation">
                      <Input
                        type="number"
                        value={selected.frame.rotation || 0}
                        onChange={event => patchFrame(selected.id, { rotation: Number(event.target.value) })}
                        className="h-7 text-2xs"
                      />
                    </Field>
                    <Field label="Opacity">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round((selected.frame.opacity ?? 1) * 100)}
                        onChange={event => patchFrame(selected.id, { opacity: Number(event.target.value) / 100 })}
                        className="h-7 text-2xs"
                      />
                    </Field>
                  </div>

                  {selected.type === 'text' && (
                    <TextProperties
                      element={selected}
                      onChange={patch => patchElement(selected.id, patch, false)}
                    />
                  )}
                  {selected.type === 'shape' && (
                    <ShapeProperties element={selected} onChange={patch => patchElement(selected.id, patch, false)} />
                  )}
                  {selected.type === 'image' && (
                    <ImageProperties element={selected} onChange={patch => patchElement(selected.id, patch, false)} />
                  )}
                  {selected.type === 'camera' && (
                    <CameraProperties element={selected} onChange={patch => patchElement(selected.id, patch, false)} />
                  )}
                  {(selected.type === 'display' ||
                    selected.type === 'window' ||
                    selected.type === 'videoDevice' ||
                    selected.type === 'audioInput' ||
                    selected.type === 'media' ||
                    selected.type === 'scene' ||
                    selected.type === 'browser') && (
                    <SourceProperties
                      element={selected}
                      currentSceneId={scene.id}
                      onChange={patch => patchElement(selected.id, patch as Partial<SceneElement>, false)}
                    />
                  )}

                  <div className="mt-auto flex flex-wrap gap-1 pt-2">
                    <Button size="xs" variant="ghost" onClick={() => reorderElement(selected.id, 'up')}>
                      Raise
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => reorderElement(selected.id, 'down')}>
                      Lower
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => duplicateElement(selected)}>
                      Duplicate
                    </Button>
                    <Button size="xs" variant="ghost" className="text-destructive" onClick={() => removeElement(selected.id)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between gap-3">
          <p className="text-2xs text-muted-foreground">
            Drag to move · handles resize · top handle rotates · arrows nudge · Ctrl+Z undo · Ctrl+D duplicate
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save scene
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


type SourceElement =
  | CaptureElement
  | VideoDeviceElement
  | AudioInputElement
  | MediaElement
  | SceneSourceElement
  | BrowserElement;

const SourceProperties: React.FC<{
  element: SourceElement;
  currentSceneId: string;
  onChange: (patch: Partial<SourceElement>) => void;
}> = ({ element, currentSceneId, onChange }) => {
  const library = useSceneLibrary();
  const [desktopSources, setDesktopSources] = React.useState<{ id: string; name: string; type: string }[]>([]);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (element.type === 'display' || element.type === 'window') {
      void listDesktopSources(element.type === 'window' ? 'window' : 'screen').then(sources => {
        if (!cancelled) setDesktopSources(sources);
      });
    } else if (element.type === 'videoDevice' || element.type === 'audioInput') {
      const loader = element.type === 'videoDevice' ? listVideoDevices : listAudioDevices;
      void loader().then(list => {
        if (!cancelled) setDevices(list);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [element.type]);

  if (element.type === 'display' || element.type === 'window') {
    return (
      <>
        <Field
          label={element.type === 'display' ? 'Display' : 'Window'}
          hint={desktopSources.length === 0 ? 'No sources found yet — open the editor on the operator machine.' : undefined}
        >
          <Select
            value={element.sourceId || 'none'}
            onValueChange={value =>
              onChange({
                sourceId: value === 'none' ? '' : value,
                sourceName: desktopSources.find(source => source.id === value)?.name || ''
              } as Partial<SourceElement>)
            }
          >
            <SelectTrigger className="h-7 text-2xs" aria-label="Capture source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a source…</SelectItem>
              {desktopSources.map(source => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fit">
          <Select value={element.fit} onValueChange={value => onChange({ fit: value as 'cover' | 'contain' } as Partial<SourceElement>)}>
            <SelectTrigger className="h-7 text-2xs" aria-label="Capture fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Cover</SelectItem>
              <SelectItem value="contain">Contain</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </>
    );
  }

  if (element.type === 'videoDevice' || element.type === 'audioInput') {
    return (
      <Field
        label="Device"
        hint={element.type === 'audioInput' ? 'Audio sources are mixed into the stream.' : undefined}
      >
        <Select
          value={element.deviceId || 'default'}
          onValueChange={value => onChange({ deviceId: value === 'default' ? '' : value } as Partial<SourceElement>)}
        >
          <SelectTrigger className="h-7 text-2xs" aria-label="Capture device">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">System default</SelectItem>
            {devices.map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || 'Device'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (element.type === 'media') {
    return (
      <>
        <Field label="Media URL" hint="A video file URL, data URL or media library URL.">
          <Input value={element.src} onChange={event => onChange({ src: event.target.value })} className="h-7 text-2xs" />
        </Field>
        <Field label="Fit">
          <Select value={element.fit} onValueChange={value => onChange({ fit: value as 'cover' | 'contain' } as Partial<SourceElement>)}>
            <SelectTrigger className="h-7 text-2xs" aria-label="Media fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Cover</SelectItem>
              <SelectItem value="contain">Contain</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center justify-between">
          <Label className="text-2xs">Loop</Label>
          <Switch checked={element.loop} onCheckedChange={loop => onChange({ loop } as Partial<SourceElement>)} aria-label="Loop media" />
        </div>
      </>
    );
  }

  if (element.type === 'scene') {
    return (
      <Field label="Scene" hint="Draws another scene inside this frame.">
        <Select
          value={element.sceneId || 'none'}
          onValueChange={value => onChange({ sceneId: value === 'none' ? '' : value } as Partial<SourceElement>)}
        >
          <SelectTrigger className="h-7 text-2xs" aria-label="Nested scene">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Choose a scene…</SelectItem>
            {library.scenes
              .filter(scene => scene.id !== currentSceneId)
              .map(scene => (
                <SelectItem key={scene.id} value={scene.id}>
                  {scene.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (element.type === 'browser') {
    return (
      <Field label="URL" hint="Rendered by an embedded browser and copied into the canvas.">
        <Input value={element.url} onChange={event => onChange({ url: event.target.value })} className="h-7 text-2xs" />
      </Field>
    );
  }

  return null;
};
const TextProperties: React.FC<{ element: TextElement; onChange: (patch: Partial<TextElement>) => void }> = ({
  element,
  onChange
}) => (
  <>
    <Field label="Binding" hint="Take the text from the live presentation.">
      <Select
        value={element.binding || 'none'}
        onValueChange={value => onChange({ binding: value === 'none' ? null : (value as TextElement['binding']) })}
      >
        <SelectTrigger className="h-7 text-2xs" aria-label="Text binding">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Static text</SelectItem>
          <SelectItem value="slide.content">Slide content</SelectItem>
          <SelectItem value="slide.title">Slide title</SelectItem>
          <SelectItem value="slide.subtitle">Slide subtitle</SelectItem>
          <SelectItem value="slide.reference">Scripture reference</SelectItem>
          <SelectItem value="theme.name">Theme name</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    {!element.binding && (
      <Field label="Text">
        <Input value={element.content} onChange={event => onChange({ content: event.target.value })} className="h-7 text-2xs" />
      </Field>
    )}
    <div className="grid grid-cols-2 gap-1.5">
      <Field label="Size">
        <Input
          type="number"
          value={element.fontSize}
          onChange={event => onChange({ fontSize: Number(event.target.value) })}
          className="h-7 text-2xs"
        />
      </Field>
      <Field label="Weight">
        <Select value={element.fontWeight} onValueChange={value => onChange({ fontWeight: value })}>
          <SelectTrigger className="h-7 text-2xs" aria-label="Font weight">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="400">Regular</SelectItem>
            <SelectItem value="500">Medium</SelectItem>
            <SelectItem value="600">Semibold</SelectItem>
            <SelectItem value="700">Bold</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
    <Field label="Colour">
      <Input type="color" value={element.color} onChange={event => onChange({ color: event.target.value })} className="h-7 w-full p-1" />
    </Field>
    <Field label="Align">
      <Select value={element.align} onValueChange={value => onChange({ align: value as TextElement['align'] })}>
        <SelectTrigger className="h-7 text-2xs" aria-label="Text alignment">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field label="Line height" action={<span className="tabular text-2xs text-muted-foreground">{element.lineHeight.toFixed(2)}</span>}>
      <Slider
        value={[element.lineHeight * 100]}
        min={90}
        max={180}
        step={5}
        onValueChange={([value]) => onChange({ lineHeight: value / 100 })}
        aria-label="Line height"
      />
    </Field>
    <div className="flex items-center justify-between">
      <Label className="text-2xs">Shadow</Label>
      <Switch checked={element.shadow} onCheckedChange={shadow => onChange({ shadow })} aria-label="Text shadow" />
    </div>
  </>
);

const ShapeProperties: React.FC<{ element: ShapeElement; onChange: (patch: Partial<ShapeElement>) => void }> = ({
  element,
  onChange
}) => (
  <>
    <Field label="Kind">
      <Select value={element.kind} onValueChange={value => onChange({ kind: value as ShapeElement['kind'] })}>
        <SelectTrigger className="h-7 text-2xs" aria-label="Shape kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rect">Rectangle</SelectItem>
          <SelectItem value="circle">Circle</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field label="Fill">
      <Input type="color" value={element.fill.startsWith('#') ? element.fill : '#101014'} onChange={event => onChange({ fill: event.target.value })} className="h-7 w-full p-1" />
    </Field>
    <Field label="Radius">
      <Input type="number" value={element.radius} onChange={event => onChange({ radius: Number(event.target.value) })} className="h-7 text-2xs" />
    </Field>
  </>
);

const ImageProperties: React.FC<{ element: ImageElement; onChange: (patch: Partial<ImageElement>) => void }> = ({
  element,
  onChange
}) => (
  <>
    <Field label="Image URL" hint="Paste a URL or data URL from the media library.">
      <Input value={element.src} onChange={event => onChange({ src: event.target.value })} className="h-7 text-2xs" />
    </Field>
    <Field label="Fit">
      <Select value={element.fit} onValueChange={value => onChange({ fit: value as ImageElement['fit'] })}>
        <SelectTrigger className="h-7 text-2xs" aria-label="Image fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cover">Cover</SelectItem>
          <SelectItem value="contain">Contain</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </>
);

const CameraProperties: React.FC<{ element: CameraElement; onChange: (patch: Partial<CameraElement>) => void }> = ({
  element,
  onChange
}) => (
  <>
    <Field label="Fit">
      <Select value={element.fit} onValueChange={value => onChange({ fit: value as CameraElement['fit'] })}>
        <SelectTrigger className="h-7 text-2xs" aria-label="Camera fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cover">Cover</SelectItem>
          <SelectItem value="contain">Contain</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <div className="flex items-center justify-between">
      <Label className="text-2xs">Mirror</Label>
      <Switch checked={element.mirror} onCheckedChange={mirror => onChange({ mirror })} aria-label="Mirror camera" />
    </div>
  </>
);
