// Changes: List/search Shopify products by title for Product Optimizer.
import { jsonResponse, requireAuth, methodNotAllowed, Env } from './_utils/auth';
import { listShopifyProducts, ShopifyCatalogStatus } from './_utils/shopifyCatalog';

type Body = {
  search?: string;
  status?: ShopifyCatalogStatus;
  cursor?: string;
  limit?: number;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const status =
    body.status === 'ACTIVE' || body.status === 'DRAFT' || body.status === 'ARCHIVED'
      ? body.status
      : 'all';

  try {
    const result = await listShopifyProducts(env, {
      search: typeof body.search === 'string' ? body.search : undefined,
      status,
      cursor: typeof body.cursor === 'string' ? body.cursor : undefined,
      limit: typeof body.limit === 'number' ? body.limit : 30,
    });
    return jsonResponse(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () => methodNotAllowed();
