// Changes: Draggable selected-image strip — reorder carousel sequence before SKU/Optimizer handoff.
import React, { useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { GeneratedImage } from '../types';

type SelectableImageStripProps = {
  images: GeneratedImage[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove?: (id: string) => void;
};

export const SelectableImageStrip: React.FC<SelectableImageStripProps> = ({
  images,
  onReorder,
  onRemove,
}) => {
  const dragFrom = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragFrom.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from =
      dragFrom.current ??
      Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isFinite(from) && from !== toIndex) {
      onReorder(from, toIndex);
    }
    dragFrom.current = null;
    setDragOverIndex(null);
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    dragFrom.current = null;
    setDragOverIndex(null);
    setDraggingIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          已选顺序 · 拖拽调整
        </p>
        <p className="text-[10px] text-zinc-400">第 1 张 = 主图 Hero</p>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
        role="list"
        aria-label="已选图片顺序，可拖拽排序"
      >
        {images.map((img, index) => {
          const isOver = dragOverIndex === index;
          const isDragging = draggingIndex === index;

          return (
            <div
              key={img.id}
              role="listitem"
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`group relative shrink-0 w-20 select-none cursor-grab active:cursor-grabbing rounded-xl border-2 bg-white transition-all ${
                isDragging
                  ? 'opacity-40 border-indigo-300 scale-95'
                  : isOver
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-105'
                    : index === 0
                      ? 'border-indigo-500'
                      : 'border-zinc-200 hover:border-zinc-300'
              }`}
              title={index === 0 ? '主图 · 拖拽调整顺序' : `#${index + 1} · 拖拽调整顺序`}
            >
              <div className="absolute top-1 left-1 z-10 flex items-center gap-0.5">
                <span className="min-w-5 h-5 px-1 rounded-md bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
              <div className="absolute top-1 right-1 z-10 text-zinc-400 pointer-events-none">
                <GripVertical className="w-3.5 h-3.5 drop-shadow" />
              </div>
              {onRemove ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(img.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="取消选择"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
              <img
                src={img.url}
                alt={`Selected ${index + 1}`}
                className="w-20 h-20 object-cover rounded-[10px] pointer-events-none"
                draggable={false}
              />
              {index === 0 ? (
                <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold uppercase tracking-wider bg-indigo-600/90 text-white rounded px-1 py-0.5">
                  Hero
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
