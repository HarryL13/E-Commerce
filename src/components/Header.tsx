// Changes:
// - Fixed: Image Studio sub-tabs were hidden behind App module switcher (top-14 stack).
// - Unified branding with E-Commerce Studio shell; renamed Imaginarium AI → Image Studio.
// - Added Logo Brand tab.
import React from 'react';
import { Sparkles, Zap, Crown, Layers, Grid3X3, Palette, Stamp } from 'lucide-react';
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
        <div className="flex items-center gap-3 text-white shrink-0">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight hidden sm:block text-slate-200">
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
              currentModel === ModelType.FLASH ? 'studio-tab-active !text-indigo-300' : ''
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flash</span>
          </button>
          <button
            onClick={() => onModelChange(ModelType.PRO)}
            className={`studio-tab flex items-center gap-1.5 ${
              currentModel === ModelType.PRO ? 'studio-tab-active !text-purple-300' : ''
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
