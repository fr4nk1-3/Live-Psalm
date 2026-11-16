import React, { useState, useEffect, useRef } from 'react';
import {
  PlaylistItem,
  ItemType,
  Slide
} from '../types/presentation';
import { StorageService } from '../services/storage';
import {
  Plus,
  Trash2,
  Copy,
  Music,
  Book,
  Film,
  Megaphone,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FolderPlus,
  ArrowUp,
  ArrowDown,
  Bookmark,
  Radio,
  Timer,
  Pencil,
  GripVertical,
  Minus
} from 'lucide-react';

interface PlaylistPanelProps {
  playlist: PlaylistItem[];
  activeItemId: string | null;
  onSelectItem: (item: PlaylistItem) => void;
  onSelectSlideInItem?: (item: PlaylistItem, slide: Slide) => void;
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

const shortSectionTag = (label?: string, fallbackIdx?: number): string => {
  if (!label) return `${(fallbackIdx ?? 0) + 1}`;
  const lower = label.toLowerCase();
  if (lower.startsWith('verse ')) return `V${label.slice(6).trim()}`;
  if (lower === 'chorus') return 'CH';
  if (lower.startsWith('chorus ')) return `C${label.slice(7).trim()}`;
  if (lower === 'pre-chorus') return 'PC';
  if (lower === 'bridge') return 'BR';
  if (lower === 'intro') return 'IN';
  if (lower === 'outro') return 'OUT';
  if (lower === 'scripture') return 'SCR';
  if (lower === 'slide') return `${(fallbackIdx ?? 0) + 1}`;
  return label.slice(0, 4).toUpperCase();
};

const shortBibleId = (id?: string | null): string => {
  if (!id) return '';
  return StorageService.getTranslationAbbreviation(id);
};

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  playlist,
  activeItemId,
  onSelectItem,
  onSelectSlideInItem,
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const headerActionsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keep active playlist item scrolled into view when navigating via keyboard
  useEffect(() => {
    if (activeItemId && itemRefs.current[activeItemId]) {
      itemRefs.current[activeItemId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeItemId]);

  const toggleExpandItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const anyExpanded = playlist.some(item => expandedIds[item.id]);
  const handleToggleExpandAll = () => {
    if (anyExpanded) {
      setExpandedIds({});
    } else {
      const next: Record<string, boolean> = {};
      playlist.forEach(item => {
        if (item.slides.length > 0) next[item.id] = true;
      });
      setExpandedIds(next);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (playlist.length === 0) return;
    const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const currentIndex = playlist.findIndex(item => item.id === activeItemId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const nextIdx = currentIndex < 0 ? 0 : Math.min(playlist.length - 1, currentIndex + 1);
      onSelectItem(playlist[nextIdx]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const prevIdx = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
      onSelectItem(playlist[prevIdx]);
    } else if (e.key === 'ArrowRight' && activeItemId) {
      e.preventDefault();
      e.stopPropagation();
      setExpandedIds(prev => ({ ...prev, [activeItemId]: true }));
    } else if (e.key === 'ArrowLeft' && activeItemId) {
      e.preventDefault();
      e.stopPropagation();
      setExpandedIds(prev => ({ ...prev, [activeItemId]: false }));
    } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      onSelectItem(playlist[currentIndex]);
    }
  };

  const getItemIcon = (type: ItemType) => {
    switch (type) {
      case 'song': return <Music className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'bible': return <Book className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'media': return <Film className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'announcement': return <Megaphone className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'countdown': return <Clock className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'sermon': return <FileText className="w-4 h-4 text-indigo-400 shrink-0" />;
      default: return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="w-56 xl:w-64 2xl:w-72 bg-[#0f1624] border-r border-[#26334a] flex flex-col h-full min-h-0 select-none shrink-0 transition-[width] duration-150">
      {/* Panel Header */}
      <div className="p-2.5 border-b border-[#26334a] bg-[#131b2c] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black text-[11px] uppercase tracking-wider text-slate-200 whitespace-nowrap">
            Service Playlist
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800/90 text-slate-300 font-bold border border-slate-700 shrink-0">
            {playlist.length} {playlist.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Uniform Action Bar */}
        <div ref={headerActionsRef} className="grid grid-cols-3 gap-1.5 relative">
          <button
            type="button"
            onClick={handleToggleExpandAll}
            disabled={playlist.length === 0}
            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition disabled:opacity-35 ${
              anyExpanded
                ? 'bg-indigo-600/25 border-indigo-400/60 text-indigo-200 hover:bg-indigo-600/35'
                : 'bg-[#0f1624] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={anyExpanded ? 'Collapse all slide previews' : 'Expand all slide previews'}
          >
            <ChevronsUpDown className="w-3 h-3 shrink-0" />
            <span>{anyExpanded ? 'Collapse' : 'Slides'}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTemplateMenu(prev => !prev);
                setShowAddMenu(false);
              }}
              className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition ${
                showTemplateMenu
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-[#0f1624] border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Load a service template"
            >
              <FolderPlus className="w-3 h-3 shrink-0 text-amber-400" />
              <span>Template</span>
            </button>
            {showTemplateMenu && (
              <div className="absolute left-0 top-9 w-48 bg-[#182234] border border-[#26334a] rounded-lg shadow-2xl py-1 z-50 text-xs text-slate-200">
                <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase border-b border-slate-700">
                  Service Templates
                </div>
                {[
                  'Sunday Service',
                  'Midweek Service',
                  'Youth Worship Night',
                  'Funeral Service',
                  'Wedding Ceremony',
                  'Conference Event'
                ].map(tmpl => (
                  <button
                    key={tmpl}
                    onClick={() => {
                      onLoadTemplate(tmpl);
                      setShowTemplateMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-indigo-600/30 hover:text-indigo-200 transition"
                  >
                    {tmpl}
                  </button>
                ))}
                {onClearPlaylist && playlist.length > 0 && (
                  <div className="border-t border-slate-700 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateMenu(false);
                        if (window.confirm('Clear all items from the current service playlist?')) {
                          onClearPlaylist();
                        }
                      }}
                      className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-600/20 hover:text-rose-200 font-semibold transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" /> Clear Playlist
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAddMenu(prev => !prev);
                setShowTemplateMenu(false);
              }}
              className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 shadow transition border border-indigo-500"
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span>Add</span>
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-9 w-44 bg-[#182234] border border-[#26334a] rounded-lg shadow-2xl py-1 z-50 text-xs">
                {[
                  { type: 'header', label: 'Section Header', icon: Minus },
                  { type: 'song', label: 'Worship Song', icon: Music },
                  { type: 'bible', label: 'Scripture Verse', icon: Book },
                  { type: 'media', label: 'Background / Media', icon: Film },
                  { type: 'announcement', label: 'Announcement', icon: Megaphone },
                  { type: 'countdown', label: 'Countdown Timer', icon: Clock },
                  { type: 'sermon', label: 'Sermon Deck', icon: FileText }
                ].map(item => (
                  <button
                    key={item.type}
                    onClick={() => {
                      onAddItem(item.type as ItemType);
                      setShowAddMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-indigo-600/30 text-slate-200 flex items-center gap-2 transition"
                  >
                    <item.icon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Items Scrollable List (focusable for keyboard navigation) */}
      <div
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        aria-label="Service Playlist Items"
        className="flex-1 overflow-y-auto p-2 space-y-1.5 outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500/40"
      >
        {playlist.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
            <p>Service playlist is empty.</p>
            <p className="mt-1 text-slate-600">Click "+ Add" or load a template above.</p>
          </div>
        ) : (
          playlist.map((item, index) => {
            const isSelected = item.id === activeItemId;
            const isLive = item.id === liveItemId;
            const isExpanded = !!expandedIds[item.id];
            const isHeader = item.type === 'header';
            const isDragTarget = dragOverIndex === index && dragIndex !== null && dragIndex !== index;

            const startEditingTitle = (e?: React.MouseEvent) => {
              e?.stopPropagation();
              setEditingId(item.id);
              setEditingTitle(item.title);
            };

            const commitEditingTitle = () => {
              if (editingId === item.id) {
                if (onRenameItem && editingTitle.trim()) {
                  onRenameItem(item.id, editingTitle);
                }
                setEditingId(null);
              }
            };

            if (isHeader) {
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) {
                      onMoveItem(dragIndex, index);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onClick={() => onSelectItem(item)}
                  className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border transition cursor-grab active:cursor-grabbing ${
                    isDragTarget
                      ? 'border-indigo-400 bg-indigo-950/50'
                      : isSelected
                      ? 'bg-slate-800/90 border-indigo-500/60'
                      : 'bg-[#0b101b] border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />
                    {editingId === item.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={commitEditingTitle}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitEditingTitle();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-[#141d2e] border border-indigo-500 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white outline-none"
                      />
                    ) : (
                      <span
                        onDoubleClick={startEditingTitle}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-300 truncate"
                        title="Double-click to rename section"
                      >
                        {item.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                    {onRenameItem && (
                      <button
                        type="button"
                        onClick={startEditingTitle}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                        title="Rename section"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                      title="Remove section header"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            }

            const hasVideoBg =
              Boolean(item.videoBackgroundUrl) ||
              item.slides.some(s => s.backgroundType === 'video');
            const hasAutoAdvance =
              typeof item.autoAdvanceSeconds === 'number' && item.autoAdvanceSeconds > 0;
            const hasRememberedSlide =
              item.type === 'bible' && Boolean(item.lastViewedSlideId);
            const primaryBibleAbbr = shortBibleId(item.bibleMeta?.translationId);
            const parallelBibleAbbr = shortBibleId(item.bibleMeta?.parallelTranslationId);

            return (
              <div
                key={item.id}
                ref={el => {
                  itemRefs.current[item.id] = el;
                }}
                draggable={editingId !== item.id}
                onDragStart={() => setDragIndex(index)}
                onDragOver={e => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    onMoveItem(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`rounded-lg border transition overflow-hidden ${
                  isDragTarget
                    ? 'border-indigo-400 ring-1 ring-indigo-400/60 bg-indigo-950/60'
                    : isLive
                    ? 'bg-rose-950/35 border-rose-500/80 shadow-[0_0_10px_rgba(239,68,68,0.18)]'
                    : isSelected
                    ? 'bg-indigo-950/50 border-indigo-500/70 text-white'
                    : 'bg-[#141d2e]/80 border-slate-800/80 hover:bg-[#1c273e] hover:border-slate-700 text-slate-300'
                }`}
              >
                {/* Item Row (Single-click = Go Live immediately) */}
                <div
                  onClick={() => onSelectItem(item)}
                  className="group relative px-2 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Expand/Collapse Slide Preview Chevron */}
                    {item.slides.length > 0 ? (
                      <button
                        type="button"
                        onClick={e => toggleExpandItem(item.id, e)}
                        className="p-0.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition shrink-0"
                        title={isExpanded ? 'Collapse slides preview' : 'Expand slides preview'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-300" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    {/* Reorder Arrows (Hover) */}
                    <div className="hidden group-hover:flex flex-col shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={e => {
                          e.stopPropagation();
                          onMoveItem(index, index - 1);
                        }}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                        title="Move up"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === playlist.length - 1}
                        onClick={e => {
                          e.stopPropagation();
                          onMoveItem(index, index + 1);
                        }}
                        className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                        title="Move down"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-slate-500 min-w-[14px] group-hover:hidden shrink-0">
                      {index + 1}
                    </span>

                    {getItemIcon(item.type)}

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingTitle}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={commitEditingTitle}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === 'Enter') commitEditingTitle();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full bg-[#0b101b] border border-indigo-500 rounded px-1.5 py-0.5 text-xs font-semibold text-white outline-none"
                          />
                        ) : (
                          <span
                            onDoubleClick={startEditingTitle}
                            className="font-semibold text-xs truncate"
                            title="Double-click to rename"
                          >
                            {item.title}
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 bg-rose-600 text-white rounded shrink-0">
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Quick Cues & Indicators Row */}
                      <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap overflow-hidden">
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {item.slides.length} {item.slides.length === 1 ? 'slide' : 'slides'}
                        </span>

                        {primaryBibleAbbr && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-300 shrink-0">
                            {parallelBibleAbbr ? `${primaryBibleAbbr}+${parallelBibleAbbr}` : primaryBibleAbbr}
                          </span>
                        )}

                        {hasAutoAdvance && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-semibold text-emerald-300"
                            title={`Auto-advance every ${item.autoAdvanceSeconds}s`}
                          >
                            <Timer className="w-2.5 h-2.5" />
                            {item.autoAdvanceSeconds}s
                          </span>
                        )}

                        {item.type === 'countdown' && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-500/15 border border-rose-500/30 text-[9px] font-semibold text-rose-300"
                            title="Countdown cue"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            TIMER
                          </span>
                        )}

                        {hasVideoBg && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-sky-500/15 border border-sky-500/30 text-[9px] font-semibold text-sky-300"
                            title="Has video background cue"
                          >
                            <Film className="w-2.5 h-2.5" />
                            BG
                          </span>
                        )}

                        {hasRememberedSlide && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-semibold text-indigo-300"
                            title="Remembers last viewed verse"
                          >
                            <Bookmark className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Item Actions (floating pill on hover so title never squeezes) */}
                  <div className="hidden group-hover:flex items-center gap-0.5 absolute right-1.5 top-1.5 bg-[#121929]/95 border border-slate-700/80 rounded-md px-1 py-0.5 shadow-lg z-10">
                    {onRenameItem && (
                      <button
                        type="button"
                        onClick={startEditingTitle}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                        title="Rename item"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onDuplicateItem(item.id);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded"
                      title="Duplicate item"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                      title="Remove item"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Inline Slides Preview */}
                {isExpanded && item.slides.length > 0 && (
                  <div className="border-t border-slate-800/80 bg-[#0b101b]/90 px-2 py-1.5 space-y-1 max-h-52 overflow-y-auto">
                    {item.slides.map((slide, sIdx) => {
                      const isSlideLive = isLive && liveSlideId === slide.id;
                      const isRemembered = item.lastViewedSlideId === slide.id;
                      const snippet = (slide.title || slide.content || 'Empty slide')
                        .replace(/\s+/g, ' ')
                        .trim();

                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (onSelectSlideInItem) {
                              onSelectSlideInItem(item, slide);
                            } else {
                              onSelectItem(item);
                            }
                          }}
                          className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 text-[11px] transition ${
                            isSlideLive
                              ? 'bg-rose-600/25 border border-rose-500/60 text-white'
                              : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                          }`}
                          title="Click to Go Live with this slide"
                        >
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-bold font-mono shrink-0 ${
                              isSlideLive
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {shortSectionTag(slide.sectionLabel, sIdx)}
                          </span>
                          <span className="truncate flex-1">{snippet}</span>
                          {isRemembered && !isSlideLive && (
                            <Bookmark className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                          )}
                          {isSlideLive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard / Workflow Hint Footer */}
      <div className="px-3 py-1.5 border-t border-[#26334a] bg-[#0c121e] text-[10px] text-slate-500 flex items-center justify-between">
        <span>Click: Go Live</span>
        <span>Alt+↑/↓: Item • →/←: Slides</span>
      </div>
    </div>
  );
};
