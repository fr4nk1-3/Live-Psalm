import { useEffect, useState } from 'react';

/**
 * Uploaded fonts.
 *
 * The file bytes live in IndexedDB and are registered with the FontFace API at
 * startup, so both DOM text and the scene canvas can use them.
 */

export interface UploadedFont {
  id: string;
  family: string;
  label: string;
}

export const SYSTEM_FONTS = [
  'Inter',
  'Segoe UI',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Palatino Linotype',
  'Courier New',
  'Impact'
];

const DB_NAME = 'live_psalms_fonts';
const STORE = 'fonts';
const VERSION = 1;

interface FontRecord extends UploadedFont {
  data: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll(): Promise<FontRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as FontRecord[]) || []);
    request.onerror = () => reject(request.error);
  });
}

async function write(record: FontRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function removeRecord(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function register(record: FontRecord): Promise<void> {
  try {
    const face = new FontFace(record.family, record.data);
    await face.load();
    document.fonts.add(face);
    await document.fonts.load(`16px "${record.family}"`);
  } catch {
    /* a malformed font should not break the app */
  }
}

const listeners = new Set<(fonts: UploadedFont[]) => void>();
let registered: UploadedFont[] | null = null;
let loading: Promise<UploadedFont[]> | null = null;

export function loadFontLibrary(): Promise<UploadedFont[]> {
  if (registered) return Promise.resolve(registered);
  if (!loading) {
    loading = readAll()
      .then(async records => {
        for (const record of records) await register(record);
        registered = records.map(({ id, family, label }) => ({ id, family, label }));
        return registered;
      })
      .catch(() => {
        registered = [];
        return registered;
      });
  }
  return loading;
}

export async function uploadFontFile(file: File): Promise<UploadedFont | null> {
  try {
    const buffer = await file.arrayBuffer();
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'Uploaded font';
    const family = `${base}`;
    const record: FontRecord = {
      id: `font-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      family,
      label: base,
      data: buffer
    };
    await write(record);
    await register(record);
    const entry = { id: record.id, family, label: base };
    registered = [...(registered || []), entry];
    listeners.forEach(listener => listener(registered as UploadedFont[]));
    return entry;
  } catch {
    return null;
  }
}

export async function removeFont(id: string): Promise<void> {
  await removeRecord(id);
  if (!registered) return;
  registered = registered.filter(font => font.id !== id);
  listeners.forEach(listener => listener(registered as UploadedFont[]));
}

export function useFontLibrary() {
  const [fonts, setFonts] = useState<UploadedFont[]>(() => registered || []);
  useEffect(() => {
    let active = true;
    void loadFontLibrary().then(list => {
      if (active) setFonts(list);
    });
    const listener = (list: UploadedFont[]) => setFonts(list);
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);
  return { fonts, uploadFontFile, removeFont };
}
