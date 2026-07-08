// Changes: SKU upload zone — up to 10 images per product listing.
import React, { useCallback, useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';

interface ImageUploadProps {
  onImagesSelected: (files: File[]) => void;
  imagePreviews: string[];
  onRemoveImage?: (index: number) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImagesSelected, imagePreviews, onRemoveImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onImagesSelected(Array.from(e.dataTransfer.files));
      }
    },
    [onImagesSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onImagesSelected(Array.from(e.target.files));
        e.target.value = '';
      }
    },
    [onImagesSelected]
  );

  return (
    <div
      className="group relative border-2 border-dashed border-zinc-200 rounded-2xl p-6 flex flex-col items-center justify-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 min-h-[16rem] overflow-hidden bg-zinc-50/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => {
        if (imagePreviews.length === 0) fileInputRef.current?.click();
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleChange} className="hidden" />
      {imagePreviews.length > 0 ? (
        <div className="w-full h-full p-2 flex flex-wrap gap-4 justify-center items-center overflow-y-auto">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative group/item">
              <img src={preview} alt={`Preview ${index}`} className="w-24 h-24 object-cover rounded-xl border border-zinc-200 shadow-sm" />
              {onRemoveImage && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveImage(index);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/item:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-30"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {imagePreviews.length < 10 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="w-24 h-24 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors cursor-pointer bg-white"
            >
              <UploadCloud className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">Add More</span>
            </button>
          )}
        </div>
      ) : (
        <div className="text-center flex flex-col items-center cursor-pointer">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-zinc-200 shadow-sm">
            <UploadCloud className="h-8 w-8 text-zinc-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <p className="text-sm font-medium text-zinc-900 mb-1">Click to upload or drag and drop</p>
          <p className="text-xs text-zinc-500">Upload up to 10 images (1 SKU gallery)</p>
        </div>
      )}
    </div>
  );
};
