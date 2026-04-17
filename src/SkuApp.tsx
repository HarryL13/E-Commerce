// Changes:
// - Removed the browser-side ANTHROPIC_API_KEY check and stopped passing the
//   key to generateProductDetails. The key now lives only on the server
//   (Vercel serverless function), so the frontend no longer needs or has
//   access to it. Calls to generateProductDetails were updated to match the
//   new signature (imageBase64, contextText, contextMode).
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight">SKU Generator</h1>
            </div>
            
            <nav className="flex space-x-1 bg-zinc-100/50 p-1 rounded-full border border-zinc-200/50">
              <button
                onClick={() => setView('generator')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${view === 'generator' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                Generator
              </button>
              <button
                onClick={() => setView('history')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 flex items-center ${view === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                <History className="w-4 h-4 mr-1.5" />
                History
                {history.length > 0 && (
                  <span className="ml-1.5 bg-zinc-900 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                    {history.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3">
            {view === 'generator' ? (
              <>
                <button onClick={saveToHistory} disabled={!productData.title} className="btn-secondary">
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </button>
                <button onClick={handleExportSingle} disabled={!productData.title} className="btn-primary">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
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
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start shadow-sm"
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
              className="mb-6 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
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
                  <h2 className="text-base font-semibold mb-4 flex items-center justify-center">
                    <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs mr-2">1</span>
                    Product Image(s)
                  </h2>
                  <ImageUpload 
                    onImagesSelected={handleImagesSelected} 
                    imagePreviews={imagePreviews} 
                    onRemoveImage={handleRemoveImage}
                  />
                  <div className="mt-6 pt-6 border-t border-zinc-100">
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
                    <h2 className="text-base font-semibold flex items-center">
                      <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs mr-2">2</span>
                      Context
                    </h2>
                    <div className="flex bg-zinc-100 p-1 rounded-lg">
                      <button
                        onClick={() => setContextMode('series')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${contextMode === 'series' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                      >
                        Series
                      </button>
                      <button
                        onClick={() => setContextMode('template')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${contextMode === 'template' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
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
                    className="w-full flex justify-center items-center px-5 py-3 rounded-xl text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
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
                  <h2 className="text-base font-semibold mb-6 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs mr-2">3</span>
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
                      className="input-modern resize-none bg-zinc-100/50 text-zinc-600"
                      rows={4}
                    />
                    <p className="text-[11px] text-zinc-500 mt-2 ml-1">This text is already integrated into the HTML description above.</p>
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
              className="card-modern p-0 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                <h2 className="text-base font-semibold text-zinc-900">Generated Products History</h2>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="p-16 text-center text-zinc-500">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PackageSearch className="w-8 h-8 text-zinc-300" />
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
                <div className="divide-y divide-zinc-100">
                  {history.map((item, idx) => (
                    <div key={idx} className="p-6 hover:bg-zinc-50/80 transition-colors flex items-start space-x-5 group">
                      {item.product.mainImageSrc ? (
                        <img src={item.product.mainImageSrc} alt="" className="w-24 h-24 object-cover rounded-2xl border border-zinc-200 shadow-sm" />
                      ) : (
                        <div className="w-24 h-24 bg-zinc-100 rounded-2xl border border-zinc-200 flex items-center justify-center text-zinc-400 text-xs font-medium">
                          No Img
                        </div>
                      )}
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="text-base font-semibold text-zinc-900 truncate mb-1">{item.product.title || 'Untitled Product'}</h3>
                        <p className="text-xs text-zinc-500 mb-3 font-mono truncate">{item.product.handle || 'no-handle'}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 uppercase tracking-wider">
                            {item.variants.length} Variants
                          </span>
                          {item.product.type && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 uppercase tracking-wider">
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
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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

