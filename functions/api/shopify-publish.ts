// Changes: Publish SKU listing to Shopify — uploads images and creates product via Admin API.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import { publishProductToShopify, ShopifyPublishRequest } from './_utils/shopify';

type Body = ShopifyPublishRequest;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body.product || typeof body.product.title !== 'string') {
    return jsonResponse({ error: 'Missing product.title.' }, 400);
  }
  if (!Array.isArray(body.variants)) {
    return jsonResponse({ error: 'Missing variants array.' }, 400);
  }

  try {
    const result = await publishProductToShopify(env, {
      product: body.product,
      variants: body.variants,
      status: body.status === 'active' ? 'active' : 'draft',
    });
    return jsonResponse(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
