import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, MoreHorizontal } from 'lucide-react';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { OnlineBibleVersion } from '../services/onlineBibleApi';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { EmptyState } from './ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';

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

interface BibleVersionEntry {
  id: string;
  name: string;
  abbreviation: string;
  category: LanguageGroup;
  sourceType: string;
}

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
  const [pendingId, setPendingId] = useState<string>(selectedTranslation);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setCategoryFilter('ALL');
      setPendingId(selectedTranslation);
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
    const items: BibleVersionEntry[] = [];

    for (const m of preloadedManifest) {
      const cat = getBibleLanguageGroup(m.name, m.abbreviation, m.id);
      items.push({
        id: m.id,
        name: m.name,
        abbreviation: m.abbreviation,
        category: cat,
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
          sourceType: 'API Online'
        });
      }
    }

    return items;
  }, [preloadedManifest, customBibles, onlineVersions, apiBibleEnabled]);

  if (!isOpen) return null;

  const toggleFavorite = (id: string) => {
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

  const languageSections: { title: string; lang: LanguageGroup; items: BibleVersionEntry[] }[] = [
    { title: 'English', lang: 'English', items: filtered.filter(v => v.category === 'English') },
    { title: 'Swahili', lang: 'Swahili', items: filtered.filter(v => v.category === 'Swahili') },
    { title: 'Luo', lang: 'Luo', items: filtered.filter(v => v.category === 'Luo') },
    { title: 'Kikuyu', lang: 'Kikuyu', items: filtered.filter(v => v.category === 'Kikuyu') },
    { title: 'Kalenjin', lang: 'Kalenjin', items: filtered.filter(v => v.category === 'Kalenjin') },
    { title: 'Kamba', lang: 'Kamba', items: filtered.filter(v => v.category === 'Kamba') },
    { title: 'Maasai', lang: 'Maasai', items: filtered.filter(v => v.category === 'Maasai') },
    { title: 'API online', lang: 'API Online', items: filtered.filter(v => v.category === 'API Online') }
  ];

  const languages: LanguageGroup[] = ['English', 'Swahili', 'Luo', 'Kikuyu', 'Kalenjin', 'Kamba', 'Maasai'];
  const isParallel = mode === 'parallel';

  const renderVersionRow = (v: BibleVersionEntry, keyPrefix?: string) => {
    const isSelected = pendingId === v.id;
    const isFav = favoriteIds.includes(v.id);
    return (
      <div
        key={keyPrefix ? `${keyPrefix}-${v.id}` : v.id}
        className={cn(
          'group flex items-center border-t border-border/70 pr-1 transition-colors first:border-t-0',
          isSelected ? 'bg-accent' : 'hover:bg-accent/60'
        )}
      >
        <button
          type="button"
          onClick={() => setPendingId(v.id)}
          aria-pressed={isSelected}
          className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="w-14 shrink-0 truncate font-mono text-2xs text-muted-foreground">
            {v.abbreviation}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{v.name}</span>
          <span className="shrink-0 text-2xs text-muted-foreground">{v.sourceType}</span>
          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Options for ${v.name}`}
              className={cn(
                'shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                isFav && 'opacity-100'
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem checked={isFav} onCheckedChange={() => toggleFavorite(v.id)}>
              Favorite
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isParallel ? 'Select parallel version' : 'Select Bible version'}</DialogTitle>
          <DialogDescription>
            {isParallel
              ? 'Choose the version shown alongside the primary reading.'
              : 'Sets the version used for readings and search.'}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, abbreviation or language"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault();
                  handlePickVersion(filtered[0].id);
                }
              }}
              aria-label="Search Bible versions"
              className="pl-8 pr-8"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs text-muted-foreground">Language</span>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as 'ALL' | LanguageGroup)}
            >
              <SelectTrigger className="h-7 w-[200px] text-xs" aria-label="Language filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All languages ({allVersions.length})</SelectItem>
                {languages.map(lang => {
                  const count = allVersions.filter(v => v.category === lang).length;
                  if (count === 0) return null;
                  return (
                    <SelectItem key={lang} value={lang}>
                      {lang} ({count})
                    </SelectItem>
                  );
                })}
                {apiBibleEnabled && (
                  <SelectItem value="API Online">
                    API online ({allVersions.filter(v => v.category === 'API Online').length})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <span className="ml-auto text-2xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'version' : 'versions'}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {pinnedQuickVersions.length > 0 && (
            <section className="pt-3">
              <div className="flex items-baseline justify-between px-3">
                <p className="text-2xs text-muted-foreground">Favorites and recent</p>
                <p className="tabular text-2xs text-muted-foreground">{pinnedQuickVersions.length}</p>
              </div>
              <div className="mt-1">{pinnedQuickVersions.map(v => renderVersionRow(v, 'quick'))}</div>
            </section>
          )}

          {languageSections.map(sec => {
            if (sec.items.length === 0) return null;
            if (categoryFilter !== 'ALL' && categoryFilter !== sec.lang) return null;
            return (
              <section key={sec.lang} className="pt-3">
                <div className="flex items-baseline justify-between px-3">
                  <p className="text-2xs text-muted-foreground">{sec.title}</p>
                  <p className="tabular text-2xs text-muted-foreground">{sec.items.length}</p>
                </div>
                <div className="mt-1">{sec.items.map(v => renderVersionRow(v))}</div>
              </section>
            );
          })}

          {filtered.length === 0 && (
            <EmptyState
              title="No versions found"
              description={
                searchQuery
                  ? `No version matches "${searchQuery}". Try a different name or abbreviation.`
                  : 'No versions are available for this language.'
              }
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!pendingId}
            onClick={() => pendingId && handlePickVersion(pendingId)}
          >
            Use version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
