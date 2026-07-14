// Changes: withRetry supports onRetry callback for auto-regenerate progress UI.
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/** General batch/gen concurrency. */
export const IMAGE_GEN_POOL_SIZE = 3;

/** Multi-View is 4 angles — keep concurrency low to avoid Lumina rate / CF flakes. */
export const MULTIVIEW_POOL_SIZE = 2;

/** Default: 1 initial try + 2 retries = 3 generations max per call. */
export const IMAGE_GEN_RETRIES = 2;

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    retries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, maxAttempts: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const retries = opts.retries ?? IMAGE_GEN_RETRIES;
  const delayMs = opts.delayMs ?? 1500;
  const maxAttempts = retries + 1;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        opts.onRetry?.(attempt + 1, maxAttempts, err);
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastErr;
}
