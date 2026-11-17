import React from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { DropdownMenuLabel } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { sceneThumbnail } from './render';
import { defaultScenes } from './presets';
import { useSceneLibrary, sceneLibrary, getActiveScene } from './store';
import { SceneDocument } from './types';

/**
 * Scene library: prepare a scene, take it live, reorder, duplicate or delete.
 * The editor that changes element geometry arrives in the next phase; this
 * panel owns selection and lifecycle.
 */
export const ScenePanel: React.FC<{ className?: string }> = ({ className }) => {
  const library = useSceneLibrary();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [dragId, setDragId] = React.useState<string | null>(null);
  const activeScene = getActiveScene(library);

  const beginRename = (scene: SceneDocument) => {
    setRenamingId(scene.id);
    setDraftName(scene.name);
  };

  const commitRename = () => {
    if (renamingId) sceneLibrary.renameScene(renamingId, draftName);
    setRenamingId(null);
  };

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground">
          {library.scenes.length} scenes · live: <span className="text-live">{activeScene?.name || 'none'}</span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="secondary">
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

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {library.scenes.map((scene, index) => {
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
                const to = index;
                if (from < 0 || from === to) return;
                const direction = from < to ? 'down' : 'up';
                for (let step = 0; step < Math.abs(to - from); step += 1) {
                  sceneLibrary.moveScene(dragId, direction);
                }
                setDragId(null);
              }}
              onClick={() => sceneLibrary.setPreviewScene(scene.id)}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md border p-1.5 transition-colors',
                isPreview ? 'border-border bg-accent/60' : 'border-transparent hover:bg-accent/30'
              )}
              title={scene.description || scene.name}
            >
              <img
                src={sceneThumbnail(scene, 96, 54)}
                alt=""
                className="h-[34px] w-16 shrink-0 rounded-sm border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
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
                    className="h-6 text-2xs"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs text-foreground">{scene.name}</span>
                    {isLive && <span className="state-label shrink-0 text-live">Live</span>}
                  </div>
                )}
                <span className="text-2xs text-muted-foreground">
                  {scene.elements.length} element{scene.elements.length === 1 ? '' : 's'}
                </span>
              </div>

              <Button
                size="xs"
                variant={isLive ? 'secondary' : 'ghost'}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={event => {
                  event.stopPropagation();
                  sceneLibrary.setActiveScene(scene.id);
                }}
              >
                {isLive ? 'Live' : 'Take'}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground"
                    onClick={event => event.stopPropagation()}
                    aria-label={`Scene actions for ${scene.name}`}
                  >
                    …
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48" onClick={event => event.stopPropagation()}>
                  <DropdownMenuItem onSelect={() => sceneLibrary.setActiveScene(scene.id)}>Take live</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => sceneLibrary.setPreviewScene(scene.id)}>Preview</DropdownMenuItem>
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
          );
        })}
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Drag to reorder. Select a scene to prepare it, then Take to put it on air. The stream and the
        Broadcast monitor follow the live scene.
      </p>
    </div>
  );
};
