// Changes:
// - Fixed: Image Studio sub-tabs (Background / Multi-View / Scene Gen) were hidden
//   behind the outer App module switcher. The inner Header used `fixed top-0` which
//   placed it at the very top of the viewport and got covered by App.tsx's sticky
//   top bar (h-14 = 56px, z-[100]). Moved this Header to `top-14` and lowered the
//   z-index below the outer bar so both headers stack correctly.
import React from 'react';
import { Sparkles, Zap, Crown, Layers, Grid3X3, Palette } from 'lucide-react';
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
  onTabChange 
}) => {
  
  const tabs = [
    { id: AppTab.BACKGROUND, label: 'Background', icon: Layers },
    { id: AppTab.MULTIVIEW, label: 'Multi-View', icon: Grid3X3 },
    { id: AppTab.SCENE, label: 'Scene Gen', icon: Palette },
  ];

  return (
    <header className="fixed top-14 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo */}
        <div className="flex items-center gap-3 text-white shrink-0">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight hidden sm:block">
            Imaginarium <span className="text-slate-500 font-normal">AI</span>
          </h1>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center p-1 bg-slate-900/50 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Model Selector */}
        <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => onModelChange(ModelType.FLASH)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentModel === ModelType.FLASH
                ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flash</span>
          </button>
          <button
            onClick={() => onModelChange(ModelType.PRO)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentModel === ModelType.PRO
                ? 'bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
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