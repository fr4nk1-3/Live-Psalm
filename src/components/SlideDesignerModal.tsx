import React, { useState } from 'react';
import { Slide, Theme } from '../types/presentation';
import { Sliders, X, Move, Type, Image as ImageIcon, Sparkles, Check, Lock } from 'lucide-react';

interface SlideDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSlide: Slide | null;
  activeTheme: Theme;
  onSaveSlide: (updatedSlide: Slide) => void;
}

export const SlideDesignerModal: React.FC<SlideDesignerModalProps> = ({
  isOpen,
  onClose,
  activeSlide,
  activeTheme,
  onSaveSlide
}) => {
  const [content, setContent] = useState(activeSlide?.content || '');
  const [title, setTitle] = useState(activeSlide?.title || '');
  const [subtitle, setSubtitle] = useState(activeSlide?.subtitle || '');
  const [backgroundUrl, setBackgroundUrl] = useState(activeSlide?.backgroundUrl || activeTheme.backgroundUrl || '');

  if (!isOpen || !activeSlide) return null;

  const isScriptureSlide = activeSlide.sectionLabel === 'Scripture';

  const handleSave = () => {
    onSaveSlide({
      ...activeSlide,
      content,
      title: title || undefined,
      subtitle: subtitle || undefined,
      backgroundUrl: backgroundUrl || undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-4xl bg-[#0f1624] border border-emerald-500/60 rounded-2xl shadow-2xl p-6 text-xs flex flex-col h-[85vh] animate-zoom-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#26334a] pb-3">
          <div className="flex items-center gap-2 font-black text-sm text-emerald-300 uppercase tracking-wider">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <span>Visual Slide Canvas Designer</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Editor Grid */}
        <div className="flex-1 grid grid-cols-12 gap-4 py-4 overflow-hidden">
          {/* Left Canvas Preview (16:9 aspect ratio) */}
          <div className="col-span-8 bg-black rounded-xl overflow-hidden border border-slate-700 relative flex items-center justify-center p-8 text-center shadow-2xl">
            {backgroundUrl && (
              <img src={backgroundUrl} alt="Canvas BG" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            )}

            <div 
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${activeTheme.scrimOpacity})` }}
            />

            <div className="relative z-10 max-w-xl">
              {title && (
                <div className="text-xs font-black uppercase text-indigo-300 tracking-widest mb-3 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-500/40 inline-block">
                  {title}
                </div>
              )}
              <div 
                className="font-extrabold text-white text-2xl leading-snug whitespace-pre-line"
                style={{ fontFamily: activeTheme.fontFamily }}
              >
                {content}
              </div>
              {subtitle && (
                <div className="text-xs font-bold text-emerald-300 mt-3 uppercase tracking-wider">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Right Inputs Inspector */}
          <div className="col-span-4 bg-[#141d2e] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 overflow-y-auto">
            <div className="space-y-3">
              <div className="font-bold text-slate-300 text-xs border-b border-slate-700 pb-2">
                Slide Elements & Text
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Badge Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Main Body Text / Lyrics</label>
                {isScriptureSlide ? (
                  <div className="p-3 bg-[#0d1320] border border-amber-500/30 rounded-lg text-amber-300 text-xs font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Scripture text content is locked for Bible slides to preserve accuracy.</span>
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-28 bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500 resize-none font-medium"
                  />
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subtitle / Author / Credit</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Background Image URL</label>
                <input
                  type="text"
                  value={backgroundUrl}
                  onChange={(e) => setBackgroundUrl(e.target.value)}
                  className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-slate-300 text-[11px] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Slide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
