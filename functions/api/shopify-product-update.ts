// Changes: Update Shopify product listing from Product Optimizer.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import { updateShopifyProduct, ShopifyProductUpdateInput } from './_utils/shopifyCatalog';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: ShopifyProductUpdateInput;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!body.productId) {
    return jsonResponse({ error: 'Missing productId.' }, 400);
  }

  try {
    const result = await updateShopifyProduct(env, body);
    return jsonResponse(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
