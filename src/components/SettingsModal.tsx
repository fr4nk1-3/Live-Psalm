import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  X,
  Tv,
  Key,
  Database,
  Building2,
  Upload,
  Globe,
  Radio,
  Check,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Trash2,
  Sliders,
  HardDrive,
  Copy,
  RotateCcw
} from 'lucide-react';
import { StorageService, CustomBibleTranslation } from '../services/storage';
import { BroadcastService } from '../services/broadcast';
import { AppSettings, ChurchProfile } from '../types/presentation';
import { ImporterService } from '../services/importer';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetDefaults: () => void;
}

type SettingsTab = 'profile' | 'projection' | 'api' | 'obs' | 'shortcuts' | 'backup';

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

  const xmlFileInputRef = React.useRef<HTMLInputElement>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = BroadcastService.onObsStatusChange((connected, err) => {
      setObsConnected(connected);
      setObsError(err || '');
    });
    return () => unsub();
  }, []);

  const refreshSystemInfo = () => {
    try {
      if ((window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer
          .invoke('get-connected-displays')
          .then((list: any[]) => {
            if (Array.isArray(list)) setDisplays(list);
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
    if (isOpen) {
      setSettings(StorageService.getSettings());
      setCustomBibles(StorageService.getCustomBibles());
      setObsConnected(BroadcastService.isObsConnected());
      setBackupNotice('');
      refreshSystemInfo();
    }
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
  };

  const handleUpdateProfile = (updated: Partial<ChurchProfile>) => {
    updateSettings({
      churchProfile: {
        ...settings.churchProfile,
        ...updated
      }
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      handleUpdateProfile({ logoUrl: dataUrl });
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
        setBackupNotice('Backup restored! Reload the app to apply all restored playlists & songs.');
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

  const navTabs: { id: SettingsTab; label: string; icon: any; color: string }[] = [
    { id: 'profile', label: 'Church Profile', icon: Building2, color: 'text-indigo-400' },
    { id: 'projection', label: 'Display & Transitions', icon: Sliders, color: 'text-sky-400' },
    { id: 'api', label: 'Bible & Library', icon: Globe, color: 'text-amber-400' },
    { id: 'obs', label: 'OBS & Network', icon: Radio, color: 'text-rose-400' },
    { id: 'shortcuts', label: 'Hotkeys', icon: Key, color: 'text-emerald-400' },
    { id: 'backup', label: 'System & Backup', icon: Database, color: 'text-purple-400' }
  ];

  const renderToggle = (checked: boolean, onChange: (val: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
        checked ? 'bg-indigo-500 justify-end' : 'bg-slate-700 justify-start'
      }`}
    >
      <span className="w-4 h-4 rounded-full bg-white shadow" />
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-[#0f1624] border border-[#26334a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-xs animate-zoom-in">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#131b2c] border-b border-[#26334a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center">
              <Settings className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white uppercase tracking-wider">
                System Settings &amp; Preferences
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure displays, transitions, OBS Studio, Bible datasets, and system backups.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Column Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Navigation Rail */}
          <nav className="md:w-56 bg-[#0b101b] border-b md:border-b-0 md:border-r border-[#26334a] p-2.5 flex md:flex-col gap-1 overflow-x-auto shrink-0">
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-xl flex items-center gap-2.5 text-left font-bold text-xs transition whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600/20 border border-indigo-500/50 text-white shadow'
                      : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Settings Content Pane */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: CHURCH PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" /> Church Identity
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                        Church Name
                      </label>
                      <input
                        type="text"
                        value={settings.churchProfile?.name || ''}
                        onChange={(e) => handleUpdateProfile({ name: e.target.value })}
                        placeholder="e.g. GRACE COMMUNITY CHURCH"
                        className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-white font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                        Tagline / Welcome Motto
                      </label>
                      <input
                        type="text"
                        value={settings.churchProfile?.tagline || ''}
                        onChange={(e) => handleUpdateProfile({ tagline: e.target.value })}
                        placeholder="e.g. Welcome To Worship"
                        className="w-full bg-[#0b101b] border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-purple-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-400" /> Church Logo &amp; Projection Size
                  </div>
                  <div className="flex items-center gap-4">
                    {settings.churchProfile?.logoUrl ? (
                      <div className="w-20 h-20 bg-[#0b101b] border border-slate-700 rounded-xl p-2 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={settings.churchProfile.logoUrl}
                          alt="Church Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-[#0b101b] border border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-500 shrink-0 text-[10px] font-semibold">
                        No Logo
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <p className="text-slate-400 text-[11px]">
                        Displayed on the Emergency <strong>LOGO</strong> screen, welcome cards, and lower thirds.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow">
                          <Upload className="w-3.5 h-3.5" /> Upload Logo
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                        {settings.churchProfile?.logoUrl && (
                          <button
                            type="button"
                            onClick={() => handleUpdateProfile({ logoUrl: undefined })}
                            className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white font-bold rounded-lg text-[11px] transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">
                        Logo Size on Screen
                      </label>
                      <span className="text-xs font-bold text-purple-300">
                        {settings.churchProfile?.logoSize ?? 35}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={settings.churchProfile?.logoSize ?? 35}
                      onChange={(e) => handleUpdateProfile({ logoSize: parseInt(e.target.value, 10) })}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DISPLAYS & TRANSITIONS */}
            {activeTab === 'projection' && (
              <div className="space-y-4">
                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sky-300 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Tv className="w-4 h-4 text-sky-400" /> Connected Displays
                    </div>
                    <button
                      type="button"
                      onClick={refreshSystemInfo}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {displays.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {displays.map((d, idx) => (
                        <div
                          key={d.id || idx}
                          className="p-2.5 bg-[#0b101b] border border-slate-800 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-white text-xs">
                              Display {idx + 1} {d.primary ? '(Primary)' : ''}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {d.bounds?.width || '?'} × {d.bounds?.height || '?'} px
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-bold uppercase">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#0b101b] border border-slate-800 rounded-lg text-slate-400 text-[11px]">
                      Running in browser/single-screen mode. Use the <strong>Audience</strong>, <strong>Stage</strong>, or <strong>LED Wall</strong> buttons in the top bar to open projector windows.
                    </div>
                  )}
                </div>

                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" /> Slide Transitions &amp; Behavior
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">
                      Default Slide Transition
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'fade', label: 'Smooth Fade' },
                        { id: 'slide', label: 'Slide Motion' },
                        { id: 'cut', label: 'Instant Cut' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateSettings({ defaultTransition: t.id as any })}
                          className={`py-2 px-3 rounded-lg border font-bold text-xs transition ${
                            (settings.defaultTransition || 'fade') === t.id
                              ? 'bg-indigo-600/25 border-indigo-400 text-white'
                              : 'bg-[#0b101b] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">
                        Transition Duration
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-300">
                        {settings.transitionDurationMs ?? 300}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={800}
                      step={50}
                      value={settings.transitionDurationMs ?? 300}
                      onChange={(e) => updateSettings({ transitionDurationMs: parseInt(e.target.value, 10) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-200">Show Verse Numbers on Scripture Slides</div>
                        <div className="text-[10px] text-slate-400">
                          Displays verse reference numbers clearly on projected Bible slides.
                        </div>
                      </div>
                      {renderToggle(settings.showVerseNumbers ?? true, (val) =>
                        updateSettings({ showVerseNumbers: val })
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-200">Auto-Launch Audience Screen on Startup</div>
                        <div className="text-[10px] text-slate-400">
                          Automatically opens the Audience projection window when Live Psalms starts.
                        </div>
                      </div>
                      {renderToggle(settings.autoLaunchAudience ?? false, (val) =>
                        updateSettings({ autoLaunchAudience: val })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BIBLE & LIBRARY */}
            {activeTab === 'api' && (
              <div className="space-y-4">
                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-amber-300 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Globe className="w-4 h-4 text-amber-400" /> Online API.Bible Search
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Enable online API.Bible lookup in addition to your offline Bible library.
                    </p>
                  </div>
                  {renderToggle(settings.apiBibleEnabled, (val) =>
                    updateSettings({ apiBibleEnabled: val })
                  )}
                </div>

                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-400" /> Import XML Bible Dataset
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Import offline XML Bibles (Zefania XML, OpenSong XML, or XML Bible format).
                  </p>
                  <input
                    type="file"
                    ref={xmlFileInputRef}
                    accept=".xml"
                    onChange={handleXmlBibleUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => xmlFileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-2 shadow"
                  >
                    <Upload className="w-4 h-4" /> Import XML Bible (.xml)
                  </button>

                  {customBibles.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Imported Custom Bibles ({customBibles.length})
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {customBibles.map(cb => (
                          <div
                            key={cb.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0b101b] border border-slate-800 rounded-lg"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-white truncate block">{cb.name}</span>
                              <span className="text-[10px] text-amber-300 font-semibold">{cb.abbreviation}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomBible(cb.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                              title="Remove imported Bible"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: OBS & NETWORK */}
            {activeTab === 'obs' && (
              <div className="space-y-4">
                <div className="bg-[#121929] border border-rose-500/40 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-rose-300 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Radio className="w-4 h-4 text-rose-400" /> Direct OBS Studio Bridge
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        obsConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {obsConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* OBS Transparent Alpha Background Toggle */}
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-[#0b101b] border border-slate-800 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-200">OBS Transparent (Alpha) Background</div>
                      <div className="text-[10px] text-slate-400">
                        Use transparent background on OBS browser/overlay output for lower thirds.
                      </div>
                    </div>
                    {renderToggle(settings.obsAlphaBackground, (val) =>
                      updateSettings({ obsAlphaBackground: val })
                    )}
                  </div>

                  {/* Method 1: OBS WebSocket v5 */}
                  <div className="bg-[#0b101b] border border-slate-800 p-3 rounded-lg space-y-2.5">
                    <div className="text-xs font-bold text-indigo-300">
                      OBS WebSocket v5 Bridge (OBS v28+)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                          WebSocket URL
                        </label>
                        <input
                          type="text"
                          value={obsWsUrl}
                          onChange={(e) => {
                            setObsWsUrl(e.target.value);
                            localStorage.setItem('live_psalms_obs_ws_url', e.target.value);
                          }}
                          placeholder="ws://127.0.0.1:4455"
                          className="w-full bg-[#121929] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                          Password (Optional)
                        </label>
                        <input
                          type="password"
                          value={obsWsPassword}
                          onChange={(e) => {
                            setObsWsPassword(e.target.value);
                            localStorage.setItem('live_psalms_obs_ws_pw', e.target.value);
                          }}
                          placeholder="Leave blank if disabled"
                          className="w-full bg-[#121929] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {obsError && (
                      <div className="text-[10px] text-rose-400 font-semibold bg-rose-950/50 border border-rose-500/40 p-2 rounded">
                        {obsError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {obsConnected ? (
                        <>
                          <button
                            type="button"
                            onClick={() => BroadcastService.disconnectObsWebSocket()}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition"
                          >
                            Disconnect OBS
                          </button>
                          <button
                            type="button"
                            onClick={() => BroadcastService.ensureObsTextSources()}
                            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-200 hover:text-white font-bold rounded-lg text-xs transition"
                          >
                            Re-Sync Scene Sources
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setObsError('');
                            BroadcastService.connectObsWebSocket(obsWsUrl, obsWsPassword);
                          }}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow"
                        >
                          Connect Directly to OBS
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Method 2: Direct Local File Output */}
                  <div className="bg-[#0b101b] border border-slate-800 p-3 rounded-lg space-y-2">
                    <div className="text-xs font-bold text-amber-300">
                      Local File Stream (OBS Text → Read from file)
                    </div>
                    <div className="space-y-1.5 font-mono text-[10px]">
                      {[
                        { label: 'Full Slide', file: 'live_combined.txt' },
                        { label: 'Slide Body', file: 'live_slide.txt' },
                        { label: 'Title / Ref', file: 'live_title.txt' },
                        { label: 'Lower-Third Ticker', file: 'lower_third.txt' }
                      ].map(item => {
                        const sep = obsOutputDir.includes('\\') ? '\\' : '/';
                        const fullPath = `${obsOutputDir}${sep}${item.file}`;
                        return (
                          <div
                            key={item.file}
                            className="flex items-center justify-between gap-2 bg-[#121929] border border-slate-800 px-2.5 py-1.5 rounded-lg"
                          >
                            <div className="truncate">
                              <span className="text-slate-400 font-sans font-bold mr-2">{item.label}:</span>
                              <span className="text-amber-300">{fullPath}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(item.file, fullPath)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded text-[9px] font-sans font-bold shrink-0 transition"
                            >
                              {copiedKey === item.file ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Network URLs */}
                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-400" /> Wi-Fi Remote Display Links
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> http://{hostIp}:{port}
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {[
                      { key: 'aud', label: 'Audience', url: `http://${hostIp}:${port}/?output=audience` },
                      { key: 'stg', label: 'Stage', url: `http://${hostIp}:${port}/?output=stage` },
                      { key: 'led', label: 'LED Wall', url: `http://${hostIp}:${port}/?output=led` },
                      { key: 'obs', label: 'OBS JSON', url: `http://${hostIp}:${port}/api/obs/state` }
                    ].map(link => (
                      <div
                        key={link.key}
                        className="flex items-center justify-between gap-2 bg-[#0b101b] border border-slate-800 px-2.5 py-1.5 rounded-lg"
                      >
                        <div className="truncate">
                          <span className="text-slate-400 font-sans font-bold mr-2">{link.label}:</span>
                          <span className="text-indigo-300">{link.url}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(link.key, link.url)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded text-[9px] font-sans font-bold shrink-0 flex items-center gap-1 transition"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          {copiedKey === link.key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SHORTCUTS */}
            {activeTab === 'shortcuts' && (
              <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="font-bold text-emerald-300 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" /> Live Operator Keyboard Shortcuts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                  {[
                    { keys: 'Space / → / ↓', desc: 'Next Slide (Go Live)' },
                    { keys: '← / ↑', desc: 'Previous Slide (Go Live)' },
                    { keys: 'Alt + ↑ / ↓', desc: 'Prev / Next Playlist Item' },
                    { keys: 'Enter', desc: 'Go Live with Preview Slide' },
                    { keys: '1 – 9', desc: 'Jump to Slide 1–9' },
                    { keys: 'Ctrl + K', desc: 'Open Global Search' },
                    { keys: 'B', desc: 'Toggle Black Screen' },
                    { keys: 'L', desc: 'Toggle Logo Screen' },
                    { keys: 'F', desc: 'Toggle Freeze Frame' },
                    { keys: 'Esc', desc: 'Clear Text Overlay' }
                  ].map(hk => (
                    <div
                      key={hk.keys}
                      className="flex items-center justify-between gap-2 bg-[#0b101b] border border-slate-800 px-3 py-2 rounded-lg"
                    >
                      <kbd className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-indigo-300 font-bold text-[10px]">
                        {hk.keys}
                      </kbd>
                      <span className="font-sans text-slate-300 text-[11px]">{hk.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SYSTEM & BACKUP */}
            {activeTab === 'backup' && (
              <div className="space-y-4">
                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-purple-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-400" /> Local Storage Diagnostics
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-[#0b101b] border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Used Storage</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        {(storageStats.bytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <div className="p-3 bg-[#0b101b] border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Stored Keys</div>
                      <div className="text-sm font-black text-indigo-300 mt-0.5">
                        {storageStats.keys}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0b101b] border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Custom Bibles</div>
                      <div className="text-sm font-black text-amber-300 mt-0.5">
                        {customBibles.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121929] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-400" /> Full System Backup &amp; Restore
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Export all songs, playlists, themes, announcements, custom Bibles, and settings to a portable <code>.json</code> file, or restore from a previous backup.
                  </p>
                  {backupNotice && (
                    <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px]">
                      {backupNotice}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportFullBackup}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Export System Backup (.json)
                    </button>

                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportFullBackup}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" /> Restore Backup (.json)
                    </button>
                  </div>
                </div>

                <div className="bg-[#121929] border border-rose-500/30 p-4 rounded-xl space-y-2.5">
                  <div className="font-bold text-rose-300 text-xs uppercase tracking-wider flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-400" /> Danger Zone
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Reset all local playlists, custom settings, and sample data back to factory defaults.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset application data to original factory defaults?')) {
                        onResetDefaults();
                        onClose();
                      }
                    }}
                    className="px-4 py-2 bg-rose-600/25 hover:bg-rose-600 border border-rose-500/50 text-rose-200 hover:text-white font-bold rounded-lg transition"
                  >
                    Reset to Factory Defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
