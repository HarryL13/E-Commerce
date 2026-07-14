// Changes: Hydrate History picker from IndexedDB so Optimizer sees real image pixels.
import React, { useEffect, useState } from 'react';
import { X, ImageIcon, Check, Loader2 } from 'lucide-react';
import {
  getStoredImages,
  hydrateStoredImages,
  StoredImage,
} from '../utils/unifiedHistory';
import { PendingStudioImage } from '../utils/optimizerHandoff';

type HistoryImagePickerProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (images: PendingStudioImage[]) => void;
  productHandle?: string;
};

export const HistoryImagePicker: React.FC<HistoryImagePickerProps> = ({
  open,
  onClose,
  onConfirm,
  productHandle,
}) => {
  const [history, setHistory] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void hydrateStoredImages(getStoredImages())
      .then((imgs) => {
        if (!cancelled) setHistory(imgs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const orderedSelected = selectedIds
    .map((id) => history.find((img) => img.id === id))
    .filter(Boolean) as StoredImage[];

  const handleConfirm = () => {
    if (orderedSelected.length === 0) return;
    onConfirm(
      orderedSelected.map((img) => ({
        url: img.url,
        sourceImageId: img.id,
        fileName: img.fileName,
      }))
    );
    setSelectedIds([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px]"
        aria-label="关闭"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-label="从 Shared History 选择图片"
        className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              从 Shared History 选择替换图
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              点击勾选，顺序 = 轮播顺序（第 1 张 = Hero）
              {productHandle ? ` · 将命名为 ${productHandle}-01.png …` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-zinc-500">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-500 animate-spin" />
              <p className="text-sm">加载 History…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-700">Shared History 暂无图片</p>
              <p className="text-xs mt-1">先在 Image Studio 生成图片后再来替换</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {history.map((img) => {
                const order = selectedIds.indexOf(img.id);
                const selected = order >= 0;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => toggle(img.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all text-left ${
                      selected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <span
                      className={`absolute top-2 left-2 min-w-6 h-6 px-1 rounded-md text-[10px] font-bold flex items-center justify-center ${
                        selected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/90 border border-zinc-300 text-transparent'
                      }`}
                    >
                      {selected ? order + 1 : '✓'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-zinc-100 bg-zinc-50/80 shrink-0">
          <p className="text-xs text-zinc-500">
            {selectedIds.length > 0
              ? `已选 ${selectedIds.length} 张 · #1 Hero`
              : '未选择'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleClose} className="btn-secondary text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="btn-primary text-sm"
            >
              <Check className="w-4 h-4 mr-1.5 inline" />
              用作替换图
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
