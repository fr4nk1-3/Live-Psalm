import React, { useState } from 'react';
import { 
  PlaylistItem, 
  ItemType 
} from '../types/presentation';
import { 
  Plus, 
  GripVertical, 
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
  FolderPlus,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface PlaylistPanelProps {
  playlist: PlaylistItem[];
  activeItemId: string | null;
  onSelectItem: (item: PlaylistItem) => void;
  onAddItem: (type: ItemType) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onLoadTemplate: (templateName: string) => void;
  liveItemId: string | null;
}

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  playlist,
  activeItemId,
  onSelectItem,
  onAddItem,
  onRemoveItem,
  onDuplicateItem,
  onMoveItem,
  onLoadTemplate,
  liveItemId
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const getItemIcon = (type: ItemType) => {
    switch (type) {
      case 'song': return <Music className="w-4 h-4 text-emerald-400" />;
      case 'bible': return <Book className="w-4 h-4 text-amber-400" />;
      case 'media': return <Film className="w-4 h-4 text-sky-400" />;
      case 'announcement': return <Megaphone className="w-4 h-4 text-purple-400" />;
      case 'countdown': return <Clock className="w-4 h-4 text-rose-400" />;
      case 'sermon': return <FileText className="w-4 h-4 text-indigo-400" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="w-72 bg-[#0f1624] border-r border-[#26334a] flex flex-col h-full select-none shrink-0">
      {/* Panel Header */}
      <div className="p-3 border-b border-[#26334a] flex items-center justify-between bg-[#131b2c]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
            Service Playlist
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-semibold border border-slate-700">
            {playlist.length} items
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 relative">
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
              title="Service Templates"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-8 w-48 bg-[#182234] border border-[#26334a] rounded-lg shadow-2xl py-1 z-50 text-xs text-slate-200">
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
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md flex items-center gap-1 shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-8 w-44 bg-[#182234] border border-[#26334a] rounded-lg shadow-2xl py-1 z-50 text-xs">
                {[
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

      {/* Playlist Items Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {playlist.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
            <p>Service playlist is empty.</p>
            <p className="mt-1 text-slate-600">Click "+ Add" or load a template above.</p>
          </div>
        ) : (
          playlist.map((item, index) => {
            const isSelected = item.id === activeItemId;
            const isLive = item.id === liveItemId;

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`group relative rounded-lg p-2 flex items-center justify-between gap-2 border transition cursor-pointer ${
                  isLive
                    ? 'bg-rose-950/40 border-rose-500/80 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                    : isSelected
                    ? 'bg-indigo-950/50 border-indigo-500/70 text-white'
                    : 'bg-[#141d2e]/80 border-slate-800/80 hover:bg-[#1c273e] hover:border-slate-700 text-slate-300'
                }`}
              >
                {/* Drag / Index */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition">
                    <button
                      disabled={index === 0}
                      onClick={(e) => { e.stopPropagation(); onMoveItem(index, index - 1); }}
                      className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={index === playlist.length - 1}
                      onClick={(e) => { e.stopPropagation(); onMoveItem(index, index + 1); }}
                      className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-[10px] font-mono font-bold text-slate-500 min-w-[14px]">
                    {index + 1}
                  </span>

                  {getItemIcon(item.type)}

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs truncate max-w-[130px]">
                        {item.title}
                      </span>
                      {isLive && (
                        <span className="text-[9px] font-black uppercase px-1 py-0.2 bg-rose-600 text-white rounded glow-live">
                          LIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 truncate">
                      {item.slides.length} {item.slides.length === 1 ? 'slide' : 'slides'}
                    </span>
                  </div>
                </div>

                {/* Quick Item Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateItem(item.id);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded"
                    title="Duplicate item"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
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
            );
          })
        )}
      </div>
    </div>
  );
};
