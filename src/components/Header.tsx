// Changes: Image Studio subheader — tabs + 1K/2K precision (model selector removed).
import React from 'react';
import { Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
import { AppTab } from '../types';
import { ImageSize, IMAGE_SIZE_OPTIONS } from '../utils/imageQuality';

interface HeaderProps {
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  imageSize,
  onImageSizeChange,
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: AppTab.BACKGROUND, label: 'Background', icon: Layers },
    { id: AppTab.MULTIVIEW, label: 'Multi-View', icon: Grid3X3 },
    { id: AppTab.SCENE, label: 'Scene Gen', icon: Palette },
    { id: AppTab.LOGO, label: 'Logo Brand', icon: Stamp },
  ];

  return (
    <header className="studio-subheader">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <nav className="studio-tab-group overflow-x-auto no-scrollbar min-w-0 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`studio-tab flex items-center gap-2 ${isActive ? 'studio-tab-active' : ''}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div
          className="flex items-center gap-2 shrink-0 border-l border-zinc-200 pl-3"
          role="group"
          aria-label="生成精度"
        >
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
            精度
          </span>
          <div className="studio-tab-group p-0.5">
            {IMAGE_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onImageSizeChange(opt.value)}
                className={`studio-tab px-3 py-1.5 text-xs font-semibold ${
                  imageSize === opt.value ? 'studio-tab-active' : ''
                }`}
                title={opt.hint}
              >
                {opt.label}
                <span className="hidden sm:inline text-[10px] font-normal text-zinc-400 ml-1">
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
