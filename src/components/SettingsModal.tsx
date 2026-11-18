import React, { useState, useEffect, useMemo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { BroadcastService } from '../services/broadcast';
import { AppSettings, ChurchProfile } from '../types/presentation';
import { ImporterService } from '../services/importer';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Field, FieldGroup } from './ui/field';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Kbd } from './ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetDefaults: () => void;
}

type SettingsTab = 'profile' | 'projection' | 'api' | 'obs' | 'shortcuts' | 'backup';

const OUTPUT_ROWS = [
  { key: 'audience' as const, label: 'Audience output' },
  { key: 'stage' as const, label: 'Stage monitor' },
  { key: 'led' as const, label: 'LED wall' }
];

const SHORTCUTS = [
  { keys: 'Space / → / ↓', description: 'Next slide and take it live' },
  { keys: '← / ↑', description: 'Previous slide and take it live' },
  { keys: 'Alt + ↑ / ↓', description: 'Previous or next playlist item' },
  { keys: 'Enter', description: 'Take the preview slide live' },
  { keys: '1 – 9', description: 'Jump to slide 1–9' },
  { keys: 'Ctrl + K', description: 'Open search' },
  { keys: 'B', description: 'Black screen' },
  { keys: 'L', description: 'Logo screen' },
  { keys: 'F', description: 'Freeze frame' },
  { keys: 'Esc', description: 'Clear the text overlay' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetDefaults
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [customBibles, setCustomBibles] = useState<CustomBibleTranslation[]>(() => StorageService.getCustomBibles());
  const [displays, setDisplays] = useState<any[]>([]);
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [obsWsUrl, setObsWsUrl] = useState<string>(
    () => localStorage.getItem('live_psalms_obs_ws_url') || 'ws://127.0.0.1:4455'
  );
  const [obsWsPassword, setObsWsPassword] = useState<string>(
    () => localStorage.getItem('live_psalms_obs_ws_pw') || ''
  );
  const [obsConnected, setObsConnected] = useState<boolean>(() => BroadcastService.isObsConnected());
  const [obsError, setObsError] = useState<string>('');
  const [obsOutputDir, setObsOutputDir] = useState<string>('~/Documents/LivePsalms-OBS');
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [backupNotice, setBackupNotice] = useState<string>('');
  const [profileNotice, setProfileNotice] = useState<string>('');

  const xmlFileInputRef = React.useRef<HTMLInputElement>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = BroadcastService.onObsStatusChange((connected, err) => {
      setObsConnected(connected);
      setObsError(err || '');
    });
    return () => unsub();
  }, []);

  const refreshSystemInfo = async () => {
    try {
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer
          .invoke('get-connected-displays')
          .then((list: any[]) => {
            if (Array.isArray(list)) {
              setDisplays(list);
              try {
                localStorage.setItem('live_psalms_detected_displays_v1', JSON.stringify(list));
              } catch {}
            }
          })
          .catch(() => {});
        ipcRenderer
          .invoke('get-network-ip')
          .then((ips: string[]) => {
            if (Array.isArray(ips)) setNetworkIps(ips);
          })
          .catch(() => {});
        ipcRenderer
          .invoke('get-obs-output-dir')
          .then((dir: string) => {
            if (dir) setObsOutputDir(dir);
          })
          .catch(() => {});
      } else {
        // Dev server / OS-level display scan, then the browser API, then a static fallback
        let detected: any[] = [];
        try {
          const res = await fetch('/api/system/displays');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.displays) && data.displays.length > 0) detected = data.displays;
          }
        } catch {}
        try {
          if (detected.length === 0 && typeof (window as any).getScreenDetails === 'function') {
            const details = await (window as any).getScreenDetails();
            if (details && Array.isArray(details.screens)) {
              detected = details.screens.map((s: any, idx: number) => ({
                id: String(idx + 1),
                index: idx + 1,
                label: s.label || (s.isPrimary ? `Display ${idx + 1} (Primary)` : `Display ${idx + 1} (External)`),
                isPrimary: Boolean(s.isPrimary),
                bounds: { x: s.left, y: s.top, width: s.width, height: s.height },
                resolution: `${s.width}x${s.height}`
              }));
            }
          }
        } catch {}

        if (detected.length === 0) {
          detected = [
            {
              id: '1',
              index: 1,
              label: 'Primary Display',
              isPrimary: true,
              bounds: { x: 0, y: 0, width: window.screen.width, height: window.screen.height },
              resolution: `${window.screen.width}x${window.screen.height}`
            }
          ];
          if ((window.screen as any).isExtended) {
            detected.push({
              id: '2',
              index: 2,
              label: 'External Display (Extended Desktop)',
              isPrimary: false,
              bounds: { x: window.screen.width, y: 0, width: window.screen.width, height: window.screen.height },
              resolution: `${window.screen.width}x${window.screen.height}`
            });
          }
        }
        setDisplays(detected);
        try {
          localStorage.setItem('live_psalms_detected_displays_v1', JSON.stringify(detected));
        } catch {}

        fetch('/api/obs/info')
          .then(r => r.json())
          .then(info => {
            if (info?.obsOutputDir) setObsOutputDir(info.obsOutputDir);
            if (Array.isArray(info?.networkIps)) setNetworkIps(info.networkIps);
            if (info?.obsConnected) setObsConnected(true);
          })
          .catch(() => {});
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!isOpen) return;
    setSettings(StorageService.getSettings());
    setCustomBibles(StorageService.getCustomBibles());
    setObsConnected(BroadcastService.isObsConnected());
    setBackupNotice('');
    refreshSystemInfo();

    let ipcRenderer: any = null;
    const onDisplaysChanged = (_event: any, list: any[]) => {
      if (!Array.isArray(list)) return;
      setDisplays(list);
      try {
        localStorage.setItem('live_psalms_detected_displays_v1', JSON.stringify(list));
      } catch {}
    };
    try {
      if ((window as any).require) {
        ipcRenderer = (window as any).require('electron').ipcRenderer;
        ipcRenderer.on('displays-changed', onDisplaysChanged);
      }
    } catch {
      /* browser preview */
    }
    return () => {
      if (ipcRenderer) ipcRenderer.removeListener('displays-changed', onDisplaysChanged);
    };
  }, [isOpen]);

  const storageStats = useMemo(() => {
    if (!isOpen) return { bytes: 0, keys: 0 };
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = localStorage.getItem(k) || '';
        bytes += (k.length + v.length) * 2;
      }
    } catch (e) {}
    return { bytes, keys: localStorage.length };
  }, [isOpen, settings, customBibles, backupNotice]);

  if (!isOpen) return null;

  const updateSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    StorageService.saveSettings(next);
    BroadcastService.postMessage({ type: 'APP_SETTINGS_UPDATE', appSettings: next });
  };

  const handleUpdateProfile = (updated: Partial<ChurchProfile>) => {
    setProfileNotice('');
    updateSettings({
      churchProfile: {
        ...settings.churchProfile,
        ...updated
      }
    });
  };

  const handleSaveProfile = () => {
    StorageService.saveSettings(settings);
    BroadcastService.postMessage({ type: 'APP_SETTINGS_UPDATE', appSettings: settings });
    setProfileNotice('Church profile and logo saved.');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      const image = new Image();
      image.onload = () => {
        try {
          const maxDim = 512;
          const scale = Math.min(1, maxDim / Math.max(image.width || 1, image.height || 1));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            handleUpdateProfile({ logoUrl: rawDataUrl });
            setProfileNotice('Logo uploaded.');
            return;
          }
          context.drawImage(image, 0, 0, width, height);
          let optimized = canvas.toDataURL('image/png');
          if (optimized.length > 350_000) {
            const webp = canvas.toDataURL('image/webp', 0.9);
            if (webp.startsWith('data:image/webp') && webp.length < optimized.length) optimized = webp;
          }
          handleUpdateProfile({ logoUrl: optimized });
          setProfileNotice('Logo uploaded.');
        } catch {
          handleUpdateProfile({ logoUrl: rawDataUrl });
          setProfileNotice('Logo uploaded.');
        }
      };
      image.onerror = () => {
        handleUpdateProfile({ logoUrl: rawDataUrl });
        setProfileNotice('Logo uploaded.');
      };
      image.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleXmlBibleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const name = file.name.replace(/\.[^/.]+$/, '');
        const customBible = ImporterService.parseXmlBible(content, name, 'XML');
        if (customBible) {
          StorageService.saveCustomBible(customBible);
          setCustomBibles(StorageService.getCustomBibles());
          setBackupNotice(`Imported XML Bible: ${customBible.name}`);
        } else {
          alert('Could not parse XML Bible file. Ensure it is a valid Zefania/OpenSong XML dataset.');
        }
      } catch (err) {
        alert('Error parsing XML file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteCustomBible = (id: string) => {
    try {
      const remaining = StorageService.getCustomBibles().filter(b => b.id !== id);
      localStorage.setItem('live_psalms_custom_bibles_v1', JSON.stringify(remaining));
      setCustomBibles(remaining);
      window.dispatchEvent(new CustomEvent('custom-bibles-updated'));
    } catch (e) {}
  };

  const handleExportFullBackup = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('live_psalms_')) {
        data[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Live Psalms', data }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-psalms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice('Full system backup downloaded.');
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result || '{}'));
        if (!parsed || typeof parsed.data !== 'object') {
          alert('Invalid backup file format.');
          return;
        }
        Object.entries(parsed.data).forEach(([k, v]) => {
          if (k.startsWith('live_psalms_') && typeof v === 'string') {
            localStorage.setItem(k, v);
          }
        });
        setSettings(StorageService.getSettings());
        setCustomBibles(StorageService.getCustomBibles());
        setBackupNotice('Backup restored. Reload the app to apply all restored playlists and songs.');
      } catch (err) {
        alert('Failed to read backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const hostIp = networkIps[0] || 'localhost';
  const port = settings.networkServerPort || 8080;

  const navTabs: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'Church profile' },
    { id: 'projection', label: 'Display and transitions' },
    { id: 'api', label: 'Bible and library' },
    { id: 'obs', label: 'OBS and network' },
    { id: 'shortcuts', label: 'Hotkeys' },
    { id: 'backup', label: 'System and backup' }
  ];

  const logoSize = settings.churchProfile?.logoSize ?? 35;
  const transitionMs = settings.transitionDurationMs ?? 300;
  const networkBase = `http://${hostIp}:${port}`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[840px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Displays, transitions, OBS, Bible sources and backups.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Settings sections"
            className="w-[180px] shrink-0 space-y-0.5 overflow-y-auto border-r border-border p-2"
          >
            {navTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-8 w-full items-center rounded-md px-2.5 text-left text-xs transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <FieldGroup title="Church identity">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Church name" htmlFor="settings-church-name">
                      <Input
                        id="settings-church-name"
                        type="text"
                        value={settings.churchProfile?.name || ''}
                        onChange={(e) => handleUpdateProfile({ name: e.target.value })}
                        placeholder="Grace Community Church"
                      />
                    </Field>
                    <Field label="Tagline" htmlFor="settings-church-tagline">
                      <Input
                        id="settings-church-tagline"
                        type="text"
                        value={settings.churchProfile?.tagline || ''}
                        onChange={(e) => handleUpdateProfile({ tagline: e.target.value })}
                        placeholder="Welcome to worship"
                      />
                    </Field>
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup
                  title="Logo"
                  description="Used on the logo screen, welcome slides and lower thirds."
                >
                  <div className="flex items-start gap-4">
                    {settings.churchProfile?.logoUrl ? (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/60 p-1.5">
                        <img
                          src={settings.churchProfile.logoUrl}
                          alt="Church logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-center text-2xs text-muted-foreground">
                        No logo
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <label className="cursor-pointer">
                            Upload logo
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          </label>
                        </Button>
                        {settings.churchProfile?.logoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateProfile({ logoUrl: undefined })}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-2xs leading-relaxed text-muted-foreground">
                        PNG or SVG with a transparent background works best.
                      </p>
                    </div>
                  </div>

                  <Field
                    label="Logo size"
                    action={<span className="tabular text-2xs text-muted-foreground">{logoSize}%</span>}
                    hint="Share of the screen height."
                  >
                    <Slider
                      value={[logoSize]}
                      min={10}
                      max={90}
                      step={5}
                      onValueChange={([value]) => handleUpdateProfile({ logoSize: value })}
                      aria-label="Logo size"
                    />
                  </Field>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {profileNotice ? (
                      <span className="text-2xs text-success">{profileNotice}</span>
                    ) : (
                      <span className="text-2xs text-muted-foreground">
                        Changes apply as you type. Save to push them to the outputs.
                      </span>
                    )}
                    <Button size="xs" variant="secondary" onClick={handleSaveProfile}>
                      Save profile
                    </Button>
                  </div>
                </FieldGroup>
              </div>
            )}

            {activeTab === 'projection' && (
              <div className="space-y-5">
                <FieldGroup
                  title="Appearance"
                  description="Match your operating system or lock the console to light or dark mode."
                >
                  <div className="grid grid-cols-3 gap-1.5 rounded-md border border-border bg-background/60 p-1">
                    {[
                      { id: 'system', label: 'System', desc: 'Follow OS' },
                      { id: 'light', label: 'Light', desc: 'Daylight' },
                      { id: 'dark', label: 'Dark', desc: 'Low light' }
                    ].map(mode => {
                      const active = (settings.uiTheme || 'system') === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => updateSettings({ uiTheme: mode.id as 'system' | 'light' | 'dark' })}
                          aria-pressed={active}
                          className={cn(
                            'rounded-sm px-2.5 py-2 text-left transition-colors',
                            active
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div className="text-xs font-medium">{mode.label}</div>
                          <div className="text-2xs text-muted-foreground">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>

                <FieldGroup title="Displays" description="Where each output window opens.">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs text-muted-foreground">
                      {displays.length === 1 ? '1 display detected' : `${displays.length} displays detected`}
                    </span>
                    <Button type="button" variant="secondary" size="xs" onClick={() => refreshSystemInfo()}>
                      Detect displays
                    </Button>
                  </div>

                  {displays.length > 0 ? (
                    <div>
                      {displays.map((d, idx) => {
                        const primary = d.isPrimary || d.primary;
                        return (
                          <div
                            key={d.id || idx}
                            className="flex items-center justify-between gap-3 border-t border-border/70 py-2 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs text-foreground">{d.label || `Display ${idx + 1}`}</p>
                              <p className="tabular text-2xs text-muted-foreground">
                                {d.bounds?.width || '?'} × {d.bounds?.height || '?'} px · ({d.bounds?.x ?? 0}, {d.bounds?.y ?? 0})
                              </p>
                            </div>
                            <span className="shrink-0 text-2xs text-muted-foreground">
                              {primary ? 'Primary' : 'External'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-2xs leading-relaxed text-muted-foreground">
                      No displays detected yet. Use Detect displays to scan connected monitors.
                    </p>
                  )}
                </FieldGroup>

                <Separator />

                <FieldGroup title="Output mapping" description="Choose a display for each output window.">
                  <div>
                    {OUTPUT_ROWS.map(row => {
                      const mappedVal = settings.outputDisplayMap?.[row.key] || 'auto';
                      const openFn =
                        row.key === 'audience'
                          ? () => BroadcastService.openAudienceWindow()
                          : row.key === 'stage'
                            ? () => BroadcastService.openStageWindow()
                            : () => BroadcastService.openLedWindow();
                      return (
                        <div
                          key={row.key}
                          className="flex flex-col gap-2 border-t border-border/70 py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-xs text-foreground">{row.label}</span>
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={mappedVal}
                              onValueChange={(nextDisplayId) => {
                                updateSettings({
                                  outputDisplayMap: {
                                    ...(settings.outputDisplayMap || {}),
                                    [row.key]: nextDisplayId
                                  }
                                });
                                BroadcastService.moveOutputToDisplay(row.key, nextDisplayId);
                              }}
                            >
                              <SelectTrigger className="w-[210px]" aria-label={`${row.label} display`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">Auto (external display)</SelectItem>
                                {displays.map((d, idx) => (
                                  <SelectItem key={d.id || idx} value={String(d.id || idx + 1)}>
                                    {d.label || `Display ${idx + 1}`} ({d.bounds?.width}×{d.bounds?.height})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={openFn}
                              title={`Open ${row.label.toLowerCase()}`}
                            >
                              Open
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup title="Stage display mode" description="How much detail the stage monitor shows.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateSettings({ stageViewMode: 'near' })}
                      aria-pressed={(settings.stageViewMode || 'near') === 'near'}
                      className={cn(
                        'rounded-md border border-border px-3 py-2.5 text-left transition-colors',
                        (settings.stageViewMode || 'near') === 'near'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-background/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">Near stage</span>
                        {(settings.stageViewMode || 'near') === 'near' && (
                          <span className="text-2xs text-muted-foreground">Selected</span>
                        )}
                      </span>
                      <span className="mt-1 block text-2xs leading-relaxed">
                        Current slide, next slide, speaker notes and timer.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ stageViewMode: 'far' })}
                      aria-pressed={settings.stageViewMode === 'far'}
                      className={cn(
                        'rounded-md border border-border px-3 py-2.5 text-left transition-colors',
                        settings.stageViewMode === 'far'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-background/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">Far stage</span>
                        {settings.stageViewMode === 'far' && (
                          <span className="text-2xs text-muted-foreground">Selected</span>
                        )}
                      </span>
                      <span className="mt-1 block text-2xs leading-relaxed">
                        Live slide, counter and reference, readable from a distance.
                      </span>
                    </button>
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup title="Slide transitions">
                  <Field label="Default transition">
                    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/60 p-0.5">
                      {[
                        { id: 'fade', label: 'Fade' },
                        { id: 'slide', label: 'Slide' },
                        { id: 'cut', label: 'Cut' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateSettings({ defaultTransition: t.id as any })}
                          aria-pressed={(settings.defaultTransition || 'fade') === t.id}
                          className={cn(
                            'h-7 rounded-sm text-xs font-medium transition-colors',
                            (settings.defaultTransition || 'fade') === t.id
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field
                    label="Duration"
                    action={<span className="tabular text-2xs text-muted-foreground">{transitionMs} ms</span>}
                  >
                    <Slider
                      value={[transitionMs]}
                      min={100}
                      max={800}
                      step={50}
                      onValueChange={([value]) => updateSettings({ transitionDurationMs: value })}
                      aria-label="Transition duration"
                    />
                  </Field>

                  <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
                    <div className="min-w-0">
                      <Label htmlFor="settings-show-verse-numbers">Verse reference on stage monitor</Label>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        Shows the reference and translation under the slide.
                      </p>
                    </div>
                    <Switch
                      id="settings-show-verse-numbers"
                      checked={settings.showVerseNumbers ?? true}
                      onCheckedChange={(value) => updateSettings({ showVerseNumbers: value })}
                      aria-label="Verse reference on stage monitor"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
                    <div className="min-w-0">
                      <Label htmlFor="settings-auto-launch-audience">Open audience screen at startup</Label>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        Opens the audience window when the app starts.
                      </p>
                    </div>
                    <Switch
                      id="settings-auto-launch-audience"
                      checked={settings.autoLaunchAudience ?? false}
                      onCheckedChange={(value) => updateSettings({ autoLaunchAudience: value })}
                      aria-label="Open audience screen at startup"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-3">
                    <div className="min-w-0">
                      <Label htmlFor="settings-broadcast-multiview">Broadcast multiview</Label>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        Shows the Multiview tab inside the Broadcast dock to monitor Preview, Program, and all scenes.
                      </p>
                    </div>
                    <Switch
                      id="settings-broadcast-multiview"
                      checked={settings.broadcastMultiviewEnabled ?? false}
                      onCheckedChange={(value) => updateSettings({ broadcastMultiviewEnabled: value })}
                      aria-label="Broadcast multiview"
                    />
                  </div>

                  <Field
                    label="Audience screen font size"
                    action={
                      <span className="tabular text-xs font-medium text-foreground">
                        {Math.max(100, settings.audienceMinFontSize ?? 100)} px (min 100)
                      </span>
                    }
                    className="border-t border-border/70 pt-3"
                  >
                    <Slider
                      value={[Math.max(100, settings.audienceMinFontSize ?? 100)]}
                      min={100}
                      max={260}
                      step={2}
                      onValueChange={([value]) => updateSettings({ audienceMinFontSize: Math.max(100, value) })}
                      aria-label="Audience screen font size"
                    />
                  </Field>
                </FieldGroup>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-5">
                <FieldGroup
                  title="Slide translation behavior"
                  description="Choose what happens when you click Translate on a Scripture slide."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 rounded-md border border-border bg-background/60 p-1">
                    {[
                      {
                        id: 'single_slide_revert',
                        label: 'Slide only (revert)',
                        desc: 'Translate only this slide and revert when moving to next.'
                      },
                      {
                        id: 'single_slide_keep',
                        label: 'Slide only (keep)',
                        desc: 'Translate only this slide and keep it translated.'
                      },
                      {
                        id: 'entire_chapter',
                        label: 'Entire chapter',
                        desc: 'Translate the whole chapter and pinned Bible items.'
                      }
                    ].map(opt => {
                      const active = (settings.slideTranslationBehavior || 'single_slide_revert') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateSettings({
                              slideTranslationBehavior: opt.id as
                                | 'single_slide_revert'
                                | 'single_slide_keep'
                                | 'entire_chapter'
                            })
                          }
                          aria-pressed={active}
                          className={cn(
                            'rounded-sm px-2.5 py-2 text-left transition-colors',
                            active
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div className="text-xs font-medium">{opt.label}</div>
                          <div className="mt-0.5 text-2xs leading-snug text-muted-foreground">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>

                <FieldGroup
                  title="Online Bible search"
                  description="Adds online lookup alongside the offline library."
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="settings-api-bible">API.Bible lookup</Label>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        Sends searches to API.Bible when the passage is not in a local version.
                      </p>
                    </div>
                    <Switch
                      id="settings-api-bible"
                      checked={settings.apiBibleEnabled}
                      onCheckedChange={(value) => updateSettings({ apiBibleEnabled: value })}
                      aria-label="API.Bible lookup"
                    />
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup
                  title="Imported Bibles"
                  description="Zefania XML, OpenSong XML or plain XML Bible datasets."
                >
                  <input
                    type="file"
                    ref={xmlFileInputRef}
                    accept=".xml"
                    onChange={handleXmlBibleUpload}
                    className="hidden"
                  />
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => xmlFileInputRef.current?.click()}
                    >
                      Import XML file
                    </Button>
                  </div>

                  {customBibles.length > 0 && (
                    <div>
                      <p className="pb-1 text-2xs text-muted-foreground">
                        {customBibles.length === 1 ? '1 imported version' : `${customBibles.length} imported versions`}
                      </p>
                      <div className="max-h-48 overflow-y-auto">
                        {customBibles.map(cb => (
                          <div
                            key={cb.id}
                            className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs text-foreground">{cb.name}</p>
                              <p className="text-2xs text-muted-foreground">{cb.abbreviation}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Options for ${cb.name}`}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleDeleteCustomBible(cb.id)}>
                                  Remove from library
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </FieldGroup>
              </div>
            )}

            {activeTab === 'obs' && (
              <div className="space-y-5">
                <FieldGroup title="OBS Studio" description="Connect over the OBS WebSocket server (OBS 28 and later).">
                  <div>
                    <Badge variant={obsConnected ? 'success' : 'outline'}>
                      {obsConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="settings-obs-alpha">Transparent background</Label>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        Sends a transparent background to OBS for lower thirds and overlays.
                      </p>
                    </div>
                    <Switch
                      id="settings-obs-alpha"
                      checked={settings.obsAlphaBackground}
                      onCheckedChange={(value) => updateSettings({ obsAlphaBackground: value })}
                      aria-label="Transparent background"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="WebSocket URL" htmlFor="settings-obs-url">
                      <Input
                        id="settings-obs-url"
                        type="text"
                        value={obsWsUrl}
                        onChange={(e) => {
                          setObsWsUrl(e.target.value);
                          localStorage.setItem('live_psalms_obs_ws_url', e.target.value);
                        }}
                        placeholder="ws://127.0.0.1:4455"
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Password" htmlFor="settings-obs-password" hint="Leave blank if the server has no password.">
                      <Input
                        id="settings-obs-password"
                        type="password"
                        value={obsWsPassword}
                        onChange={(e) => {
                          setObsWsPassword(e.target.value);
                          localStorage.setItem('live_psalms_obs_ws_pw', e.target.value);
                        }}
                        placeholder="Optional"
                        className="font-mono"
                      />
                    </Field>
                  </div>

                  {obsError && <p className="text-2xs text-destructive">{obsError}</p>}

                  <div className="flex flex-wrap items-center gap-2">
                    {obsConnected ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => BroadcastService.disconnectObsWebSocket()}
                        >
                          Disconnect
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => BroadcastService.ensureObsTextSources()}
                        >
                          Re-sync scene sources
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setObsError('');
                          BroadcastService.connectObsWebSocket(obsWsUrl, obsWsPassword);
                        }}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup
                  title="Local file output"
                  description="OBS text sources read these files. Copy a path into the source properties."
                >
                  <div>
                    {[
                      { label: 'Full slide', file: 'live_combined.txt' },
                      { label: 'Slide body', file: 'live_slide.txt' },
                      { label: 'Title and reference', file: 'live_title.txt' },
                      { label: 'Lower third', file: 'lower_third.txt' }
                    ].map(item => {
                      const sep = obsOutputDir.includes('\\') ? '\\' : '/';
                      const fullPath = `${obsOutputDir}${sep}${item.file}`;
                      return (
                        <div
                          key={item.file}
                          className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5 first:border-t-0"
                        >
                          <div className="min-w-0">
                            <p className="text-2xs text-muted-foreground">{item.label}</p>
                            <p className="truncate font-mono text-2xs text-foreground">{fullPath}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => copyText(item.file, fullPath)}
                          >
                            {copiedKey === item.file ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup title="Network links" description={`Server address ${networkBase}`}>
                  <div>
                    {[
                      { key: 'aud', label: 'Audience', url: `http://${hostIp}:${port}/?output=audience` },
                      { key: 'stg', label: 'Stage', url: `http://${hostIp}:${port}/?output=stage` },
                      { key: 'led', label: 'LED wall', url: `http://${hostIp}:${port}/?output=led` },
                      { key: 'obs', label: 'OBS state', url: `http://${hostIp}:${port}/api/obs/state` }
                    ].map(link => (
                      <div
                        key={link.key}
                        className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="text-2xs text-muted-foreground">{link.label}</p>
                          <p className="truncate font-mono text-2xs text-foreground">{link.url}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => copyText(link.key, link.url)}
                        >
                          {copiedKey === link.key ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </FieldGroup>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <FieldGroup title="Keyboard shortcuts" description="These work in the operator window.">
                <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
                  {SHORTCUTS.map(shortcut => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between gap-3 border-t border-border/70 py-2"
                    >
                      <span className="text-2xs text-muted-foreground">{shortcut.description}</span>
                      <Kbd className="shrink-0">{shortcut.keys}</Kbd>
                    </div>
                  ))}
                </div>
              </FieldGroup>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-5">
                <FieldGroup title="Storage" description="Local data on this machine.">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Used storage', value: `${(storageStats.bytes / 1024).toFixed(1)} KB` },
                      { label: 'Stored keys', value: String(storageStats.keys) },
                      { label: 'Imported Bibles', value: String(customBibles.length) }
                    ].map(item => (
                      <div key={item.label} className="space-y-0.5">
                        <p className="text-2xs text-muted-foreground">{item.label}</p>
                        <p className="tabular text-sm text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup
                  title="Backup"
                  description="Songs, playlists, themes, announcements, Bibles and settings in one file."
                >
                  {backupNotice && (
                    <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
                      {backupNotice}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={handleExportFullBackup}>
                      Export backup
                    </Button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportFullBackup}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => backupFileInputRef.current?.click()}
                    >
                      Restore backup
                    </Button>
                  </div>
                </FieldGroup>

                <Separator />

                <FieldGroup
                  title="Reset"
                  description="Clears local playlists, settings and sample data."
                >
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Reset application data to original factory defaults?')) {
                          onResetDefaults();
                          onClose();
                        }
                      }}
                    >
                      Reset to factory defaults
                    </Button>
                  </div>
                </FieldGroup>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="default" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
