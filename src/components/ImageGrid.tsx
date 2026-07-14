// Changes: Gallery selection badges; selected order is reordered via SelectableImageStrip drag.
import React from 'react';
import { Download, Trash2, Calendar, Ratio, Image as ImageIcon, Package, Boxes, Link2 } from 'lucide-react';
import { GeneratedImage } from '../types';
import { SkuLine } from '../utils/unifiedHistory';

interface ImageGridProps {
  images: GeneratedImage[];
  onDelete: (id: string) => void;
  selectedIds?: Set<string>;
  selectionOrder?: string[];
  onToggleSelect?: (id: string) => void;
  onSendToSku?: (images: GeneratedImage[]) => void;
  skuLine?: SkuLine;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onDelete,
  selectedIds,
  selectionOrder = [],
  onToggleSelect,
  onSendToSku,
  skuLine = 'pod',
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

  const orderIndex = (id: string) => {
    const idx = selectionOrder.indexOf(id);
    return idx >= 0 ? idx + 1 : null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-32">
      {images.map((img) => {
        const isSelected = selectedIds?.has(img.id) ?? false;
        const selNum = orderIndex(img.id);
        const downloadName = img.fileName || `studio-${img.id.slice(0, 8)}.png`;

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
                  className={`absolute top-3 left-3 z-10 min-w-6 h-6 px-1 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white/90 border-zinc-300 text-transparent hover:border-indigo-400'
                  }`}
                  title="Select for SKU carousel (drag selected strip to reorder)"
                >
                  {selNum ?? '✓'}
                </button>
              )}

              {img.linkedHandle && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-semibold">
                  <Link2 className="w-3 h-3" />
                  {img.linkedHandle}
                </div>
              )}

              <img
                src={img.url}
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                {onSendToSku && (
                  <button
                    type="button"
                    onClick={() => onSendToSku([img])}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-semibold transition-colors mb-3 ${
                      skuLine === 'pod' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    {skuLine === 'pod' ? (
                      <>
                        <Package className="w-3.5 h-3.5" />
                        Quick POD SKU
                      </>
                    ) : (
                      <>
                        <Boxes className="w-3.5 h-3.5" />
                        Quick 大货 SKU
                      </>
                    )}
                  </button>
                )}

                <div className="flex gap-2 justify-end">
                  <a
                    href={img.url}
                    download={downloadName}
                    className="p-2 bg-white/90 hover:bg-white rounded-full text-zinc-800 border border-zinc-200 transition-colors shadow-sm"
                    title={`Download as ${downloadName}`}
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
              {img.fileName && (
                <p className="text-[10px] font-mono text-indigo-600 mb-1 truncate" title={img.fileName}>
                  {img.fileName}
                </p>
              )}
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
