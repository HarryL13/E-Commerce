// Changes: Optimizer — After selecting a product, Replace Images opens Shared History picker.
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Save,
  AlertCircle,
  CheckCircle2,
  PackageSearch,
  Loader2,
  ChevronRight,
  Sparkles,
  X,
  ImageIcon,
  Images,
} from 'lucide-react';
import { DescriptionEditor } from './components/DescriptionEditor';
import { HistoryImagePicker } from './components/HistoryImagePicker';
import {
  listShopifyProducts,
  getShopifyProduct,
  updateShopifyProduct,
  replaceShopifyProductImages,
  ShopifyCatalogListItem,
  ShopifyCatalogProduct,
  CatalogStatus,
} from './services/shopifyCatalogService';
import {
  OptimizerHandoff,
  PendingStudioImage,
  filenamesForProductHandle,
} from './utils/optimizerHandoff';
import { linkImagesToProduct } from './utils/unifiedHistory';

const STATUS_OPTIONS: { value: CatalogStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function statusBadgeClass(status: string) {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  if (status === 'draft') return 'bg-amber-500/10 text-amber-800 border-amber-200';
  return 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

export default function ProductOptimizerApp({
  handoff = null,
  onHandoffConsumed,
  onPendingCountChange,
}: {
  handoff?: OptimizerHandoff | null;
  onHandoffConsumed?: () => void;
  onPendingCountChange?: (count: number) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CatalogStatus>('all');
  const [products, setProducts] = useState<ShopifyCatalogListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ShopifyCatalogProduct | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingStudioImage[]>([]);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandoffId = useRef<string | null>(null);

  useEffect(() => {
    if (!handoff || handoff.id === lastHandoffId.current) return;
    lastHandoffId.current = handoff.id;
    setPendingImages(handoff.images);
    onPendingCountChange?.(handoff.images.length);
    setSuccessMsg(`${handoff.images.length} image(s) from Image Studio — search & select a product to update.`);
    setTimeout(() => setSuccessMsg(null), 5000);
    onHandoffConsumed?.();
  }, [handoff, onHandoffConsumed, onPendingCountChange]);

  useEffect(() => {
    onPendingCountChange?.(pendingImages.length);
  }, [pendingImages.length, onPendingCountChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const fetchList = useCallback(
    async (append = false, nextCursor?: string | null) => {
      setListLoading(true);
      setListError(null);
      try {
        const result = await listShopifyProducts({
          search: searchQuery || undefined,
          status: statusFilter,
          cursor: append ? nextCursor ?? undefined : undefined,
          limit: 30,
        });
        setProducts((prev) => (append ? [...prev, ...result.products] : result.products));
        setCursor(result.pageInfo.endCursor);
        setHasMore(result.pageInfo.hasNextPage);
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : 'Failed to load products.');
      } finally {
        setListLoading(false);
      }
    },
    [searchQuery, statusFilter]
  );

  useEffect(() => {
    void fetchList(false);
    setSelectedId(null);
    setDraft(null);
  }, [fetchList]);

  const loadProduct = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { product } = await getShopifyProduct(id);
      setDraft(product);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load product.');
      setDraft(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    const hadPendingImages = pendingImages.length > 0;
    try {
      if (hadPendingImages) {
        const named = filenamesForProductHandle(draft.handle, pendingImages);
        const uploadResult = await replaceShopifyProductImages({
          productId: draft.id,
          images: named.map((img, index) => ({
            src: img.url,
            filename: img.fileName || `${draft.handle}-${String(index + 1).padStart(2, '0')}.png`,
            position: index + 1,
          })),
        });
        linkImagesToProduct(
          named.map((img) => img.sourceImageId),
          draft.handle,
          'pod'
        );
        setPendingImages([]);
        const { product: refreshed } = await getShopifyProduct(draft.id);
        setDraft(refreshed);
        setSuccessMsg(
          `Saved — ${uploadResult.count} studio image(s) uploaded (gallery replaced) + listing updated.`
        );
      }

      const result = await updateShopifyProduct({
        productId: draft.id,
        title: draft.title,
        handle: draft.handle,
        body_html: draft.descriptionHtml,
        tags: draft.tags,
        vendor: draft.vendor,
        product_type: draft.productType,
        status: draft.status as 'active' | 'draft' | 'archived',
        seo_title: draft.seoTitle,
        seo_description: draft.seoDescription,
      });

      if (!hadPendingImages) {
        setSuccessMsg('Saved to Shopify.');
      }

      setDraft((prev) => (prev ? { ...prev, adminUrl: result.adminUrl } : prev));
      void fetchList(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const pendingNamed = draft
    ? filenamesForProductHandle(draft.handle, pendingImages)
    : pendingImages;

  return (
    <div className="min-h-screen bg-zinc-50/80">
      <main className="studio-main-offset-no-sub max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Product Optimizer</h1>
          <p className="text-sm text-zinc-500 mt-1">
            搜索 Shopify 产品并编辑 listing。替换图片有两种方式：
            （1）Image Studio → Push to Optimizer；（2）选中产品后点「Replace Images」从 Shared History 选图。
          </p>
        </div>

        {pendingImages.length > 0 && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    {pendingImages.length} image(s) from Image Studio
                  </p>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Select a Shopify product below. Save will replace its gallery with these images
                    {draft ? ` (filenames: ${draft.handle}-01.png …)` : ' (SKU-linked names after you pick a product)'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingImages([])}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pendingNamed.map((img, i) => (
                <div key={img.sourceImageId} className="shrink-0 text-center">
                  <img
                    src={img.url}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border-2 border-indigo-300"
                  />
                  <p className="text-[9px] font-mono text-indigo-600 mt-1 max-w-[64px] truncate">
                    {i === 0 ? 'Hero' : `#${i + 1}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(error || successMsg) && (
          <div className="mb-6 space-y-2">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{successMsg}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left — search & list */}
          <div className="lg:col-span-4 space-y-4">
            <div className="studio-card p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by title..."
                  className="input-modern pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusFilter === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fetchList(false)}
                disabled={listLoading}
                className="btn-secondary w-full text-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 inline ${listLoading ? 'animate-spin' : ''}`} />
                Refresh from Shopify
              </button>
            </div>

            <div className="studio-card p-0 overflow-hidden max-h-[calc(100vh-280px)] flex flex-col">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {listLoading && products.length === 0 ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
                {searchQuery && ` · "${searchQuery}"`}
              </div>

              {listError && (
                <div className="p-4 text-sm text-red-600">{listError}</div>
              )}

              {!listError && products.length === 0 && !listLoading && (
                <div className="p-10 text-center text-zinc-500">
                  <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No products found.</p>
                </div>
              )}

              <ul className="overflow-y-auto divide-y divide-zinc-100 flex-1">
                {products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => loadProduct(p.id)}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-zinc-50 transition-colors ${
                        selectedId === p.id ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-200' : ''
                      }`}
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">{p.handle}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${statusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>

              {hasMore && (
                <div className="p-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => fetchList(true, cursor)}
                    disabled={listLoading}
                    className="btn-secondary w-full text-xs"
                  >
                    {listLoading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right — editor */}
          <div className="lg:col-span-8">
            {!draft && !detailLoading && (
              <div className="studio-card p-16 text-center text-zinc-500">
                <PackageSearch className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium text-zinc-700 mb-1">Select a product to optimize</p>
                <p className="text-sm">
                  {pendingImages.length > 0
                    ? 'Search by title, pick the product whose images you want to replace, then Save.'
                    : 'Search by title on the left, then click a product.'}
                </p>
              </div>
            )}

            {detailLoading && (
              <div className="studio-card p-16 flex flex-col items-center text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                <p className="text-sm">Loading product…</p>
              </div>
            )}

            {draft && !detailLoading && (
              <div className="space-y-6">
                <div className="studio-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-4">
                      {draft.imageUrl && (
                        <img src={draft.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover border border-zinc-200" />
                      )}
                      <div>
                        <p className="text-xs text-zinc-500 font-mono">ID {draft.id}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBadgeClass(draft.status)}`}>
                          {draft.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={draft.adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-1.5 inline" />
                        Shopify Admin
                      </a>
                      <button
                        type="button"
                        onClick={() => setHistoryPickerOpen(true)}
                        className="btn-secondary text-sm"
                        title="从 Image Studio Shared History 选择图片替换图库"
                      >
                        <Images className="w-4 h-4 mr-1.5 inline" />
                        Replace Images
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary text-sm"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 mr-1.5 inline animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1.5 inline" />
                        )}
                        {pendingImages.length > 0
                          ? `Save + Replace ${pendingImages.length} Image(s)`
                          : 'Save to Shopify'}
                      </button>
                    </div>
                  </div>

                  {pendingImages.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Pending gallery replace
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryPickerOpen(true)}
                            className="text-[11px] text-indigo-700 hover:text-indigo-900 font-medium"
                          >
                            重新选图
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingImages([])}
                            className="text-[11px] text-zinc-500 hover:text-red-600"
                          >
                            清除
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {pendingNamed.map((img, i) => (
                          <div key={img.sourceImageId} className="flex flex-col items-center gap-1">
                            <img
                              src={img.url}
                              alt=""
                              className="w-24 h-24 rounded-lg object-cover border border-indigo-200 shadow-sm"
                            />
                            <span className="text-[10px] font-mono text-indigo-700 truncate max-w-[96px]">
                              {img.fileName || `${draft.handle}-${String(i + 1).padStart(2, '0')}.png`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500 mt-3">
                        点击「Save + Replace」后将整库替换为以上图片（当前 Shopify Hero 见上方缩略图）。
                      </p>
                    </div>
                  )}

                  {pendingImages.length === 0 && (
                    <div className="mb-6 p-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-800">替换产品图库</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          从 Shared History 选择图片，或先在 Image Studio 勾选后 Push to Optimizer
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHistoryPickerOpen(true)}
                        className="btn-secondary text-sm shrink-0"
                      >
                        <Images className="w-4 h-4 mr-1.5 inline" />
                        Replace Images
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label-modern">Title</label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">Handle</label>
                      <input
                        type="text"
                        value={draft.handle}
                        onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                        className="input-modern font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="label-modern">Vendor</label>
                      <input
                        type="text"
                        value={draft.vendor}
                        onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">Product type</label>
                      <input
                        type="text"
                        value={draft.productType}
                        onChange={(e) => setDraft({ ...draft, productType: e.target.value })}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">Status</label>
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                        className="input-modern"
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-modern">Tags (comma separated)</label>
                      <input
                        type="text"
                        value={draft.tags.join(', ')}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                          })
                        }
                        className="input-modern"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="label-modern">SEO Title</label>
                      <input
                        type="text"
                        value={draft.seoTitle}
                        onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">SEO Description</label>
                      <textarea
                        value={draft.seoDescription}
                        onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
                        className="input-modern resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  {draft.variants.length > 0 && (
                    <div className="mb-6">
                      <label className="label-modern">Variants ({draft.variants.length})</label>
                      <div className="mt-2 rounded-xl border border-zinc-200 overflow-hidden text-xs">
                        <table className="w-full">
                          <thead className="bg-zinc-50 text-zinc-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Option</th>
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-right">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {draft.variants.map((v) => (
                              <tr key={v.id}>
                                <td className="px-3 py-2">{v.option1 || '—'}</td>
                                <td className="px-3 py-2 font-mono text-indigo-700">{v.sku || '—'}</td>
                                <td className="px-3 py-2 text-right font-mono">${v.price}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="h-[420px]">
                    <DescriptionEditor
                      html={draft.descriptionHtml}
                      onChange={(html) => setDraft({ ...draft, descriptionHtml: html })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <HistoryImagePicker
        open={historyPickerOpen}
        onClose={() => setHistoryPickerOpen(false)}
        productHandle={draft?.handle}
        onConfirm={(images) => {
          setPendingImages(images);
          setSuccessMsg(`已选 ${images.length} 张 History 图片 — 点击 Save + Replace 写入 Shopify`);
          setTimeout(() => setSuccessMsg(null), 4000);
        }}
      />
    </div>
  );
}
