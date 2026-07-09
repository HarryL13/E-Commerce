// Changes:
// - Fixed top padding so content isn't hidden under the double header. The outer
//   App.tsx sticky bar is 56px (h-14) and the inner Image Studio Header (now fixed
//   at top-14) is 64px (h-16), totaling ~120px. Increased main's pt-28 -> pt-32.
// - Also bumped the progress toast's `top-24` -> `top-32` so it appears under both
//   headers instead of on top of the inner tab bar.
// - Added Logo Brand tab: upload logo + product image(s), position & size controls,
//   optional prompt, AI compositing via Gemini multi-image reference.
// - Logo Brand product upload supports 1–10 images in one queue (no single/batch toggle).
// - Scene Gen prompts centralized in utils/scenePrompts.ts with product-preservation instructions.
// - Multi-View: parallel generation with pre-analyze + server-side fast proxy fallback.
// - Batch tabs: 3-wide parallel pool (no artificial delays between items).
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { PromptBar } from './components/PromptBar';
import { ImageGrid } from './components/ImageGrid';
import { UploadZone } from './components/UploadZone';
import { MultiUploadZone } from './components/MultiUploadZone';
import { Button } from './components/Button';
import { GeneratedImage, AspectRatio, ModelType, AppTab, LogoPosition } from './types';
import { generateImageFromGemini, ensureApiKey, analyzeImage } from './services/geminiService';
import { resolveGeminiImageModel } from './utils/imageModels';
import {
  MULTIVIEW_ANGLES,
  buildMultiViewPrompt,
  buildMultiViewPromptWithProduct,
} from './utils/multiViewPrompts';
import { buildLogoPlacementPrompt, getLogoPositionLabel } from './utils/logoPlacement';
import {
  buildSceneBatchCustomPrompt,
  buildSceneCustomPrompt,
  buildSceneSmartPrompts,
  getSceneSmartBatchTemplate,
} from './utils/scenePrompts';
import { AlertCircle, Wand2, Layers, Grid3X3, Palette, BrainCircuit, Users, Loader2, Hand, Images, Upload, X, Trash2, ChevronRight, Package, Box, Stamp, Boxes, ArrowRight, Sparkles } from 'lucide-react';
// - Shared History: POD vs 大货 SKU line; push selected images to Product Optimizer.
import { SkuHandoff, SkuHandoffMode, createSkuHandoffFromImages, orderedImagesFromSelection } from './utils/skuHandoff';
import { createOptimizerHandoffFromImages } from './utils/optimizerHandoff';
import { prepareReferenceForApi } from './utils/imageApiPrep';
import { runPool, IMAGE_GEN_POOL_SIZE } from './utils/runPool';
import {
  getStoredImages,
  setStoredImages,
  removeStoredImage,
  clearStoredImages,
  SkuLine,
} from './utils/unifiedHistory';

const SKU_LINE_PREF_KEY = 'ecs_sku_line_pref';

// Helper to shuffle array for random selection
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface ImageStudioAppProps {
  onSendToSku?: (handoff: SkuHandoff) => void;
  onSendToOptimizer?: (handoff: import('./utils/optimizerHandoff').OptimizerHandoff) => void;
}

const ImageStudioApp: React.FC<ImageStudioAppProps> = ({ onSendToSku, onSendToOptimizer }) => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.BACKGROUND);
  const [model, setModel] = useState<ModelType>(ModelType.GEMINI_31_FLASH_IMAGE);
  const [images, setImages] = useState<GeneratedImage[]>(() => getStoredImages());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const [skuLineSelection, setSkuLineSelection] = useState<SkuLine>(() => {
    try {
      const saved = localStorage.getItem(SKU_LINE_PREF_KEY);
      return saved === 'bulk' ? 'bulk' : 'pod';
    } catch {
      return 'pod';
    }
  });
  const [galleryMode, setGalleryMode] = useState<SkuHandoffMode>('single-product');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Background Modes
  const [bgMode, setBgMode] = useState<'single' | 'batch'>('single');
  // Scene Generator Modes
  const [sceneMode, setSceneMode] = useState<'single' | 'batch'>('single');
  // MultiView Modes
  const [multiViewMode, setMultiViewMode] = useState<'single' | 'batch'>('single');

  // Separate upload state for each tab
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [multiViewImage, setMultiViewImage] = useState<string | null>(null);
  const [sceneImage, setSceneImage] = useState<string | null>(null); // Single Reference
  
  // Batch State (Background)
  const [bgBatchFiles, setBgBatchFiles] = useState<{file: File, preview: string}[]>([]);
  // Batch State (Scene)
  const [batchFiles, setBatchFiles] = useState<{file: File, preview: string}[]>([]);
  // Batch State (MultiView)
  const [multiViewBatchFiles, setMultiViewBatchFiles] = useState<{file: File, preview: string}[]>([]);

  // Controlled Prompt State for Scene Tab
  const [scenePrompt, setScenePrompt] = useState('');

  // Refs for Batch Inputs
  const bgBatchInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const multiViewBatchInputRef = useRef<HTMLInputElement>(null);

  // Logo Brand tab state
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoProductFiles, setLogoProductFiles] = useState<{ file: File; preview: string }[]>([]);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('top-right');
  const [logoSizePercent, setLogoSizePercent] = useState(15);
  const [logoPrompt, setLogoPrompt] = useState('');
  const [logoAspectRatio, setLogoAspectRatio] = useState<AspectRatio>('1:1');

  useEffect(() => {
    const syncFromStorage = () => setImages(getStoredImages());
    window.addEventListener('focus', syncFromStorage);
    return () => window.removeEventListener('focus', syncFromStorage);
  }, []);

  useEffect(() => {
    setStoredImages(images);
  }, [images]);

  useEffect(() => {
    try {
      localStorage.setItem(SKU_LINE_PREF_KEY, skuLineSelection);
    } catch {
      /* ignore */
    }
  }, [skuLineSelection]);

  const handleModelChange = (nextModel: ModelType) => {
    setModel(nextModel);
  };

  const handleGenerate = useCallback(async (
    prompt: string, 
    aspectRatio: AspectRatio, 
    referenceImg?: string | null,
    modelOverride?: ModelType
  ) => {
    setError(null);
    setIsGenerating(true);
    setProgressMessage("Generating...");

    // Use override if provided, otherwise current state
    const targetModel = modelOverride || model;

    try {
      const canProceed = await ensureApiKey(targetModel);
      if (!canProceed) {
        setIsGenerating(false);
        setProgressMessage(null);
        return;
      }

      const refForApi = await prepareReferenceForApi(referenceImg);
      const base64Image = await generateImageFromGemini(
        prompt, 
        aspectRatio, 
        targetModel, 
        refForApi
      );

      const newImage: GeneratedImage = {
        id: crypto.randomUUID(),
        url: base64Image,
        prompt: prompt,
        timestamp: Date.now(),
        aspectRatio,
        model: targetModel,
        tab: activeTab
      };

      setImages(prev => [newImage, ...prev]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while generating the image.");
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  }, [model, activeTab]);

  const handleDelete = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    removeStoredImage(id);
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectionOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const toggleImageSelection = useCallback((id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectionOrder((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const handleSendToOptimizer = useCallback(
    (studioImages: GeneratedImage[]) => {
      if (!onSendToOptimizer || studioImages.length === 0) return;
      onSendToOptimizer(createOptimizerHandoffFromImages(studioImages));
      setSelectedImageIds(new Set());
      setSelectionOrder([]);
    },
    [onSendToOptimizer]
  );

  const handleSendToSku = useCallback(
    (studioImages: GeneratedImage[], mode: SkuHandoffMode = 'single-product') => {
      if (!onSendToSku || studioImages.length === 0) return;
      onSendToSku(createSkuHandoffFromImages(studioImages, skuLineSelection, { autoGenerate: true, mode }));
      setSelectedImageIds(new Set());
      setSelectionOrder([]);
    },
    [onSendToSku, skuLineSelection]
  );

  const selectedOrderedImages = useMemo(
    () => orderedImagesFromSelection(images, selectionOrder.filter((id) => selectedImageIds.has(id))),
    [images, selectionOrder, selectedImageIds]
  );

  // --- Background Tab Handlers ---
  const handleBgGenerate = async (color: string, promptDetails: string) => {
    if (bgMode === 'single') {
      if (!bgImage) {
        setError("Please upload an image first.");
        return;
      }
      const fullPrompt = `Change the background of this image to ${color}. ${promptDetails} Keep the main subject exactly as is.`;
      handleGenerate(fullPrompt, '1:1', bgImage);
    } else {
      if (bgBatchFiles.length === 0) {
        setError("Please upload files first.");
        return;
      }

      setIsGenerating(true);
      setError(null);
      const targetModel = model;
        let successCount = 0;

      try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        const fullPrompt = `Change the background of this image to ${color}. ${promptDetails} Keep the main subject exactly as is.`;

        const results = await runPool(
          bgBatchFiles,
          IMAGE_GEN_POOL_SIZE,
          async ({ preview, file }) => {
            try {
              const ref = await prepareReferenceForApi(preview);
              const generatedBase64 = await generateImageFromGemini(
                fullPrompt,
                '1:1',
                targetModel,
                ref
              );

              const newImage: GeneratedImage = {
                id: crypto.randomUUID(),
                url: generatedBase64,
                prompt: `Batch (${file.name}): ${color}`,
                timestamp: Date.now(),
                aspectRatio: '1:1',
                model: targetModel,
                tab: AppTab.BACKGROUND,
              };

              setImages((prev) => [newImage, ...prev]);
              return true;
            } catch (innerErr) {
              console.error('Background batch item failed:', innerErr);
              return false;
            }
          },
          (done, total) => setProgressMessage(`Background batch ${done}/${total}…`)
        );

        successCount = results.filter(Boolean).length;

        if (successCount === 0) {
            throw new Error("Batch processing failed for all items.");
        }

      } catch (err: any) {
          setError(err.message || "Batch processing failed.");
      } finally {
          setIsGenerating(false);
          setProgressMessage(null);
      }
    }
  };

  // --- MultiView Tab Handler (Single) ---
  const handleMultiViewGenerate = async () => {
    if (!multiViewImage) {
      setError('Please upload a reference product image. Multi-View needs the original photo to preserve the product.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressMessage('Preparing reference image…');

    const ratio: AspectRatio = '1:1';

    try {
      const targetModel = resolveGeminiImageModel(model);
      const canProceed = await ensureApiKey(targetModel);
      if (!canProceed) {
          setIsGenerating(false);
          setProgressMessage(null);
          return;
      }

      const refForApi = await prepareReferenceForApi(multiViewImage);
      let productDescription = 'product';
      try {
        productDescription = await analyzeImage(refForApi ?? multiViewImage);
      } catch {
        productDescription = 'product';
      }

      setProgressMessage('Generating Top, Side, and Zoom in parallel…');

      const genOptions = { productDescription };

      const results = await runPool(
        MULTIVIEW_ANGLES,
        IMAGE_GEN_POOL_SIZE,
        async (view) => {
          try {
            const fullPrompt = buildMultiViewPrompt(view.key);
            const base64Image = await generateImageFromGemini(
              fullPrompt,
              ratio,
              targetModel,
              refForApi,
              undefined,
              genOptions
            );

            const newImage: GeneratedImage = {
              id: crypto.randomUUID(),
              url: base64Image,
              prompt: `${view.label}: ${fullPrompt.slice(0, 80)}...`,
              timestamp: Date.now(),
              aspectRatio: ratio,
              model: targetModel,
              tab: AppTab.MULTIVIEW,
            };

            setImages((prev) => [newImage, ...prev]);
            return newImage;
          } catch (err) {
            console.error(`Failed ${view.label} view:`, err);
            return null;
          }
        },
        (done, total) => setProgressMessage(`Multi-View ${done}/${total}…`)
      );

      const successCount = results.filter((r): r is GeneratedImage => r !== null).length;

      if (successCount === 0) {
        throw new Error('Failed to generate any views. Try a clearer reference photo or check VPN/proxy.');
      }

      if (successCount < MULTIVIEW_ANGLES.length) {
        setError(`Only ${successCount}/${MULTIVIEW_ANGLES.length} views succeeded. You can retry for the missing angles.`);
      }

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to generate multi-view images.");
    } finally {
        setIsGenerating(false);
        setProgressMessage(null);
    }
  };

  // --- MultiView Tab Handler (Batch) ---
  const handleBatchMultiViewGenerate = async () => {
     if (multiViewBatchFiles.length === 0) {
         setError("Please upload files first.");
         return;
     }

     setIsGenerating(true);
     setError(null);
     
     const targetModel = resolveGeminiImageModel(model);
     const ratio: AspectRatio = '1:1';

     try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        let overallSuccess = 0;

        const fileResults = await runPool(
          multiViewBatchFiles,
          2,
          async ({ preview, file }, fileIndex) => {
            const refForApi = await prepareReferenceForApi(preview);
            let productDescription = 'product';
            try {
              productDescription = await analyzeImage(refForApi ?? preview);
            } catch {
              productDescription = 'product';
            }
            const genOptions = { productDescription };

            const viewResults = await runPool(
              MULTIVIEW_ANGLES,
              IMAGE_GEN_POOL_SIZE,
              async (view) => {
                try {
                  const fullPrompt = buildMultiViewPrompt(view.key);
                  const base64Image = await generateImageFromGemini(
                    fullPrompt,
                    ratio,
                    targetModel,
                    refForApi,
                    undefined,
                    genOptions
                  );
                  const newImage: GeneratedImage = {
                    id: crypto.randomUUID(),
                    url: base64Image,
                    prompt: `Batch (${file.name}): ${view.label}`,
                    timestamp: Date.now(),
                    aspectRatio: ratio,
                    model: targetModel,
                    tab: AppTab.MULTIVIEW,
                  };
                  setImages((prev) => [newImage, ...prev]);
                  return true;
                } catch (err) {
                  console.error(`Batch item ${fileIndex + 1} ${view.label} failed:`, err);
                  return false;
                }
              }
            );

            return viewResults.filter(Boolean).length;
          },
          (done, total) =>
            setProgressMessage(`Multi-View batch ${done}/${total} products…`)
        );

        overallSuccess = fileResults.reduce((sum, n) => sum + n, 0);

        if (overallSuccess === 0) throw new Error("Batch processing failed completely.");

     } catch (err: any) {
         setError(err.message || "Batch Multi-View generation failed.");
     } finally {
         setIsGenerating(false);
         setProgressMessage(null);
     }
  };

  // --- Core Batch Logic (Scene) ---
  const executeBatchRun = async (
      promptGenerator: (index: number) => string, 
      label: string,
      aspectRatio: AspectRatio = '1:1'
  ) => {
    if (batchFiles.length === 0) return;

    setIsGenerating(true);
    setError(null);
    const targetModel = model;

    try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        const results = await runPool(
          batchFiles,
          IMAGE_GEN_POOL_SIZE,
          async ({ preview }, i) => {
            try {
              const prompt = promptGenerator(i);
              const ref = await prepareReferenceForApi(preview);
              const generatedBase64 = await generateImageFromGemini(
                prompt,
                aspectRatio,
                targetModel,
                ref
              );

              const newImage: GeneratedImage = {
                id: crypto.randomUUID(),
                url: generatedBase64,
                prompt: `Batch (${label}): ${prompt.substring(0, 30)}...`,
                timestamp: Date.now(),
                aspectRatio,
                model: targetModel,
                tab: AppTab.SCENE,
              };

              setImages((prev) => [newImage, ...prev]);
              return true;
            } catch (innerErr) {
              console.error(`Scene batch item ${i} failed:`, innerErr);
              return false;
            }
          },
          (done, total) => setProgressMessage(`Scene batch ${done}/${total}…`)
        );

        const successCount = results.filter(Boolean).length;
        if (successCount === 0) {
            throw new Error("Batch processing failed for all items.");
        }

    } catch (err: any) {
        setError(err.message || "Batch processing failed.");
    } finally {
        setIsGenerating(false);
        setProgressMessage(null);
    }
  };

  // --- Scene Tab Handler (Unified) ---
  const handleSceneGenerate = (prompt: string, ratio: AspectRatio) => {
    if (sceneMode === 'batch') {
        if (batchFiles.length === 0) {
            setError("Please upload at least one file for batch processing.");
            return;
        }
        const promptGen = () => buildSceneBatchCustomPrompt(prompt);
        executeBatchRun(promptGen, "Custom", ratio);
    } else {
        handleGenerate(buildSceneCustomPrompt(prompt, !!sceneImage), ratio, sceneImage);
    }
  };

  // --- Smart/Styles Handler (Unified) ---
  const handleSmartBatchGenerate = async (type: 'scene' | 'ugc' | 'interaction') => {
    
    // CASE 1: BATCH MODE
    if (sceneMode === 'batch') {
        if (batchFiles.length === 0) {
             setError("Please upload files first.");
             return;
        }
        const promptTemplate = getSceneSmartBatchTemplate(type);
        const promptGen = () => promptTemplate;
        executeBatchRun(promptGen, type === 'scene' ? 'Pro Scene' : type === 'ugc' ? 'Lifestyle' : 'Interaction', '1:1');
        return;
    }

    // CASE 2: SINGLE MODE
    if (!sceneImage) {
      setError("Please upload a reference image first for this feature.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressMessage("Analyzing image...");

    try {
      const sceneRef = await prepareReferenceForApi(sceneImage);
      const objectDescription = await analyzeImage(sceneRef ?? sceneImage!);
      const prompts = buildSceneSmartPrompts(type, true, objectDescription, (items, count) =>
        shuffleArray(items).slice(0, count)
      );

      const targetModel = model;

      const results = await runPool(
        prompts,
        IMAGE_GEN_POOL_SIZE,
        async (prompt) => {
          try {
            const base64Image = await generateImageFromGemini(
              prompt, '1:1', targetModel, sceneRef
            );
            const newImage: GeneratedImage = {
              id: crypto.randomUUID(),
              url: base64Image,
              prompt,
              timestamp: Date.now(),
              aspectRatio: '1:1',
              model: targetModel,
              tab: AppTab.SCENE,
            };
            setImages((prev) => [newImage, ...prev]);
            return true;
          } catch (e) {
            console.error(e);
            return false;
          }
        },
        (done, total) => setProgressMessage(`Smart ${type} ${done}/${total}…`)
      );

      const successCount = results.filter(Boolean).length;
      if (successCount === 0) throw new Error("Failed to generate any images.");

    } catch (err: any) {
      setError(err.message || "Batch generation failed.");
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  };

  // --- Handlers for Batch Uploads (Background) ---
  const triggerBgBatchUpload = () => {
    bgBatchInputRef.current?.click();
  };

  const handleBgBatchSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    setBgBatchFiles(prev => {
        const availableSlots = 10 - prev.length;
        if (availableSlots <= 0) return prev;
        
        const filesToAdd = fileArray.slice(0, availableSlots);
        const newFiles = [...prev];
        
        filesToAdd.forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBgBatchFiles(current => {
                        // Prevent duplicates if needed, but for now just add
                        if (current.length >= 10) return current;
                        return [...current, { file, preview: e.target!.result as string }];
                    });
                }
            };
            reader.readAsDataURL(file);
        });
        
        return newFiles; // This will be updated asynchronously by the reader
    });
    
    if (bgBatchInputRef.current) bgBatchInputRef.current.value = '';
  };

  const removeBgBatchFile = (index: number) => {
      setBgBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Handlers for Batch Uploads (Scene) ---
  const triggerBatchUpload = () => {
    batchInputRef.current?.click();
  };

  const handleBatchSkuSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    setBatchFiles(prev => {
        const availableSlots = 10 - prev.length;
        if (availableSlots <= 0) return prev;
        
        const filesToAdd = fileArray.slice(0, availableSlots);
        const newFiles = [...prev];
        
        filesToAdd.forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBatchFiles(current => {
                        if (current.length >= 10) return current;
                        return [...current, { file, preview: e.target!.result as string }];
                    });
                }
            };
            reader.readAsDataURL(file);
        });

        return newFiles;
    });

    if (batchInputRef.current) batchInputRef.current.value = '';
  };

  const removeBatchFile = (index: number) => {
      setBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Handlers for Batch Uploads (MultiView) ---
  const triggerMultiViewBatchUpload = () => {
    multiViewBatchInputRef.current?.click();
  };

  const handleMultiViewBatchSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    setMultiViewBatchFiles(prev => {
        const availableSlots = 10 - prev.length;
        if (availableSlots <= 0) return prev;
        
        const filesToAdd = fileArray.slice(0, availableSlots);
        const newFiles = [...prev];
        
        filesToAdd.forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setMultiViewBatchFiles(current => {
                        if (current.length >= 10) return current;
                        return [...current, { file, preview: e.target!.result as string }];
                    });
                }
            };
            reader.readAsDataURL(file);
        });

        return newFiles;
    });

    if (multiViewBatchInputRef.current) multiViewBatchInputRef.current.value = '';
  };

  const removeMultiViewBatchFile = (index: number) => {
    setMultiViewBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Logo Brand Tab Handlers ---
  const generateLogoComposite = async (
    productPreview: string,
    fileLabel?: string
  ) => {
    const prompt = buildLogoPlacementPrompt(logoPosition, logoSizePercent, logoPrompt);
    const productRef = await prepareReferenceForApi(productPreview);
    const logoRef = await prepareReferenceForApi(logoImage);
    const generatedBase64 = await generateImageFromGemini(
      prompt,
      logoAspectRatio,
      model,
      undefined,
      [productRef ?? productPreview, logoRef ?? logoImage!]
    );

    const newImage: GeneratedImage = {
      id: crypto.randomUUID(),
      url: generatedBase64,
      prompt: fileLabel
        ? `Logo (${fileLabel}): ${getLogoPositionLabel(logoPosition)} ${logoSizePercent}%`
        : `Logo: ${getLogoPositionLabel(logoPosition)} ${logoSizePercent}%`,
      timestamp: Date.now(),
      aspectRatio: logoAspectRatio,
      model,
      tab: AppTab.LOGO,
    };

    setImages(prev => [newImage, ...prev]);
    return newImage;
  };

  const handleLogoGenerate = async () => {
    if (!logoImage) {
      setError('Please upload a brand logo first.');
      return;
    }

    if (logoProductFiles.length === 0) {
      setError('Please upload at least one product image (up to 10).');
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const canProceed = await ensureApiKey(model);
      if (!canProceed) {
        setIsGenerating(false);
        setProgressMessage(null);
        return;
      }

      const results = await runPool(
        logoProductFiles,
        IMAGE_GEN_POOL_SIZE,
        async ({ preview, file }) => {
          try {
            await generateLogoComposite(preview, file.name);
            return true;
          } catch (innerErr) {
            console.error('Logo item failed:', innerErr);
            return false;
          }
        },
        (done, total) => setProgressMessage(`Logo batch ${done}/${total}…`)
      );

      const successCount = results.filter(Boolean).length;
      if (successCount === 0) {
        throw new Error('Logo placement failed for all images.');
      }
    } catch (err: any) {
      setError(err.message || 'Logo placement failed.');
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  };

  const renderWorkspace = () => {
    switch (activeTab) {
      case AppTab.BACKGROUND:
        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Background Mode Toggle */}
            <div className="flex justify-center">
                <div className="bg-white p-1.5 rounded-xl border border-zinc-200 flex gap-1 shadow-lg shadow-zinc-200/50">
                    <button 
                        onClick={() => setBgMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            bgMode === 'single' 
                            ? 'bg-zinc-100 text-white shadow-sm ring-1 ring-zinc-200' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setBgMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            bgMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Images className="w-4 h-4" /> Batch Studio
                    </button>
                </div>
            </div>

            {bgMode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  <div className="h-[400px]">
                     <UploadZone 
                        currentImage={bgImage} 
                        onImageUpload={setBgImage} 
                        onClear={() => setBgImage(null)} 
                        label="Upload Subject Image"
                     />
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                    <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Background Options
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <Button 
                        onClick={() => handleBgGenerate("solid white", "Clean, high-key lighting.")}
                        disabled={!bgImage || isGenerating}
                        variant="secondary"
                        className="w-full justify-start h-12"
                      >
                        <div className="w-4 h-4 rounded-full bg-white border border-slate-300 mr-3"></div>
                        White Studio Background
                      </Button>
                      <Button 
                        onClick={() => handleBgGenerate("solid studio grey", "Professional photography backdrop.")}
                        disabled={!bgImage || isGenerating}
                        variant="secondary"
                        className="w-full justify-start h-12"
                      >
                        <div className="w-4 h-4 rounded-full bg-slate-500 border border-slate-400 mr-3"></div>
                        Grey Studio Background
                      </Button>
                      <Button 
                        onClick={() => handleBgGenerate("transparent/black", "Isolate subject on a pure black background for easy masking.")}
                        disabled={!bgImage || isGenerating}
                        variant="secondary"
                        className="w-full justify-start h-12"
                      >
                        <div className="w-4 h-4 rounded-full bg-black border border-slate-600 mr-3"></div>
                        Transparent / Dark Background
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="h-full min-h-[400px] bg-white rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center relative overflow-hidden">
                   {images.filter(i => i.tab === AppTab.BACKGROUND).length > 0 ? (
                     <img 
                        src={images.filter(i => i.tab === AppTab.BACKGROUND)[0].url} 
                        alt="Result" 
                        className="w-full h-full object-contain"
                      />
                   ) : (
                     <div className="text-slate-600 text-center">
                       <Wand2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                       <p>Processed image will appear here</p>
                     </div>
                   )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left: Queue */}
                  <div className="lg:col-span-5 space-y-4">
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                           <Images className="w-4 h-4" /> Batch Queue
                      </h3>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 h-[400px] flex flex-col">
                          {bgBatchFiles.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
                                      <Package className="w-8 h-8 text-slate-500" />
                                  </div>
                                  <div>
                                      <h4 className="text-zinc-900 font-medium">No files queued</h4>
                                      <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload up to 10 product images to process them together.</p>
                                  </div>
                                  <Button onClick={triggerBgBatchUpload} variant="secondary">
                                      <Upload className="w-4 h-4 mr-2" /> Upload Files
                                  </Button>
                              </div>
                          ) : (
                              <div className="flex flex-col h-full">
                                  <div className="flex items-center justify-between mb-4">
                                      <span className="text-sm font-medium text-zinc-700">{bgBatchFiles.length} files loaded</span>
                                      <div className="flex gap-2">
                                          <Button onClick={triggerBgBatchUpload} variant="ghost" size="sm" className="h-8" disabled={bgBatchFiles.length >= 10}>
                                              <Upload className="w-3 h-3 mr-2" /> Add
                                          </Button>
                                          <Button onClick={() => setBgBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-500 hover:text-red-300">
                                              Clear
                                          </Button>
                                      </div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                      {bgBatchFiles.map((file, idx) => (
                                          <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-100 rounded-lg border border-zinc-200 group">
                                              <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                              <span className="text-sm text-zinc-700 truncate flex-1">{file.file.name}</span>
                                              <button onClick={() => removeBgBatchFile(idx)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <X className="w-4 h-4" />
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                          <input type="file" multiple accept="image/*" className="hidden" ref={bgBatchInputRef} onChange={handleBgBatchSelect} />
                      </div>
                  </div>

                  {/* Right: Controls */}
                  <div className="lg:col-span-7 space-y-4">
                      <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                        <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Layers className="w-4 h-4" /> Batch Background Options
                        </h3>
                        <p className="text-zinc-500 text-sm mb-6">
                            Apply the same background to all images in your queue.
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          <Button 
                            onClick={() => handleBgGenerate("solid white", "Clean, high-key lighting.")}
                            disabled={bgBatchFiles.length === 0 || isGenerating}
                            variant="secondary"
                            className="w-full justify-start h-12"
                          >
                            <div className="w-4 h-4 rounded-full bg-white border border-slate-300 mr-3"></div>
                            White Studio Background
                          </Button>
                          <Button 
                            onClick={() => handleBgGenerate("solid studio grey", "Professional photography backdrop.")}
                            disabled={bgBatchFiles.length === 0 || isGenerating}
                            variant="secondary"
                            className="w-full justify-start h-12"
                          >
                            <div className="w-4 h-4 rounded-full bg-slate-500 border border-slate-400 mr-3"></div>
                            Grey Studio Background
                          </Button>
                          <Button 
                            onClick={() => handleBgGenerate("transparent/black", "Isolate subject on a pure black background for easy masking.")}
                            disabled={bgBatchFiles.length === 0 || isGenerating}
                            variant="secondary"
                            className="w-full justify-start h-12"
                          >
                            <div className="w-4 h-4 rounded-full bg-black border border-slate-600 mr-3"></div>
                            Transparent / Dark Background
                          </Button>
                        </div>
                      </div>
                  </div>
              </div>
            )}

             {/* Recent Results for Background */}
             {bgMode === 'batch' && images.filter(i => i.tab === AppTab.BACKGROUND).length > 0 && (
               <div className="space-y-6 pt-8 border-t border-zinc-200">
                  <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Recent Background Generations</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {images.filter(i => i.tab === AppTab.BACKGROUND).slice(0, 10).map((img) => (
                          <div key={img.id} className="relative aspect-square bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-lg group">
                              <img 
                                src={img.url} 
                                alt={img.prompt} 
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                                  <p className="text-white text-[10px] font-medium truncate">{img.prompt}</p>
                              </div>
                          </div>
                      ))}
                  </div>
               </div>
             )}
          </div>
        );

      case AppTab.MULTIVIEW:
        const multiViewImages = images.filter(i => i.tab === AppTab.MULTIVIEW);
        const latestMultiView = multiViewImages.slice(0, 3);

        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* MultiView Mode Toggle */}
            <div className="flex justify-center">
                <div className="bg-white p-1.5 rounded-xl border border-zinc-200 flex gap-1 shadow-lg shadow-zinc-200/50">
                    <button 
                        onClick={() => setMultiViewMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            multiViewMode === 'single' 
                            ? 'bg-zinc-100 text-white shadow-sm ring-1 ring-zinc-200' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setMultiViewMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            multiViewMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Images className="w-4 h-4" /> Batch Studio
                    </button>
                </div>
            </div>

            {multiViewMode === 'single' ? (
                // SINGLE MODE UI
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 h-[250px]">
                        <UploadZone 
                            currentImage={multiViewImage} 
                            onImageUpload={setMultiViewImage} 
                            onClear={() => setMultiViewImage(null)} 
                            label="Product Reference (Required)"
                        />
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-end gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                        <h3 className="text-lg font-medium text-zinc-900 mb-2 flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-indigo-400" />
                            Multi-View Generator
                        </h3>
                        <p className="text-zinc-500 text-sm mb-4">
                            Upload your product photo, then generate consistent <strong>Top, Side, and Zoom</strong> views. Uses Gemini image models and preserves the exact product from your reference.
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Top View</span>
                            <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Side Profile</span>
                            <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Zoom Detail</span>
                        </div>
                        </div>
                        <Button
                            onClick={handleMultiViewGenerate}
                            disabled={!multiViewImage || isGenerating}
                            isLoading={isGenerating}
                            size="lg"
                            className="w-full"
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            Generate 3 Views
                        </Button>
                    </div>
                </div>
            ) : (
                // BATCH MODE UI
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Queue */}
                    <div className="lg:col-span-5 space-y-4">
                        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                             <Images className="w-4 h-4" /> Batch Queue
                        </h3>
                        <div className="bg-white border border-zinc-200 rounded-2xl p-6 h-[360px] flex flex-col">
                            {multiViewBatchFiles.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-zinc-900 font-medium">No files queued</h4>
                                        <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload multiple product images to generate views for all of them.</p>
                                    </div>
                                    <Button onClick={triggerMultiViewBatchUpload} variant="secondary">
                                        <Upload className="w-4 h-4 mr-2" /> Upload Files
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-zinc-700">{multiViewBatchFiles.length} files loaded</span>
                                        <div className="flex gap-2">
                                            <Button onClick={triggerMultiViewBatchUpload} variant="ghost" size="sm" className="h-8">
                                                <Upload className="w-3 h-3 mr-2" /> Add
                                            </Button>
                                            <Button onClick={() => setMultiViewBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-500 hover:text-red-300">
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                        {multiViewBatchFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-100 rounded-lg border border-zinc-200 group">
                                                <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                                <span className="text-sm text-zinc-700 truncate flex-1">{file.file.name}</span>
                                                <button onClick={() => removeMultiViewBatchFile(idx)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <input type="file" multiple accept="image/*" className="hidden" ref={multiViewBatchInputRef} onChange={handleMultiViewBatchSelect} />
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="lg:col-span-7 space-y-4 flex flex-col justify-end h-full min-h-[360px]">
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 mb-2">
                           <h3 className="text-lg font-medium text-zinc-900 mb-2 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                Batch Multi-View Processor
                           </h3>
                           <p className="text-zinc-500 text-sm mb-4">
                               This will generate <strong>3 views</strong> (Top, Side, Zoom) for <strong>every image</strong> in your queue.
                           </p>
                           <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-4">
                                <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Top View</span>
                                <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Side Profile</span>
                                <span className="px-2 py-1 bg-zinc-100 rounded border border-zinc-200">Zoom Detail</span>
                           </div>
                        </div>
                        <Button
                            onClick={handleBatchMultiViewGenerate}
                            disabled={multiViewBatchFiles.length === 0 || isGenerating}
                            isLoading={isGenerating}
                            size="lg"
                            className="w-full"
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            Generate All Views
                        </Button>
                    </div>
                </div>
            )}

            {/* Latest Results (Only show in single mode or if images exist) */}
            {latestMultiView.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-200">
                 <h4 className="text-sm font-medium text-zinc-500 uppercase tracking-wider pl-1">Latest Generation</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {latestMultiView.map((img, idx) => (
                      <div key={img.id} className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-xl group">
                          <img 
                            src={img.url} 
                            alt={img.prompt} 
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] uppercase font-semibold px-2.5 py-1 rounded-full border border-white/10">
                              {/* Simple logic for labels, though batch might mix order, keeping it simple for now */}
                             {img.prompt.includes('Zoom') ? "Zoom View" : img.prompt.includes('Side') ? "Side View" : img.prompt.includes('Top') ? "Top View" : "View"}
                          </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        );

      case AppTab.SCENE:
        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* MODE TOGGLE */}
            <div className="flex justify-center">
                <div className="bg-white p-1.5 rounded-xl border border-zinc-200 flex gap-1 shadow-lg shadow-zinc-200/50">
                    <button 
                        onClick={() => setSceneMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sceneMode === 'single' 
                            ? 'bg-zinc-100 text-white shadow-sm ring-1 ring-zinc-200' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setSceneMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sceneMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
                        }`}
                    >
                        <Images className="w-4 h-4" /> Batch Studio
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT COLUMN: UPLOAD / CONTEXT */}
                <div className="lg:col-span-5 space-y-4">
                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        {sceneMode === 'single' ? <Box className="w-4 h-4" /> : <Images className="w-4 h-4" />}
                        {sceneMode === 'single' ? 'Input Image' : 'Batch Queue'}
                    </h3>

                    {sceneMode === 'single' ? (
                        <div className="h-[360px]">
                            <UploadZone 
                                currentImage={sceneImage} 
                                onImageUpload={setSceneImage} 
                                onClear={() => setSceneImage(null)} 
                                label="Upload Reference Object"
                            />
                        </div>
                    ) : (
                        <div className="bg-white border border-zinc-200 rounded-2xl p-6 h-[360px] flex flex-col">
                            {batchFiles.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-zinc-900 font-medium">No files queued</h4>
                                        <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload multiple product images to process them all at once.</p>
                                    </div>
                                    <Button onClick={triggerBatchUpload} variant="secondary">
                                        <Upload className="w-4 h-4 mr-2" /> Upload Files
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-zinc-700">{batchFiles.length} files loaded</span>
                                        <div className="flex gap-2">
                                            <Button onClick={triggerBatchUpload} variant="ghost" size="sm" className="h-8">
                                                <Upload className="w-3 h-3 mr-2" /> Add
                                            </Button>
                                            <Button onClick={() => setBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-500 hover:text-red-300">
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                        {batchFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-100 rounded-lg border border-zinc-200 group">
                                                <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                                <span className="text-sm text-zinc-700 truncate flex-1">{file.file.name}</span>
                                                <button onClick={() => removeBatchFile(idx)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <input type="file" multiple accept="image/*" className="hidden" ref={batchInputRef} onChange={handleBatchSkuSelect} />
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: CONTROLS */}
                <div className="lg:col-span-7 space-y-8">
                     {/* Smart Styles */}
                     <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="w-4 h-4 text-zinc-500" />
                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                                {sceneMode === 'single' ? 'Generate Variations' : 'Apply Batch Style'}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { 
                                    id: 'scene', 
                                    label: 'Smart Scenes', 
                                    icon: BrainCircuit, 
                                    desc: 'Pro commercial backdrops', 
                                    color: 'indigo' 
                                },
                                { 
                                    id: 'ugc', 
                                    label: 'Lifestyle', 
                                    icon: Users, 
                                    desc: 'Cozy authentic home vibes', 
                                    color: 'pink' 
                                },
                                { 
                                    id: 'interaction', 
                                    label: 'Interaction', 
                                    icon: Hand, 
                                    desc: 'Hand-held & action shots', 
                                    color: 'emerald' 
                                }
                            ].map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => handleSmartBatchGenerate(style.id as any)}
                                    disabled={isGenerating || (sceneMode === 'single' && !sceneImage) || (sceneMode === 'batch' && batchFiles.length === 0)}
                                    className={`relative p-5 rounded-2xl text-left border transition-all duration-300 group overflow-hidden ${
                                        (sceneMode === 'single' && !sceneImage) || (sceneMode === 'batch' && batchFiles.length === 0)
                                        ? 'bg-white border-zinc-200 opacity-50 cursor-not-allowed'
                                        : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-2xl'
                                    }`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br from-${style.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                    <div className={`w-10 h-10 rounded-xl bg-${style.color}-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                                        <style.icon className={`w-5 h-5 text-${style.color}-400`} />
                                    </div>
                                    <h4 className="text-zinc-900 font-semibold mb-1 group-hover:text-white">{style.label}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed group-hover:text-zinc-500">{style.desc}</p>
                                </button>
                            ))}
                        </div>
                     </div>

                     <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-zinc-200"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] text-slate-600 uppercase tracking-widest font-bold">Or Custom Prompt</span>
                        <div className="flex-grow border-t border-zinc-200"></div>
                     </div>

                     {/* Custom Prompt */}
                     <PromptBar 
                        onGenerate={handleSceneGenerate} 
                        isGenerating={isGenerating} 
                        placeholder={sceneMode === 'batch' 
                            ? "Describe the scene for ALL items (e.g., 'floating in outer space')..." 
                            : "Describe a custom scene for your object..."}
                        defaultAspectRatio="16:9"
                        value={scenePrompt}
                        onInputChange={setScenePrompt}
                     />
                </div>
            </div>

             {/* Recent Results for Scene */}
             {images.filter(i => i.tab === AppTab.SCENE).length > 0 && (
               <div className="space-y-6 pt-8 border-t border-zinc-200">
                  <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Recent Scene Generations</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {images.filter(i => i.tab === AppTab.SCENE).slice(0, 4).map(img => (
                        <div key={img.id} className="group relative aspect-video bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-zinc-300 transition-all">
                          <img 
                            src={img.url} 
                            alt={img.prompt} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                             <p className="text-xs text-center text-zinc-900 line-clamp-3">{img.prompt}</p>
                          </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
          </div>
        );

      case AppTab.LOGO:
        const logoImages = images.filter(i => i.tab === AppTab.LOGO);
        const logoPositions: { id: LogoPosition; label: string }[] = [
          { id: 'top-left', label: '左上' },
          { id: 'top-right', label: '右上' },
          { id: 'center', label: '正中' },
          { id: 'bottom-left', label: '左下' },
          { id: 'bottom-right', label: '右下' },
        ];
        const logoRatios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-4">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <Stamp className="w-4 h-4" /> Brand Logo
                </h3>
                <div className="h-[200px]">
                  <UploadZone
                    currentImage={logoImage}
                    onImageUpload={setLogoImage}
                    onClear={() => setLogoImage(null)}
                    label="Upload Brand Logo"
                    compact
                  />
                </div>

                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <Images className="w-4 h-4" /> Product Images (1–10)
                </h3>
                <MultiUploadZone
                  items={logoProductFiles}
                  onItemsChange={setLogoProductFiles}
                  maxFiles={10}
                  label="Upload Product Images"
                  hint="Add 1 to 10 images. Drag & drop or click. The same logo applies to each."
                />
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200">
                  <h3 className="text-lg font-medium text-zinc-900 mb-2 flex items-center gap-2">
                    <Stamp className="w-5 h-5 text-indigo-400" />
                    Logo Placement
                  </h3>
                  <p className="text-zinc-500 text-sm mb-6">
                    Upload your brand logo and product image(s). Choose where the logo appears and its size.
                  </p>

                  <div className="mb-6">
                    <label className="text-xs text-slate-500 mb-3 block uppercase tracking-wider font-semibold">
                      Position
                    </label>
                    <div className="grid grid-cols-3 grid-rows-3 gap-2 max-w-[240px]">
                      {logoPositions.map((pos) => {
                        const isActive = logoPosition === pos.id;
                        const gridClass =
                          pos.id === 'top-left'
                            ? 'col-start-1 row-start-1'
                            : pos.id === 'top-right'
                              ? 'col-start-3 row-start-1'
                              : pos.id === 'center'
                                ? 'col-start-2 row-start-2'
                                : pos.id === 'bottom-left'
                                  ? 'col-start-1 row-start-3'
                                  : 'col-start-3 row-start-3';

                        return (
                          <button
                            key={pos.id}
                            onClick={() => setLogoPosition(pos.id)}
                            className={`${gridClass} px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900'
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="text-xs text-slate-500 mb-3 block uppercase tracking-wider font-semibold">
                      Logo Size — {logoSizePercent}% of image width
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        { label: '小', value: 8 },
                        { label: '中', value: 15 },
                        { label: '大', value: 25 },
                      ].map((size) => (
                        <button
                          key={size.value}
                          onClick={() => setLogoSizePercent(size.value)}
                          className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                            logoSizePercent === size.value
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                          }`}
                        >
                          {size.label} ({size.value}%)
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={40}
                      step={1}
                      value={logoSizePercent}
                      onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="text-xs text-slate-500 mb-3 block uppercase tracking-wider font-semibold">
                      Aspect Ratio
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {logoRatios.map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setLogoAspectRatio(ratio)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            logoAspectRatio === ratio
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-400'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider font-semibold">
                      Optional Prompt
                    </label>
                    <textarea
                      value={logoPrompt}
                      onChange={(e) => setLogoPrompt(e.target.value)}
                      placeholder="e.g. Add soft shadow behind logo, keep minimal style..."
                      className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 resize-none min-h-[80px]"
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleLogoGenerate}
                  disabled={
                    isGenerating ||
                    !logoImage ||
                    logoProductFiles.length === 0
                  }
                  isLoading={isGenerating}
                  variant="primary"
                  className="w-full h-14 text-base"
                >
                  {!isGenerating && <Wand2 className="w-5 h-5 mr-2" />}
                  {logoProductFiles.length > 1
                    ? `Generate ${logoProductFiles.length} Images with Logo`
                    : 'Generate with Logo'}
                </Button>
              </div>
            </div>

            {logoImages.length > 0 && (
              <div className="space-y-6 pt-8 border-t border-zinc-200">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Recent Logo Generations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {logoImages.slice(0, 10).map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-lg group"
                    >
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-contain" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-white text-[10px] font-medium truncate">{img.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="studio-root image-studio-root">

      {/* Header with Tabs */}
      <Header
        currentModel={model}
        onModelChange={handleModelChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="pt-32 px-4 max-w-7xl mx-auto min-h-screen flex flex-col pb-20">
        
        {/* Progress Indicator */}
        {isGenerating && (
           <div className="fixed top-32 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md border border-zinc-200 text-zinc-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 fade-in">
             <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
             <span className="text-sm font-medium">{progressMessage || "Processing..."}</span>
           </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-100">Generation Failed</h4>
              <p className="text-sm opacity-90 mt-1">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Active Workspace */}
        <div className="mb-16">
          {renderWorkspace()}
        </div>

        {/* History / Gallery — shared with SKU Generator */}
        <div className="border-t border-zinc-200 pt-12">
          <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">Shared History</h2>
                  <p className="text-sm text-zinc-500 mt-1 max-w-xl">
                    Generate images → choose <strong>POD</strong> or <strong>大货</strong> → select carousel (first = hero) → Generate SKU.
                    History persists across Image Studio and SKU Generator.
                  </p>
                </div>
                {images.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImages([]);
                      setSelectedImageIds(new Set());
                      setSelectionOrder([]);
                      clearStoredImages();
                    }}
                    className="text-slate-500 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Clear images
                  </Button>
                )}
              </div>

              {(onSendToSku || onSendToOptimizer) && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-4">
                  {onSendToSku && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">SKU line</p>
                        <div className="studio-tab-group p-1 inline-flex">
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('pod')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'pod' ? 'studio-tab-active' : ''}`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            POD · FIG-POD-size
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('bulk')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'bulk' ? 'studio-tab-active' : ''}`}
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            大货 · xxx-REG-size
                          </button>
                        </div>
                      </div>

                      {selectedOrderedImages.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Listing mode</p>
                          <div className="studio-tab-group p-1 inline-flex">
                            <button
                              type="button"
                              onClick={() => setGalleryMode('single-product')}
                              className={`studio-tab text-xs ${galleryMode === 'single-product' ? 'studio-tab-active' : ''}`}
                            >
                              1 SKU · {selectedOrderedImages.length} imgs
                            </button>
                            <button
                              type="button"
                              onClick={() => setGalleryMode('bulk-products')}
                              className={`studio-tab text-xs ${galleryMode === 'bulk-products' ? 'studio-tab-active' : ''}`}
                            >
                              {selectedOrderedImages.length}× separate SKUs
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrderedImages.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs text-zinc-600">
                        <span className="font-medium text-indigo-700">{selectedOrderedImages.length} selected</span>
                        {' · '}
                        #{1} hero
                        {selectedOrderedImages.length > 1 && ` · #2–${selectedOrderedImages.length} gallery`}
                      </p>
                      {onSendToSku && (
                        <Button
                          size="sm"
                          onClick={() => handleSendToSku(selectedOrderedImages, galleryMode)}
                        >
                          Generate {skuLineSelection === 'pod' ? 'POD' : '大货'} SKU
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      )}
                      {onSendToOptimizer && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSendToOptimizer(selectedOrderedImages)}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Push to Optimizer
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Select images below — click order = carousel sequence (1st = main image).
                    </p>
                  )}
                </div>
              )}
          </div>
          <ImageGrid
            images={images}
            onDelete={handleDelete}
            selectedIds={selectedImageIds}
            selectionOrder={selectionOrder}
            onToggleSelect={onSendToSku || onSendToOptimizer ? toggleImageSelection : undefined}
            onSendToSku={onSendToSku ? (imgs) => handleSendToSku(imgs, 'single-product') : undefined}
            skuLine={skuLineSelection}
          />
        </div>
        
      </main>
    </div>
  );
};

export default ImageStudioApp;