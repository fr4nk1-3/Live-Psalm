/**
 * Shared capture streams.
 *
 * Several scene canvases can show the same camera or display at once (preview,
 * broadcast, programme). Opening a device per canvas fails on most hardware, so
 * the stream is created once and reused until the last canvas releases it.
 */

interface Entry {
  stream: MediaStream;
  refs: number;
}

const entries = new Map<string, Entry>();

export async function acquireStream(key: string, factory: () => Promise<MediaStream>): Promise<MediaStream> {
  const existing = entries.get(key);
  if (existing) {
    existing.refs += 1;
    return existing.stream;
  }
  const stream = await factory();
  entries.set(key, { stream, refs: 1 });
  return stream;
}

export function releaseStream(key: string) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.stream.getTracks().forEach(track => track.stop());
  entries.delete(key);
}
