// Changes:
// - Server-side API proxy; unified light studio UI.
// - Pricing modes: FIG-POD default table + FIG-NOL custom sizes/prices with per-row code.
import React, { useState, useEffect } from 'react';
import { Download, Wand2, AlertCircle, Save, History, CheckCircle2, PackageSearch, Trash2, RefreshCw, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageUpload } from './components/ImageUpload';
import { VariantManager } from './components/VariantManager';
import { DescriptionEditor } from './components/DescriptionEditor';
import { generateProductDetails } from './services/gemini';
import { exportCSV, Variant, ProductData, ExportItem } from './utils/csvExport';
import { resizeImage } from './utils/imageUtils';
import {
  PriceMode,
  POD_SIZE_PRICES,
  POD_SIZES,
  getProductAbbreviation,
  buildPodVariants,
  buildNolVariantsFromRows,
  createCustomSizeRow,
  CustomSizeRow,
  applyPodAbbrevToVariants,
  isPodVariantSet,
  isNolVariantSet,
  customSizeRowsFromVariants,
  buildNolSku,
} from './utils/podPricing';

export default function SkuApp() {
  const [view, setView] = useState<'generator' | 'history'>('generator');
  const [history, setHistory] = useState<ExportItem[]>([]);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{current: number, total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [contextMode, setContextMode] = useState<'series' | 'template'>('series');
  const [contextText, setContextText] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('pod-default');
  const [customSizeRows, setCustomSizeRows] = useState<CustomSizeRow[]>([createCustomSizeRow()]);
  const [productAbbrev, setProductAbbrev] = useState('');

  const buildVariantsForProduct = (
    title: string,
    handle: string,
    imageSrc: string
  ): Variant[] => {
    if (priceMode === 'pod-default') {
      return buildPodVariants(productAbbrev.trim() || undefined, imageSrc);
    }
    return buildNolVariantsFromRows(customSizeRows, imageSrc);
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
        setVariants(applyPodAbbrevToVariants(variants, abbrev));
      }
    } else {
      setCustomSizeRows((prev) =>
        prev.map((row) => ({ ...row, code: abbrev }))
      );
      if (variants.length > 0 && isNolVariantSet(variants)) {
        setVariants(
          variants.map((v) => {
            const size = v.option1Value === 'Default' ? '' : v.option1Value;
            return { ...v, sku: buildNolSku(size, abbrev) };
          })
        );
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
    mainImageSrc: ''
  });

  const [aboutSection, setAboutSection] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('productHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = () => {
    if (!productData.title) {
      setError('Nothing to save. Please generate a product first.');
      return;
    }
    const newItem: ExportItem = { product: productData, variants };
    const updatedHistory = [...history, newItem];
    setHistory(updatedHistory);
    localStorage.setItem('productHistory', JSON.stringify(updatedHistory));
    setSuccessMsg('Product saved to history!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('productHistory');
    setSuccessMsg('History cleared!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const deleteHistoryItem = (indexToDelete: number) => {
    const updatedHistory = history.filter((_, index) => index !== indexToDelete);
    setHistory(updatedHistory);
    localStorage.setItem('productHistory', JSON.stringify(updatedHistory));
    setSuccessMsg('Product deleted from history.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleImagesSelected = async (newFiles: File[]) => {
    let updatedFiles = [...imageFiles, ...newFiles];
    if (updatedFiles.length > 6) {
      setError('You can only upload up to 6 images at a time. Limiting to first 6.');
      updatedFiles = updatedFiles.slice(0, 6);
    } else {
      setError(null);
    }
    setImageFiles(updatedFiles);
    
    // Create previews concurrently
    try {
      const previews = await Promise.all(
        updatedFiles.map((file) => resizeImage(file, 800, 800))
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

  const handleGenerate = async () => {
    if (!contextText && imageFiles.length === 0) {
      setError('Please provide series/template information or an image.');
      return;
    }

    if (priceMode === 'custom' && !customSizeRows.some((r) => r.size.trim())) {
      setError('Add at least one size for custom pricing.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (imageFiles.length > 1) {
        // Bulk generation (Sequential to avoid rate limits)
        setBulkProgress({ current: 0, total: imageFiles.length });
        
        const newHistoryItems: ExportItem[] = [];
        let completed = 0;
        
        for (let i = 0; i < imageFiles.length; i++) {
          try {
            const result = await generateProductDetails(imagePreviews[i], contextText, contextMode);
            completed++;
            setBulkProgress({ current: completed, total: imageFiles.length });
            
            newHistoryItems.push({
              product: {
                title: result.title || '',
                handle: result.handle || '',
                description_html: result.description_html || '',
                vendor: result.vendor || '',
                type: result.type || '',
                category: result.category || '',
                tags: result.tags || [],
                seo_title: result.seo_title || '',
                seo_description: result.seo_description || '',
                mainImageSrc: imagePreviews[i] || '',
              },
              variants: buildVariantsForProduct(
                result.title || '',
                result.handle || '',
                imagePreviews[i] || ''
              ),
            });
            
            // Wait a short time between requests to avoid rate limits
            if (i < imageFiles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            completed++;
            setBulkProgress({ current: completed, total: imageFiles.length });
            console.error("Failed to generate for a file", err);
          }
        }
        
        if (newHistoryItems.length > 0) {
          const updatedHistory = [...history, ...newHistoryItems];
          setHistory(updatedHistory);
          
          try {
            localStorage.setItem('productHistory', JSON.stringify(updatedHistory));
          } catch (e) {
            console.error("Failed to save to localStorage, might be full", e);
            setError("Products generated, but could not save to local storage (quota exceeded).");
          }
          
          setSuccessMsg(`Successfully generated and saved ${newHistoryItems.length} products to history!`);
        } else {
          setError('Failed to generate products.');
        }
        
        setImageFiles([]);
        setImagePreviews([]);
        setBulkProgress(null);
        setView('history');
      } else {
        // Single generation
        const fileToProcess = imagePreviews.length === 1 ? imagePreviews[0] : null;
        const result = await generateProductDetails(
          fileToProcess,
          contextText,
          contextMode
        );

        setProductData(prev => ({
          ...prev,
          title: result.title || '',
          handle: result.handle || '',
          description_html: result.description_html || '',
          vendor: result.vendor || '',
          type: result.type || '',
          category: result.category || '',
          tags: result.tags || [],
          seo_title: result.seo_title || '',
          seo_description: result.seo_description || '',
          mainImageSrc: imagePreviews[0] || ''
        }));
        
        setAboutSection(result.about_section || '');
        setVariants(
          buildVariantsForProduct(
            result.title || '',
            result.handle || '',
            imagePreviews[0] || ''
          )
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate content.');
      setBulkProgress(null);
    } finally {
      setLoading(false);
    }
  };

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
    exportCSV(history, 'all_products_export');
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8">
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
              <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <div className="mt-6 pt-6 border-t border-zinc-200 space-y-4">
                    <label className="label-modern text-center block">Pricing</label>
                    <div className="studio-tab-group p-1 w-full">
                      <button
                        type="button"
                        onClick={() => setPriceMode('pod-default')}
                        className={`studio-tab flex-1 text-center ${priceMode === 'pod-default' ? 'studio-tab-active' : ''}`}
                      >
                        FIG-POD Default
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceMode('custom')}
                        className={`studio-tab flex-1 text-center ${priceMode === 'custom' ? 'studio-tab-active' : ''}`}
                      >
                        Custom Price
                      </button>
                    </div>

                    {priceMode === 'pod-default' ? (
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-500 text-center leading-relaxed">
                          SKU format: <span className="font-mono text-zinc-700">FIG-POD-[size]-XXX</span>
                        </p>
                        <div className="rounded-xl border border-zinc-200 overflow-hidden text-xs">
                          <table className="w-full">
                            <thead className="bg-zinc-50 text-zinc-500">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Size</th>
                                <th className="px-3 py-2 text-right font-medium">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {POD_SIZES.map((size) => (
                                <tr key={size}>
                                  <td className="px-3 py-2 text-zinc-700">{size}</td>
                                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                                    ${POD_SIZE_PRICES[size]}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <label className="label-modern">Product code (optional, 3 letters)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={3}
                              value={productAbbrev}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                                setProductAbbrev(val);
                                if (priceMode === 'pod-default' && variants.length > 0 && isPodVariantSet(variants)) {
                                  setVariants(applyPodAbbrevToVariants(variants, val));
                                }
                              }}
                              className="input-modern text-center font-mono uppercase"
                              placeholder="Optional"
                            />
                            <button
                              type="button"
                              onClick={syncAbbrevFromTitle}
                              className="btn-secondary px-3 shrink-0"
                              title="Suggest code from product title"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1.5 text-center">
                            Leave empty for <span className="font-mono">FIG-POD-6cm</span>
                            {productAbbrev
                              ? ` · With code: FIG-POD-6cm-${productAbbrev}`
                              : ' · Or add code: FIG-POD-6cm-ABC'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-zinc-500">
                            SKU: <span className="font-mono text-zinc-700">FIG-NOL-[size]-XXX</span>
                          </p>
                          <button
                            type="button"
                            onClick={syncAbbrevFromTitle}
                            className="btn-secondary px-2 py-1 text-[10px] shrink-0"
                            title="Fill all codes from product title"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 inline" />
                            Fill codes
                          </button>
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
                                  SKU: {buildNolSku(row.size, row.code)}
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
                    disabled={loading || (imageFiles.length === 0 && !contextText)}
                    className="w-full flex justify-center items-center px-5 py-3 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {bulkProgress ? `Generating ${bulkProgress.current} of ${bulkProgress.total}...` : 'Generating Magic...'}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        {imageFiles.length > 1 ? `Bulk Generate (${imageFiles.length})` : 'Generate Listing'}
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
                    <label className="label-modern">Main Image URL</label>
                    <input
                      type="text"
                      value={productData.mainImageSrc}
                      onChange={e => setProductData({...productData, mainImageSrc: e.target.value})}
                      className="input-modern font-mono text-xs"
                      placeholder="https://cdn.shopify.com/..."
                    />
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
                  <VariantManager variants={variants} setVariants={setVariants} />
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
                <h2 className="text-base font-semibold text-zinc-900">Generated Products History</h2>
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
                  {history.map((item, idx) => (
                    <div key={idx} className="p-6 hover:bg-zinc-100/30 transition-colors flex items-start space-x-5 group">
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
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 uppercase tracking-wider border border-zinc-200">
                            {item.variants.length} Variants
                          </span>
                          {item.product.type && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 uppercase tracking-wider border border-indigo-500/20">
                              {item.product.type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setProductData(item.product);
                            setVariants(item.variants);
                            if (isPodVariantSet(item.variants)) {
                              setPriceMode('pod-default');
                              const sku = item.variants[0]?.sku || '';
                              const match = sku.match(/^FIG-POD-\d+cm(?:-([A-Z]{3}))?$/i);
                              setProductAbbrev(match?.[1]?.toUpperCase() || '');
                            } else if (isNolVariantSet(item.variants)) {
                              setPriceMode('custom');
                              setCustomSizeRows(customSizeRowsFromVariants(item.variants));
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
                          onClick={() => deleteHistoryItem(idx)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

