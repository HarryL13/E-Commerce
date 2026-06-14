// Changes: Professional light theme; unified with E-Commerce Studio shell.
import React from 'react';
import { Image, Zap, Crown, Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
import { ModelType, AppTab } from '../types';

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

        <div className="studio-tab-group shrink-0">
          <button
            onClick={() => onModelChange(ModelType.FLASH)}
            className={`studio-tab flex items-center gap-1.5 ${
              currentModel === ModelType.FLASH ? 'studio-tab-active text-indigo-700' : ''
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flash</span>
          </button>
          <button
            onClick={() => onModelChange(ModelType.PRO)}
            className={`studio-tab flex items-center gap-1.5 ${
              currentModel === ModelType.PRO ? 'studio-tab-active text-purple-700' : ''
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pro</span>
          </button>
        </div>
      </div>
    </header>
  );
};
