// Changes:
// - Fixed top padding so content isn't hidden under the double header. The outer
//   App.tsx sticky bar is 56px (h-14) and the inner Image Studio Header (now fixed
//   at top-14) is 64px (h-16), totaling ~120px. Increased main's pt-28 -> pt-32.
// - Also bumped the progress toast's `top-24` -> `top-32` so it appears under both
//   headers instead of on top of the inner tab bar.
import React, { useState, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { PromptBar } from './components/PromptBar';
import { ImageGrid } from './components/ImageGrid';
import { UploadZone } from './components/UploadZone';
import { Button } from './components/Button';
import { GeneratedImage, AspectRatio, ModelType, AppTab } from './types';
import { generateImageFromGemini, ensureApiKey, analyzeImage } from './services/geminiService';
import { AlertCircle, Wand2, Layers, Grid3X3, Palette, BrainCircuit, Users, Loader2, Hand, Images, Upload, X, Trash2, ChevronRight, Package, Box } from 'lucide-react';

// Helper to shuffle array for random selection
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const ImageStudioApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.BACKGROUND);
  const [model, setModel] = useState<ModelType>(ModelType.FLASH);
  const [images, setImages] = useState<GeneratedImage[]>([]);
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
  // Controlled Prompt State for MultiView Batch
  const [multiViewBatchPrompt, setMultiViewBatchPrompt] = useState('');

  // Refs for Batch Inputs
  const bgBatchInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const multiViewBatchInputRef = useRef<HTMLInputElement>(null);

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

      const base64Image = await generateImageFromGemini(
        prompt, 
        aspectRatio, 
        targetModel, 
        referenceImg || undefined
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
  }, []);

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
      const targetModel = ModelType.FLASH;
      let successCount = 0;

      try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        for (let i = 0; i < bgBatchFiles.length; i++) {
            const { preview, file } = bgBatchFiles[i];
            setProgressMessage(`Processing Item ${i + 1} of ${bgBatchFiles.length}...`);

            if (i > 0) await new Promise(r => setTimeout(r, 1000));

            try {
                const fullPrompt = `Change the background of this image to ${color}. ${promptDetails} Keep the main subject exactly as is.`;
                
                const generatedBase64 = await generateImageFromGemini(
                    fullPrompt,
                    '1:1',
                    targetModel,
                    preview 
                );

                const newImage: GeneratedImage = {
                    id: crypto.randomUUID(),
                    url: generatedBase64,
                    prompt: `Batch (${file.name}): ${color}`,
                    timestamp: Date.now(),
                    aspectRatio: '1:1',
                    model: targetModel,
                    tab: AppTab.BACKGROUND
                };

                setImages(prev => [newImage, ...prev]);
                successCount++;
            } catch (innerErr) {
                console.error(`Error processing batch item ${i}:`, innerErr);
            }
        }

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
  const handleMultiViewGenerate = async (prompt: string, ratio: AspectRatio) => {
    const viewConfigs = [
      { suffix: "Top-down view (plan view).", label: "Top" },
      { suffix: "Side profile view.", label: "Side" },
      { suffix: "Detailed zoom-in close-up.", label: "Zoom" }
    ];
    
    setIsGenerating(true);
    setError(null);
    setProgressMessage("Starting Multi-View Generation...");

    try {
      const targetModel = ModelType.FLASH;
      const canProceed = await ensureApiKey(targetModel);
      if (!canProceed) {
          setIsGenerating(false);
          setProgressMessage(null);
          return;
      }

      let successCount = 0;

      for (const [index, view] of viewConfigs.entries()) {
        try {
          setProgressMessage(`Generating ${view.label} view (${index + 1}/3)...`);
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          const fullPrompt = `${view.suffix} ${prompt} Professional product photography, neutral background, consistent lighting.`;
          
          const base64Image = await generateImageFromGemini(
            fullPrompt, 
            ratio, 
            targetModel, 
            multiViewImage || undefined
          );

          const newImage: GeneratedImage = {
            id: crypto.randomUUID(),
            url: base64Image,
            prompt: fullPrompt, 
            timestamp: Date.now(),
            aspectRatio: ratio,
            model: targetModel,
            tab: AppTab.MULTIVIEW
          };

          setImages(prev => [newImage, ...prev]);
          successCount++;
          
        } catch (innerErr) {
          console.error(`Failed to generate ${view.label} view:`, innerErr);
        }
      }

      if (successCount === 0) {
        throw new Error("Failed to generate any views. Please check your connection or try a different image.");
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
  const handleBatchMultiViewGenerate = async (commonPrompt: string, ratio: AspectRatio) => {
     if (multiViewBatchFiles.length === 0) {
         setError("Please upload files first.");
         return;
     }

     setIsGenerating(true);
     setError(null);
     
     const viewConfigs = [
        { suffix: "Top-down view (plan view).", label: "Top" },
        { suffix: "Side profile view.", label: "Side" },
        { suffix: "Detailed zoom-in close-up.", label: "Zoom" }
     ];

     const targetModel = ModelType.FLASH;

     try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        let overallSuccess = 0;

        for (let i = 0; i < multiViewBatchFiles.length; i++) {
            const { preview, file } = multiViewBatchFiles[i];
            
            // Step 1: Determine Prompt
            let promptToUse = commonPrompt;
            if (!promptToUse || promptToUse.trim() === '') {
                setProgressMessage(`Analyzing Item ${i + 1}/${multiViewBatchFiles.length}...`);
                try {
                    promptToUse = await analyzeImage(preview);
                } catch (e) {
                    promptToUse = "Product";
                }
            }

            // Step 2: Generate Views
            for (const [vIdx, view] of viewConfigs.entries()) {
                setProgressMessage(`Item ${i + 1}: Generating ${view.label} (${vIdx + 1}/3)...`);
                
                // Rate limiting pause
                if (vIdx > 0 || i > 0) await new Promise(r => setTimeout(r, 1500));

                try {
                    const fullPrompt = `${view.suffix} ${promptToUse} Professional product photography, neutral background, consistent lighting.`;
                    
                    const base64Image = await generateImageFromGemini(
                        fullPrompt, 
                        ratio, 
                        targetModel, 
                        preview
                    );

                    const newImage: GeneratedImage = {
                        id: crypto.randomUUID(),
                        url: base64Image,
                        prompt: `Batch (${file.name}): ${view.label}`, 
                        timestamp: Date.now(),
                        aspectRatio: ratio,
                        model: targetModel,
                        tab: AppTab.MULTIVIEW
                    };

                    setImages(prev => [newImage, ...prev]);
                    overallSuccess++;

                } catch (err) {
                    console.error(`Failed View ${view.label} for item ${i}`, err);
                }
            }
        }

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
    const targetModel = ModelType.FLASH;
    let successCount = 0;

    try {
        const canProceed = await ensureApiKey(targetModel);
        if (!canProceed) {
            setIsGenerating(false);
            setProgressMessage(null);
            return;
        }

        for (let i = 0; i < batchFiles.length; i++) {
            const { preview } = batchFiles[i];
            setProgressMessage(`Processing Item ${i + 1} of ${batchFiles.length}...`);

            if (i > 0) await new Promise(r => setTimeout(r, 1000));

            try {
                const prompt = promptGenerator(i);
                
                const generatedBase64 = await generateImageFromGemini(
                    prompt,
                    aspectRatio,
                    targetModel,
                    preview 
                );

                const newImage: GeneratedImage = {
                    id: crypto.randomUUID(),
                    url: generatedBase64,
                    prompt: `Batch (${label}): ${prompt.substring(0, 30)}...`,
                    timestamp: Date.now(),
                    aspectRatio: aspectRatio,
                    model: targetModel,
                    tab: AppTab.SCENE
                };

                setImages(prev => [newImage, ...prev]);
                successCount++;
            } catch (innerErr) {
                console.error(`Error processing batch item ${i}:`, innerErr);
            }
        }

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
        const promptGen = () => "Place the object from this reference image into the following scene: " + prompt;
        executeBatchRun(promptGen, "Custom", ratio);
    } else {
        if (!sceneImage) {
            // Optional: Allow generation without image
        }
        const prefix = sceneImage 
          ? "Place the object from this reference image into the following scene: " 
          : "Create a scene described as: ";
        
        handleGenerate(prefix + prompt, ratio, sceneImage);
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
        let promptTemplate = "";
        
        if (type === 'scene') {
            promptTemplate = "Professional product photography of this object placed on a polished white marble surface, modern minimal background, soft high-key lighting.";
        } else if (type === 'ugc') {
            promptTemplate = "A realistic lifestyle photo of this object on a wooden coffee table in a cozy living room, warm sunlight, authentic home vibe.";
        } else {
            promptTemplate = "Close-up shot of a hand holding this object, showing scale and interaction, blurred natural background.";
        }

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
      const objectDescription = await analyzeImage(sceneImage);
      
      let prompts: string[] = [];

      // --- SCENE LOGIC ---
      if (type === 'scene') {
        prompts = [
          `High-end commercial photography of the ${objectDescription} placed on a polished white marble coffee table in a sunlit modern living room.`,
          `Interior design style shot: The ${objectDescription} displayed on a wooden shelf, minimal home decor.`,
          `Elegant product shot of the ${objectDescription} on a clean vanity table, morning light.`,
          `The ${objectDescription} placed on a textured fabric surface in a cozy bedroom setting.`,
          `A professional shot of the ${objectDescription} on a clean kitchen island countertop, modern white cabinetry.`
        ];
      } 
      // --- LIFESTYLE (UGC) LOGIC ---
      else if (type === 'ugc') {
        const ugcPool = [
           `A realistic POV photo of a hand holding the ${objectDescription} inside a cozy living room, warm ambient light.`,
           `A casual lifestyle snap of the ${objectDescription} sitting on a bedside table next to a lamp and a book.`,
           `The ${objectDescription} placed on a home office desk next to a laptop and a steaming coffee cup.`,
           `A candid photo of the ${objectDescription} on a rustic wooden entryway console table.`,
           `User-generated content style: The ${objectDescription} resting on a soft textured throw blanket on a sofa.`,
           `A bright morning shot of the ${objectDescription} on a kitchen counter near a window.`,
           `The ${objectDescription} placed on a window sill with raindrops on the glass, moody aesthetic.`,
           `A summer vibe shot of the ${objectDescription} on an outdoor patio table with dappled sunlight.`,
           `The ${objectDescription} sitting on a bathroom vanity shelf, clean and spa-like atmosphere.`,
           `Top-down view of the ${objectDescription} on a picnic blanket in the grass.`
        ];
        // Raffle: Randomly select 5 unique scenes
        prompts = shuffleArray(ugcPool).slice(0, 5);
      } 
      // --- INTERACTION LOGIC ---
      else {
        const interactionPool = [
           `A realistic POV shot of a hand holding the ${objectDescription} inside a modern home living room, with a sofa and soft decor in the background.`,
           `Close-up interaction: someone's hand resting on the ${objectDescription} on a desk in a quiet library, with rows of books in the background.`,
           `A shot of the ${objectDescription} being held up in a modern shopping mall, with bright commercial lighting and glass storefronts.`,
           `Street photography style: a hand holding the ${objectDescription} with a blurred city street and pavement in the background.`,
           `A casual shot of the ${objectDescription} being used at a coffee shop table, with a warm, social atmosphere in the background.`,
           `A hand holding the ${objectDescription} against a clear blue sky in a park, nature background.`,
           `A professional setting: a hand holding the ${objectDescription} in a modern office, glass walls in background.`,
           `A hand holding the ${objectDescription} inside a car, dashboard and steering wheel visible.`,
           `A hand holding the ${objectDescription} in a study hall, quiet academic atmosphere with wooden desks.`,
           `A hand holding the ${objectDescription} in a grocery store aisle, shelves in background.`
        ];
        // Raffle: Randomly select 5 unique scenes
        prompts = shuffleArray(interactionPool).slice(0, 5);
      }

      let successCount = 0;
      const targetModel = ModelType.FLASH;

      for (let i = 0; i < prompts.length; i++) {
        setProgressMessage(`Generating ${type} variation ${i + 1} of ${prompts.length}...`);
        if (i > 0) await new Promise(r => setTimeout(r, 1500)); 

        try {
            const base64Image = await generateImageFromGemini(prompts[i], '1:1', targetModel, sceneImage);
            const newImage: GeneratedImage = {
                id: crypto.randomUUID(),
                url: base64Image,
                prompt: prompts[i],
                timestamp: Date.now(),
                aspectRatio: '1:1',
                model: targetModel,
                tab: AppTab.SCENE
            };
            setImages(prev => [newImage, ...prev]);
            successCount++;
        } catch (e) { console.error(e); }
      }
      
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

  const renderWorkspace = () => {
    switch (activeTab) {
      case AppTab.BACKGROUND:
        return (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Background Mode Toggle */}
            <div className="flex justify-center">
                <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex gap-1 shadow-lg shadow-black/20">
                    <button 
                        onClick={() => setBgMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            bgMode === 'single' 
                            ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setBgMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            bgMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
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
                
                <div className="h-full min-h-[400px] bg-slate-900 rounded-2xl border-2 border-dashed border-slate-800 flex items-center justify-center relative overflow-hidden">
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
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                           <Images className="w-4 h-4" /> Batch Queue
                      </h3>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[400px] flex flex-col">
                          {bgBatchFiles.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                                      <Package className="w-8 h-8 text-slate-500" />
                                  </div>
                                  <div>
                                      <h4 className="text-slate-200 font-medium">No files queued</h4>
                                      <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload up to 10 product images to process them together.</p>
                                  </div>
                                  <Button onClick={triggerBgBatchUpload} variant="secondary">
                                      <Upload className="w-4 h-4 mr-2" /> Upload Files
                                  </Button>
                              </div>
                          ) : (
                              <div className="flex flex-col h-full">
                                  <div className="flex items-center justify-between mb-4">
                                      <span className="text-sm font-medium text-slate-300">{bgBatchFiles.length} files loaded</span>
                                      <div className="flex gap-2">
                                          <Button onClick={triggerBgBatchUpload} variant="ghost" size="sm" className="h-8" disabled={bgBatchFiles.length >= 10}>
                                              <Upload className="w-3 h-3 mr-2" /> Add
                                          </Button>
                                          <Button onClick={() => setBgBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300">
                                              Clear
                                          </Button>
                                      </div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                      {bgBatchFiles.map((file, idx) => (
                                          <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg border border-slate-700 group">
                                              <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                              <span className="text-sm text-slate-300 truncate flex-1">{file.file.name}</span>
                                              <button onClick={() => removeBgBatchFile(idx)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Layers className="w-4 h-4" /> Batch Background Options
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
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
               <div className="space-y-6 pt-8 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Recent Background Generations</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {images.filter(i => i.tab === AppTab.BACKGROUND).slice(0, 10).map((img) => (
                          <div key={img.id} className="relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg group">
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
                <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex gap-1 shadow-lg shadow-black/20">
                    <button 
                        onClick={() => setMultiViewMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            multiViewMode === 'single' 
                            ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setMultiViewMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            multiViewMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
                            label="Reference (Optional)"
                        />
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-end">
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-2">
                        <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-indigo-400" />
                            Multi-View Generator
                        </h3>
                        <p className="text-slate-400 text-sm">
                            Upload a single image to generate consistent <strong>Top, Side, and Zoom-in</strong> views automatically. Perfect for product listings.
                        </p>
                        </div>
                        <PromptBar 
                        onGenerate={handleMultiViewGenerate} 
                        isGenerating={isGenerating} 
                        placeholder="Describe your subject (e.g., 'A futuristic sneaker')..."
                        defaultAspectRatio="1:1" 
                        />
                    </div>
                </div>
            ) : (
                // BATCH MODE UI
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Queue */}
                    <div className="lg:col-span-5 space-y-4">
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                             <Images className="w-4 h-4" /> Batch Queue
                        </h3>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[360px] flex flex-col">
                            {multiViewBatchFiles.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-200 font-medium">No files queued</h4>
                                        <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload multiple product images to generate views for all of them.</p>
                                    </div>
                                    <Button onClick={triggerMultiViewBatchUpload} variant="secondary">
                                        <Upload className="w-4 h-4 mr-2" /> Upload Files
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-slate-300">{multiViewBatchFiles.length} files loaded</span>
                                        <div className="flex gap-2">
                                            <Button onClick={triggerMultiViewBatchUpload} variant="ghost" size="sm" className="h-8">
                                                <Upload className="w-3 h-3 mr-2" /> Add
                                            </Button>
                                            <Button onClick={() => setMultiViewBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300">
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                        {multiViewBatchFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg border border-slate-700 group">
                                                <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                                <span className="text-sm text-slate-300 truncate flex-1">{file.file.name}</span>
                                                <button onClick={() => removeMultiViewBatchFile(idx)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-2">
                           <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                Batch Multi-View Processor
                           </h3>
                           <p className="text-slate-400 text-sm mb-4">
                               This will generate <strong>3 views</strong> (Top, Side, Zoom) for <strong>every image</strong> in your queue.
                           </p>
                           <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Top View</span>
                                <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Side Profile</span>
                                <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Zoom Detail</span>
                           </div>
                        </div>
                        <PromptBar 
                            onGenerate={handleBatchMultiViewGenerate} 
                            isGenerating={isGenerating} 
                            placeholder="Optional: Common description (e.g., 'A leather shoe'). Leave empty to auto-detect."
                            defaultAspectRatio="1:1" 
                            value={multiViewBatchPrompt}
                            onInputChange={setMultiViewBatchPrompt}
                        />
                    </div>
                </div>
            )}

            {/* Latest Results (Only show in single mode or if images exist) */}
            {latestMultiView.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                 <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider pl-1">Latest Generation</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {latestMultiView.map((img, idx) => (
                      <div key={img.id} className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
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
                <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex gap-1 shadow-lg shadow-black/20">
                    <button 
                        onClick={() => setSceneMode('single')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sceneMode === 'single' 
                            ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Single Product
                    </button>
                    <button 
                        onClick={() => setSceneMode('batch')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sceneMode === 'batch' 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <Images className="w-4 h-4" /> Batch Studio
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT COLUMN: UPLOAD / CONTEXT */}
                <div className="lg:col-span-5 space-y-4">
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
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
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[360px] flex flex-col">
                            {batchFiles.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-200 font-medium">No files queued</h4>
                                        <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto">Upload multiple product images to process them all at once.</p>
                                    </div>
                                    <Button onClick={triggerBatchUpload} variant="secondary">
                                        <Upload className="w-4 h-4 mr-2" /> Upload Files
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-slate-300">{batchFiles.length} files loaded</span>
                                        <div className="flex gap-2">
                                            <Button onClick={triggerBatchUpload} variant="ghost" size="sm" className="h-8">
                                                <Upload className="w-3 h-3 mr-2" /> Add
                                            </Button>
                                            <Button onClick={() => setBatchFiles([])} variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300">
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                                        {batchFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg border border-slate-700 group">
                                                <img src={file.preview} className="w-10 h-10 rounded bg-black object-cover" />
                                                <span className="text-sm text-slate-300 truncate flex-1">{file.file.name}</span>
                                                <button onClick={() => removeBatchFile(idx)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            <Palette className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
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
                                        ? 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:shadow-2xl'
                                    }`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br from-${style.color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                    <div className={`w-10 h-10 rounded-xl bg-${style.color}-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                                        <style.icon className={`w-5 h-5 text-${style.color}-400`} />
                                    </div>
                                    <h4 className="text-slate-200 font-semibold mb-1 group-hover:text-white">{style.label}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-400">{style.desc}</p>
                                </button>
                            ))}
                        </div>
                     </div>

                     <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] text-slate-600 uppercase tracking-widest font-bold">Or Custom Prompt</span>
                        <div className="flex-grow border-t border-slate-800"></div>
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
               <div className="space-y-6 pt-8 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Recent Scene Generations</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {images.filter(i => i.tab === AppTab.SCENE).slice(0, 4).map(img => (
                        <div key={img.id} className="group relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all">
                          <img 
                            src={img.url} 
                            alt={img.prompt} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                             <p className="text-xs text-center text-slate-200 line-clamp-3">{img.prompt}</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 image-studio-root">

      {/* Header with Tabs */}
      <Header
        currentModel={model}
        onModelChange={setModel}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="pt-32 px-4 max-w-7xl mx-auto min-h-screen flex flex-col pb-20">
        
        {/* Progress Indicator */}
        {isGenerating && (
           <div className="fixed top-32 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in">
             <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
             <span className="text-sm font-medium">{progressMessage || "Processing..."}</span>
           </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 animate-in fade-in slide-in-from-top-2 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-100">Generation Failed</h4>
              <p className="text-sm opacity-90 mt-1">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Active Workspace */}
        <div className="mb-16">
          {renderWorkspace()}
        </div>

        {/* History / Gallery */}
        <div className="border-t border-slate-800 pt-12">
          <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                History
              </h2>
              {images.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setImages([])} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4 mr-2" /> Clear All
                  </Button>
              )}
          </div>
          <ImageGrid images={images} onDelete={handleDelete} />
        </div>
        
      </main>
    </div>
  );
};

export default ImageStudioApp;