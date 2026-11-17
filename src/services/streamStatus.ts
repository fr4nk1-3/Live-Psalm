/**
 * Small observable for the live stream state and its encoder telemetry, so the
 * footer, the broadcast monitor and the setup dialog all read from one source.
 */

export type StreamState = 'offline' | 'connecting' | 'live' | 'ended' | 'error';

export interface StreamStats {
  bitrateKbps?: number;
  fps?: number;
  frames?: number;
  dropped?: number;
  speed?: number;
  sizeKb?: number;
  timeSeconds?: number;
}

export interface StreamStatus {
  live: boolean;
  state: StreamState;
  platform?: string;
  startedAt?: number;
  stats: StreamStats;
  error?: string;
}

type Listener = (status: StreamStatus) => void;

const EMPTY: StreamStatus = { live: false, state: 'offline', stats: {} };

class StreamStatusStore {
  private status: StreamStatus = { ...EMPTY };
  private listeners = new Set<Listener>();

  get(): StreamStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snapshot = this.status;
    this.listeners.forEach(listener => listener(snapshot));
  }

  begin(platform?: string) {
    this.status = { live: false, state: 'connecting', platform, startedAt: Date.now(), stats: {} };
    this.emit();
  }

  markLive() {
    if (this.status.state === 'live') return;
    this.status = { ...this.status, live: true, state: 'live', error: undefined };
    this.emit();
  }

  applyStats(stats: StreamStats) {
    this.status = {
      ...this.status,
      live: true,
      state: 'live',
      stats: { ...this.status.stats, ...stats }
    };
    this.emit();
  }

  finish(error?: string) {
    this.status = {
      ...this.status,
      live: false,
      state: error ? 'error' : 'ended',
      error
    };
    this.emit();
  }

  reset() {
    this.status = { ...EMPTY, stats: {} };
    this.emit();
  }
}

export const streamStatus = new StreamStatusStore();
