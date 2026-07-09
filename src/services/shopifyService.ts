// Changes: Client for POST /api/shopify-publish — create Shopify product with uploaded images.
import { ExportItem } from '../utils/csvExport';
import { apiFetch } from './authClient';

export type ShopifyPublishResponse = {
  productId: number;
  handle: string;
  adminUrl: string;
  storefrontUrl: string;
  imageUrls: string[];
  status: string;
};

export async function publishToShopify(
  item: ExportItem,
  status: 'draft' | 'active' = 'draft'
): Promise<ShopifyPublishResponse> {
  return apiFetch<ShopifyPublishResponse>('/api/shopify-publish', {
    product: item.product,
    variants: item.variants,
    status,
  });
}
