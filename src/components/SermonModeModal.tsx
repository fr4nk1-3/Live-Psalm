import React, { useState } from 'react';
import { PlaylistItem, Slide } from '../types/presentation';
import { BookOpen, Plus, Trash2, X, Check } from 'lucide-react';

interface SermonModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSermonToPlaylist: (item: PlaylistItem) => void;
}

export const SermonModeModal: React.FC<SermonModeModalProps> = ({
  isOpen,
  onClose,
  onAddSermonToPlaylist
}) => {
  const [title, setTitle] = useState('Unstoppable Faith');
  const [speaker, setSpeaker] = useState('Senior Pastor John Doe');
  const [speakerNotes, setSpeakerNotes] = useState('Key sermon theme: Standing firm on God\'s promises.');
  const [points, setPoints] = useState<string[]>([
    'Point 1: Faith That Moves Mountains (Matthew 17:20)',
    'Point 2: Walking by Faith, Not by Sight (2 Corinthians 5:7)',
    'Point 3: The Victory That Overcomes the World (1 John 5:4)'
  ]);
  const [newPoint, setNewPoint] = useState('');

  if (!isOpen) return null;

  const handleAddPoint = () => {
    if (!newPoint.trim()) return;
    setPoints([...points, newPoint.trim()]);
    setNewPoint('');
  };

  const handleRemovePoint = (idx: number) => {
    setPoints(points.filter((_, i) => i !== idx));
  };

  const handleBuildSermon = () => {
    const slides: Slide[] = [];

    // Title Slide
    slides.push({
      id: `slide-sermon-title`,
      title: title.toUpperCase(),
      content: `${title.toUpperCase()}\n"Sermon Series"`,
      subtitle: speaker,
      sectionLabel: 'Title'
    });

    // Point Slides
    points.forEach((pt, idx) => {
      slides.push({
        id: `slide-sermon-pt-${idx}`,
        title: `POINT ${idx + 1}`,
        content: pt,
        subtitle: speaker,
        sectionLabel: 'Slide'
      });
    });

    // Closing Slide
    slides.push({
      id: `slide-sermon-closing`,
      title: 'PRAYER & ALTAR CALL',
      content: 'PRAYER & ALTAR CALL\n"Come as you are to the throne of grace."',
      subtitle: title,
      sectionLabel: 'Title'
    });

    const playlistItem: PlaylistItem = {
      id: `item-sermon-${Math.random().toString(36).substring(2, 9)}`,
      title: `Sermon: ${title}`,
      type: 'sermon',
      category: 'Sermon',
      slides,
      speakerNotes
    };

    onAddSermonToPlaylist(playlistItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-[#0f1624] border border-purple-500/60 rounded-2xl shadow-2xl p-6 text-xs space-y-4 animate-zoom-in">
        <div className="flex items-center justify-between border-b border-[#26334a] pb-3">
          <div className="flex items-center gap-2 font-black text-sm text-purple-300 uppercase tracking-wider">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <span>Sermon Presentation Builder</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sermon Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Speaker Name</label>
            <input
              type="text"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="w-full bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Key Message Points List */}
        <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-3 rounded-xl">
          <label className="text-[10px] font-bold text-slate-400 uppercase block">Main Message Points</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {points.map((pt, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-[#0d1320] border border-slate-700 p-2 rounded-lg text-slate-200">
                <span className="font-semibold text-xs truncate">{pt}</span>
                <button
                  onClick={() => handleRemovePoint(idx)}
                  className="p-1 text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Add key scripture or main point..."
              value={newPoint}
              onChange={(e) => setNewPoint(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPoint()}
              className="flex-1 bg-[#0d1320] border border-slate-700 rounded-lg p-1.5 text-white outline-none focus:border-purple-500"
            />
            <button
              onClick={handleAddPoint}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Point
            </button>
          </div>
        </div>

        {/* Speaker Notes */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Speaker Notes (Stage Display)</label>
          <textarea
            value={speakerNotes}
            onChange={(e) => setSpeakerNotes(e.target.value)}
            className="w-full h-16 bg-[#141d2e] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Build Button */}
        <button
          onClick={handleBuildSermon}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl flex items-center justify-center gap-2 transition"
        >
          <Check className="w-4 h-4" />
          <span>Add Sermon Presentation to Service ({points.length + 2} Slides)</span>
        </button>
      </div>
    </div>
  );
};
