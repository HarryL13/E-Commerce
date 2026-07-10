// Changes: Image Studio subheader — tabs + model only (no duplicate title); fixed-height row.
import React from 'react';
import { Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
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

        <label className="flex items-center gap-2 shrink-0 border-l border-zinc-200 pl-3">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
            Model
          </span>
          <select
            className="studio-select font-mono truncate max-w-[10rem] sm:max-w-[14rem]"
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
