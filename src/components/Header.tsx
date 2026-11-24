import React from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Kbd } from './ui/primitives';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

interface HeaderProps {
  serviceTitle: string;
  onOpenSearch: () => void;
  onOpenQuickMode: () => void;
  onOpenSermonMode: () => void;
  onOpenSettings: () => void;
  onOpenStreaming?: () => void;
  isBroadcastOpen?: boolean;
  onOpenAudienceOutput: () => void;
  onOpenStageOutput: () => void;
  onOpenLedOutput?: () => void;
  onExportPackage: () => void;
  onImportPackage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isAudienceActive: boolean;
  isStageActive: boolean;
  isLedActive?: boolean;
  isSaved: boolean;
  onOpenSlideDesigner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serviceTitle,
  onOpenSearch,
  onOpenQuickMode,
  onOpenSermonMode,
  onOpenSettings,
  onOpenStreaming,
  isBroadcastOpen = false,
  onOpenAudienceOutput,
  onOpenStageOutput,
  onOpenLedOutput,
  onExportPackage,
  onImportPackage,
  isAudienceActive,
  isStageActive,
  isLedActive = false,
  isSaved,
  onOpenSlideDesigner
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [displayCount, setDisplayCount] = React.useState(1);

  const refreshDisplayCount = React.useCallback(async () => {
    try {
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        const displays = await ipcRenderer.invoke('get-connected-displays');
        if (Array.isArray(displays)) setDisplayCount(displays.length);
        return;
      }
      try {
        const res = await fetch('/api/system/displays');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.displays) && data.displays.length > 0) {
            setDisplayCount(data.displays.length);
            return;
          }
        }
      } catch {
        /* dev server may not expose display scanning */
      }
      if (typeof (window as any).getScreenDetails === 'function') {
        try {
          const details = await (window as any).getScreenDetails();
          if (details && Array.isArray(details.screens) && details.screens.length > 0) {
            setDisplayCount(details.screens.length);
            return;
          }
        } catch {
          /* permission denied */
        }
      }
      setDisplayCount((window.screen as any).isExtended ? 2 : 1);
    } catch {
      /* ignore detection failures */
    }
  }, []);

  React.useEffect(() => {
    refreshDisplayCount();
    let ipcRenderer: any = null;
    const onDisplaysChanged = (_event: any, list: any[]) => {
      if (Array.isArray(list)) setDisplayCount(list.length);
    };
    try {
      if ((window as any).require) {
        ipcRenderer = (window as any).require('electron').ipcRenderer;
        ipcRenderer.on('displays-changed', onDisplaysChanged);
      }
    } catch {
      /* browser preview */
    }
    window.addEventListener('focus', refreshDisplayCount);
    return () => {
      if (ipcRenderer) ipcRenderer.removeListener('displays-changed', onDisplaysChanged);
      window.removeEventListener('focus', refreshDisplayCount);
    };
  }, [refreshDisplayCount]);

  const activeOutputs = [isAudienceActive, isStageActive, isLedActive].filter(Boolean).length;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      {/* Identity */}
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <img src="./logo.png" alt="" className="h-6 w-6 shrink-0 rounded-[5px] object-cover" />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-foreground">Live Psalms</span>
            <span
              className={cn(
                'hidden items-center gap-1 whitespace-nowrap text-2xs md:inline-flex',
                isSaved ? 'text-muted-foreground' : 'text-warning'
              )}
              aria-live="polite"
            >
              <span
                className={cn('h-1 w-1 rounded-full', isSaved ? 'bg-muted-foreground/60' : 'bg-warning')}
                aria-hidden
              />
              {isSaved ? 'Saved' : 'Saving'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="max-w-[220px] truncate">{serviceTitle}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={refreshDisplayCount}
              className="tabular whitespace-nowrap rounded-sm transition-colors hover:text-foreground"
              title="Re-scan connected displays"
            >
              {displayCount > 1 ? `${displayCount} screens` : '1 screen'}
            </button>
          </div>
        </div>
      </div>

      {/* Command field */}
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            'group flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-background/70 px-2.5 text-left',
            'text-xs text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground'
          )}
        >
          <span className="flex-1 truncate">Search songs, scripture, media</span>
          <span className="hidden shrink-0 items-center gap-0.5 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2">
              Outputs
              <span
                className={cn(
                  'tabular rounded-sm px-1 text-[10px]',
                  activeOutputs > 0 ? 'bg-live/20 text-live' : 'bg-muted text-muted-foreground'
                )}
              >
                {activeOutputs}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Program outputs</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={isAudienceActive} onSelect={onOpenAudienceOutput}>
              Audience screen
              <span className="ml-auto pl-2 text-2xs text-muted-foreground">Projector / main</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={isStageActive} onSelect={onOpenStageOutput}>
              Stage display
              <span className="ml-auto pl-2 text-2xs text-muted-foreground">Confidence monitor</span>
            </DropdownMenuCheckboxItem>
            {onOpenLedOutput && (
              <DropdownMenuCheckboxItem checked={isLedActive} onSelect={onOpenLedOutput}>
                LED wall
                <span className="ml-auto pl-2 text-2xs text-muted-foreground">Wide format</span>
              </DropdownMenuCheckboxItem>
            )}
            {onOpenStreaming && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onOpenStreaming}>Streaming setup…</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Presenting</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onOpenQuickMode}>
              Quick present
              <DropdownMenuShortcut>Q</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenSermonMode}>Sermon outline</DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenSlideDesigner}>Slide canvas</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Service file</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>Import service…</DropdownMenuItem>
            <DropdownMenuItem onSelect={onExportPackage}>Export service…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSettings}>
              Settings
              <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          type="file"
          ref={fileInputRef}
          onChange={onImportPackage}
          accept=".worshipflow,.json"
          className="hidden"
        />
      </div>
    </header>
  );
};
