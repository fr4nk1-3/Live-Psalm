/**
 * MediaVault — IndexedDB storage for large uploaded video & image files.
 * Prevents localStorage 5MB QuotaExceededError when operators upload HD/4K MP4 videos,
 * and provides persistent local storage + instant Blob URLs across reloads.
 */
import { MediaAsset } from '../types/presentation';

const DB_NAME = 'live_psalms_media_vault_v1';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

interface StoredMediaRecord {
  id: string;
  name: string;
  type: MediaAsset['type'];
  category: MediaAsset['category'];
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export class MediaVaultService {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static urlCache = new Map<string, string>();

  private static openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  /** Save a File/Blob via local server (/api/media/upload) or IndexedDB fallback */
  public static async saveMediaFile(
    file: File,
    usageMode: 'background' | 'foreground' = 'background'
  ): Promise<MediaAsset> {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name);
    const id = `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const category: MediaAsset['category'] = isVideo
      ? usageMode === 'background'
        ? 'Backgrounds'
        : 'Videos'
      : 'Backgrounds';

    // 1. Try uploading directly to local disk via /api/media/upload so all output windows & OBS can stream it via HTTP Range
    try {
      const res = await fetch(`/api/media/upload?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          return {
            id,
            name: cleanName,
            type: isVideo ? 'video' : 'image',
            url: data.url,
            category
          };
        }
      }
    } catch (e) {}

    // 2. Fallback: IndexedDB + Object URL
    const objectUrl = URL.createObjectURL(file);
    this.urlCache.set(id, objectUrl);

    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: StoredMediaRecord = {
          id,
          name: cleanName,
          type: isVideo ? 'video' : 'image',
          category,
          mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          blob: file,
          createdAt: Date.now()
        };
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}

    return {
      id,
      name: cleanName,
      type: isVideo ? 'video' : 'image',
      url: objectUrl,
      category
    };
  }

  /** Load all persisted media files from IndexedDB and create fresh Object URLs */
  public static async loadAllVaultMedia(): Promise<MediaAsset[]> {
    try {
      const db = await this.openDb();
      const records = await new Promise<StoredMediaRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      return records.map(rec => {
        let url = this.urlCache.get(rec.id);
        if (!url && rec.blob) {
          url = URL.createObjectURL(rec.blob);
          this.urlCache.set(rec.id, url);
        }
        return {
          id: rec.id,
          name: rec.name,
          type: rec.type,
          url: url || '',
          category: rec.category
        };
      });
    } catch (e) {
      return [];
    }
  }

  /** Delete a media asset from IndexedDB */
  public static async deleteVaultMedia(id: string): Promise<void> {
    const cachedUrl = this.urlCache.get(id);
    if (cachedUrl) {
      try {
        URL.revokeObjectURL(cachedUrl);
      } catch (e) {}
      this.urlCache.delete(id);
    }
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}
  }
}
