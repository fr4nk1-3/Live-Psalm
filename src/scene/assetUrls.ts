import { MediaVaultService } from '../services/mediaVault';

/**
 * Asset id to object URL. Scene documents store the asset id, never a blob URL,
 * so a scene survives a reload and still finds its image or video.
 */

let cache: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

export function loadAssetUrls(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = MediaVaultService.loadAllVaultMedia()
      .then(assets => {
        const map: Record<string, string> = {};
        assets.forEach(asset => {
          map[asset.id] = asset.url;
        });
        cache = map;
        return map;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return pending;
}

export function getAssetUrl(assetId?: string): string {
  if (!assetId || !cache) return '';
  return cache[assetId] || '';
}

export function resolveSource(src: string | undefined, assetId: string | undefined, assets?: Record<string, string>): string {
  if (src) return src;
  if (!assetId) return '';
  return assets?.[assetId] || getAssetUrl(assetId);
}
