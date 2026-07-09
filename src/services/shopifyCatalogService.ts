// Changes: Client for Shopify Product Optimizer — list, get, update, replace images.
import { apiFetch } from './authClient';

export type CatalogStatus = 'all' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export type ShopifyCatalogListItem = {
  id: number;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  imageUrl: string;
  updatedAt: string;
  adminUrl: string;
};

export type ShopifyCatalogProduct = ShopifyCatalogListItem & {
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  imageUrls: string[];
  variants: Array<{
    id: number;
    sku: string;
    price: string;
    compareAtPrice: string;
    option1: string;
    option2: string;
    option3: string;
  }>;
};

export type ListProductsResponse = {
  products: ShopifyCatalogListItem[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

export type ProductUpdatePayload = {
  productId: number;
  title?: string;
  handle?: string;
  body_html?: string;
  tags?: string[];
  vendor?: string;
  product_type?: string;
  status?: 'active' | 'draft' | 'archived';
  seo_title?: string;
  seo_description?: string;
};

export async function listShopifyProducts(params: {
  search?: string;
  status?: CatalogStatus;
  cursor?: string;
  limit?: number;
}): Promise<ListProductsResponse> {
  return apiFetch('/api/shopify-products', params);
}

export async function getShopifyProduct(productId: number): Promise<{ product: ShopifyCatalogProduct }> {
  return apiFetch('/api/shopify-product-get', { productId });
}

export async function updateShopifyProduct(payload: ProductUpdatePayload): Promise<{ productId: number; adminUrl: string }> {
  return apiFetch('/api/shopify-product-update', payload);
}

export type ReplaceImagesPayload = {
  productId: number;
  images: Array<{ src: string; filename: string; position: number }>;
};

export async function replaceShopifyProductImages(
  payload: ReplaceImagesPayload
): Promise<{ productId: number; imageUrls: string[]; count: number }> {
  return apiFetch('/api/shopify-product-images', payload);
}
