// Changes: Fetch single Shopify product for Product Optimizer editor.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import { getShopifyProduct } from './_utils/shopifyCatalog';

type Body = { productId?: number };

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

  try {
    const product = await getShopifyProduct(env, productId);
    return jsonResponse({ product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
