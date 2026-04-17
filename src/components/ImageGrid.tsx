import React from 'react';
import { Download, ExternalLink, Trash2, Calendar, Ratio, Image as ImageIcon } from 'lucide-react';
import { GeneratedImage } from '../types';

interface ImageGridProps {
  images: GeneratedImage[];
  onDelete: (id: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onDelete }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-20 h-20 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-center mb-6 shadow-xl shadow-black/20">
          <ImageIcon className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-200 mb-2">Create your first masterpiece</h3>
        <p className="max-w-sm text-sm text-slate-500">
          Upload a reference image, choose a style or write a prompt, and watch the AI bring your vision to life.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-32">
      {images.map((img) => (
        <div 
          key={img.id} 
          className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 transition-all hover:shadow-2xl hover:shadow-indigo-500/10"
        >
          {/* Image Container */}
          <div className="relative aspect-square bg-slate-950 w-full overflow-hidden">
            <img 
              src={img.url} 
              alt={img.prompt} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <div className="flex gap-2 justify-end mb-2">
                 <a 
                  href={img.url} 
                  download={`imaginarium-${img.id}.png`}
                  className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white border border-white/10 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => onDelete(img.id)}
                  className="p-2 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full text-red-200 hover:text-white border border-red-500/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <p className="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed font-medium" title={img.prompt}>
              {img.prompt}
            </p>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
               <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(img.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               </div>
               <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-md border border-slate-700/50">
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