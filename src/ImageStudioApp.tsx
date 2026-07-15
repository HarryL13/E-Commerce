// Changes: Compact Multi-View toolbar (mode/base/Zoom/NEW) — cut stacked option cards.
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { PromptBar } from './components/PromptBar';
import { ImageGrid } from './components/ImageGrid';
import { SelectableImageStrip } from './components/SelectableImageStrip';
import { UploadZone } from './components/UploadZone';
import { MultiUploadZone } from './components/MultiUploadZone';
import { Button } from './components/Button';
import { GeneratedImage, AspectRatio, ModelType, AppTab, LogoPosition } from './types';
import { generateImageFromGemini, ensureApiKey, analyzeImage } from './services/geminiService';
import { resolveGeminiImageModel } from './utils/imageModels';
import {
  ImageSize,
  compositePxForImageSize,
  readImageSizePreference,
  writeImageSizePreference,
} from './utils/imageQuality';
import {
  MULTIVIEW_ANGLES,
  MultiViewAngle,
  buildMultiViewPrompt,
  buildMultiViewPromptWithProduct,
  getActiveMultiViewAngles,
  readMultiViewIncludeZoom,
  writeMultiViewIncludeZoom,
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
import { runPool, IMAGE_GEN_POOL_SIZE, MULTIVIEW_POOL_SIZE } from './utils/runPool';
import { StudioWorkflowSnapshot } from './components/WorkflowBar';
import {
  SKU_BASE_TEMPLATES,
  SkuBaseVariant,
  readSkuBasePreference,
  writeSkuBasePreference,
} from './utils/skuBaseTemplates';
import { compositeMultiViewOnSkuBase } from './utils/multiViewComposite';
import {
  NEW_TAG_SCALE_MAX,
  NEW_TAG_SCALE_MIN,
  readNewTagEnabled,
  readNewTagScale,
  writeNewTagEnabled,
  writeNewTagScale,
} from './utils/newTagOverlay';
import {
  getStoredImages,
  setStoredImages,
  removeStoredImage,
  clearStoredImages,
  persistGeneratedImage,
  hydrateStoredImages,
  mergeImagesById,
  SkuLine,
} from './utils/unifiedHistory';
import { WorkflowUxMode } from './utils/workflowGuide';

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
  workflowUxMode?: WorkflowUxMode;
  onSendToSku?: (handoff: SkuHandoff) => void;
  onSendToOptimizer?: (handoff: import('./utils/optimizerHandoff').OptimizerHandoff) => void;
  onWorkflowChange?: (snapshot: StudioWorkflowSnapshot) => void;
  onGoToOptimizer?: () => void;
}

const ImageStudioApp: React.FC<ImageStudioAppProps> = ({
  workflowUxMode = 'standalone',
  onSendToSku,
  onSendToOptimizer,
  onWorkflowChange,
  onGoToOptimizer,
}) => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.BACKGROUND);
  const [imageSize, setImageSize] = useState<ImageSize>(() => readImageSizePreference());
  const model = ModelType.GEMINI_31_FLASH_IMAGE;
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
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
  const isGeneratingRef = useRef(false);

  // Background Modes
  const [bgMode, setBgMode] = useState<'single' | 'batch'>('single');
  // Scene Generator Modes
  const [sceneMode, setSceneMode] = useState<'single' | 'batch'>('single');
  // MultiView Modes
  const [multiViewMode, setMultiViewMode] = useState<'single' | 'batch'>('single');
  const [multiViewSkuBase, setMultiViewSkuBase] = useState<SkuBaseVariant>(() => readSkuBasePreference());
  const [multiViewNewTagEnabled, setMultiViewNewTagEnabled] = useState(() => readNewTagEnabled());
  const [multiViewNewTagScale, setMultiViewNewTagScale] = useState(() => readNewTagScale());
  const [multiViewIncludeZoom, setMultiViewIncludeZoom] = useState(() => readMultiViewIncludeZoom());

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
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Hydrate History from IndexedDB (pixels) + localStorage (meta)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hydrated = await hydrateStoredImages(getStoredImages());
        if (!cancelled) setImages(hydrated);
      } catch (e) {
        console.error('History hydrate failed', e);
        if (!cancelled) setImages(getStoredImages().filter((img) => Boolean(img.url)));
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus/visibility: MERGE with storage — never wipe in-memory gens (esp. mid-batch).
  useEffect(() => {
    const syncFromStorage = () => {
      if (isGeneratingRef.current) return;
      void hydrateStoredImages(getStoredImages()).then((hydrated) => {
        setImages((prev) => mergeImagesById(prev, hydrated));
      });
    };
    window.addEventListener('focus', syncFromStorage);
    const onVis = () => {
      if (document.visibilityState === 'visible') syncFromStorage();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', syncFromStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    setStoredImages(images);
  }, [images, historyReady]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isGeneratingRef.current) return;
      e.preventDefault();
      e.returnValue = '还在生成中，离开可能中断当前请求；已完成的图会保留。';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /** Push into History UI + durable store immediately (survives tab switch). */
  const commitGeneratedImage = useCallback((newImage: GeneratedImage) => {
    setImages((prev) => [newImage, ...prev]);
    void persistGeneratedImage(newImage);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SKU_LINE_PREF_KEY, skuLineSelection);
    } catch {
      /* ignore */
    }
  }, [skuLineSelection]);

  const handleImageSizeChange = (next: ImageSize) => {
    setImageSize(next);
    writeImageSizePreference(next);
  };

  const selectMultiViewSkuBase = (variant: SkuBaseVariant) => {
    setMultiViewSkuBase(variant);
    writeSkuBasePreference(variant);
  };

  const toggleMultiViewNewTag = (enabled: boolean) => {
    setMultiViewNewTagEnabled(enabled);
    writeNewTagEnabled(enabled);
  };

  const setMultiViewNewTagScalePref = (scale: number) => {
    const clamped = Math.min(NEW_TAG_SCALE_MAX, Math.max(NEW_TAG_SCALE_MIN, Math.round(scale)));
    setMultiViewNewTagScale(clamped);
    writeNewTagScale(clamped);
  };

  const toggleMultiViewIncludeZoom = (enabled: boolean) => {
    setMultiViewIncludeZoom(enabled);
    writeMultiViewIncludeZoom(enabled);
  };

  const activeMultiViewAngles = useMemo(
    () => getActiveMultiViewAngles(multiViewIncludeZoom),
    [multiViewIncludeZoom]
  );

  const applyMultiViewSkuBase = async (rawUrl: string): Promise<string> => {
    try {
      return await compositeMultiViewOnSkuBase(rawUrl, multiViewSkuBase, {
        newTag: {
          enabled: multiViewNewTagEnabled,
          scalePercent: multiViewNewTagScale,
        },
        outputPx: compositePxForImageSize(imageSize),
      });
    } catch (err) {
      console.warn('SKU base composite failed, using raw image', err);
      return rawUrl;
    }
  };

  const prepRef = useCallback(
    (dataUrl: string | null | undefined) => prepareReferenceForApi(dataUrl, imageSize),
    [imageSize]
  );

  const genOpts = useCallback(
    (extra?: { productDescription?: string; preferProxy?: boolean }) => ({
      imageSize,
      onRetry: (attempt: number, maxAttempts: number) => {
        setProgressMessage(`失败自动重试 ${attempt}/${maxAttempts}…`);
      },
      ...extra,
    }),
    [imageSize]
  );

  const handleGenerate = useCallback(async (
    prompt: string, 
    aspectRatio: AspectRatio, 
    referenceImg?: string | null,
    modelOverride?: ModelType
  ) => {
    setError(null);
    setIsGenerating(true);
    setProgressMessage("Generating...");

    const targetModel = modelOverride || model;

    try {
      const canProceed = await ensureApiKey(targetModel);
      if (!canProceed) {
        setIsGenerating(false);
        setProgressMessage(null);
        return;
      }

      const refForApi = await prepRef(referenceImg);
      const base64Image = await generateImageFromGemini(
        prompt, 
        aspectRatio, 
        targetModel, 
        refForApi,
        undefined,
        genOpts()
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

      commitGeneratedImage(newImage);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while generating the image.");
    } finally {
      setIsGenerating(false);
      setProgressMessage(null);
    }
  }, [model, activeTab, prepRef, genOpts, commitGeneratedImage]);

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

  const reorderSelection = useCallback((fromIndex: number, toIndex: number) => {
    setSelectionOrder((prev) => {
      const active = prev.filter((id) => selectedImageIds.has(id));
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= active.length ||
        toIndex >= active.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const nextActive = [...active];
      const [moved] = nextActive.splice(fromIndex, 1);
      nextActive.splice(toIndex, 0, moved);
      const inactive = prev.filter((id) => !selectedImageIds.has(id));
      return [...nextActive, ...inactive];
    });
  }, [selectedImageIds]);

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

  useEffect(() => {
    onWorkflowChange?.({
      selectedCount: selectedOrderedImages.length,
      totalImages: images.length,
      skuLine: skuLineSelection,
    });
  }, [selectedOrderedImages.length, images.length, skuLineSelection, onWorkflowChange]);

  // --- Background Tab Handlers ---
  const handleBgGenerate = async (color: string, promptDetails: string) => {
    if (bgMode === 'single') {
      if (!bgImage) {
        setError("Please upload an image first.");
        return;
      }
      const fullPrompt = `Change the background of this image to ${color}. ${promptDetails} Keep the main subject exactly as is, ultra-sharp high-resolution product detail.`;
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

        const fullPrompt = `Change the background of this image to ${color}. ${promptDetails} Keep the main subject exactly as is, ultra-sharp high-resolution product detail.`;

        const results = await runPool(
          bgBatchFiles,
          IMAGE_GEN_POOL_SIZE,
          async ({ preview, file }) => {
            try {
              const ref = await prepRef(preview);
              const generatedBase64 = await generateImageFromGemini(
                fullPrompt,
                '1:1',
                targetModel,
                ref,
                undefined,
                genOpts()
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

              commitGeneratedImage(newImage);
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
  // Parallel 4-angle gen often drops 1 view on proxy rate limits; retry failures.
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

      const refForApi = await prepRef(multiViewImage);
      let productDescription = 'product';
      try {
        productDescription = await analyzeImage(refForApi ?? multiViewImage);
      } catch {
        productDescription = 'product';
      }

      const angles = activeMultiViewAngles;
      type AngleItem = { key: MultiViewAngle; label: string; labelZh: string };
      const angleListLabel = angles.map((v) => v.label).join(', ');
      const generateAngle = async (view: AngleItem) => {
        const fullPrompt = buildMultiViewPrompt(view.key, undefined, multiViewSkuBase);
        const base64Image = await generateImageFromGemini(
          fullPrompt,
          ratio,
          targetModel,
          refForApi,
          undefined,
          genOpts({ productDescription })
        );
        const finalUrl = await applyMultiViewSkuBase(base64Image);
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: finalUrl,
          prompt: `${view.label}: ${fullPrompt.slice(0, 80)}...`,
          timestamp: Date.now(),
          aspectRatio: ratio,
          model: targetModel,
          tab: AppTab.MULTIVIEW,
        };
        commitGeneratedImage(newImage);
        return newImage;
      };

      setProgressMessage(`Generating ${angleListLabel}…`);

      const firstPass = await runPool(
        angles as AngleItem[],
        MULTIVIEW_POOL_SIZE,
        async (view: AngleItem) => {
          try {
            return await generateAngle(view);
          } catch (err) {
            console.error(`Failed ${view.label} view:`, err);
            return null;
          }
        },
        (done, total) => setProgressMessage(`Multi-View ${done}/${total}…`)
      );

      // Auto-recover missing angles for several rounds (each angle still retries inside).
      const MAX_RECOVERY_ROUNDS = 3;
      for (let round = 1; round <= MAX_RECOVERY_ROUNDS; round++) {
        const failedAngles = angles.filter((_, i) => firstPass[i] === null);
        if (failedAngles.length === 0) break;

        setProgressMessage(
          `自动补全缺失视角 (${round}/${MAX_RECOVERY_ROUNDS}): ${failedAngles.map((v) => v.labelZh).join('、')}…`
        );

        for (const view of failedAngles) {
          const idx = angles.findIndex((v) => v.key === view.key);
          try {
            firstPass[idx] = await generateAngle(view);
          } catch (err) {
            console.error(`Recovery round ${round} failed ${view.label}:`, err);
          }
        }
      }

      const successCount = firstPass.filter((r): r is GeneratedImage => r !== null).length;
      const stillFailed = angles.filter((_, i) => firstPass[i] === null).map((v) => v.labelZh);

      if (successCount === 0) {
        throw new Error('Failed to generate any views. Try a clearer reference photo or check VPN/proxy.');
      }

      if (stillFailed.length > 0) {
        setError(
          `自动重试后仍缺 ${stillFailed.join('、')}（${successCount}/${angles.length}）。可再点一次 Generate 补全。`
        );
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
        let overallMissing = 0;

        // Process products one at a time so leaving mid-batch still keeps finished products saved.
        for (let fileIndex = 0; fileIndex < multiViewBatchFiles.length; fileIndex++) {
          const { preview, file } = multiViewBatchFiles[fileIndex];
          setProgressMessage(
            `Multi-View batch ${fileIndex + 1}/${multiViewBatchFiles.length}: ${file.name.slice(0, 24)}…`
          );

          const refForApi = await prepRef(preview);
          let productDescription = 'product';
          try {
            productDescription = await analyzeImage(refForApi ?? preview);
          } catch {
            productDescription = 'product';
          }

          const angles = activeMultiViewAngles as {
            key: MultiViewAngle;
            label: string;
            labelZh: string;
          }[];
          const generateAngle = async (view: (typeof angles)[number]) => {
            const fullPrompt = buildMultiViewPrompt(view.key, undefined, multiViewSkuBase);
            const base64Image = await generateImageFromGemini(
              fullPrompt,
              ratio,
              targetModel,
              refForApi,
              undefined,
              genOpts({ productDescription })
            );
            const finalUrl = await applyMultiViewSkuBase(base64Image);
            const newImage: GeneratedImage = {
              id: crypto.randomUUID(),
              url: finalUrl,
              prompt: `Batch (${file.name}): ${view.label}`,
              timestamp: Date.now(),
              aspectRatio: ratio,
              model: targetModel,
              tab: AppTab.MULTIVIEW,
            };
            commitGeneratedImage(newImage);
            return true;
          };

          const firstPass = await runPool(
            angles,
            MULTIVIEW_POOL_SIZE,
            async (view: (typeof angles)[number]) => {
              try {
                return await generateAngle(view);
              } catch (err) {
                console.error(`Batch item ${fileIndex + 1} ${view.label} failed:`, err);
                return false;
              }
            }
          );

          const MAX_RECOVERY_ROUNDS = 3;
          for (let round = 1; round <= MAX_RECOVERY_ROUNDS; round++) {
            const failedAngles = angles.filter((_, i) => !firstPass[i]);
            if (failedAngles.length === 0) break;
            setProgressMessage(
              `Batch ${fileIndex + 1}/${multiViewBatchFiles.length} 自动补全 (${round}/${MAX_RECOVERY_ROUNDS}): ${failedAngles
                .map((v) => v.labelZh)
                .join('、')}…`
            );
            for (const view of failedAngles) {
              const idx = angles.findIndex((v) => v.key === view.key);
              try {
                firstPass[idx] = await generateAngle(view);
              } catch (err) {
                console.error(`Batch recovery failed ${view.label}:`, err);
              }
            }
          }

          const ok = firstPass.filter(Boolean).length;
          overallSuccess += ok;
          overallMissing += angles.length - ok;
        }

        if (overallSuccess === 0) throw new Error('Batch processing failed completely.');
        if (overallMissing > 0) {
          setError(
            `Batch 完成：成功 ${overallSuccess} 张，仍缺 ${overallMissing} 张（已自动重试）。可对缺的产品再点 Generate。`
          );
        }
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
              const ref = await prepRef(preview);
              const generatedBase64 = await generateImageFromGemini(
                prompt,
                aspectRatio,
                targetModel,
                ref,
                undefined,
                genOpts()
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

              commitGeneratedImage(newImage);
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
      const sceneRef = await prepRef(sceneImage);
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
              prompt, '1:1', targetModel, sceneRef, undefined, genOpts()
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
            commitGeneratedImage(newImage);
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
    const productRef = await prepRef(productPreview);
    const logoRef = await prepRef(logoImage);
    const generatedBase64 = await generateImageFromGemini(
      prompt,
      logoAspectRatio,
      model,
      undefined,
      [productRef ?? productPreview, logoRef ?? logoImage!],
      genOpts()
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

    commitGeneratedImage(newImage);
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
        const latestMultiView = multiViewImages.slice(0, activeMultiViewAngles.length);

        return (
          <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300">
            {/* Compact options bar — mode + base + Zoom + NEW */}
            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex bg-zinc-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMultiViewMode('single')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    multiViewMode === 'single'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setMultiViewMode('batch')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    multiViewMode === 'batch'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Batch
                </button>
              </div>

              <div className="w-px h-5 bg-zinc-200 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">底图</span>
                {(['white', 'black'] as const).map((variant) => {
                  const tpl = SKU_BASE_TEMPLATES[variant];
                  const active = multiViewSkuBase === variant;
                  return (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => selectMultiViewSkuBase(variant)}
                      title={tpl.labelZh}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-sm border ${
                          variant === 'white' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-700'
                        }`}
                      />
                      {tpl.labelZh}
                    </button>
                  );
                })}
              </div>

              <div className="w-px h-5 bg-zinc-200 hidden sm:block" />

              <button
                type="button"
                role="switch"
                aria-checked={multiViewIncludeZoom}
                onClick={() => toggleMultiViewIncludeZoom(!multiViewIncludeZoom)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  multiViewIncludeZoom
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span
                  className={`relative w-7 h-4 rounded-full transition-colors ${
                    multiViewIncludeZoom ? 'bg-indigo-600' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                      multiViewIncludeZoom ? 'translate-x-3' : ''
                    }`}
                  />
                </span>
                Zoom 细节
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={multiViewNewTagEnabled}
                onClick={() => toggleMultiViewNewTag(!multiViewNewTagEnabled)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  multiViewNewTagEnabled
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span
                  className={`relative w-7 h-4 rounded-full transition-colors ${
                    multiViewNewTagEnabled ? 'bg-indigo-600' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                      multiViewNewTagEnabled ? 'translate-x-3' : ''
                    }`}
                  />
                </span>
                NEW
              </button>

              {multiViewNewTagEnabled ? (
                <div className="flex items-center gap-2 ml-auto min-w-[140px] max-w-[200px] flex-1">
                  <span className="text-[10px] text-zinc-400 shrink-0">大小</span>
                  <input
                    type="range"
                    min={NEW_TAG_SCALE_MIN}
                    max={NEW_TAG_SCALE_MAX}
                    step={1}
                    value={multiViewNewTagScale}
                    onChange={(e) => setMultiViewNewTagScalePref(Number(e.target.value))}
                    className="w-full h-1.5 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-indigo-700 tabular-nums w-8 text-right">
                    {multiViewNewTagScale}%
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 ml-auto hidden md:block">
                  {activeMultiViewAngles.map((a) => a.labelZh).join(' · ')}
                </p>
              )}
            </div>

            {multiViewMode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-stretch">
                <div className="h-[220px]">
                  <UploadZone
                    currentImage={multiViewImage}
                    onImageUpload={setMultiViewImage}
                    onClear={() => setMultiViewImage(null)}
                    label="产品图"
                  />
                </div>
                <div className="flex flex-col justify-end gap-3">
                  <p className="text-sm text-zinc-500">
                    上传参考图后生成{' '}
                    <span className="font-medium text-zinc-800">
                      {activeMultiViewAngles.map((a) => a.labelZh).join('、')}
                    </span>
                    {multiViewIncludeZoom ? '' : '（可开 Zoom）'}
                  </p>
                  <Button
                    onClick={handleMultiViewGenerate}
                    disabled={!multiViewImage || isGenerating}
                    isLoading={isGenerating}
                    size="lg"
                    className="w-full md:w-auto md:min-w-[240px]"
                  >
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate {activeMultiViewAngles.length} Views
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 min-h-[260px] flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Queue · {multiViewBatchFiles.length}
                    </span>
                    <div className="flex gap-1">
                      <Button onClick={triggerMultiViewBatchUpload} variant="ghost" size="sm" className="h-7 text-xs">
                        <Upload className="w-3 h-3 mr-1" /> Add
                      </Button>
                      {multiViewBatchFiles.length > 0 ? (
                        <Button
                          onClick={() => setMultiViewBatchFiles([])}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500"
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {multiViewBatchFiles.length === 0 ? (
                    <button
                      type="button"
                      onClick={triggerMultiViewBatchUpload}
                      className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">上传多张产品图</span>
                    </button>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[280px] pr-1">
                      {multiViewBatchFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-1.5 rounded-lg bg-zinc-50 border border-zinc-100 group"
                        >
                          <img src={file.preview} className="w-9 h-9 rounded object-cover" alt="" />
                          <span className="text-xs text-zinc-700 truncate flex-1">{file.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeMultiViewBatchFile(idx)}
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    ref={multiViewBatchInputRef}
                    onChange={handleMultiViewBatchSelect}
                  />
                </div>
                <div className="flex flex-col gap-3 lg:pt-1">
                  <p className="text-sm text-zinc-500">
                    每张出{' '}
                    <span className="font-medium text-zinc-800">{activeMultiViewAngles.length}</span> 视角
                  </p>
                  <Button
                    onClick={handleBatchMultiViewGenerate}
                    disabled={multiViewBatchFiles.length === 0 || isGenerating}
                    isLoading={isGenerating}
                    size="lg"
                    className="w-full"
                  >
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate All
                  </Button>
                </div>
              </div>
            )}

            {latestMultiView.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-zinc-200">
                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Latest</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {latestMultiView.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square bg-white rounded-xl overflow-hidden border border-zinc-200"
                    >
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-contain" />
                      <div className="absolute top-2 left-2 bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {img.prompt.includes('Front') || img.prompt.includes('正面')
                          ? '正面全身'
                          : img.prompt.includes('Zoom')
                            ? 'Zoom'
                            : img.prompt.includes('Side')
                              ? 'Side'
                              : img.prompt.includes('Top')
                                ? 'Top'
                                : 'View'}
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
                        defaultAspectRatio="1:1"
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
                        <div key={img.id} className="group relative aspect-square bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-zinc-300 transition-all">
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
    <div className="image-studio-root">

      <Header
        imageSize={imageSize}
        onImageSizeChange={handleImageSizeChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="studio-main-offset px-4 max-w-7xl mx-auto min-h-screen flex flex-col pb-20">
        
        {/* Progress Indicator */}
        {isGenerating && (
           <div className="fixed top-[calc(var(--chrome-stack-h)+0.5rem)] left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md border border-zinc-200 text-zinc-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4 fade-in">
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
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Shared History</h2>
              {workflowUxMode === 'pipeline' ? (
                <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                  全 tab 共享的图片库。勾选后可在上方拖拽调整顺序（第 1 张 = 主图），再
                  <strong className="text-indigo-700"> 继续生成 SKU</strong> 进入下一步。
                </p>
              ) : (
                <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                  独立使用 — 所有 tab 生成的图片集中在此。勾选后可拖拽调整顺序，再推送到 SKU Generator。
                </p>
              )}
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
            <div
              className={`history-action-dock mb-6 ${
                workflowUxMode === 'pipeline' ? 'history-action-dock-pipeline' : ''
              }`}
            >
              {workflowUxMode === 'pipeline' ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200">
                      完整流程 · Step 2
                    </span>
                  </div>

                  {onSendToSku && (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                          SKU 产品线
                        </p>
                        <div className="studio-tab-group p-1 inline-flex">
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('pod')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'pod' ? 'studio-tab-active' : ''}`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            POD
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('bulk')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'bulk' ? 'studio-tab-active' : ''}`}
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            大货
                          </button>
                        </div>
                      </div>

                      {selectedOrderedImages.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                            Listing 模式
                          </p>
                          <div className="studio-tab-group p-1 inline-flex">
                            <button
                              type="button"
                              onClick={() => setGalleryMode('single-product')}
                              className={`studio-tab text-xs ${galleryMode === 'single-product' ? 'studio-tab-active' : ''}`}
                            >
                              1 SKU · {selectedOrderedImages.length} 图
                            </button>
                            <button
                              type="button"
                              onClick={() => setGalleryMode('bulk-products')}
                              className={`studio-tab text-xs ${galleryMode === 'bulk-products' ? 'studio-tab-active' : ''}`}
                            >
                              {selectedOrderedImages.length}× 独立 SKU
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrderedImages.length > 0 && onSendToSku ? (
                    <div className="space-y-3">
                      <SelectableImageStrip
                        images={selectedOrderedImages}
                        onReorder={reorderSelection}
                        onRemove={toggleImageSelection}
                      />
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        onClick={() => handleSendToSku(selectedOrderedImages, galleryMode)}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        继续生成 SKU
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      在下方网格勾选图片，然后拖拽调整顺序 — 选好后点击「继续生成 SKU」
                    </p>
                  )}

                  {onGoToOptimizer ? (
                    <button
                      type="button"
                      onClick={onGoToOptimizer}
                      className="text-[11px] text-zinc-400 hover:text-violet-600 transition-colors"
                    >
                      要更新已有 Shopify 产品？前往 Optimizer →
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  {onSendToSku && selectedOrderedImages.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                          SKU line
                        </p>
                        <div className="studio-tab-group p-1 inline-flex">
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('pod')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'pod' ? 'studio-tab-active' : ''}`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            POD
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkuLineSelection('bulk')}
                            className={`studio-tab flex items-center gap-1.5 text-xs ${skuLineSelection === 'bulk' ? 'studio-tab-active' : ''}`}
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            大货
                          </button>
                        </div>
                      </div>

                      {selectedOrderedImages.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                            Listing mode
                          </p>
                          <div className="studio-tab-group p-1 inline-flex">
                            <button
                              type="button"
                              onClick={() => setGalleryMode('single-product')}
                              className={`studio-tab text-xs ${galleryMode === 'single-product' ? 'studio-tab-active' : ''}`}
                            >
                              1 SKU
                            </button>
                            <button
                              type="button"
                              onClick={() => setGalleryMode('bulk-products')}
                              className={`studio-tab text-xs ${galleryMode === 'bulk-products' ? 'studio-tab-active' : ''}`}
                            >
                              {selectedOrderedImages.length}× SKU
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrderedImages.length > 0 ? (
                    <div className="space-y-3">
                      <SelectableImageStrip
                        images={selectedOrderedImages}
                        onReorder={reorderSelection}
                        onRemove={toggleImageSelection}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        {onSendToSku && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSendToSku(selectedOrderedImages, galleryMode)}
                          >
                            <Package className="w-3.5 h-3.5 mr-1.5" />
                            推送到 SKU Generator
                          </Button>
                        )}
                        {onSendToOptimizer && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-violet-700 hover:bg-violet-50"
                            onClick={() => handleSendToOptimizer(selectedOrderedImages)}
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            Push to Optimizer
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      勾选图片后可拖拽调整顺序，再推送到 SKU Generator 或 Optimizer（非必须）
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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