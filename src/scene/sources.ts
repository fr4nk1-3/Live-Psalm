/**
 * Capture sources for the scene canvas.
 *
 * Desktop capture is main-process only in Electron, so screens and windows are
 * enumerated over IPC; the renderer then asks getUserMedia for the chosen
 * source id. Cameras and microphones use the ordinary device APIs.
 */

export interface DesktopSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnail: string;
}

interface ElectronBridge {
  ipcRenderer?: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };
}

function electron(): ElectronBridge | null {
  const bridge = (window as unknown as { require?: (module: string) => ElectronBridge }).require;
  if (!bridge) return null;
  try {
    return bridge('electron');
  } catch {
    return null;
  }
}

export async function listDesktopSources(kind: 'screen' | 'window' | 'all' = 'all'): Promise<DesktopSource[]> {
  const ipc = electron()?.ipcRenderer;
  if (!ipc) return [];
  try {
    const result = (await ipc.invoke('get-desktop-sources', kind)) as DesktopSource[] | { error: string };
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function captureDesktop(sourceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId
      }
    } as unknown as MediaTrackConstraints
  });
}

export async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch {
    return [];
  }
}

export async function listAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch {
    return [];
  }
}
