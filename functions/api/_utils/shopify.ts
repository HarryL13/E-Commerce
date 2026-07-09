// Changes: Shopify publish — default variant inventory qty 1000; SKU-linked image filenames.
import { Env } from './auth';

const API_VERSION = '2024-01';
const DEFAULT_VARIANT_INVENTORY_QTY = 1000;

export type ShopifyProductInput = {
  title: string;
  handle: string;
  description_html: string;
  vendor: string;
  category: string;
  type: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  mainImageSrc: string;
  galleryImageSrcs?: string[];
  imageFileNames?: string[];
};

export type ShopifyVariantInput = {
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string;
  option3Value: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  imageSrc: string;
};

export type ShopifyPublishRequest = {
  product: ShopifyProductInput;
  variants: ShopifyVariantInput[];
  status?: 'draft' | 'active';
};

export type ShopifyPublishResult = {
  productId: number;
  handle: string;
  adminUrl: string;
  storefrontUrl: string;
  imageUrls: string[];
  status: string;
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

function parseImageAttachment(src: string, index: number): { attachment: string; filename: string } | null {
  const trimmed = src.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    const ext = match[1].includes('jpeg') || match[1].includes('jpg') ? 'jpg' : 'png';
    return {
      attachment: match[2].replace(/\s/g, ''),
      filename: `product-${index + 1}.${ext}`,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return {
    attachment: trimmed.replace(/\s/g, ''),
    filename: `product-${index + 1}.png`,
  };
}

function collectProductImages(product: ShopifyProductInput): string[] {
  const images = [
    product.mainImageSrc,
    ...(product.galleryImageSrcs ?? []),
  ].filter(Boolean);
  return images.slice(0, 10);
}

function buildShopifyOptions(variants: ShopifyVariantInput[]): Array<{ name: string; values: string[] }> {
  const options: Array<{ name: string; values: string[] }> = [];

  for (let i = 1; i <= 3; i++) {
    const nameKey = `option${i}Name` as keyof ShopifyVariantInput;
    const valueKey = `option${i}Value` as keyof ShopifyVariantInput;
    const name = variants.find((v) => v[nameKey])?.[nameKey];
    if (typeof name !== 'string' || !name.trim()) continue;

    const values = Array.from(
      new Set(
        variants
          .map((v) => v[valueKey])
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      )
    );
    if (values.length > 0) {
      options.push({ name: name.trim(), values });
    }
  }

  if (options.length === 0 && variants.length > 0) {
    options.push({ name: 'Title', values: ['Default Title'] });
  }

  return options;
}

function mapVariantsToShopify(variants: ShopifyVariantInput[]) {
  return variants.map((variant) => {
    const payload: Record<string, unknown> = {
      sku: variant.sku || undefined,
      price: variant.price || '0.00',
      requires_shipping: true,
      taxable: false,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      inventory_quantity: DEFAULT_VARIANT_INVENTORY_QTY,
    };

    if (variant.compareAtPrice?.trim()) {
      payload.compare_at_price = variant.compareAtPrice;
    }
    if (variant.option1Value?.trim()) payload.option1 = variant.option1Value;
    if (variant.option2Value?.trim()) payload.option2 = variant.option2Value;
    if (variant.option3Value?.trim()) payload.option3 = variant.option3Value;

    return payload;
  });
}

function buildProductPayload(body: ShopifyPublishRequest) {
  const { product, variants } = body;
  const status = body.status === 'active' ? 'active' : 'draft';
  const imageSources = collectProductImages(product);
  const customNames = product.imageFileNames ?? [];

  const images = imageSources
    .map((src, index) => {
      const parsed = parseImageAttachment(src, index);
      if (!parsed) return null;
      const customName = customNames[index]?.trim();
      return {
        attachment: parsed.attachment,
        filename: customName || parsed.filename,
        position: index + 1,
      };
    })
    .filter(Boolean);

  if (images.length === 0) {
    throw new Error('No uploadable product images found. Use generated images or base64 data URLs.');
  }

  const shopifyVariants =
    variants.length > 0
      ? mapVariantsToShopify(variants)
      : [
          {
            option1: 'Default Title',
            price: '0.00',
            requires_shipping: true,
            taxable: false,
            inventory_management: 'shopify',
            inventory_policy: 'deny',
            inventory_quantity: DEFAULT_VARIANT_INVENTORY_QTY,
          },
        ];

  const tagsRaw = product.tags as string[] | string | undefined;
  const tagsList = Array.isArray(tagsRaw)
    ? tagsRaw
    : typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  const payload: Record<string, unknown> = {
    title: product.title,
    body_html: product.description_html,
    vendor: product.vendor || undefined,
    product_type: product.type || undefined,
    tags: tagsList.length ? tagsList.join(', ') : undefined,
    handle: product.handle || undefined,
    status,
    variants: shopifyVariants,
    options: buildShopifyOptions(variants),
    images,
  };

  if (product.seo_title?.trim()) {
    payload.metafields_global_title_tag = product.seo_title.trim();
  }
  if (product.seo_description?.trim()) {
    payload.metafields_global_description_tag = product.seo_description.trim();
  }

  return payload;
}

async function shopifyAdminFetch(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; json: any; raw: string }> {
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

  return { ok: response.ok, status: response.status, json, raw };
}

export async function publishProductToShopify(
  env: Env,
  body: ShopifyPublishRequest
): Promise<ShopifyPublishResult> {
  if (!body.product?.title?.trim()) {
    throw new Error('Product title is required.');
  }

  const productPayload = buildProductPayload(body);
  const result = await shopifyAdminFetch(env, `/admin/api/${API_VERSION}/products.json`, {
    method: 'POST',
    body: JSON.stringify({ product: productPayload }),
  });

  if (!result.ok) {
    const message =
      result.json?.errors ||
      result.json?.error ||
      result.raw.slice(0, 500) ||
      `Shopify API ${result.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  const created = result.json?.product;
  if (!created?.id) {
    throw new Error('Shopify did not return a product id.');
  }

  const shop = resolveShopDomain(env);
  const storeSlug = shop.replace('.myshopify.com', '');
  const imageUrls = Array.isArray(created.images)
    ? created.images.map((img: { src?: string }) => img.src).filter(Boolean)
    : [];

  return {
    productId: created.id,
    handle: created.handle,
    adminUrl: `https://admin.shopify.com/store/${storeSlug}/products/${created.id}`,
    storefrontUrl: `https://${shop}/products/${created.handle}`,
    imageUrls,
    status: created.status,
  };
}
