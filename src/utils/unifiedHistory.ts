// Changes: Shared history for Image Studio images + SKU products (single localStorage, survives tab switch & refresh).
import { GeneratedImage } from '../types';
import { ExportItem } from './csvExport';
import { buildImageFilenameMap } from './imageNaming';

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save unified history', e);
  }
}

export function getStoredImages(): StoredImage[] {
  return loadUnifiedHistory().images;
}

export function setStoredImages(images: StoredImage[]): void {
  const history = loadUnifiedHistory();
  history.images = images;
  saveUnifiedHistory(history);
}

export function upsertStoredImage(image: StoredImage): void {
  const history = loadUnifiedHistory();
  const idx = history.images.findIndex((img) => img.id === image.id);
  if (idx >= 0) history.images[idx] = { ...history.images[idx], ...image };
  else history.images.unshift(image);
  saveUnifiedHistory(history);
}

export function removeStoredImage(id: string): void {
  const history = loadUnifiedHistory();
  history.images = history.images.filter((img) => img.id !== id);
  saveUnifiedHistory(history);
}

export function clearStoredImages(): void {
  const history = loadUnifiedHistory();
  history.images = [];
  saveUnifiedHistory(history);
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
