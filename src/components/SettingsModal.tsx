import React, { useState, useEffect } from 'react';
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
  Layers, 
  Image as ImageIcon,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { AppSettings, ChurchProfile } from '../types/presentation';
import { ImporterService } from '../services/importer';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetDefaults
}) => {
  // Vertical accordion settings - collapsed by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const xmlFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(StorageService.getSettings());
      try {
        if ((window as any).require) {
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.invoke('get-network-ip').then((ips: string[]) => {
            if (Array.isArray(ips)) setNetworkIps(ips);
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleUpdateProfile = (updated: Partial<ChurchProfile>) => {
    const newSettings = {
      ...settings,
      churchProfile: {
        ...settings.churchProfile,
        ...updated
      }
    };
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
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
  };

  const handleToggleApi = (enabled: boolean) => {
    const newSettings = { ...settings, apiBibleEnabled: enabled };
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
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
          alert(`Successfully imported XML Bible: ${customBible.name} (${customBible.abbreviation})`);
        } else {
          alert('Could not parse XML Bible file. Ensure it is a valid Zefania/OpenSong XML dataset.');
        }
      } catch (err) {
        alert('Error parsing XML file.');
      }
    };
    reader.readAsText(file);
  };

  const hostIp = networkIps[0] || 'localhost';

  const sections = [
    {
      id: 'profile',
      title: 'Church Profile & Logo Setup',
      subtitle: 'Church name, tagline, and logo image for emergency & welcome screens',
      icon: Building2,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/30'
    },
    {
      id: 'api',
      title: 'Bible & API Settings',
      subtitle: 'API.Bible online search toggle and XML Bible dataset importer',
      icon: Globe,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30'
    },
    {
      id: 'displays',
      title: 'Displays, Network & OBS Transmission',
      subtitle: 'Wi-Fi streaming links, multi-monitor settings, and LED Wall outputs',
      icon: Tv,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30'
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts & Hotkeys',
      subtitle: 'Quick access keyboard hotkeys for live presentation operators',
      icon: Key,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30'
    },
    {
      id: 'backup',
      title: 'Backup & Factory Reset',
      subtitle: 'Local data persistence & reset app to default sample data',
      icon: Database,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0f1624] border border-[#26334a] rounded-2xl shadow-2xl p-6 text-xs space-y-4 animate-zoom-in overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#26334a] pb-3">
          <div className="flex items-center gap-2 font-black text-sm text-slate-200 uppercase tracking-wider">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>Live Psalms Preferences & Settings</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vertical Collapsed Accordion List */}
        <div className="space-y-3">
          {sections.map((sec) => {
            const isOpenSection = !!openSections[sec.id];
            const Icon = sec.icon;

            return (
              <div
                key={sec.id}
                className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                  isOpenSection ? `${sec.borderColor} bg-[#141d2e]` : 'border-[#26334a] bg-[#111827] hover:border-slate-700'
                }`}
              >
                {/* Accordion Header Button */}
                <button
                  onClick={() => toggleSection(sec.id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-800/40 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${sec.bgColor} ${sec.color} border border-slate-700/50 shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                        <span>{sec.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">{sec.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isOpenSection
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isOpenSection ? 'Expanded' : 'Collapsed'}
                    </span>
                    {isOpenSection ? (
                      <ChevronDown className="w-5 h-5 text-indigo-400 transition-transform" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400 transition-transform" />
                    )}
                  </div>
                </button>

                {/* Accordion Body Content */}
                {isOpenSection && (
                  <div className="p-4 border-t border-[#26334a]/60 space-y-4 bg-[#0e1523] animate-fade-in">
                    {/* SECTION 1: CHURCH PROFILE */}
                    {sec.id === 'profile' && (
                      <div className="space-y-4">
                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-3">
                          <div className="font-extrabold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-indigo-400" /> Church Details
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Church Name</label>
                            <input
                              type="text"
                              value={settings.churchProfile?.name || ''}
                              onChange={(e) => handleUpdateProfile({ name: e.target.value })}
                              placeholder="e.g. GRACE COMMUNITY CHURCH"
                              className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Church Tagline / Motto</label>
                            <input
                              type="text"
                              value={settings.churchProfile?.tagline || ''}
                              onChange={(e) => handleUpdateProfile({ tagline: e.target.value })}
                              placeholder="e.g. Welcome To Worship / Loving God & Serving People"
                              className="w-full bg-[#0d1320] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-3">
                          <div className="font-extrabold text-purple-300 text-xs uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-purple-400" /> Church Logo Setup
                          </div>

                          <div className="flex items-center gap-4">
                            {settings.churchProfile?.logoUrl ? (
                              <div className="w-20 h-20 bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-center shrink-0">
                                <img src={settings.churchProfile.logoUrl} alt="Church Logo" className="max-w-full max-h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-20 h-20 bg-slate-900 border border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-500 shrink-0 font-semibold text-[10px]">
                                No Logo Set
                              </div>
                            )}

                            <div className="space-y-2 flex-1">
                              <p className="text-slate-400 text-[11px]">
                                Upload your Church Logo image file. Rendered automatically on the Emergency **LOGO** screen, welcome cards, and lower thirds.
                              </p>
                              <label className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow">
                                <Upload className="w-3.5 h-3.5" /> Upload Logo Image File
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: BIBLE & API SETTINGS */}
                    {sec.id === 'api' && (
                      <div className="space-y-4">
                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-extrabold text-amber-300 text-xs uppercase tracking-wider flex items-center gap-2">
                                <Globe className="w-4 h-4 text-amber-400" /> Online API.Bible Search
                              </div>
                              <p className="text-slate-400 text-[11px] mt-1">
                                Enables online API.Bible search for NKJV, NIV, AMP, and KJV translations. **(OFF by default for offline use)**.
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.apiBibleEnabled}
                              onChange={(e) => handleToggleApi(e.target.checked)}
                              className="accent-amber-500 w-5 h-5 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-3">
                          <div className="font-extrabold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
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
                            onClick={() => xmlFileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-2 shadow"
                          >
                            <Upload className="w-4 h-4" /> Import XML Bible (.xml)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: DISPLAYS & NETWORK */}
                    {sec.id === 'displays' && (
                      <div className="space-y-4">
                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-3">
                          <div className="font-extrabold text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-2">
                            <Radio className="w-4 h-4 text-indigo-400" /> Local Network Server & OBS Transmission Link
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Live Psalms serves live displays over your Wi-Fi network. Any browser, device, or OBS Studio on the network can connect!
                          </p>

                          <div className="bg-[#090d14] border border-slate-800 p-3 rounded-lg space-y-2 font-mono text-[11px]">
                            <div className="text-emerald-400 font-extrabold flex items-center gap-1.5 font-sans">
                              <Check className="w-4 h-4" /> Local Network Server Active: http://{hostIp}:8080
                            </div>
                            <div className="space-y-1 text-slate-300">
                              <div>📺 Audience Output: <span className="text-indigo-300 font-bold">http://{hostIp}:8080/?output=audience</span></div>
                              <div>🎙️ Stage Confidence: <span className="text-amber-300 font-bold">http://{hostIp}:8080/?output=stage</span></div>
                              <div>🖼️ LED Wall Display: <span className="text-sky-300 font-bold">http://{hostIp}:8080/?output=led</span></div>
                              <div>🎥 OBS Transparent Link: <span className="text-rose-300 font-bold">http://{hostIp}:8080/?output=obs</span></div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#141d2e] border border-slate-800 p-4 rounded-xl space-y-2">
                          <div className="font-extrabold text-sky-300 text-xs uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-sky-400" /> 3rd Display (LED Wall & Motion Graphics Window)
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Manages &gt;2 physical or virtual screens. Launch dedicated LED wall output for motion graphic panels.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* SECTION 4: SHORTCUTS */}
                    {sec.id === 'shortcuts' && (
                      <div className="space-y-2 bg-[#141d2e] border border-slate-800 p-4 rounded-xl font-mono text-[11px]">
                        <div className="font-bold text-indigo-300 font-sans text-xs mb-2">Active Hotkeys</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-indigo-400">Ctrl + K</kbd> Global Search</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-rose-400">B</kbd> Toggle Black Screen</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-amber-400">ESC</kbd> Clear Text Output</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-indigo-400">L</kbd> Toggle Logo Screen</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-sky-400">F</kbd> Toggle Freeze Frame</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-emerald-400">ENTER</kbd> Go Live with Preview</div>
                          <div><kbd className="px-1.5 py-0.5 bg-slate-900 border rounded text-slate-300">↑ / ↓</kbd> Prev / Next Slide</div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 5: BACKUP */}
                    {sec.id === 'backup' && (
                      <div className="space-y-3 bg-[#141d2e] border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400">
                          Live Psalms operates 100% offline using local application data storage.
                        </p>
                        <button
                          onClick={() => {
                            if (confirm('Reset application data to original factory defaults?')) {
                              onResetDefaults();
                              onClose();
                            }
                          }}
                          className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/50 text-rose-200 hover:text-white font-bold rounded-lg transition"
                        >
                          Reset to Factory Default Sample Data
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
