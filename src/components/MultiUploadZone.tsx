// Changes: Multi-image upload zone for Image Studio (dark theme). Supports drag-and-drop
// and file picker, up to maxFiles (default 10).
import React, { useCallback, useRef } from 'react';
import { Upload, X, Package } from 'lucide-react';
import { Button } from './Button';

interface UploadItem {
  file: File;
  preview: string;
}

interface MultiUploadZoneProps {
  items: UploadItem[];
  onItemsChange: (items: UploadItem[]) => void;
  maxFiles?: number;
  label?: string;
  hint?: string;
  className?: string;
}

export const MultiUploadZone: React.FC<MultiUploadZoneProps> = ({
  items,
  onItemsChange,
  maxFiles = 10,
  label = 'Upload Images',
  hint = 'Upload up to 10 images. Drag & drop or click to add.',
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const appendFiles = useCallback(
    (fileList: File[]) => {
      const available = maxFiles - items.length;
      if (available <= 0) return;

      const toAdd = fileList.slice(0, available);
      const readers = toAdd.map(
        (file) =>
          new Promise<UploadItem>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({ file, preview: e.target!.result as string });
            };
            reader.readAsDataURL(file);
          })
      );

      Promise.all(readers).then((newItems) => {
        onItemsChange([...items, ...newItems].slice(0, maxFiles));
      });
    },
    [items, maxFiles, onItemsChange]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    appendFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    appendFiles(Array.from(files));
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const triggerUpload = () => inputRef.current?.click();

  return (
    <div
      className={`bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[280px] ${className}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {items.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center space-y-4 cursor-pointer"
          onClick={triggerUpload}
        >
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <h4 className="text-slate-200 font-medium">{label}</h4>
            <p className="text-slate-500 text-sm mt-1 max-w-[240px] mx-auto">{hint}</p>
          </div>
          <Button onClick={(e) => { e.stopPropagation(); triggerUpload(); }} variant="secondary">
            <Upload className="w-4 h-4 mr-2" /> Upload Images
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-[240px]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-300">
              {items.length} / {maxFiles} images
            </span>
            <div className="flex gap-2">
              <Button
                onClick={triggerUpload}
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={items.length >= maxFiles}
              >
                <Upload className="w-3 h-3 mr-2" /> Add
              </Button>
              <Button
                onClick={() => onItemsChange([])}
                variant="ghost"
                size="sm"
                className="h-8 text-red-400 hover:text-red-300"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {items.map((item, idx) => (
                <div key={`${item.file.name}-${idx}`} className="relative group aspect-square">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-full h-full rounded-lg bg-black object-cover border border-slate-700"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1 truncate px-0.5">{item.file.name}</p>
                </div>
              ))}
              {items.length < maxFiles && (
                <button
                  onClick={triggerUpload}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
                >
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
};
