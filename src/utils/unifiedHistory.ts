// Changes: History meta in localStorage + pixels in IndexedDB — prevents lost images on tab switch / quota.
import { GeneratedImage } from '../types';
import { ExportItem } from './csvExport';
import { buildImageFilenameMap } from './imageNaming';
import {
  putImageBlob,
  getImageBlob,
  deleteImageBlob,
  clearImageBlobs,
} from './imageBlobDb';

export type SkuLine = 'pod' | 'bulk';

export interface StoredImage extends GeneratedImage {
  skuLine?: SkuLine;
  linkedHandle?: string;
  /** SKU-linked filename e.g. bullet-bandit-01.png */
  fileName?: string;
}

export interface StoredProduct {
  id: string;
  createdAt: number;
  skuLine: SkuLine;
  sourceImageIds: string[];
  exportItem: ExportItem;
}

export interface UnifiedHistory {
  version: 1;
  images: StoredImage[];
  products: StoredProduct[];
}

const STORAGE_KEY = 'ecs_unified_history';
const LEGACY_PRODUCT_KEY = 'productHistory';

function emptyHistory(): UnifiedHistory {
  return { version: 1, images: [], products: [] };
}

function skuLineFromPriceMode(priceMode: string): SkuLine {
  return priceMode === 'pod-default' ? 'pod' : 'bulk';
}

/** Strip huge data URLs from LS payload — pixels live in IndexedDB. */
function toMeta(image: StoredImage): StoredImage {
  if (image.url?.startsWith('data:')) {
    return { ...image, url: '' };
  }
  return image;
}

function migrateLegacyProducts(): StoredProduct[] {
  try {
    const raw = localStorage.getItem(LEGACY_PRODUCT_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as ExportItem[];
    if (!Array.isArray(items)) return [];

    return items.map((exportItem) => ({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      skuLine: exportItem.variants.some((v) => v.sku.startsWith('FIG-POD-'))
        ? 'pod'
        : 'bulk',
      sourceImageIds: [],
      exportItem,
    }));
  } catch {
    return [];
  }
}

export function loadUnifiedHistory(): UnifiedHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UnifiedHistory;
      if (parsed?.version === 1 && Array.isArray(parsed.images) && Array.isArray(parsed.products)) {
        return parsed;
      }
    }
  } catch {
    /* fall through to migration */
  }

  const migrated = migrateLegacyProducts();
  const history: UnifiedHistory = { version: 1, images: [], products: migrated };
  if (migrated.length > 0) {
    saveUnifiedHistory(history);
    localStorage.removeItem(LEGACY_PRODUCT_KEY);
  }
  return history;
}

export function saveUnifiedHistory(history: UnifiedHistory): void {
  const slim: UnifiedHistory = {
    ...history,
    images: history.images.map(toMeta),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    return;
  } catch (e) {
    // Quota: drop oldest metadata until write succeeds (pixels remain in IDB).
    let images = [...slim.images];
    while (images.length > 0) {
      images = images.slice(0, Math.max(0, images.length - 5));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...slim, images }));
        console.warn(`History quota: kept newest ${images.length} image meta entries.`);
        return;
      } catch {
        /* continue pruning */
      }
    }
    console.error('Failed to save unified history', e);
  }
}

export function getStoredImages(): StoredImage[] {
  return loadUnifiedHistory().images;
}

/** Sync write: put pixels in IDB, meta in localStorage. */
export function setStoredImages(images: StoredImage[]): void {
  for (const img of images) {
    if (img.url?.startsWith('data:')) {
      void putImageBlob(img.id, img.url);
    }
  }
  const history = loadUnifiedHistory();
  history.images = images.map(toMeta);
  saveUnifiedHistory(history);
}

export function upsertStoredImage(image: StoredImage): void {
  if (image.url?.startsWith('data:')) {
    void putImageBlob(image.id, image.url);
  }
  const history = loadUnifiedHistory();
  const meta = toMeta(image);
  const idx = history.images.findIndex((img) => img.id === image.id);
  if (idx >= 0) history.images[idx] = { ...history.images[idx], ...meta };
  else history.images.unshift(meta);
  saveUnifiedHistory(history);
}

/** Awaitable persist — use right after each successful generation. */
export async function persistGeneratedImage(image: StoredImage): Promise<void> {
  if (image.url?.startsWith('data:')) {
    try {
      await putImageBlob(image.id, image.url);
    } catch (e) {
      console.error('IndexedDB put failed', e);
    }
  }
  upsertStoredImage(image);
}

/** Restore data URLs from IndexedDB (and migrate legacy in-LS data URLs). */
export async function hydrateStoredImages(images: StoredImage[]): Promise<StoredImage[]> {
  const out: StoredImage[] = [];
  for (const img of images) {
    if (img.url?.startsWith('data:')) {
      void putImageBlob(img.id, img.url).then(() => upsertStoredImage(toMeta(img)));
      out.push(img);
      continue;
    }
    if (img.url && !img.url.startsWith('data:')) {
      out.push(img);
      continue;
    }
    try {
      const blob = await getImageBlob(img.id);
      if (blob) out.push({ ...img, url: blob });
    } catch (e) {
      console.warn('Failed to hydrate image', img.id, e);
    }
  }
  return out;
}

/** Union by id — never drop in-memory images when syncing from storage. */
export function mergeImagesById(primary: StoredImage[], secondary: StoredImage[]): StoredImage[] {
  const map = new Map<string, StoredImage>();
  for (const img of secondary) map.set(img.id, img);
  for (const img of primary) {
    const existing = map.get(img.id);
    if (!existing || (!existing.url && img.url) || img.timestamp >= (existing.timestamp || 0)) {
      map.set(img.id, img);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function removeStoredImage(id: string): void {
  const history = loadUnifiedHistory();
  history.images = history.images.filter((img) => img.id !== id);
  saveUnifiedHistory(history);
  void deleteImageBlob(id);
}

export function clearStoredImages(): void {
  const history = loadUnifiedHistory();
  history.images = [];
  saveUnifiedHistory(history);
  void clearImageBlobs();
}

export function getStoredProducts(): StoredProduct[] {
  return loadUnifiedHistory().products;
}

export function addStoredProduct(entry: StoredProduct): void {
  const history = loadUnifiedHistory();
  history.products.push(entry);
  saveUnifiedHistory(history);
}

export function setStoredProducts(products: StoredProduct[]): void {
  const history = loadUnifiedHistory();
  history.products = products;
  saveUnifiedHistory(history);
}

export function removeStoredProduct(id: string): void {
  const history = loadUnifiedHistory();
  history.products = history.products.filter((p) => p.id !== id);
  saveUnifiedHistory(history);
}

export function clearStoredProducts(): void {
  const history = loadUnifiedHistory();
  history.products = [];
  saveUnifiedHistory(history);
}

/** After SKU generation — link studio images to product handle + filenames. */
export function linkImagesToProduct(
  sourceImageIds: string[],
  handle: string,
  skuLine: SkuLine
): void {
  if (!handle.trim() || sourceImageIds.length === 0) return;

  const history = loadUnifiedHistory();
  const nameMap = buildImageFilenameMap(handle, sourceImageIds);

  history.images = history.images.map((img) => {
    const pos = sourceImageIds.indexOf(img.id);
    if (pos === -1) return img;
    return {
      ...img,
      skuLine,
      linkedHandle: handle,
      fileName: nameMap[img.id],
    };
  });

  saveUnifiedHistory(history);
}

export function storedProductFromExportItem(
  exportItem: ExportItem,
  sourceImageIds: string[],
  priceMode: string
): StoredProduct {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    skuLine: skuLineFromPriceMode(priceMode),
    sourceImageIds,
    exportItem,
  };
}

/** ExportItem[] for CSV / publish (backward compatible). */
export function exportItemsFromHistory(): ExportItem[] {
  return getStoredProducts().map((p) => p.exportItem);
}
