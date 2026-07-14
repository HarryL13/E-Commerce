// Changes: POD carousel auto-appends size guide + create-your-own as last 2 gallery images.
import { WorkflowUxMode } from './utils/workflowGuide';
import {
  buildPodCarouselPreviews,
  MAX_POD_USER_CAROUSEL_IMAGES,
  POD_CAROUSEL_TAIL_ASSETS,
  preloadPodCarouselTailAssets,
  isPodCarouselTailImage,
  shouldAppendPodCarouselTail,
} from './utils/podCarouselAssets';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Wand2, AlertCircle, Save, History, CheckCircle2, PackageSearch, Trash2, RefreshCw, Plus, Store, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageUpload } from './components/ImageUpload';
import { VariantManager } from './components/VariantManager';
import { DescriptionEditor } from './components/DescriptionEditor';
import { generateProductDetails } from './services/gemini';
import { exportCSV, Variant, ProductData, ExportItem } from './utils/csvExport';
import { publishToShopify } from './services/shopifyService';
import { resizeImage } from './utils/imageUtils';
import {
  PriceMode,
  POD_SIZE_PRICES,
  POD_SIZES,
  getProductAbbreviation,
  buildPodVariants,
  buildBulkVariantsFromRows,
  createCustomSizeRow,
  CustomSizeRow,
  applyPodAbbrevToVariants,
  isPodVariantSet,
  isBulkVariantSet,
  customSizeRowsFromVariants,
  buildBulkSku,
  applyBulkProductCodeToVariants,
  skuLineFromPriceMode,
  parseBulkSku,
} from './utils/podPricing';
import { SkuHandoff, SkuHandoffMode, splitProductImages } from './utils/skuHandoff';
import {
  getStoredProducts,
  setStoredProducts,
  addStoredProduct,
  linkImagesToProduct,
  storedProductFromExportItem,
  StoredProduct,
} from './utils/unifiedHistory';
import { filenameForDataUrl } from './utils/imageNaming';

const MAX_PRODUCT_IMAGES = 10;

type GenerateOptions = {
  previews: string[];
  priceMode: PriceMode;
  contextText: string;
  contextMode: 'series' | 'template';
  customRows?: CustomSizeRow[];
  productAbbrevOverride?: string;
  generationMode?: SkuHandoffMode;
  sourceImageIds?: string[];
};

interface SkuAppProps {
  handoff?: SkuHandoff | null;
  workflowUxMode?: WorkflowUxMode;
  onHandoffConsumed?: () => void;
}

export default function SkuApp({
  handoff = null,
  workflowUxMode = 'standalone',
  onHandoffConsumed,
}: SkuAppProps) {
  useEffect(() => {
    preloadPodCarouselTailAssets();
  }, []);
  const [view, setView] = useState<'generator' | 'history'>('generator');
  const [history, setHistory] = useState<StoredProduct[]>(() => getStoredProducts());

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shopifyAdminUrl, setShopifyAdminUrl] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{current: number, total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [contextMode, setContextMode] = useState<'series' | 'template'>('series');
  const [contextText, setContextText] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('pod-default');
  const [customSizeRows, setCustomSizeRows] = useState<CustomSizeRow[]>([createCustomSizeRow()]);
  const [productAbbrev, setProductAbbrev] = useState('');
  const [generationMode, setGenerationMode] = useState<SkuHandoffMode>('single-product');

  const buildVariantsForProduct = (
    title: string,
    handle: string,
    imageSrc: string
  ): Variant[] => {
    if (priceMode === 'pod-default') {
      return buildPodVariants(undefined, imageSrc);
    }
    return buildBulkVariantsFromRows(customSizeRows, productAbbrev.trim() || 'PRD', imageSrc);
  };

  const addCustomSizeRow = () => {
    const sharedCode = customSizeRows[0]?.code || '';
    setCustomSizeRows((prev) => [...prev, createCustomSizeRow('0.00', sharedCode)]);
  };

  const updateCustomSizeRow = (id: string, field: 'size' | 'code' | 'price', value: string) => {
    setCustomSizeRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === 'code') {
          return {
            ...row,
            code: value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const removeCustomSizeRow = (id: string) => {
    setCustomSizeRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  };

  const syncAbbrevFromTitle = () => {
    const abbrev = getProductAbbreviation(productData.title, productData.handle);
    if (priceMode === 'pod-default') {
      setProductAbbrev(abbrev);
      if (variants.length > 0) {
        setVariants(applyPodAbbrevToVariants(variants));
      }
    } else {
      setCustomSizeRows((prev) =>
        prev.map((row) => ({ ...row, code: row.code || abbrev }))
      );
      if (variants.length > 0 && isBulkVariantSet(variants)) {
        setVariants(applyBulkProductCodeToVariants(variants, abbrev));
      }
    }
  };

  const [productData, setProductData] = useState<ProductData>({
    title: '',
    handle: '',
    description_html: '',
    vendor: '',
    category: '',
    type: '',
    tags: [],
    seo_title: '',
    seo_description: '',
    mainImageSrc: '',
    galleryImageSrcs: [],
  });

  const [aboutSection, setAboutSection] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [studioImportNote, setStudioImportNote] = useState<string | null>(null);
  const lastHandoffId = useRef<string | null>(null);
  const pendingSourceImageIds = useRef<string[]>([]);

  const buildVariantsForProductWithMode = (
    title: string,
    handle: string,
    imageSrc: string,
    mode: PriceMode,
    rows: CustomSizeRow[],
    abbrev: string
  ): Variant[] => {
    if (mode === 'pod-default') {
      return buildPodVariants(undefined, imageSrc);
    }
    return buildBulkVariantsFromRows(rows, abbrev.trim() || 'PRD', imageSrc);
  };

  useEffect(() => {
    setHistory(getStoredProducts());
  }, [view]);

  const buildImageFileNames = (handle: string, main: string, gallery: string[]): string[] => {
    const names: string[] = [];
    if (main) names.push(filenameForDataUrl(handle, 1, main));
    gallery.forEach((src, i) => names.push(filenameForDataUrl(handle, i + 2, src)));
    return names;
  };

  const saveProductToHistory = (
    item: ExportItem,
    sourceImageIds: string[],
    priceMode: PriceMode
  ) => {
    const stored = storedProductFromExportItem(item, sourceImageIds, priceMode);
    addStoredProduct(stored);
    const skuLine = skuLineFromPriceMode(priceMode);
    if (item.product.handle && sourceImageIds.length > 0) {
      linkImagesToProduct(sourceImageIds, item.product.handle, skuLine);
    }
    setHistory(getStoredProducts());
  };

  const saveToHistory = () => {
    if (!productData.title) {
      setError('Nothing to save. Please generate a product first.');
      return;
    }
    const newItem: ExportItem = { product: productData, variants };
    saveProductToHistory(newItem, pendingSourceImageIds.current, priceMode);
    setSuccessMsg('Product saved to history!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const clearHistory = () => {
    setStoredProducts([]);
    setHistory([]);
    setSuccessMsg('History cleared!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const deleteHistoryItem = (idToDelete: string) => {
    const updatedHistory = history.filter((item) => item.id !== idToDelete);
    setStoredProducts(updatedHistory);
    setHistory(updatedHistory);
    setSuccessMsg('Product deleted from history.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const maxUploadImages =
    priceMode === 'pod-default' && generationMode === 'single-product'
      ? MAX_POD_USER_CAROUSEL_IMAGES
      : MAX_PRODUCT_IMAGES;

  const handleImagesSelected = async (newFiles: File[]) => {
    let updatedFiles = [...imageFiles, ...newFiles];
    if (updatedFiles.length > maxUploadImages) {
      setError(
        `You can only use up to ${maxUploadImages} product images${priceMode === 'pod-default' && generationMode === 'single-product' ? ' (+ 2 fixed carousel slides)' : ''}. Limiting to first ${maxUploadImages}.`
      );
      updatedFiles = updatedFiles.slice(0, maxUploadImages);
    } else {
      setError(null);
    }
    setImageFiles(updatedFiles);
    
    // Create previews concurrently
    try {
      const previews = await Promise.all(
        updatedFiles.map((file) => resizeImage(file, 1536, 1536))
      );
      setImagePreviews(previews);
    } catch (err) {
      console.error("Failed to read files", err);
      setError("Failed to load image previews.");
    }
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);
    
    const newPreviews = [...imagePreviews];
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
  };

  const executeGenerate = useCallback(async ({
    previews,
    priceMode: mode,
    contextText: ctxText,
    contextMode: ctxMode,
    customRows,
    productAbbrevOverride,
    generationMode: genModeOverride,
    sourceImageIds,
  }: GenerateOptions) => {
    if (!ctxText && previews.length === 0) {
      setError('Please provide series/template information or an image.');
      return;
    }

    const rows = customRows ?? customSizeRows;
    if (mode === 'custom' && !rows.some((r) => r.size.trim())) {
      setError('Add at least one size for custom pricing.');
      return;
    }

    const genMode = genModeOverride ?? generationMode;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const abbrev = productAbbrevOverride ?? productAbbrev;
    const srcIds = sourceImageIds ?? pendingSourceImageIds.current;

    try {
      if (previews.length > 1 && genMode === 'bulk-products') {
        setBulkProgress({ current: 0, total: previews.length });

        let savedCount = 0;

        for (let i = 0; i < previews.length; i++) {
          try {
            const result = await generateProductDetails(
              previews[i],
              ctxText,
              ctxMode,
              skuLineFromPriceMode(mode)
            );
            const handle = result.handle || '';
            const mainImageSrc = previews[i] || '';
            const imageFileNames = buildImageFileNames(handle, mainImageSrc, []);
            const itemSourceIds = srcIds[i] ? [srcIds[i]] : [];

            const exportItem: ExportItem = {
              product: {
                title: result.title || '',
                handle,
                description_html: result.description_html || '',
                vendor: result.vendor || '',
                type: result.type || '',
                category: result.category || '',
                tags: result.tags || [],
                seo_title: result.seo_title || '',
                seo_description: result.seo_description || '',
                mainImageSrc,
                galleryImageSrcs: [],
                imageFileNames,
              },
              variants: buildVariantsForProductWithMode(
                result.title || '',
                handle,
                mainImageSrc,
                mode,
                rows,
                abbrev
              ),
            };

            saveProductToHistory(exportItem, itemSourceIds, mode);
            savedCount++;

            if (i < previews.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (err) {
            console.error('Failed to generate for a file', err);
          } finally {
            setBulkProgress({ current: i + 1, total: previews.length });
          }
        }

        if (savedCount > 0) {
          setSuccessMsg(`Successfully generated and saved ${savedCount} products to shared history!`);
        } else {
          setError('Failed to generate products.');
        }

        setImageFiles([]);
        setImagePreviews([]);
        pendingSourceImageIds.current = [];
        setBulkProgress(null);
        setView('history');
      } else {
        const carouselPreviews = await buildPodCarouselPreviews(previews, mode, genMode);
        const { mainImageSrc, galleryImageSrcs } = splitProductImages(carouselPreviews);
        const fileToProcess = mainImageSrc || null;
        const result = await generateProductDetails(
          fileToProcess,
          ctxText,
          ctxMode,
          skuLineFromPriceMode(mode)
        );
        const handle = result.handle || '';
        const imageFileNames = buildImageFileNames(handle, mainImageSrc, galleryImageSrcs);

        setProductData((prev) => ({
          ...prev,
          title: result.title || '',
          handle,
          description_html: result.description_html || '',
          vendor: result.vendor || '',
          type: result.type || '',
          category: result.category || '',
          tags: result.tags || [],
          seo_title: result.seo_title || '',
          seo_description: result.seo_description || '',
          mainImageSrc,
          galleryImageSrcs,
          imageFileNames,
        }));

        setAboutSection(result.about_section || '');
        setVariants(
          buildVariantsForProductWithMode(
            result.title || '',
            handle,
            mainImageSrc,
            mode,
            rows,
            abbrev
          )
        );

        if (handle && srcIds.length > 0) {
          linkImagesToProduct(srcIds, handle, skuLineFromPriceMode(mode));
        }

        if (galleryImageSrcs.length > 0) {
          const tailNote =
            shouldAppendPodCarouselTail(mode, genMode) ? '（含尺寸说明 + 定制步骤）' : '';
          setSuccessMsg(`Listing ready with ${1 + galleryImageSrcs.length} product images${tailNote}.`);
          setTimeout(() => setSuccessMsg(null), 4000);
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to generate content.';
      setError(message);
      setBulkProgress(null);
    } finally {
      setLoading(false);
    }
  }, [customSizeRows, productAbbrev, generationMode]);

  const handleGenerate = async () => {
    await executeGenerate({
      previews: imagePreviews,
      priceMode,
      contextText,
      contextMode,
      generationMode,
    });
  };

  const removeGalleryImage = (index: number) => {
    const src = productData.galleryImageSrcs?.[index];
    if (src && isPodCarouselTailImage(src)) return;

    setProductData((prev) => ({
      ...prev,
      galleryImageSrcs: (prev.galleryImageSrcs ?? []).filter((_, i) => i !== index),
    }));
  };

  const allProductImages = [
    ...(productData.mainImageSrc ? [productData.mainImageSrc] : []),
    ...(productData.galleryImageSrcs ?? []),
  ];

  useEffect(() => {
    if (!handoff || handoff.id === lastHandoffId.current) return;
    lastHandoffId.current = handoff.id;

    pendingSourceImageIds.current = handoff.sourceImageIds;
    setView('generator');
    setImageFiles([]);
    setImagePreviews(
      handoff.images.slice(
        0,
        handoff.priceMode === 'pod-default' && handoff.mode === 'single-product'
          ? MAX_POD_USER_CAROUSEL_IMAGES
          : MAX_PRODUCT_IMAGES
      )
    );
    setGenerationMode(handoff.mode);
    setPriceMode(handoff.priceMode);
    setContextText(handoff.contextText);
    setContextMode(handoff.contextMode);
    const lineLabel = handoff.skuLine === 'pod' ? 'POD · FIG-POD-size' : '大货 · xxx-REG-size';
    setStudioImportNote(
      `${lineLabel} · ${
        handoff.mode === 'bulk-products'
          ? `${handoff.images.length} images → ${handoff.images.length} separate SKUs`
          : handoff.images.length > 1
            ? `${handoff.images.length} images → 1 SKU (hero + gallery)`
            : '1 image from Image Studio'
      }`
    );

    let bulkRows = customSizeRows;
    if (handoff.priceMode === 'custom') {
      bulkRows = POD_SIZES.map((size) => ({
        ...createCustomSizeRow(POD_SIZE_PRICES[size], ''),
        size,
      }));
      setCustomSizeRows(bulkRows);
    }

    if (handoff.autoGenerate) {
      void executeGenerate({
        previews: handoff.images.slice(0, MAX_PRODUCT_IMAGES),
        priceMode: handoff.priceMode,
        contextText: handoff.contextText,
        contextMode: handoff.contextMode,
        customRows: handoff.priceMode === 'custom' ? bulkRows : undefined,
        generationMode: handoff.mode,
        sourceImageIds: handoff.sourceImageIds,
      });
    }

    onHandoffConsumed?.();
  }, [handoff, executeGenerate, onHandoffConsumed]);

  const handleExportSingle = () => {
    if (!productData.title) {
      setError('Please generate product details before exporting.');
      return;
    }
    exportCSV([{ product: productData, variants }], productData.handle || 'product');
  };

  const handleExportAll = () => {
    if (history.length === 0) {
      setError('No history to export.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    exportCSV(history.map((h) => h.exportItem), 'all_products_export');
  };

  const handlePublishToShopify = async (
    item?: ExportItem,
    status: 'draft' | 'active' = 'draft'
  ) => {
    const payload: ExportItem = item ?? { product: productData, variants };
    if (!payload.product.title?.trim()) {
      setError('Generate a product before publishing to Shopify.');
      return;
    }
    if (!payload.product.mainImageSrc?.trim()) {
      setError('Product needs at least one image before publishing to Shopify.');
      return;
    }

    setPublishing(true);
    setError(null);
    setShopifyAdminUrl(null);

    try {
      const result = await publishToShopify(payload, status);
      setSuccessMsg(
        `Published to Shopify (${result.status}) · ${result.imageUrls.length} image(s) on CDN.`
      );
      setShopifyAdminUrl(result.adminUrl);

      if (!item) {
        setProductData((prev) => ({
          ...prev,
          handle: result.handle || prev.handle,
          mainImageSrc: result.imageUrls[0] || prev.mainImageSrc,
          galleryImageSrcs: result.imageUrls.slice(1),
        }));
      }

      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Shopify publish failed.';
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="studio-root pb-20">
      <div className="studio-subheader">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <nav className="studio-tab-group">
            <button
              onClick={() => setView('generator')}
              className={`studio-tab ${view === 'generator' ? 'studio-tab-active' : ''}`}
            >
              Generator
            </button>
            <button
              onClick={() => setView('history')}
              className={`studio-tab flex items-center gap-1.5 ${view === 'history' ? 'studio-tab-active' : ''}`}
            >
              <History className="w-3.5 h-3.5" />
              History
              {history.length > 0 && (
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded-full leading-none border border-indigo-500/30">
                  {history.length}
                </span>
              )}
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {view === 'generator' ? (
              <>
                <button onClick={saveToHistory} disabled={!productData.title} className="btn-secondary">
                  <Save className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Save Draft</span>
                </button>
                <button onClick={handleExportSingle} disabled={!productData.title} className="btn-primary">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  onClick={() => handlePublishToShopify(undefined, 'draft')}
                  disabled={!productData.title || !productData.mainImageSrc || publishing || loading}
                  className="btn-secondary"
                  title="Upload images to Shopify CDN and create a draft product"
                >
                  <Store className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{publishing ? 'Publishing…' : 'Publish Draft'}</span>
                </button>
              </>
            ) : (
              <button onClick={handleExportAll} disabled={history.length === 0} className="btn-primary">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="studio-main-offset max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {workflowUxMode === 'pipeline' && handoff && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900">完整流程 Step 3–4</p>
              <p className="text-xs text-indigo-700/80 mt-0.5">
                已从 Image Studio 导入 {handoff.images.length} 张图。检查 AI 生成的 listing → Publish Draft 完成上架。
              </p>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start"
            >
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
                {shopifyAdminUrl && (
                  <a
                    href={shopifyAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-800 underline mt-2 font-medium"
                  >
                    Open in Shopify Admin
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {studioImportNote && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-start gap-3">
            <PackageSearch className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-900">{studioImportNote}</p>
              <p className="text-xs text-indigo-700/80 mt-1">Brand context and pricing mode were applied from Image Studio.</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'generator' ? (
            <motion.div
              key="generator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Inputs */}
              <div className="lg:col-span-4 space-y-6">
                <div className="card-modern">
                  <h2 className="text-base font-semibold mb-4 flex items-center justify-center text-zinc-900">
                    <span className="studio-step">1</span>
                    Product Image(s)
                  </h2>
                  <ImageUpload 
                    onImagesSelected={handleImagesSelected} 
                    imagePreviews={imagePreviews} 
                    onRemoveImage={handleRemoveImage}
                  />
                  {imagePreviews.length > 1 && (
                    <div className="mt-4 space-y-2">
                      <label className="label-modern text-center block">Multiple images</label>
                      <div className="studio-tab-group p-1 w-full">
                        <button
                          type="button"
                          onClick={() => setGenerationMode('single-product')}
                          className={`studio-tab flex-1 text-center text-xs ${generationMode === 'single-product' ? 'studio-tab-active' : ''}`}
                        >
                          1 SKU · gallery
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenerationMode('bulk-products')}
                          className={`studio-tab flex-1 text-center text-xs ${generationMode === 'bulk-products' ? 'studio-tab-active' : ''}`}
                        >
                          {imagePreviews.length} separate SKUs
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                        {generationMode === 'single-product'
                          ? 'All images attach to one product listing (hero + gallery).'
                          : 'Each image becomes its own product in History.'}
                      </p>
                    </div>
                  )}
                  <div className="mt-6 pt-6 border-t border-zinc-200 space-y-4">
                    <label className="label-modern text-center block">Pricing</label>
                    <div className="studio-tab-group p-1 w-full">
                      <button
                        type="button"
                        onClick={() => setPriceMode('pod-default')}
                        className={`studio-tab flex-1 text-center ${priceMode === 'pod-default' ? 'studio-tab-active' : ''}`}
                      >
                        POD · FIG-POD
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceMode('custom')}
                        className={`studio-tab flex-1 text-center ${priceMode === 'custom' ? 'studio-tab-active' : ''}`}
                      >
                        大货 · REG
                      </button>
                    </div>

                    {priceMode === 'pod-default' ? (
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-500 text-center leading-relaxed">
                          SKU format: <span className="font-mono text-zinc-700">FIG-POD-{'{size}'}</span>
                        </p>
                        <div className="rounded-xl border border-zinc-200 overflow-hidden text-xs">
                          <table className="w-full">
                            <thead className="bg-zinc-50 text-zinc-500">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Size</th>
                                <th className="px-3 py-2 text-right font-medium">Price</th>
                                <th className="px-3 py-2 text-right font-medium">SKU</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {POD_SIZES.map((size) => (
                                <tr key={size}>
                                  <td className="px-3 py-2 text-zinc-700">{size}</td>
                                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                                    ${POD_SIZE_PRICES[size]}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-indigo-600 text-[10px]">
                                    FIG-POD-{size}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {generationMode === 'single-product' ? (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                            <p className="text-xs font-medium text-indigo-900">轮播图固定末尾（自动生成）</p>
                            <div className="flex flex-wrap gap-3">
                              {POD_CAROUSEL_TAIL_ASSETS.map((asset) => (
                                <div key={asset.id} className="flex items-center gap-2">
                                  <img
                                    src={asset.url}
                                    alt={asset.label}
                                    className="w-14 h-14 rounded-lg object-cover border border-indigo-200 bg-black"
                                  />
                                  <span className="text-[10px] text-indigo-700 font-medium">{asset.label}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-indigo-600/80 leading-relaxed">
                              生成 SKU 时自动追加为轮播最后 2 张 · 产品图最多 {MAX_POD_USER_CAROUSEL_IMAGES} 张
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-zinc-500">
                            SKU:{' '}
                            <span className="font-mono text-zinc-700">
                              {'{code}'}-REG-{'{size}'}
                            </span>{' '}
                            or{' '}
                            <span className="font-mono text-zinc-700">
                              {'{code}'}-REG-{'{sub}'}-{'{size}'}
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={syncAbbrevFromTitle}
                            className="btn-secondary px-2 py-1 text-[10px] shrink-0"
                            title="Suggest product code from title"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 inline" />
                            Code
                          </button>
                        </div>
                        <div>
                          <label className="label-modern">Product code (xxx in xxx-REG-size)</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={productAbbrev}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                              setProductAbbrev(val);
                              if (variants.length > 0 && isBulkVariantSet(variants)) {
                                setVariants(applyBulkProductCodeToVariants(variants, val));
                              }
                            }}
                            className="input-modern text-center font-mono uppercase"
                            placeholder="e.g. BUL"
                          />
                        </div>
                        <div className="space-y-2">
                          {customSizeRows.map((row, idx) => (
                            <div
                              key={row.id}
                              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-2"
                            >
                              <div className="flex gap-2 items-end">
                                <div className="flex-[1.2] min-w-0">
                                  <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1 block">
                                    Size {idx + 1}
                                  </label>
                                  <input
                                    type="text"
                                    value={row.size}
                                    onChange={(e) => updateCustomSizeRow(row.id, 'size', e.target.value)}
                                    className="input-modern font-mono text-sm"
                                    placeholder="e.g. 8cm, Large"
                                  />
                                </div>
                                <div className="w-20 shrink-0">
                                  <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1 block">
                                    Code
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={3}
                                    value={row.code}
                                    onChange={(e) => updateCustomSizeRow(row.id, 'code', e.target.value)}
                                    className="input-modern font-mono text-sm text-center uppercase"
                                    placeholder="ABC"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1 block">
                                    Price ($)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={row.price}
                                    onChange={(e) => updateCustomSizeRow(row.id, 'price', e.target.value)}
                                    className="input-modern font-mono text-sm"
                                    placeholder="0.00"
                                  />
                                </div>
                                {customSizeRows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeCustomSizeRow(row.id)}
                                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                    title="Remove size"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              {row.size.trim() && (
                                <p className="text-[10px] text-zinc-500 font-mono">
                                  SKU: {buildBulkSku(productAbbrev || 'PRD', row.size, row.code)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addCustomSizeRow} className="btn-secondary w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Size
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-modern space-y-5">
                  <div className="flex flex-col items-center justify-center mb-4 space-y-3">
                    <h2 className="text-base font-semibold flex items-center text-zinc-900">
                      <span className="studio-step">2</span>
                      Context
                    </h2>
                    <div className="flex studio-tab-group p-1">
                      <button
                        onClick={() => setContextMode('series')}
                        className={`studio-tab ${contextMode === 'series' ? 'studio-tab-active' : ''}`}
                      >
                        Series
                      </button>
                      <button
                        onClick={() => setContextMode('template')}
                        className={`studio-tab ${contextMode === 'template' ? 'studio-tab-active' : ''}`}
                      >
                        Template
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <label className="label-modern block mb-2">
                      {contextMode === 'series' ? 'Series Information' : 'Template Information'}
                    </label>
                    <textarea
                      value={contextText}
                      onChange={e => setContextText(e.target.value)}
                      className="input-modern resize-none text-center"
                      rows={5}
                      placeholder={`Describe the overall ${contextMode}. E.g., 'The Starry Night series features cute astronaut cats exploring the galaxy...'`}
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || (imagePreviews.length === 0 && !contextText)}
                    className="w-full flex justify-center items-center px-5 py-3 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {bulkProgress
                          ? `Generating ${bulkProgress.current} of ${bulkProgress.total}...`
                          : 'Generating Magic...'}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        {imagePreviews.length > 1 && generationMode === 'bulk-products'
                          ? `Bulk Generate (${imagePreviews.length} SKUs)`
                          : imagePreviews.length > 1
                            ? `Generate 1 SKU (${imagePreviews.length} images)`
                            : 'Generate Listing'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Output & Editing */}
              <div className="lg:col-span-8 space-y-6">
                <div className="card-modern">
                  <h2 className="text-base font-semibold mb-6 flex items-center text-zinc-900">
                    <span className="studio-step">3</span>
                    Listing Details
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="label-modern">Title</label>
                      <input
                        type="text"
                        value={productData.title}
                        onChange={e => setProductData({...productData, title: e.target.value})}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">Handle (URL)</label>
                      <input
                        type="text"
                        value={productData.handle}
                        onChange={e => setProductData({...productData, handle: e.target.value})}
                        className="input-modern font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="label-modern">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={productData.tags.join(', ')}
                      onChange={e => setProductData({...productData, tags: e.target.value.split(',').map(t => t.trim())})}
                      className="input-modern"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="label-modern">
                      Product Images ({allProductImages.length})
                    </label>
                    {allProductImages.length > 0 ? (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {allProductImages.map((src, index) => (
                          <div key={`${src.slice(0, 24)}-${index}`} className="relative group/gallery">
                            <img
                              src={src}
                              alt={index === 0 ? 'Hero image' : `Gallery ${index}`}
                              className="w-20 h-20 object-cover rounded-xl border border-zinc-200 shadow-sm"
                            />
                            <span className="absolute top-1 left-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/60 text-white">
                              {index === 0
                                ? 'Hero'
                                : isPodCarouselTailImage(src)
                                  ? '固定'
                                  : index + 1}
                            </span>
                            {index > 0 && !isPodCarouselTailImage(src) && (
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(index - 1)}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/gallery:opacity-100 transition-opacity"
                                title="Remove gallery image"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-2">Generate a listing to attach product images.</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-2">
                      Hero = Shopify Image Position 1. Additional images export as gallery rows.
                    </p>
                  </div>

                  <div className="mb-6 h-[500px]">
                    <DescriptionEditor 
                      html={productData.description_html} 
                      onChange={html => setProductData({...productData, description_html: html})} 
                    />
                  </div>

                  <div className="mb-6">
                    <label className="label-modern">Auto-generated "About" Section (Reference)</label>
                    <textarea
                      value={aboutSection}
                      onChange={e => setAboutSection(e.target.value)}
                      className="input-modern resize-none bg-white/40 text-zinc-500"
                      rows={4}
                    />
                    <p className="text-[11px] text-slate-500 mt-2 ml-1">This text is already integrated into the HTML description above.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="label-modern">SEO Title</label>
                      <input
                        type="text"
                        value={productData.seo_title}
                        onChange={e => setProductData({...productData, seo_title: e.target.value})}
                        className="input-modern"
                      />
                    </div>
                    <div>
                      <label className="label-modern">SEO Description</label>
                      <textarea
                        value={productData.seo_description}
                        onChange={e => setProductData({...productData, seo_description: e.target.value})}
                        className="input-modern resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="card-modern">
                  <VariantManager variants={variants} setVariants={setVariants} productCode={productAbbrev} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="studio-card p-0 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <h2 className="text-base font-semibold text-zinc-900">Shared Product History</h2>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-medium text-red-500 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PackageSearch className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="font-medium text-zinc-900 mb-1">No products saved yet</p>
                  <p className="text-sm mb-6">Generate and save products to see them here.</p>
                  <button 
                    onClick={() => setView('generator')}
                    className="btn-secondary mx-auto"
                  >
                    Go generate some
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200">
                  {history.map((stored) => {
                    const item = stored.exportItem;
                    return (
                    <div key={stored.id} className="p-6 hover:bg-zinc-100/30 transition-colors flex items-start space-x-5 group">
                      {item.product.mainImageSrc ? (
                        <img src={item.product.mainImageSrc} alt="" className="w-24 h-24 object-cover rounded-2xl border border-zinc-200 shadow-sm" />
                      ) : (
                        <div className="w-24 h-24 bg-zinc-100 rounded-2xl border border-zinc-200 flex items-center justify-center text-slate-500 text-xs font-medium">
                          No Img
                        </div>
                      )}
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="text-base font-semibold text-zinc-900 truncate mb-1">{item.product.title || 'Untitled Product'}</h3>
                        <p className="text-xs text-slate-500 mb-3 font-mono truncate">{item.product.handle || 'no-handle'}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            stored.skuLine === 'pod'
                              ? 'bg-indigo-500/10 text-indigo-700 border-indigo-200'
                              : 'bg-amber-500/10 text-amber-800 border-amber-200'
                          }`}>
                            {stored.skuLine === 'pod' ? 'POD' : '大货'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 uppercase tracking-wider border border-zinc-200">
                            {item.variants.length} Variants
                          </span>
                          {(1 + (item.product.galleryImageSrcs?.length ?? 0)) > 1 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 uppercase tracking-wider border border-emerald-200">
                              {1 + (item.product.galleryImageSrcs?.length ?? 0)} Images
                            </span>
                          )}
                          {stored.sourceImageIds.length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-700 uppercase tracking-wider border border-violet-200">
                              Linked studio
                            </span>
                          )}
                          {item.product.type && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 uppercase tracking-wider border border-indigo-500/20">
                              {item.product.type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                        <button
                          onClick={() => handlePublishToShopify(item, 'draft')}
                          disabled={publishing || !item.product.mainImageSrc}
                          className="btn-secondary text-xs px-3 py-2"
                          title="Publish draft to Shopify"
                        >
                          <Store className="w-3.5 h-3.5 mr-1 inline" />
                          Publish
                        </button>
                        <button
                          onClick={() => {
                            pendingSourceImageIds.current = stored.sourceImageIds;
                            setProductData({
                              ...item.product,
                              galleryImageSrcs: item.product.galleryImageSrcs ?? [],
                            });
                            setImagePreviews([
                              ...(item.product.mainImageSrc ? [item.product.mainImageSrc] : []),
                              ...(item.product.galleryImageSrcs ?? []),
                            ]);
                            setImageFiles([]);
                            setGenerationMode('single-product');
                            setVariants(item.variants);
                            if (isPodVariantSet(item.variants)) {
                              setPriceMode('pod-default');
                              setProductAbbrev('');
                            } else if (isBulkVariantSet(item.variants)) {
                              setPriceMode('custom');
                              setCustomSizeRows(customSizeRowsFromVariants(item.variants));
                              const parsed = item.variants[0]?.sku ? parseBulkSku(item.variants[0].sku) : null;
                              setProductAbbrev(parsed?.productCode || '');
                            } else {
                              setPriceMode('custom');
                              setCustomSizeRows(customSizeRowsFromVariants(item.variants));
                            }
                            setView('generator');
                          }}
                          className="btn-secondary"
                        >
                          Edit Draft
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(stored.id)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

