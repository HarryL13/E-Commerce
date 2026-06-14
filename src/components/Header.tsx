// Changes: Model selector includes gpt-image-1 (OpenAI) alongside Gemini models.
import React from 'react';
import { Image, Zap, Crown, Bot, Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
import { ModelType, AppTab, IMAGE_MODEL_OPTIONS, getModelLabel } from '../types';

interface HeaderProps {
  currentModel: ModelType;
  onModelChange: (model: ModelType) => void;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const MODEL_ICONS: Record<ModelType, typeof Zap> = {
  [ModelType.GEMINI_31_FLASH_IMAGE]: Zap,
  [ModelType.GEMINI_3_PRO_IMAGE_PREVIEW]: Crown,
  [ModelType.GPT_IMAGE_2]: Bot,
};

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
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-zinc-900 shrink-0">
          <Image className="w-4 h-4 text-indigo-600" />
          <h1 className="text-sm font-semibold tracking-tight hidden sm:block text-zinc-800">
            Image Studio
          </h1>
        </div>

        <nav className="studio-tab-group overflow-x-auto no-scrollbar max-w-full">
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

        <div className="studio-tab-group shrink-0 max-w-[min(100%,280px)] overflow-x-auto no-scrollbar">
          {IMAGE_MODEL_OPTIONS.map((modelId) => {
            const Icon = MODEL_ICONS[modelId];
            const isActive = currentModel === modelId;
            return (
              <button
                key={modelId}
                onClick={() => onModelChange(modelId)}
                title={getModelLabel(modelId)}
                className={`studio-tab flex items-center gap-1.5 max-w-full ${
                  isActive
                    ? modelId === ModelType.GEMINI_31_FLASH_IMAGE
                      ? 'studio-tab-active text-indigo-700'
                      : modelId === ModelType.GPT_IMAGE_2
                        ? 'studio-tab-active text-emerald-700'
                        : 'studio-tab-active text-purple-700'
                    : ''
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono text-[10px] sm:text-[11px] truncate">
                  {getModelLabel(modelId)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
