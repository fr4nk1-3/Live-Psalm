import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { PlaylistItem, ItemType, Slide } from '../types/presentation';
import { StorageService } from '../services/storage';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { EmptyState } from './ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

interface PlaylistPanelProps {
  playlist: PlaylistItem[];
  activeItemId: string | null;
  /** Select an item for preview without taking it to air. */
  onPreviewItem?: (item: PlaylistItem) => void;
  onSelectItem: (item: PlaylistItem) => void;
  onSelectSlideInItem?: (item: PlaylistItem, slide: Slide) => void;
  onPreviewSlideInItem?: (item: PlaylistItem, slide: Slide) => void;
  onAddItem: (type: ItemType) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onRenameItem?: (id: string, newTitle: string) => void;
  onClearPlaylist?: () => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onLoadTemplate: (templateName: string) => void;
  liveItemId: string | null;
  liveSlideId?: string | null;
}

const SECTION_TAGS: Record<string, string> = {
  chorus: 'CH',
  'pre-chorus': 'PC',
  bridge: 'BR',
  intro: 'IN',
  outro: 'OUT',
  scripture: 'SCR',
  slide: 'SL'
};

const sectionTag = (label?: string, fallbackIdx = 0): string => {
  if (!label) return String(fallbackIdx + 1).padStart(2, '0');
  const lower = label.toLowerCase();
  if (lower.startsWith('verse ')) return `V${label.slice(6).trim()}`;
  if (lower.startsWith('chorus ')) return `C${label.slice(7).trim()}`;
  return SECTION_TAGS[lower] ?? label.slice(0, 3).toUpperCase();
};

const translationAbbr = (id?: string | null): string => (id ? StorageService.getTranslationAbbreviation(id) : '');

const ADD_ITEMS: { type: ItemType; label: string; hint: string }[] = [
  { type: 'header', label: 'Section heading', hint: 'Divide the service into parts' },
  { type: 'song', label: 'Song', hint: 'Worship set from your library' },
  { type: 'bible', label: 'Scripture', hint: 'A Bible passage' },
  { type: 'media', label: 'Media', hint: 'Image or video slide' },
  { type: 'sermon', label: 'Sermon deck', hint: 'Outline with slides' },
  { type: 'announcement', label: 'Announcement', hint: 'Notice for the screens' },
  { type: 'countdown', label: 'Countdown', hint: 'Timer before the service' }
];

const TEMPLATES = [
  'Sunday Service',
  'Midweek Service',
  'Youth Worship Night',
  'Funeral Service',
  'Wedding Ceremony',
  'Conference Event'
];

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  playlist,
  activeItemId,
  onPreviewItem,
  onSelectItem,
  onSelectSlideInItem,
  onPreviewSlideInItem,
  onAddItem,
  onRemoveItem,
  onDuplicateItem,
  onRenameItem,
  onClearPlaylist,
  onMoveItem,
  onLoadTemplate,
  liveItemId,
  liveSlideId
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeItemId && itemRefs.current[activeItemId]) {
      itemRefs.current[activeItemId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeItemId]);

  const anyExpanded = playlist.some(item => expandedIds[item.id]);
  const toggleExpandAll = () => {
    if (anyExpanded) {
      setExpandedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    playlist.forEach(item => {
      if (item.slides.length > 0) next[item.id] = true;
    });
    setExpandedIds(next);
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (playlist.length === 0) return;
    const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const currentIndex = playlist.findIndex(item => item.id === activeItemId);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = currentIndex < 0 ? 0 : Math.min(playlist.length - 1, Math.max(0, currentIndex + step));
      const item = playlist[nextIdx];
      if (item) (onPreviewItem ?? onSelectItem)(item);
      return;
    }
    if (e.key === 'ArrowRight' && activeItemId) {
      e.preventDefault();
      setExpandedIds(prev => ({ ...prev, [activeItemId]: true }));
      return;
    }
    if (e.key === 'ArrowLeft' && activeItemId) {
      e.preventDefault();
      setExpandedIds(prev => ({ ...prev, [activeItemId]: false }));
      return;
    }
    if (e.key === 'Enter' && currentIndex >= 0) {
      e.preventDefault();
      onSelectItem(playlist[currentIndex]);
    }
  };

  const startEditing = (e: React.MouseEvent | undefined, item: PlaylistItem) => {
    e?.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const commitEditing = () => {
    if (editingId) {
      if (onRenameItem && editingTitle.trim()) onRenameItem(editingId, editingTitle.trim());
      setEditingId(null);
    }
  };

  const dragHandlers = (index: number) => ({
    draggable: true,
    onDragStart: () => setDragIndex(index),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverIndex(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) onMoveItem(dragIndex, index);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    onDragEnd: () => {
      setDragIndex(null);
      setDragOverIndex(null);
    }
  });

  return (
    <aside className="panel w-[292px] shrink-0 border-l border-border">
      <div className="panel-header">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="panel-title">Service</h2>
          <span className="tabular text-2xs text-muted-foreground">{playlist.length}</span>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="secondary">
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Add to service</DropdownMenuLabel>
              {ADD_ITEMS.map(item => (
                <DropdownMenuItem key={item.type} onSelect={() => onAddItem(item.type)}>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span>{item.label}</span>
                    <span className="text-2xs text-muted-foreground">{item.hint}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Service options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={toggleExpandAll} disabled={playlist.length === 0}>
                {anyExpanded ? 'Collapse all slides' : 'Expand all slides'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Service templates</DropdownMenuLabel>
              {TEMPLATES.map(template => (
                <DropdownMenuItem key={template} onSelect={() => onLoadTemplate(template)}>
                  {template}
                </DropdownMenuItem>
              ))}
              {onClearPlaylist && playlist.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => {
                      if (window.confirm('Remove every item from this service?')) onClearPlaylist();
                    }}
                  >
                    Clear service
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        aria-label="Service order"
        className="min-h-0 flex-1 overflow-y-auto outline-none"
      >
        {playlist.length === 0 ? (
          <EmptyState
            title="No service yet"
            description="Add songs, scripture and media to build the order of service."
            className="py-14"
            action={
              <Button size="xs" onClick={() => onAddItem('song')}>
                Add a first item
              </Button>
            }
          />
        ) : (
          <ul className="py-1">
            {playlist.map((item, index) => {
              const isSelected = item.id === activeItemId;
              const isLive = item.id === liveItemId;
              const isExpanded = !!expandedIds[item.id];
              const isDragTarget = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
              const bibleAbbr = translationAbbr(item.bibleMeta?.translationId);
              const parallelAbbr = translationAbbr(item.bibleMeta?.parallelTranslationId);
              const hasVideoBg = Boolean(item.videoBackgroundUrl) || item.slides.some(s => s.backgroundType === 'video');

              if (item.type === 'header') {
                return (
                  <li
                    key={item.id}
                    {...dragHandlers(index)}
                    onClick={() => (onPreviewItem ? onPreviewItem(item) : onSelectItem(item))}
                    className={cn(
                      'group relative mx-1 mb-1 mt-3 flex items-center gap-2 rounded-sm px-2 py-1.5 first:mt-1',
                      'cursor-grab active:cursor-grabbing',
                      isSelected ? 'bg-accent/70' : 'hover:bg-accent/40',
                      isDragTarget && 'ring-1 ring-ring'
                    )}
                  >
                    <span className="h-3 w-px bg-border" aria-hidden />
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitEditing();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-6 min-w-0 flex-1 rounded-sm border border-ring bg-background px-1.5 text-2xs font-semibold uppercase tracking-[0.08em] outline-none"
                      />
                    ) : (
                      <span
                        onDoubleClick={e => startEditing(e, item)}
                        className="min-w-0 flex-1 truncate text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        {item.title}
                      </span>
                    )}
                    <ItemMenu
                      item={item}
                      index={index}
                      total={playlist.length}
                      onMoveItem={onMoveItem}
                      onRename={onRenameItem ? () => startEditing(undefined, item) : undefined}
                      onDuplicate={onDuplicateItem}
                      onRemove={onRemoveItem}
                    />
                  </li>
                );
              }

              return (
                <li key={item.id} className="relative">
                  {isDragTarget && <span className="absolute inset-x-1 top-0 h-px bg-foreground" aria-hidden />}
                  <div
                    ref={el => {
                      itemRefs.current[item.id] = el;
                    }}
                    {...dragHandlers(index)}
                    onClick={() => (onPreviewItem ?? onSelectItem)(item)}
                    className={cn(
                      'list-row mx-1 cursor-pointer rounded-sm',
                      isSelected && 'bg-accent text-accent-foreground',
                      isLive && 'pl-[6px]',
                      isDragTarget && 'opacity-60'
                    )}
                    data-active={isSelected}
                  >
                    <span
                      className={cn('absolute inset-y-1 left-0 w-[2px] rounded-full', isLive ? 'bg-live' : 'bg-transparent')}
                      aria-hidden
                    />
                    <span className="tabular w-5 shrink-0 text-2xs text-muted-foreground">{index + 1}</span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {editingId === item.id ? (
                          <input
                            autoFocus
                            value={editingTitle}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={commitEditing}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === 'Enter') commitEditing();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="h-6 min-w-0 flex-1 rounded-sm border border-ring bg-background px-1.5 text-xs outline-none"
                          />
                        ) : (
                          <span
                            onDoubleClick={e => onRenameItem && startEditing(e, item)}
                            className="truncate text-xs font-medium"
                            title={onRenameItem ? 'Double-click to rename' : item.title}
                          >
                            {item.title}
                          </span>
                        )}
                        {isLive && <span className="state-label shrink-0 text-live">Live</span>}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-muted-foreground">
                        <span className="tabular">
                          {item.slides.length} {item.slides.length === 1 ? 'slide' : 'slides'}
                        </span>
                        {bibleAbbr && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{parallelAbbr ? `${bibleAbbr} + ${parallelAbbr}` : bibleAbbr}</span>
                          </>
                        )}
                        {typeof item.autoAdvanceSeconds === 'number' && item.autoAdvanceSeconds > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular">auto {item.autoAdvanceSeconds}s</span>
                          </>
                        )}
                        {hasVideoBg && (
                          <>
                            <span aria-hidden>·</span>
                            <span>motion background</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      {item.slides.length > 0 && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedIds(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          aria-label={isExpanded ? 'Hide slides' : 'Show slides'}
                          aria-expanded={isExpanded}
                          className="flex h-6 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                        >
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')} />
                        </button>
                      )}
                      <ItemMenu
                        item={item}
                        index={index}
                        total={playlist.length}
                        onMoveItem={onMoveItem}
                        onRename={onRenameItem ? () => startEditing(undefined, item) : undefined}
                        onDuplicate={onDuplicateItem}
                        onRemove={onRemoveItem}
                      />
                    </div>
                  </div>

                  {isExpanded && item.slides.length > 0 && (
                    <div className="mx-1 mb-1 border-l border-border pb-1 pl-[26px] pr-1">
                      {item.slides.map((slide, sIdx) => {
                        const isSlideLive = isLive && liveSlideId === slide.id;
                        const snippet = (slide.title || slide.content || 'Untitled slide').replace(/\s+/g, ' ').trim();

                        return (
                          <button
                            key={slide.id}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (onPreviewSlideInItem) onPreviewSlideInItem(item, slide);
                              else if (onSelectSlideInItem) onSelectSlideInItem(item, slide);
                              else (onPreviewItem ?? onSelectItem)(item);
                            }}
                            onDoubleClick={e => {
                              e.stopPropagation();
                              if (onSelectSlideInItem) onSelectSlideInItem(item, slide);
                            }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-2xs transition-colors',
                              isSlideLive ? 'text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            )}
                          >
                            <span
                              className={cn(
                                'w-8 shrink-0 text-2xs tabular',
                                isSlideLive ? 'font-semibold text-live' : 'text-muted-foreground/70'
                              )}
                            >
                              {sectionTag(slide.sectionLabel, sIdx)}
                            </span>
                            <span className="truncate">{snippet}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
        <span>Click to preview · Enter to take live</span>
        <span className="tabular">↑↓ navigate</span>
      </div>
    </aside>
  );
};

function ItemMenu({
  item,
  index,
  total,
  onMoveItem,
  onRename,
  onDuplicate,
  onRemove
}: {
  item: PlaylistItem;
  index: number;
  total: number;
  onMoveItem: (from: number, to: number) => void;
  onRename?: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Options for ${item.title}`}
          onClick={e => e.stopPropagation()}
          className="flex h-6 w-5 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-background/70 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onRename && <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => onDuplicate(item.id)}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onSelect={() => onMoveItem(index, index - 1)}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index >= total - 1} onSelect={() => onMoveItem(index, index + 1)}>
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => onRemove(item.id)}
        >
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Kept for reference by callers that relied on the previous export shape. */
export type { PlaylistPanelProps };
