// Changes: Professional light theme image gallery grid.
import React from 'react';
import { Download, Trash2, Calendar, Ratio, Image as ImageIcon } from 'lucide-react';
import { GeneratedImage } from '../types';

interface ImageGridProps {
  images: GeneratedImage[];
  onDelete: (id: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onDelete }) => {
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
      {images.map((img) => (
        <div
          key={img.id}
          className="group relative bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-zinc-300 transition-all hover:shadow-md"
        >
          <div className="relative aspect-square bg-zinc-100 w-full overflow-hidden">
            <img
              src={img.url}
              alt={img.prompt}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <div className="flex gap-2 justify-end mb-2">
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
      ))}
    </div>
  );
};
