/**
 * Shared capture streams.
 *
 * Several scene canvases and monitors can show the same camera or display at once
 * (preview, broadcast, programme, audience). Opening a hardware device per canvas
 * fails or causes black frames on V4L2/DirectShow/AVFoundation, so each stream is
 * created once, deduplicated while in-flight, and kept alive across quick scene
 * switches with a short grace timer.
 */

interface Entry {
  stream: MediaStream;
  refs: number;
  releaseTimer?: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<MediaStream>>();

function isStreamLive(stream: MediaStream): boolean {
  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.some(track => track.readyState === 'live');
}

export async function acquireStream(key: string, factory: () => Promise<MediaStream>): Promise<MediaStream> {
  const existing = entries.get(key);
  if (existing) {
    if (existing.releaseTimer) {
      clearTimeout(existing.releaseTimer);
      existing.releaseTimer = null;
    }
    if (isStreamLive(existing.stream)) {
      existing.refs += 1;
      return existing.stream;
    }
    // Existing stream died; clean it up and re-open
    existing.stream.getTracks().forEach(track => track.stop());
    entries.delete(key);
  }

  const inflight = pending.get(key);
  if (inflight) {
    const stream = await inflight;
    const entry = entries.get(key);
    if (entry) {
      if (entry.releaseTimer) {
        clearTimeout(entry.releaseTimer);
        entry.releaseTimer = null;
      }
      entry.refs += 1;
    } else {
      entries.set(key, { stream, refs: 1, releaseTimer: null });
    }
    return stream;
  }

  const promise = (async () => {
    try {
      const stream = await factory();
      entries.set(key, { stream, refs: 1, releaseTimer: null });
      return stream;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, promise);
  return promise;
}

export function releaseStream(key: string) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;

  if (entry.releaseTimer) {
    clearTimeout(entry.releaseTimer);
  }
  // Keep the hardware camera open briefly so switching scenes or monitors reuses it without black frames
  entry.releaseTimer = setTimeout(() => {
    const current = entries.get(key);
    if (!current || current.refs > 0) return;
    current.stream.getTracks().forEach(track => track.stop());
    entries.delete(key);
  }, 1500);
}
