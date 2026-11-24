/**
 * Audio monitor for the broadcast output.
 *
 * Builds a small Web Audio graph around either the media player's programme
 * audio or a microphone / line input, and exposes RMS levels to any component
 * that wants to draw a meter. Device capture is never routed back to the
 * speakers (no feedback); programme audio is, because creating a media element
 * source takes over the element's own playback path.
 */

export type AudioSource = 'device' | 'program' | 'silent';

export interface AudioSettings {
  source: AudioSource;
  deviceId: string;
  /** Linear gain applied before metering, 0 - 2. */
  gain: number;
  muted: boolean;
}

export interface AudioLevels {
  left: number;
  right: number;
  /** Decaying peak across both channels, 0 - 1. */
  peak: number;
  /** Peak expressed in dBFS for a numeric readout. */
  peakDb: number;
  connected: boolean;
  error?: string;
}

const STORAGE_KEY = 'live_psalms_stream_audio_v1';

const DEFAULT_SETTINGS: AudioSettings = {
  source: 'device',
  deviceId: '',
  gain: 1,
  muted: false
};

const SILENT_LEVELS: AudioLevels = {
  left: 0,
  right: 0,
  peak: 0,
  peakDb: -60,
  connected: true
};

const rmsToNormalised = (rms: number): number => {
  if (rms <= 0.0005) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 60) / 60));
};

const toDb = (value: number): number =>
  value <= 0 ? -60 : Math.round(20 * Math.log10(value) * 10) / 10;

class AudioMonitor {
  private settings: AudioSettings = this.loadSettings();
  private settingsListeners = new Set<(settings: AudioSettings) => void>();
  private levelListeners = new Set<(levels: AudioLevels) => void>();

  private context: AudioContext | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private sourceNode: AudioNode | null = null;
  private elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private programElement: HTMLMediaElement | null = null;
  private micStream: MediaStream | null = null;
  private sceneStream: MediaStream | null = null;

  private retainCount = 0;
  private frame = 0;
  private lastEmit = 0;
  private peak = 0;
  private levels: AudioLevels = { ...SILENT_LEVELS, connected: false };
  private rebuildToken = 0;
  private unlockBound = false;

  // ---------------------------------------------------------------- settings

  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        source: parsed.source === 'program' || parsed.source === 'silent' ? parsed.source : 'device',
        deviceId: parsed.deviceId || '',
        gain: typeof parsed.gain === 'number' ? Math.min(2, Math.max(0, parsed.gain)) : 1,
        muted: Boolean(parsed.muted)
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage may be unavailable */
    }
    this.settingsListeners.forEach(listener => listener(this.getSettings()));
    if (this.levelListeners.size > 0) void this.rebuild();
  }

  subscribeSettings(listener: (settings: AudioSettings) => void): () => void {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  }

  // ------------------------------------------------------------------ source

  registerProgramElement(element: HTMLMediaElement | null) {
    if (this.programElement === element) return;
    this.programElement = element;
    if (this.levelListeners.size > 0 && this.settings.source === 'program') void this.rebuild();
  }

  /** Allows the active Broadcast Scene's audio input stream to feed the meter directly. */
  setSceneStream(stream: MediaStream | null) {
    if (this.sceneStream === stream) return;
    this.sceneStream = stream;
    if (this.retainCount > 0) void this.rebuild();
  }

  // ------------------------------------------------------------------ levels

  getLevels(): AudioLevels {
    return this.levels;
  }

  subscribeLevels(listener: (levels: AudioLevels) => void): () => void {
    this.levelListeners.add(listener);
    listener(this.levels);
    return () => {
      this.levelListeners.delete(listener);
    };
  }

  /**
   * Ask for capture. Callers retain while they need levels (dialog open, stream
   * live) so the microphone is never opened unprompted at start-up.
   */
  retain() {
    this.retainCount += 1;
    if (this.retainCount > 1) return;
    this.bindUnlock();
    void this.rebuild();
    this.startLoop();
  }

  release() {
    this.retainCount = Math.max(0, this.retainCount - 1);
    if (this.retainCount > 0) return;
    this.stopLoop();
    this.teardown();
    this.broadcast({ ...SILENT_LEVELS, connected: false });
  }

  private broadcast(levels: AudioLevels) {
    this.levels = levels;
    this.levelListeners.forEach(listener => listener(levels));
  }

  private startLoop() {
    if (this.frame) return;
    const tick = (time: number) => {
      this.frame = requestAnimationFrame(tick);
      if (time - this.lastEmit < 33) return;
      this.lastEmit = time;
      this.sample();
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private sample() {
    if (this.retainCount === 0) return;
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }
    if (!this.analyserLeft || !this.analyserRight) {
      this.peak *= 0.94;
      this.broadcast({
        left: 0,
        right: 0,
        peak: this.peak,
        peakDb: toDb(this.peak),
        connected: this.settings.source === 'silent',
        error: this.levels.error
      });
      return;
    }

    const leftData = new Float32Array(this.analyserLeft.fftSize);
    const rightData = new Float32Array(this.analyserRight.fftSize);
    this.analyserLeft.getFloatTimeDomainData(leftData);
    this.analyserRight.getFloatTimeDomainData(rightData);

    const rms = (data: Float32Array) => {
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
      return Math.sqrt(sum / data.length);
    };

    const rawLeft = rms(leftData);
    const rawRight = rms(rightData);
    const left = rmsToNormalised(rawLeft);
    // Most microphones are mono (1 channel), so channel 1 of a 2-channel splitter is 0;
    // mirror channel 0 when channel 1 is empty so both stereo meter bars animate.
    const right = rawRight <= 0.0001 && rawLeft > 0.0001 ? left : rmsToNormalised(rawRight);
    const instant = Math.max(left, right);
    this.peak = Math.max(instant, this.peak * 0.92);

    this.broadcast({
      left,
      right,
      peak: this.peak,
      peakDb: toDb(this.peak),
      connected: true
    });
  }

  // ------------------------------------------------------------------- graph

  private bindUnlock() {
    if (this.unlockBound || typeof document === 'undefined') return;
    this.unlockBound = true;
    const unlock = () => {
      void this.context?.resume().catch(() => {});
    };
    document.addEventListener('pointerdown', unlock, { capture: true });
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (this.context) return this.context;
    const Ctor = typeof window !== 'undefined' ? window.AudioContext || (window as any).webkitAudioContext : null;
    if (!Ctor) return null;
    this.context = new Ctor({ latencyHint: 'interactive' });
    if (this.context.state === 'suspended') {
      await this.context.resume().catch(() => {});
    }
    return this.context;
  }

  private teardown() {
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.gainNode?.disconnect();
    this.gainNode = null;
    this.splitter?.disconnect();
    this.splitter = null;
    this.analyserLeft = null;
    this.analyserRight = null;
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }

  private async rebuild() {
    const token = ++this.rebuildToken;
    this.teardown();

    if (this.retainCount === 0 || this.settings.source === 'silent') {
      this.broadcast({ ...SILENT_LEVELS, connected: this.settings.source === 'silent' });
      return;
    }

    const context = await this.ensureContext();
    if (!context || token !== this.rebuildToken) return;
    context.resume().catch(() => {});

    try {
      if (this.sceneStream && this.sceneStream.getAudioTracks().some(t => t.readyState === 'live')) {
        this.sourceNode = context.createMediaStreamSource(this.sceneStream);
      } else if (this.settings.source === 'device') {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: this.settings.deviceId ? { deviceId: { exact: this.settings.deviceId } } : true,
            video: false
          });
        } catch (err) {
          if (this.settings.deviceId) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } else {
            throw err;
          }
        }
        if (token !== this.rebuildToken) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        this.micStream = stream;
        this.sourceNode = context.createMediaStreamSource(stream);
      } else {
        const element = this.programElement;
        if (!element) {
          this.broadcast({
            left: 0,
            right: 0,
            peak: 0,
            peakDb: -60,
            connected: false,
            error: 'No programme audio is playing.'
          });
          return;
        }
        let source = this.elementSources.get(element);
        if (!source) {
          source = context.createMediaElementSource(element);
          this.elementSources.set(element, source);
        }
        this.sourceNode = source;
      }

      const gain = context.createGain();
      gain.gain.value = this.settings.muted ? 0 : this.settings.gain;
      this.gainNode = gain;

      const splitter = context.createChannelSplitter(2);
      this.splitter = splitter;

      const analyserLeft = context.createAnalyser();
      analyserLeft.fftSize = 2048;
      analyserLeft.smoothingTimeConstant = 0.5;
      const analyserRight = context.createAnalyser();
      analyserRight.fftSize = 2048;
      analyserRight.smoothingTimeConstant = 0.5;

      this.sourceNode.connect(gain);
      gain.connect(splitter);
      splitter.connect(analyserLeft, 0);
      splitter.connect(analyserRight, 1);

      // Programme audio must stay audible once it moves into the graph.
      if (this.settings.source === 'program') gain.connect(context.destination);

      this.analyserLeft = analyserLeft;
      this.analyserRight = analyserRight;
      this.broadcast({ ...this.levels, connected: true, error: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the audio input.';
      this.broadcast({ left: 0, right: 0, peak: 0, peakDb: -60, connected: false, error: message });
    }
  }
}

export const audioMonitor = new AudioMonitor();
