// Changes: Replace Shopify product images from Image Studio handoff (base64 upload).
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import { replaceProductImages, ReplaceProductImageInput } from './_utils/shopifyCatalog';

type Body = {
  productId?: number;
  images?: ReplaceProductImageInput[];
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const productId = Number(body.productId);
  if (!productId || Number.isNaN(productId)) {
    return jsonResponse({ error: 'Missing or invalid productId.' }, 400);
  }
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return jsonResponse({ error: 'Missing images array.' }, 400);
  }

  try {
    const imageUrls = await replaceProductImages(env, productId, body.images);
    return jsonResponse({ productId, imageUrls, count: imageUrls.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
