import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, Book, Star, Clock } from 'lucide-react';
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
  mode?: 'primary' | 'parallel';
}

export type LanguageGroup =
  | 'Swahili'
  | 'Kalenjin'
  | 'Kamba'
  | 'Kikuyu'
  | 'Luo'
  | 'Maasai'
  | 'English'
  | 'API Online';

export function getBibleLanguageGroup(name: string, abbr: string, id: string): LanguageGroup {
  const s = (name + ' ' + abbr + ' ' + id).toLowerCase();
  // Check Luo FIRST before Swahili to avoid 'muma' being caught by generic checks
  if (s.includes('luo') || s.includes('muma')) return 'Luo';
  if (
    s.includes('swahili') ||
    s.includes('kiswahili') ||
    s.includes('suv') ||
    s.includes('rsuv') ||
    s.includes('takatifu') ||
    s.includes('habari njema')
  ) {
    return 'Swahili';
  }
  if (s.includes('kalenjin') || s.includes('baibil') || s.includes('klj')) return 'Kalenjin';
  if (s.includes('kamba') || s.includes('mbivilia') || s.includes('kmb') || s.includes('mbv')) {
    return 'Kamba';
  }
  if (s.includes('kikuyu') || s.includes('ibuku') || s.includes('gky')) return 'Kikuyu';
  if (s.includes('maasai') || s.includes('mas')) return 'Maasai';
  return 'English';
}

const RECENT_KEY = 'live_psalms_recent_bibles_v1';
const FAVORITE_KEY = 'live_psalms_favorite_bibles_v1';

const loadStringArray = (key: string, fallback: string[] = []): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const BibleVersionModal: React.FC<BibleVersionModalProps> = ({
  isOpen,
  onClose,
  selectedTranslation,
  onSelectTranslation,
  customBibles,
  onlineVersions,
  apiBibleEnabled,
  mode = 'primary'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LanguageGroup>('ALL');
  const [recentIds, setRecentIds] = useState<string[]>(() => loadStringArray(RECENT_KEY));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    loadStringArray(FAVORITE_KEY, ['bible-eng-nkjv', 'bible-eng-kjv', 'bible-swahili-suv'])
  );

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setCategoryFilter('ALL');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const preloadedManifest = StorageService.getPreloadedManifestList();

  const allVersions = useMemo(() => {
    const items: {
      id: string;
      name: string;
      abbreviation: string;
      category: LanguageGroup;
      flag: string;
      sourceType: string;
    }[] = [];

    for (const m of preloadedManifest) {
      const cat = getBibleLanguageGroup(m.name, m.abbreviation, m.id);
      items.push({
        id: m.id,
        name: m.name,
        abbreviation: m.abbreviation,
        category: cat,
        flag: cat === 'English' ? '🇬🇧' : '🇰🇪',
        sourceType: 'Offline'
      });
    }

    for (const cb of customBibles) {
      if (!items.some(it => it.id === cb.id)) {
        const cat = getBibleLanguageGroup(cb.name, cb.abbreviation, cb.id);
        items.push({
          id: cb.id,
          name: cb.name,
          abbreviation: cb.abbreviation,
          category: cat,
          flag: cat === 'English' ? '🇬🇧' : '🇰🇪',
          sourceType: 'Custom'
        });
      }
    }

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
  }, [preloadedManifest, customBibles, onlineVersions, apiBibleEnabled]);

  if (!isOpen) return null;

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      try {
        localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handlePickVersion = (id: string) => {
    setRecentIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    onSelectTranslation(id);
    onClose();
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = allVersions.filter(v => {
    const matchesQuery =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.abbreviation.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q);
    const matchesCat = categoryFilter === 'ALL' || v.category === categoryFilter;
    return matchesQuery && matchesCat;
  });

  const pinnedQuickVersions = !q && categoryFilter === 'ALL'
    ? allVersions.filter(v => favoriteIds.includes(v.id) || recentIds.includes(v.id))
    : [];

  const languageSections: { title: string; lang: LanguageGroup; items: typeof allVersions }[] = [
    { title: '🇬🇧 English', lang: 'English', items: filtered.filter(v => v.category === 'English') },
    { title: '🇰🇪 Swahili', lang: 'Swahili', items: filtered.filter(v => v.category === 'Swahili') },
    { title: '🇰🇪 Luo', lang: 'Luo', items: filtered.filter(v => v.category === 'Luo') },
    { title: '🇰🇪 Kikuyu', lang: 'Kikuyu', items: filtered.filter(v => v.category === 'Kikuyu') },
    { title: '🇰🇪 Kalenjin', lang: 'Kalenjin', items: filtered.filter(v => v.category === 'Kalenjin') },
    { title: '🇰🇪 Kamba', lang: 'Kamba', items: filtered.filter(v => v.category === 'Kamba') },
    { title: '🇰🇪 Maasai', lang: 'Maasai', items: filtered.filter(v => v.category === 'Maasai') },
    { title: '🌐 API Online', lang: 'API Online', items: filtered.filter(v => v.category === 'API Online') }
  ];

  const isParallel = mode === 'parallel';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-fadeIn"
    >
      <div
        className={`bg-[#0f1624] border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh] animate-scaleUp ${
          isParallel ? 'border-purple-500/50' : 'border-amber-500/50'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isParallel
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              <Book className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>{isParallel ? 'Select Parallel Translation' : 'Select Primary Bible Version'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  {allVersions.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Search by name, abbreviation, or language — star favorites for 1-click access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Wrapped Language Pills */}
        <div className="p-4 bg-[#0b101b] border-b border-[#26334a] space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Bible (e.g. NKJV, KJV, SUV, Kikuyu, Luo, Maasai) — press Enter to select..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault();
                  handlePickVersion(filtered[0].id);
                }
              }}
              className={`w-full bg-[#121929] border border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 outline-none ${
                isParallel ? 'focus:border-purple-500' : 'focus:border-amber-500'
              }`}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg border transition ${
                categoryFilter === 'ALL'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-[#121929] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({allVersions.length})
            </button>
            {(['English', 'Swahili', 'Luo', 'Kikuyu', 'Kalenjin', 'Kamba', 'Maasai'] as LanguageGroup[]).map(lang => {
              const count = allVersions.filter(v => v.category === lang).length;
              if (count === 0) return null;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCategoryFilter(lang)}
                  className={`px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                    categoryFilter === lang
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-[#121929] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{lang === 'English' ? '🇬🇧' : '🇰🇪'} {lang}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
            {apiBibleEnabled && (
              <button
                type="button"
                onClick={() => setCategoryFilter('API Online')}
                className={`px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                  categoryFilter === 'API Online'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-[#121929] border-slate-800 text-sky-400 hover:text-white'
                }`}
              >
                <span>🌐 API</span>
                <span className="text-[10px] opacity-70">
                  ({allVersions.filter(v => v.category === 'API Online').length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Quick Picks (Favorites & Recent) */}
          {pinnedQuickVersions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Favorites &amp; Recent</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {pinnedQuickVersions.map(v => {
                  const isSel = selectedTranslation === v.id;
                  const isFav = favoriteIds.includes(v.id);
                  return (
                    <div
                      key={`quick-${v.id}`}
                      onClick={() => handlePickVersion(v.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 group ${
                        isSel
                          ? isParallel
                            ? 'bg-purple-950/50 border-purple-400 text-white'
                            : 'bg-amber-950/50 border-amber-400 text-white'
                          : 'bg-[#121929] border-slate-800 hover:border-amber-500/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-md text-[10px] font-black uppercase shrink-0">
                          {v.abbreviation}
                        </span>
                        <span className="font-bold text-xs truncate">{v.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(v.id, e)}
                          className={`p-1 rounded hover:bg-slate-800 transition ${
                            isFav ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'
                          }`}
                          title={isFav ? 'Remove from favorites' : 'Pin to favorites'}
                        >
                          <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                        {isSel && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Language Sections */}
          {languageSections.map(sec => {
            if (sec.items.length === 0) return null;
            if (categoryFilter !== 'ALL' && categoryFilter !== sec.lang) return null;
            return (
              <div key={sec.lang} className="space-y-2">
                <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center justify-between border-b border-slate-800 pb-1">
                  <span>{sec.title}</span>
                  <span className="text-slate-500">{sec.items.length} versions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sec.items.map(v => {
                    const isSel = selectedTranslation === v.id;
                    const isFav = favoriteIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => handlePickVersion(v.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 group ${
                          isSel
                            ? isParallel
                              ? 'bg-purple-950/50 border-purple-400 text-white shadow'
                              : 'bg-amber-950/50 border-amber-400 text-white shadow'
                            : 'bg-[#121929] border-slate-800 hover:border-amber-500/50 hover:bg-[#172136] text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-md text-[10px] font-black uppercase shrink-0">
                            {v.abbreviation}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs truncate group-hover:text-amber-300 transition">
                              {v.name}
                            </div>
                            <div className="text-[10px] text-slate-400">{v.sourceType}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(v.id, e)}
                            className={`p-1 rounded hover:bg-slate-800 transition ${
                              isFav ? 'text-amber-400' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                            }`}
                            title={isFav ? 'Remove from favorites' : 'Pin to favorites'}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                          {isSel && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-xs">
              No Bible versions found matching "{searchQuery}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
