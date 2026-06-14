// Changes:
// - Removed browser-side API key usage; calls go through server proxy.
// - Unified UI with Image Studio: dark studio theme, sub-header below app shell.
import React, { useState, useEffect } from 'react';
import { Download, Wand2, AlertCircle, Save, History, Plus, CheckCircle2, PackageSearch, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageUpload } from './components/ImageUpload';
import { VariantManager } from './components/VariantManager';
import { DescriptionEditor } from './components/DescriptionEditor';
import { generateProductDetails } from './services/gemini';
import { exportCSV, Variant, ProductData, ExportItem } from './utils/csvExport';
import { resizeImage } from './utils/imageUtils';

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
  const [defaultPrice, setDefaultPrice] = useState('0.00');

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
                mainImageSrc: imagePreviews[i] || '' // Save the preview image so it shows in history
              },
              variants: [{
                id: Date.now().toString() + Math.random().toString(),
                option1Name: 'Title',
                option1Value: 'Default Title',
                option2Name: '',
                option2Value: '',
                option3Name: '',
                option3Value: '',
                price: defaultPrice || '0.00',
                compareAtPrice: '',
                sku: result.handle ? `${result.handle}-01` : '',
                imageSrc: imagePreviews[i] || ''
              }]
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
        setVariants([{
          id: Date.now().toString(),
          option1Name: 'Title',
          option1Value: 'Default Title',
          option2Name: '',
          option2Value: '',
          option3Name: '',
          option3Value: '',
          price: defaultPrice || '0.00',
          compareAtPrice: '',
          sku: result.handle ? `${result.handle}-01` : '',
          imageSrc: imagePreviews[0] || ''
        }]);
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
              className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start"
            >
              <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200 font-medium">{error}</p>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-200 font-medium">{successMsg}</p>
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
                  <h2 className="text-base font-semibold mb-4 flex items-center justify-center text-slate-200">
                    <span className="studio-step">1</span>
                    Product Image(s)
                  </h2>
                  <ImageUpload 
                    onImagesSelected={handleImagesSelected} 
                    imagePreviews={imagePreviews} 
                    onRemoveImage={handleRemoveImage}
                  />
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <label className="label-modern text-center block mb-2">Default Price ($)</label>
                    <input
                      type="number"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                      className="input-modern text-center"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="card-modern space-y-5">
                  <div className="flex flex-col items-center justify-center mb-4 space-y-3">
                    <h2 className="text-base font-semibold flex items-center text-slate-200">
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
                  <h2 className="text-base font-semibold mb-6 flex items-center text-slate-200">
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
                      className="input-modern resize-none bg-slate-900/40 text-slate-400"
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
              <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                <h2 className="text-base font-semibold text-slate-200">Generated Products History</h2>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PackageSearch className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="font-medium text-slate-200 mb-1">No products saved yet</p>
                  <p className="text-sm mb-6">Generate and save products to see them here.</p>
                  <button 
                    onClick={() => setView('generator')}
                    className="btn-secondary mx-auto"
                  >
                    Go generate some
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {history.map((item, idx) => (
                    <div key={idx} className="p-6 hover:bg-slate-800/30 transition-colors flex items-start space-x-5 group">
                      {item.product.mainImageSrc ? (
                        <img src={item.product.mainImageSrc} alt="" className="w-24 h-24 object-cover rounded-2xl border border-slate-700 shadow-sm" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-center text-slate-500 text-xs font-medium">
                          No Img
                        </div>
                      )}
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="text-base font-semibold text-slate-100 truncate mb-1">{item.product.title || 'Untitled Product'}</h3>
                        <p className="text-xs text-slate-500 mb-3 font-mono truncate">{item.product.handle || 'no-handle'}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase tracking-wider border border-slate-700">
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
                            setView('generator');
                          }}
                          className="btn-secondary"
                        >
                          Edit Draft
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(idx)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
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

