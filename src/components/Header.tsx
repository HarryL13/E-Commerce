// Changes: Model selector dropdown for Image Studio (resolution removed — API default).
import React from 'react';
import { Image, Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
import { ModelType, AppTab, IMAGE_MODEL_OPTIONS, getModelLabel } from '../types';

interface HeaderProps {
  currentModel: ModelType;
  onModelChange: (model: ModelType) => void;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModel,
  onModelChange,
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
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-900 shrink-0">
          <Image className="w-4 h-4 text-indigo-600" />
          <h1 className="text-sm font-semibold tracking-tight hidden sm:block text-zinc-800">
            Image Studio
          </h1>
        </div>

        <nav className="studio-tab-group overflow-x-auto no-scrollbar max-w-full min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`studio-tab flex items-center gap-2 ${isActive ? 'studio-tab-active' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <label className="flex flex-col gap-1 shrink-0 border-l border-zinc-200 pl-3 min-w-0 max-w-[11rem] sm:max-w-[14rem]">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Model
          </span>
          <select
            className="studio-select font-mono truncate"
            value={currentModel}
            onChange={(e) => onModelChange(e.target.value as ModelType)}
            aria-label="Image generation model"
          >
            {IMAGE_MODEL_OPTIONS.map((modelId) => (
              <option key={modelId} value={modelId}>
                {getModelLabel(modelId)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
};
