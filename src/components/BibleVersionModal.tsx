import React, { useState, useEffect } from 'react';
import { Search, X, Check, Book } from 'lucide-react';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { OnlineBibleVersion } from '../services/onlineBibleApi';

interface BibleVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTranslation: string;
  onSelectTranslation: (versionId: string) => void;
  customBibles: CustomBibleTranslation[];
  onlineVersions: OnlineBibleVersion[];
  apiBibleEnabled: boolean;
}

export type LanguageGroup = 'Swahili' | 'Kalenjin' | 'Kamba' | 'Kikuyu' | 'Luo' | 'Maasai' | 'English' | 'API Online';

export function getBibleLanguageGroup(name: string, abbr: string, id: string): LanguageGroup {
  const s = (name + ' ' + abbr + ' ' + id).toLowerCase();
  if (s.includes('swahili') || s.includes('kiswahili') || s.includes('suv') || s.includes('rsuv') || s.includes('takatifu') || s.includes('habari njema')) return 'Swahili';
  if (s.includes('kalenjin') || s.includes('baibil') || s.includes('klj')) return 'Kalenjin';
  if (s.includes('kamba') || s.includes('mbivilia') || s.includes('kmb') || s.includes('mbv')) return 'Kamba';
  if (s.includes('kikuyu') || s.includes('ibuku') || s.includes('gky')) return 'Kikuyu';
  if (s.includes('luo') || s.includes('muma')) return 'Luo';
  if (s.includes('maasai') || s.includes('mas')) return 'Maasai';
  return 'English';
}

export const BibleVersionModal: React.FC<BibleVersionModalProps> = ({
  isOpen,
  onClose,
  selectedTranslation,
  onSelectTranslation,
  customBibles,
  onlineVersions,
  apiBibleEnabled
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LanguageGroup>('ALL');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const preloadedManifest = StorageService.getPreloadedManifestList();

  const allVersions = (() => {
    const items: {
      id: string;
      name: string;
      abbreviation: string;
      category: LanguageGroup;
      flag: string;
      sourceType: string;
    }[] = [];

    // Pre-loaded XML Bibles
    for (const m of preloadedManifest) {
      const cat = getBibleLanguageGroup(m.name, m.abbreviation, m.id);
      items.push({
        id: m.id,
        name: m.name,
        abbreviation: m.abbreviation,
        category: cat,
        flag: cat === 'English' ? '🇬🇧' : '🇰🇪',
        sourceType: 'Local Pre-loaded'
      });
    }

    // User Custom Bibles
    for (const cb of customBibles) {
      if (!items.some(it => it.id === cb.id)) {
        const cat = getBibleLanguageGroup(cb.name, cb.abbreviation, cb.id);
        items.push({
          id: cb.id,
          name: cb.name,
          abbreviation: cb.abbreviation,
          category: cat,
          flag: cat === 'English' ? '🇬🇧' : '🇰🇪',
          sourceType: 'Custom Imported'
        });
      }
    }

    // API Online Bibles
    if (apiBibleEnabled) {
      for (const ov of onlineVersions) {
        items.push({
          id: ov.id,
          name: `${ov.version}`,
          abbreviation: (ov as any).abbreviation || 'API',
          category: 'API Online',
          flag: '🌐',
          sourceType: 'API Online'
        });
      }
    }

    return items;
  })();

  const filtered = allVersions.filter(v => {
    const matchesQuery =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.abbreviation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || v.category === categoryFilter;
    return matchesQuery && matchesCat;
  });

  const languageSections: { title: string; lang: LanguageGroup; items: typeof allVersions }[] = [
    { title: '🇰🇪 Swahili Bibles', lang: 'Swahili', items: filtered.filter(v => v.category === 'Swahili') },
    { title: '🇰🇪 Luo Bibles', lang: 'Luo', items: filtered.filter(v => v.category === 'Luo') },
    { title: '🇰🇪 Kikuyu Bibles', lang: 'Kikuyu', items: filtered.filter(v => v.category === 'Kikuyu') },
    { title: '🇰🇪 Kalenjin Bibles', lang: 'Kalenjin', items: filtered.filter(v => v.category === 'Kalenjin') },
    { title: '🇰🇪 Kamba Bibles', lang: 'Kamba', items: filtered.filter(v => v.category === 'Kamba') },
    { title: '🇰🇪 Maasai Bibles', lang: 'Maasai', items: filtered.filter(v => v.category === 'Maasai') },
    { title: '🇬🇧 English Bibles', lang: 'English', items: filtered.filter(v => v.category === 'English') },
    { title: '🌐 API Online Bibles', lang: 'API Online', items: filtered.filter(v => v.category === 'API Online') }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div 
        className="bg-[#0f172a] border border-amber-500/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 bg-[#141d2e] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600/20 border border-amber-500/40 rounded-xl text-amber-400">
              <Book className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Select Bible Version</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  {allVersions.length} Available
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Preloaded Kiswahili, Kalenjin, Kamba, Kikuyu, Luo, Maasai & English Bibles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar Input (Global Search Modal Style) */}
        <div className="p-4 bg-[#0d1320] border-b border-slate-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search version name or abbreviation (e.g. SUV, Kikuyu, Kalenjin, Kamba, Luo, Maasai, NKJV, KJV)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#162032] border border-slate-700 focus:border-amber-500 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-400 outline-none shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-full transition shrink-0 shadow-sm ${
                categoryFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-[#182338] text-slate-300 hover:bg-slate-700'
              }`}
            >
              All ({allVersions.length})
            </button>
            {(['Swahili', 'Luo', 'Kikuyu', 'Kalenjin', 'Kamba', 'Maasai', 'English'] as LanguageGroup[]).map(lang => {
              const count = allVersions.filter(v => v.category === lang).length;
              if (count === 0) return null;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCategoryFilter(lang)}
                  className={`px-3 py-1.5 rounded-full transition shrink-0 flex items-center gap-1 shadow-sm ${
                    categoryFilter === lang
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-[#182338] text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{lang === 'English' ? '🇬🇧' : '🇰🇪'} {lang}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
            {apiBibleEnabled && (
              <button
                type="button"
                onClick={() => setCategoryFilter('API Online')}
                className={`px-3 py-1.5 rounded-full transition shrink-0 flex items-center gap-1 shadow-sm ${
                  categoryFilter === 'API Online'
                    ? 'bg-blue-500 text-white font-black'
                    : 'bg-[#182338] text-blue-400 hover:bg-slate-700'
                }`}
              >
                <span>🌐 API</span>
                <span className="text-[10px] opacity-75">({allVersions.filter(v => v.category === 'API Online').length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Results Content List grouped by Language */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {languageSections.map(sec => {
            if (sec.items.length === 0) return null;
            if (categoryFilter !== 'ALL' && categoryFilter !== sec.lang) return null;
            return (
              <div key={sec.lang} className="space-y-2">
                <div className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1">
                  <span>{sec.title}</span>
                  <span className="text-slate-500 text-[10px]">({sec.items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sec.items.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onSelectTranslation(v.id);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 group ${
                        selectedTranslation === v.id
                          ? 'bg-amber-950/70 border-amber-500 text-white shadow-lg ring-1 ring-amber-500'
                          : 'bg-[#141d2e] border-slate-800 hover:border-amber-500/60 hover:bg-[#1a263d] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-1 bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-black uppercase shrink-0">
                          {v.abbreviation}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate group-hover:text-amber-300 transition">
                            {v.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {v.sourceType}
                          </div>
                        </div>
                      </div>
                      {selectedTranslation === v.id && (
                        <Check className="w-5 h-5 text-amber-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No Bible versions found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
