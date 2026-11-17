import React from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { sceneThumbnail } from './render';
import { defaultScenes } from './presets';
import { getActiveScene, sceneLibrary, useSceneLibrary } from './store';
import { SceneDocument } from './types';
import { SceneEditor } from './SceneEditor';
import type { MediaAsset, Slide, Theme } from '../types/presentation';

interface ScenePanelProps {
  className?: string;
  slide: Slide | null;
  theme: Theme;
  mediaList?: MediaAsset[];
}

/**
 * Scene library as a grid. Click a card to prepare it on the preview monitor;
 * send it to programme with the Take button, a double click, or the row menu.
 */
export const ScenePanel: React.FC<ScenePanelProps> = ({ className, slide, theme, mediaList = [] }) => {
  const library = useSceneLibrary();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const activeScene = getActiveScene(library);
  const previewScene = library.scenes.find(scene => scene.id === library.previewSceneId) || library.scenes[0];

  const beginRename = (scene: SceneDocument) => {
    setRenamingId(scene.id);
    setDraftName(scene.name);
  };

  const commitRename = () => {
    if (renamingId) sceneLibrary.renameScene(renamingId, draftName);
    setRenamingId(null);
  };

  const takePreview = () => sceneLibrary.setActiveScene(library.previewSceneId);

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground">
          {library.scenes.length} scenes · programme:{' '}
          <span className="text-emerald-400">{activeScene?.name || 'none'}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="secondary" onClick={takePreview} title="Send the preview scene to programme">
            Take {previewScene ? `“${previewScene.name}”` : ''}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost">
                Add scene
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Start from</DropdownMenuLabel>
              {defaultScenes().map(preset => (
                <DropdownMenuItem
                  key={preset.name}
                  onSelect={() =>
                    sceneLibrary.addScene({
                      ...preset,
                      id: `scene-${Math.random().toString(36).slice(2, 10)}`,
                      name: preset.name,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    })
                  }
                >
                  {preset.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  sceneLibrary.addScene({
                    version: 1,
                    id: `scene-${Math.random().toString(36).slice(2, 10)}`,
                    name: 'Blank scene',
                    canvas: { width: 1920, height: 1080, background: { type: 'solid', color: '#0e0e10' } },
                    elements: [],
                    transition: { type: 'fade', durationMs: 400 },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  })
                }
              >
                Blank scene
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-3 gap-1.5">
          {library.scenes.map(scene => {
            const isLive = scene.id === library.activeSceneId;
            const isPreview = scene.id === library.previewSceneId;
            return (
              <div
                key={scene.id}
                draggable
                onDragStart={() => setDragId(scene.id)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (!dragId || dragId === scene.id) return;
                  const from = library.scenes.findIndex(item => item.id === dragId);
                  const to = library.scenes.findIndex(item => item.id === scene.id);
                  if (from < 0 || to < 0 || from === to) return;
                  const direction = from < to ? 'down' : 'up';
                  for (let step = 0; step < Math.abs(to - from); step += 1) {
                    sceneLibrary.moveScene(dragId, direction);
                  }
                  setDragId(null);
                }}
                onClick={() => sceneLibrary.setPreviewScene(scene.id)}
                onDoubleClick={() => {
                  sceneLibrary.setPreviewScene(scene.id);
                  sceneLibrary.setActiveScene(scene.id);
                }}
                className={cn(
                  'group cursor-pointer overflow-hidden rounded-md border bg-card/60 transition-colors',
                  isPreview ? 'border-foreground/40 ring-1 ring-foreground/20' : 'border-border hover:border-foreground/25'
                )}
                title={scene.description || scene.name}
              >
                <div className="relative">
                  <img src={sceneThumbnail(scene, 320, 180)} alt="" className="block aspect-video w-full object-cover" />
                  {isLive && (
                    <span className="absolute left-1 top-1 rounded-sm bg-emerald-500 px-1 text-[10px] font-semibold leading-4 text-black">
                      LIVE
                    </span>
                  )}
                  <Button
                    size="xs"
                    variant="secondary"
                    className="absolute bottom-1 right-1 h-5 px-1.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={event => {
                      event.stopPropagation();
                      sceneLibrary.setActiveScene(scene.id);
                    }}
                  >
                    Take
                  </Button>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-1">
                  {renamingId === scene.id ? (
                    <Input
                      autoFocus
                      value={draftName}
                      onChange={event => setDraftName(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={event => {
                        if (event.key === 'Enter') commitRename();
                        if (event.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={event => event.stopPropagation()}
                      className="h-5 text-2xs"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-2xs text-foreground">{scene.name}</span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 px-0.5 text-muted-foreground hover:text-foreground"
                        onClick={event => event.stopPropagation()}
                        aria-label={`Scene actions for ${scene.name}`}
                      >
                        …
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48" onClick={event => event.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => sceneLibrary.setActiveScene(scene.id)}>Take to programme</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => sceneLibrary.setPreviewScene(scene.id)}>Preview</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditingId(scene.id)}>Edit in editor</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => beginRename(scene)}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => sceneLibrary.duplicateScene(scene.id)}>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => sceneLibrary.moveScene(scene.id, 'up')}>Move up</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => sceneLibrary.moveScene(scene.id, 'down')}>Move down</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={library.scenes.length <= 1}
                        onSelect={() => sceneLibrary.deleteScene(scene.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Click a scene to preview it on the preview monitor, then Take (or double-click) to send it to programme. Drag cards
        to reorder.
      </p>

      {editingId && (
        <SceneEditor
          scene={library.scenes.find(scene => scene.id === editingId) || null}
          slide={slide}
          theme={theme}
          mediaList={mediaList}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
};
