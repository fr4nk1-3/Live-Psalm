import React from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { sceneThumbnail } from './render';
import { applyLayoutToScene, cameraLayoutScenes, defaultScenes, layoutScenes, SCENE_LAYOUT_OPTIONS } from './presets';
import { getActiveScene, sceneLibrary, useSceneLibrary } from './store';
import { SceneBackground, SceneDocument } from './types';
import { SceneEditor } from './SceneEditor';
import type { MediaAsset, ProjectorLayout, Slide, Theme } from '../types/presentation';

interface ScenePanelProps {
  className?: string;
  slide: Slide | null;
  theme: Theme;
  mediaList?: MediaAsset[];
  /** Switches the preview monitor to scene mode. */
  onPreviewScene?: () => void;
  /** Updates the active Theme (e.g. broadcastLayout, linkLayoutToBroadcast, projectorLayout). */
  onUpdateTheme?: (updated: Partial<Theme>) => void;
}

/**
 * Scene library as a grid. Click a card to prepare it on the preview monitor;
 * send it to programme with the Take button, a double click, or the row menu.
 */
export const ScenePanel: React.FC<ScenePanelProps> = ({
  className,
  slide,
  theme,
  mediaList = [],
  onPreviewScene,
  onUpdateTheme
}) => {
  const library = useSceneLibrary();
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const activeScene = getActiveScene(library);
  const previewScene = library.scenes.find(scene => scene.id === library.previewSceneId) || library.scenes[0];
  const isLinked = Boolean(theme.linkLayoutToBroadcast);
  const audienceLayout: ProjectorLayout =
    theme.projectorLayout || (theme.lowerThirdStyle ? 'lower_third' : 'centered');

  const beginRename = (scene: SceneDocument) => {
    setRenamingId(scene.id);
    setDraftName(scene.name);
  };

  const commitRename = () => {
    if (renamingId) sceneLibrary.renameScene(renamingId, draftName);
    setRenamingId(null);
  };

  const takePreview = () => sceneLibrary.setActiveScene(library.previewSceneId);

  const applyLayout = (scene: SceneDocument | undefined, layout: ProjectorLayout) => {
    if (!scene) return;
    sceneLibrary.updateScene(scene.id, current => applyLayoutToScene(current, layout));
    if (onUpdateTheme) {
      if (isLinked) {
        onUpdateTheme({
          projectorLayout: layout,
          lowerThirdStyle: layout === 'lower_third',
          broadcastLayout: layout
        });
      } else {
        onUpdateTheme({ broadcastLayout: layout });
      }
    }
  };

  const applyBackgroundToScene = (scene: SceneDocument | undefined, background: SceneBackground) => {
    if (!scene) return;
    sceneLibrary.updateScene(scene.id, current => ({
      ...current,
      updatedAt: Date.now(),
      canvas: {
        ...current.canvas,
        background
      }
    }));
  };

  const backgroundAssets = React.useMemo(
    () => mediaList.filter(asset => asset.type === 'image' || asset.type === 'video'),
    [mediaList]
  );

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
                Layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                Apply layout to {activeScene ? `“${activeScene.name}”` : 'scene'}
              </DropdownMenuLabel>
              {SCENE_LAYOUT_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.id}
                  onSelect={() => applyLayout(activeScene || previewScene, opt.id)}
                >
                  {opt.label}
                  {activeScene?.layoutOverride === opt.id && (
                    <span className="ml-auto text-2xs text-emerald-400">Active</span>
                  )}
                </DropdownMenuItem>
              ))}
              {onUpdateTheme && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={isLinked}
                    onSelect={() => {
                      const nextLinked = !isLinked;
                      onUpdateTheme({
                        linkLayoutToBroadcast: nextLinked,
                        ...(nextLinked ? { broadcastLayout: audienceLayout } : {})
                      });
                      if (nextLinked && activeScene) {
                        sceneLibrary.updateScene(activeScene.id, current =>
                          applyLayoutToScene(current, audienceLayout)
                        );
                      }
                    }}
                  >
                    Link to Audience layout
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost">
                Background
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>
                Background for {(activeScene || previewScene) ? `“${(activeScene || previewScene).name}”` : 'scene'}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() =>
                  applyBackgroundToScene(activeScene || previewScene, {
                    type: 'live',
                    from: '#0f172a',
                    to: '#020617',
                    angle: 145,
                    followLiveBackground: true
                  })
                }
              >
                Follow live slide background
                {((activeScene || previewScene)?.canvas.background.type === 'live' ||
                  (activeScene || previewScene)?.canvas.background.followLiveBackground) &&
                  !(activeScene || previewScene)?.canvas.background.src &&
                  !(activeScene || previewScene)?.canvas.background.assetId && (
                    <span className="ml-auto text-2xs text-emerald-400">Active</span>
                  )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  applyBackgroundToScene(activeScene || previewScene, {
                    type: 'gradient',
                    from: '#111827',
                    to: '#020617',
                    angle: 160,
                    followLiveBackground: false
                  })
                }
              >
                Dark stage gradient
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  applyBackgroundToScene(activeScene || previewScene, {
                    type: 'solid',
                    color: '#050508',
                    followLiveBackground: false
                  })
                }
              >
                Solid black stage
              </DropdownMenuItem>
              {backgroundAssets.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Media library backgrounds</DropdownMenuLabel>
                  {backgroundAssets.map(asset => (
                    <DropdownMenuItem
                      key={asset.id}
                      onSelect={() =>
                        applyBackgroundToScene(activeScene || previewScene, {
                          type: asset.type === 'video' ? 'video' : 'image',
                          src: asset.url,
                          assetId: asset.id,
                          from: '#0f172a',
                          to: '#020617',
                          followLiveBackground: false
                        })
                      }
                    >
                      <span className="truncate">{asset.name}</span>
                      <span className="ml-auto pl-2 text-2xs uppercase text-muted-foreground">{asset.type}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost">
                Add scene
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Camera + Layout scenes</DropdownMenuLabel>
              {cameraLayoutScenes().map(({ id, label, scene: preset }) => (
                <DropdownMenuItem
                  key={`cam-${id}`}
                  onSelect={() =>
                    sceneLibrary.addScene({
                      ...preset,
                      id: `scene-${Math.random().toString(36).slice(2, 10)}`,
                      name: label,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    })
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Slide layouts</DropdownMenuLabel>
              {layoutScenes().map(({ id, label, scene: preset }) => (
                <DropdownMenuItem
                  key={id}
                  onSelect={() =>
                    sceneLibrary.addScene({
                      ...preset,
                      id: `scene-${Math.random().toString(36).slice(2, 10)}`,
                      name: `${label} layout`,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    })
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Start from</DropdownMenuLabel>
              {defaultScenes()
                .filter(preset => !preset.name.startsWith('Camera + '))
                .map(preset => (
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
        <div className="grid grid-cols-4 gap-1.5">
          {library.scenes.map(scene => {
            const isLive = scene.id === library.activeSceneId;
            const isPreview = scene.id === library.previewSceneId;
            return (
              <div
                key={scene.id}
                draggable
                onDragStart={() => setDragId(scene.id)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  const mediaRaw = event.dataTransfer?.getData('application/livepsalms-media');
                  if (mediaRaw) {
                    event.preventDefault();
                    try {
                      const asset = JSON.parse(mediaRaw) as MediaAsset;
                      if (asset && asset.url) {
                        applyBackgroundToScene(scene, {
                          type: asset.type === 'video' ? 'video' : 'image',
                          src: asset.url,
                          assetId: asset.id,
                          from: '#0f172a',
                          to: '#020617',
                          followLiveBackground: false
                        });
                      }
                    } catch {
                      /* ignore invalid drop */
                    }
                    return;
                  }
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
                onClick={() => {
                  sceneLibrary.setPreviewScene(scene.id);
                  onPreviewScene?.();
                }}
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
                    <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto" onClick={event => event.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => sceneLibrary.setActiveScene(scene.id)}>Take to programme</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => sceneLibrary.setPreviewScene(scene.id)}>Preview</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditingId(scene.id)}>Edit in editor</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Apply slide layout</DropdownMenuLabel>
                      {SCENE_LAYOUT_OPTIONS.map(opt => (
                        <DropdownMenuItem
                          key={opt.id}
                          onSelect={() => applyLayout(scene, opt.id)}
                        >
                          {opt.label}
                          {scene.layoutOverride === opt.id && (
                            <span className="ml-auto text-2xs text-emerald-400">Active</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Scene background</DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() =>
                          applyBackgroundToScene(scene, {
                            type: 'live',
                            from: '#0f172a',
                            to: '#020617',
                            angle: 145,
                            followLiveBackground: true
                          })
                        }
                      >
                        Follow live slide background
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          applyBackgroundToScene(scene, {
                            type: 'gradient',
                            from: '#111827',
                            to: '#020617',
                            angle: 160,
                            followLiveBackground: false
                          })
                        }
                      >
                        Dark stage gradient
                      </DropdownMenuItem>
                      {backgroundAssets.slice(0, 6).map(asset => (
                        <DropdownMenuItem
                          key={asset.id}
                          onSelect={() =>
                            applyBackgroundToScene(scene, {
                              type: asset.type === 'video' ? 'video' : 'image',
                              src: asset.url,
                              assetId: asset.id,
                              from: '#0f172a',
                              to: '#020617',
                              followLiveBackground: false
                            })
                          }
                        >
                          <span className="truncate">{asset.name}</span>
                        </DropdownMenuItem>
                      ))}
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
