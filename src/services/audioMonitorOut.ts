/**
 * Audio confidence monitoring: routes the selected input to an output device so
 * the operator can hear what is going to air.
 */

export interface MonitorSettings {
  enabled: boolean;
  outputDeviceId: string;
  volume: number;
}

const STORAGE_KEY = 'live_psalms_audio_monitor_v1';

export const DEFAULT_MONITOR: MonitorSettings = { enabled: false, outputDeviceId: '', volume: 0.7 };

export function loadMonitorSettings(): MonitorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MONITOR };
    const parsed = JSON.parse(raw) as Partial<MonitorSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      outputDeviceId: parsed.outputDeviceId || '',
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT_MONITOR.volume
    };
  } catch {
    return { ...DEFAULT_MONITOR };
  }
}

export function saveMonitorSettings(settings: MonitorSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

class AudioOutputMonitor {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private gain: GainNode | null = null;
  private signature = '';

  async apply(settings: MonitorSettings, inputDeviceId: string) {
    if (!settings.enabled) {
      this.stop();
      return;
    }
    const signature = `${inputDeviceId}|${settings.outputDeviceId}`;
    if (this.context && this.signature === signature) {
      if (this.gain) this.gain.gain.value = settings.volume;
      return;
    }
    this.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : true
      });
      const context = new AudioContext();
      if (typeof (context as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function' && settings.outputDeviceId) {
        await (context as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(settings.outputDeviceId);
      }
      const source = context.createMediaStreamSource(stream);
      const gain = context.createGain();
      gain.gain.value = settings.volume;
      source.connect(gain);
      gain.connect(context.destination);
      if (context.state === 'suspended') void context.resume();
      this.stream = stream;
      this.context = context;
      this.gain = gain;
      this.signature = signature;
    } catch {
      this.stop();
    }
  }

  stop() {
    this.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {});
    this.stream = null;
    this.context = null;
    this.gain = null;
    this.signature = '';
  }
}

export const audioOutputMonitor = new AudioOutputMonitor();
