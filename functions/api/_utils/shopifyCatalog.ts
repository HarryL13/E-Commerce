// Changes: Shopify catalog — GraphQL search/list, get product, update product for Product Optimizer.
import { Env } from './auth';

const API_VERSION = '2024-01';

export type ShopifyCatalogStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'all';

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

function resolveShopDomain(env: Env): string {
  const raw = env.SHOPIFY_STORE_NAME?.trim();
  if (!raw) throw new Error('SHOPIFY_STORE_NAME is not set.');
  return raw.includes('.myshopify.com') ? raw : `${raw}.myshopify.com`;
}

function requireShopifyToken(env: Env): string {
  const token = env.SHOPIFY_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('SHOPIFY_ACCESS_TOKEN is not set.');
  return token;
}

function adminUrl(env: Env, productId: number): string {
  const shop = resolveShopDomain(env);
  const slug = shop.replace('.myshopify.com', '');
  return `https://admin.shopify.com/store/${slug}/products/${productId}`;
}

async function shopifyGraphql(
  env: Env,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<any> {
  const shop = resolveShopDomain(env);
  const token = requireShopifyToken(env);
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const raw = await response.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`Shopify GraphQL parse error: ${raw.slice(0, 300)}`);
  }

  if (!response.ok || json?.errors?.length) {
    const message = json?.errors?.[0]?.message || raw.slice(0, 400) || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json?.data;
}

function buildSearchQuery(search?: string, status?: ShopifyCatalogStatus): string {
  const parts: string[] = [];
  const q = search?.trim();
  if (q) {
    parts.push(`title:*${q.replace(/"/g, '')}*`);
  }
  if (status && status !== 'all') {
    parts.push(`status:${status}`);
  }
  return parts.join(' ');
}

function mapListNode(env: Env, node: any): ShopifyCatalogListItem {
  const id = Number(node.legacyResourceId || node.id?.split('/').pop());
  return {
    id,
    title: node.title || '',
    handle: node.handle || '',
    status: (node.status || '').toLowerCase(),
    vendor: node.vendor || '',
    productType: node.productType || '',
    tags: Array.isArray(node.tags) ? node.tags : [],
    imageUrl: node.featuredImage?.url || '',
    updatedAt: node.updatedAt || '',
    adminUrl: adminUrl(env, id),
  };
}

const PRODUCT_LIST_QUERY = `
  query ProductList($query: String, $first: Int!, $after: String) {
    products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          legacyResourceId
          title
          handle
          status
          vendor
          productType
          tags
          updatedAt
          featuredImage { url }
        }
      }
    }
  }
`;

const PRODUCT_DETAIL_QUERY = `
  query ProductDetail($id: ID!) {
    product(id: $id) {
      id
      legacyResourceId
      title
      handle
      status
      vendor
      productType
      tags
      updatedAt
      descriptionHtml
      seo { title description }
      featuredImage { url }
      images(first: 10) { edges { node { url } } }
      variants(first: 50) {
        edges {
          node {
            id
            legacyResourceId
            sku
            price
            compareAtPrice
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

export async function listShopifyProducts(
  env: Env,
  options: { search?: string; status?: ShopifyCatalogStatus; limit?: number; cursor?: string } = {}
): Promise<{ products: ShopifyCatalogListItem[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> {
  const first = Math.min(Math.max(options.limit ?? 30, 1), 50);
  const query = buildSearchQuery(options.search, options.status);

  const data = await shopifyGraphql(env, PRODUCT_LIST_QUERY, {
    query: query || null,
    first,
    after: options.cursor || null,
  });

  const connection = data?.products;
  const products = (connection?.edges ?? []).map((edge: any) => mapListNode(env, edge.node));

  return {
    products,
    pageInfo: {
      hasNextPage: Boolean(connection?.pageInfo?.hasNextPage),
      endCursor: connection?.pageInfo?.endCursor ?? null,
    },
  };
}

export async function getShopifyProduct(env: Env, productId: number): Promise<ShopifyCatalogProduct> {
  const gid = `gid://shopify/Product/${productId}`;
  const data = await shopifyGraphql(env, PRODUCT_DETAIL_QUERY, { id: gid });
  const node = data?.product;
  if (!node) throw new Error(`Product ${productId} not found.`);

  const base = mapListNode(env, node);
  const variants = (node.variants?.edges ?? []).map((edge: any) => {
    const v = edge.node;
    const opts = v.selectedOptions ?? [];
    const opt = (name: string) => opts.find((o: any) => o.name === name)?.value || '';
    return {
      id: Number(v.legacyResourceId || v.id?.split('/').pop()),
      sku: v.sku || '',
      price: v.price || '0.00',
      compareAtPrice: v.compareAtPrice || '',
      option1: opt('Size') || opt('Title') || opts[0]?.value || '',
      option2: opts[1]?.value || '',
      option3: opts[2]?.value || '',
    };
  });

  return {
    ...base,
    descriptionHtml: node.descriptionHtml || '',
    seoTitle: node.seo?.title || '',
    seoDescription: node.seo?.description || '',
    imageUrls: (node.images?.edges ?? []).map((e: any) => e.node?.url).filter(Boolean),
    variants,
  };
}

export type ShopifyProductUpdateInput = {
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

async function shopifyRestFetch(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; json: any; raw: string }> {
  const shop = resolveShopDomain(env);
  const token = requireShopifyToken(env);
  const response = await fetch(`https://${shop}${path}`, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, json, raw };
}

export async function updateShopifyProduct(
  env: Env,
  input: ShopifyProductUpdateInput
): Promise<{ productId: number; adminUrl: string }> {
  const { productId } = input;
  if (!productId) throw new Error('productId is required.');

  const payload: Record<string, unknown> = { id: productId };
  if (input.title !== undefined) payload.title = input.title;
  if (input.handle !== undefined) payload.handle = input.handle;
  if (input.body_html !== undefined) payload.body_html = input.body_html;
  if (input.vendor !== undefined) payload.vendor = input.vendor;
  if (input.product_type !== undefined) payload.product_type = input.product_type;
  if (input.status !== undefined) payload.status = input.status;
  if (input.tags !== undefined) {
    payload.tags = Array.isArray(input.tags) ? input.tags.join(', ') : input.tags;
  }
  if (input.seo_title !== undefined) {
    payload.metafields_global_title_tag = input.seo_title;
  }
  if (input.seo_description !== undefined) {
    payload.metafields_global_description_tag = input.seo_description;
  }

  const result = await shopifyRestFetch(
    env,
    `/admin/api/${API_VERSION}/products/${productId}.json`,
    {
      method: 'PUT',
      body: JSON.stringify({ product: payload }),
    }
  );

  if (!result.ok) {
    const message =
      result.json?.errors ||
      result.json?.error ||
      result.raw.slice(0, 500) ||
      'Shopify update failed';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return { productId, adminUrl: adminUrl(env, productId) };
}

function parseImageAttachment(src: string, filename: string): { attachment: string; filename: string } | null {
  const trimmed = src.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    const ext = match[1].includes('jpeg') || match[1].includes('jpg') ? 'jpg' : 'png';
    return {
      attachment: match[2].replace(/\s/g, ''),
      filename: filename.endsWith(`.${ext}`) ? filename : `${filename.replace(/\.[^.]+$/, '')}.${ext}`,
    };
  }
  return null;
}

export type ReplaceProductImageInput = {
  src: string;
  filename: string;
  position: number;
};

/** Replace all product images with new uploads (base64 data URLs). */
export async function replaceProductImages(
  env: Env,
  productId: number,
  images: ReplaceProductImageInput[]
): Promise<string[]> {
  if (images.length === 0) throw new Error('No images to upload.');

  const listResult = await shopifyRestFetch(
    env,
    `/admin/api/${API_VERSION}/products/${productId}/images.json`
  );
  if (!listResult.ok) {
    throw new Error(`Failed to list images: ${listResult.raw.slice(0, 300)}`);
  }

  const existing: Array<{ id: number }> = listResult.json?.images ?? [];
  for (const img of existing) {
    await shopifyRestFetch(
      env,
      `/admin/api/${API_VERSION}/products/${productId}/images/${img.id}.json`,
      { method: 'DELETE' }
    );
  }

  const uploadedUrls: string[] = [];
  for (const img of images) {
    const parsed = parseImageAttachment(img.src, img.filename);
    if (!parsed) {
      throw new Error(`Image at position ${img.position} is not a valid base64 data URL.`);
    }
    const upload = await shopifyRestFetch(
      env,
      `/admin/api/${API_VERSION}/products/${productId}/images.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          image: {
            attachment: parsed.attachment,
            filename: parsed.filename,
            position: img.position,
          },
        }),
      }
    );
    if (!upload.ok) {
      const message = upload.json?.errors || upload.raw.slice(0, 300);
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }
    const src = upload.json?.image?.src;
    if (src) uploadedUrls.push(src);
  }

  return uploadedUrls;
}
