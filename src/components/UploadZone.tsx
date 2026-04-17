import React, { useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface UploadZoneProps {
  currentImage: string | null;
  onImageUpload: (base64: string) => void;
  onClear: () => void;
  label?: string;
  compact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
  currentImage, 
  onImageUpload, 
  onClear,
  label = "Upload Reference Image",
  compact = false
}) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onImageUpload(base64String);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  if (currentImage) {
    return (
      <div className="relative group w-full h-full min-h-[240px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-inner">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <img 
          src={currentImage} 
          alt="Reference" 
          className="w-full h-full object-contain p-4 relative z-10"
        />
        <div className="absolute top-0 right-0 p-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
           <button
            onClick={onClear}
            className="p-2 bg-slate-900/80 hover:bg-red-500/80 text-slate-200 hover:text-white rounded-full backdrop-blur-md transition-all shadow-lg border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className={`relative flex flex-col items-center justify-center w-full h-full ${compact ? 'min-h-[160px]' : 'min-h-[240px]'} bg-slate-900/50 hover:bg-slate-900/80 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden`}>
      <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="flex flex-col items-center justify-center p-6 text-center relative z-10">
        <div className={`mb-4 rounded-full bg-slate-800 border border-slate-700 group-hover:scale-110 group-hover:border-indigo-500/30 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300 ${compact ? 'p-3' : 'p-4'}`}>
            <Upload className={`text-slate-400 group-hover:text-indigo-400 transition-colors ${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
        </div>
        <p className="mb-2 text-sm text-slate-200 font-medium group-hover:text-white transition-colors">{label}</p>
        <p className="text-xs text-slate-500 group-hover:text-slate-400">PNG, JPG (Max 5MB)</p>
      </div>
      <input 
        type="file" 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange}
      />
    </label>
  );
};