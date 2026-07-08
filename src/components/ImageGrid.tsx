// Changes: Image gallery with one-click FIG-POD / FIG-NOL SKU handoff to SKU Generator.
import React from 'react';
import { Download, Trash2, Calendar, Ratio, Image as ImageIcon, Package, Boxes } from 'lucide-react';
import { GeneratedImage } from '../types';
import { PriceMode } from '../utils/podPricing';

interface ImageGridProps {
  images: GeneratedImage[];
  onDelete: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSendToSku?: (images: GeneratedImage[], priceMode: PriceMode) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onDelete,
  selectedIds,
  onToggleSelect,
  onSendToSku,
}) => {
  const selectionEnabled = Boolean(onToggleSelect && selectedIds);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
          <ImageIcon className="w-8 h-8 text-zinc-400" />
        </div>
        <h3 className="text-lg font-medium text-zinc-900 mb-2">No generated images yet</h3>
        <p className="max-w-sm text-sm text-zinc-500">
          Upload a reference image, choose a style or write a prompt, and generate your first result.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-32">
      {images.map((img) => {
        const isSelected = selectedIds?.has(img.id) ?? false;

        return (
          <div
            key={img.id}
            className={`group relative bg-white rounded-2xl overflow-hidden border transition-all hover:shadow-md ${
              isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="relative aspect-square bg-zinc-100 w-full overflow-hidden">
              {selectionEnabled && (
                <button
                  type="button"
                  onClick={() => onToggleSelect?.(img.id)}
                  className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white/90 border-zinc-300 text-transparent hover:border-indigo-400'
                  }`}
                  title="Select for bulk SKU"
                >
                  ✓
                </button>
              )}

              <img
                src={img.url}
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                {onSendToSku && (
                  <div className="flex flex-col gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => onSendToSku([img], 'pod-default')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Generate FIG-POD SKU
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendToSku([img], 'custom')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/95 hover:bg-white text-zinc-800 text-xs font-semibold border border-zinc-200 transition-colors"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      Generate FIG-NOL SKU
                    </button>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <a
                    href={img.url}
                    download={`studio-${img.id}.png`}
                    className="p-2 bg-white/90 hover:bg-white rounded-full text-zinc-800 border border-zinc-200 transition-colors shadow-sm"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => onDelete(img.id)}
                    className="p-2 bg-red-500/90 hover:bg-red-500 rounded-full text-white transition-colors shadow-sm"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-zinc-100">
              <p className="text-xs text-zinc-700 line-clamp-2 mb-3 leading-relaxed font-medium" title={img.prompt}>
                {img.prompt}
              </p>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200">
                  <Ratio className="w-3 h-3" />
                  <span>{img.aspectRatio}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
