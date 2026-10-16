import React from 'react';
import { Theme, Slide, MediaAsset } from '../types/presentation';
import { 
  Sliders, 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Image as ImageIcon, 
  FileText, 
  Sparkles, 
  ShieldAlert,
  Layers,
  Lock
} from 'lucide-react';

interface InspectorPanelProps {
  theme: Theme;
  onUpdateTheme: (updated: Partial<Theme>) => void;
  activeSlide: Slide | null;
  onUpdateSlide: (updated: Partial<Slide>) => void;
  mediaList: MediaAsset[];
  speakerNotes: string;
  onUpdateSpeakerNotes: (notes: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  theme,
  onUpdateTheme,
  activeSlide,
  onUpdateSlide,
  mediaList,
  speakerNotes,
  onUpdateSpeakerNotes
}) => {
  return (
    <div className="w-72 bg-[#0f1624] border-l border-[#26334a] flex flex-col h-full select-none shrink-0 overflow-y-auto p-3 space-y-4">
      {/* Panel Header */}
      <div className="flex items-center gap-2 border-b border-[#26334a] pb-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <span>Inspector & Theme</span>
      </div>

      {/* TYPOGRAPHY SECTION */}
      <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-lg text-xs">
        <div className="font-bold text-indigo-300 flex items-center gap-1.5 mb-2">
          <Type className="w-4 h-4" /> Typography & Style
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Font Family</label>
          <select
            value={theme.fontFamily}
            onChange={(e) => onUpdateTheme({ fontFamily: e.target.value })}
            className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white font-semibold outline-none focus:border-indigo-500"
          >
            {['Inter', 'Cinzel', 'Outfit', 'Montserrat', 'Playfair Display'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
            Font Size ({theme.fontSize}px)
          </label>
          <input
            type="range"
            min={24}
            max={72}
            value={theme.fontSize}
            onChange={(e) => onUpdateTheme({ fontSize: parseInt(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Text Align Buttons */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Text Alignment</label>
          <div className="grid grid-cols-3 gap-1 bg-[#0d1320] p-1 rounded border border-slate-700">
            {[
              { id: 'left', icon: AlignLeft },
              { id: 'center', icon: AlignCenter },
              { id: 'right', icon: AlignRight }
            ].map(align => (
              <button
                key={align.id}
                onClick={() => onUpdateTheme({ align: align.id as any })}
                className={`py-1 flex items-center justify-center rounded transition ${
                  theme.align === align.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <align.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Text Color & Accent Color */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Text Color</label>
            <input
              type="color"
              value={theme.textColor}
              onChange={(e) => onUpdateTheme({ textColor: e.target.value })}
              className="w-full h-8 bg-transparent cursor-pointer rounded border border-slate-700 p-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Accent Color</label>
            <input
              type="color"
              value={theme.accentColor}
              onChange={(e) => onUpdateTheme({ accentColor: e.target.value })}
              className="w-full h-8 bg-transparent cursor-pointer rounded border border-slate-700 p-0.5"
            />
          </div>
        </div>
      </div>

      {/* BACKGROUND & SCRIM OVERLAY SECTION */}
      <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-lg text-xs">
        <div className="font-bold text-sky-300 flex items-center gap-1.5 mb-2">
          <ImageIcon className="w-4 h-4" /> Background Overlay
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
            Dark Scrim Opacity ({Math.round(theme.scrimOpacity * 100)}%)
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={theme.scrimOpacity}
            onChange={(e) => onUpdateTheme({ scrimOpacity: parseFloat(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
        </div>

        {/* Slide-specific Text & Background Override */}
        {activeSlide && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Edit Slide Content Text
              </label>
              {activeSlide.sectionLabel === 'Scripture' ? (
                <div className="p-2.5 bg-[#0d1320] border border-amber-500/30 rounded text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Scripture text is locked for Bible verses</span>
                </div>
              ) : (
                <textarea
                  value={activeSlide.content}
                  onChange={(e) => onUpdateSlide({ content: e.target.value })}
                  className="w-full h-20 bg-[#0d1320] border border-slate-700 rounded p-2 text-white outline-none focus:border-indigo-500 text-xs font-sans resize-none leading-relaxed"
                  placeholder="Edit slide text..."
                />
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Slide Background Image
              </label>
              <select
                value={activeSlide.backgroundUrl || ''}
                onChange={(e) => onUpdateSlide({ backgroundUrl: e.target.value || undefined })}
                className="w-full bg-[#0d1320] border border-slate-700 rounded p-1.5 text-white font-semibold outline-none focus:border-sky-500 text-xs"
              >
                <option value="">Default Theme Background</option>
                {mediaList.map(m => (
                  <option key={m.id} value={m.url}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* LOWER THIRD STYLING SECTION */}
      <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-lg text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-emerald-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Lower Third Badge Mode
          </span>
          <input
            type="checkbox"
            checked={theme.lowerThirdStyle}
            onChange={(e) => onUpdateTheme({ lowerThirdStyle: e.target.checked })}
            className="accent-emerald-500 w-4 h-4 cursor-pointer"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          Renders text as a broadcast lower-third overlay at bottom of screen.
        </p>
      </div>

      {/* SPEAKER NOTES SECTION */}
      <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-lg text-xs">
        <div className="font-bold text-amber-300 flex items-center gap-1.5">
          <FileText className="w-4 h-4" /> Speaker / Stage Notes
        </div>
        <textarea
          placeholder="Enter notes visible only to operator & stage display (confidence monitor)..."
          value={speakerNotes}
          onChange={(e) => onUpdateSpeakerNotes(e.target.value)}
          className="w-full h-24 bg-[#0d1320] border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-amber-500 text-xs resize-none"
        />
      </div>
    </div>
  );
};
