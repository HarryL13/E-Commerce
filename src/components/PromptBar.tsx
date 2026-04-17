import React, { useState } from 'react';
import { Send, Settings2, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { AspectRatio } from '../types';

interface PromptBarProps {
  onGenerate: (prompt: string, aspectRatio: AspectRatio) => void;
  isGenerating: boolean;
  placeholder?: string;
  showAspectRatio?: boolean;
  defaultAspectRatio?: AspectRatio;
  className?: string;
  value?: string;
  onInputChange?: (value: string) => void;
}

export const PromptBar: React.FC<PromptBarProps> = ({ 
  onGenerate, 
  isGenerating,
  placeholder = "Describe the image you want to create...",
  showAspectRatio = true,
  defaultAspectRatio = '1:1',
  className = '',
  value,
  onInputChange
}) => {
  const [localPrompt, setLocalPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [showSettings, setShowSettings] = useState(false);

  // Determine if component is controlled
  const isControlled = value !== undefined;
  const prompt = isControlled ? value : localPrompt;

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (!isControlled) {
      setLocalPrompt(val);
    }
    onInputChange?.(val);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, aspectRatio);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const ratios: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

  return (
    <div className={`relative ${className}`}>
        
        {/* Settings Panel Popover */}
        {showSettings && showAspectRatio && (
          <div className="absolute bottom-full left-0 mb-4 p-4 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-20 w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Image Configuration
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider font-semibold">Aspect Ratio</label>
                <div className="flex flex-wrap gap-2">
                  {ratios.map((r) => (
                    <button
                      key={r}
                      onClick={() => setAspectRatio(r)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        aspectRatio === r
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="bg-slate-800 p-2 rounded-2xl border border-slate-700 shadow-xl flex items-end gap-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
          {showAspectRatio && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-xl transition-colors h-[52px] w-[52px] flex items-center justify-center shrink-0 ${
                showSettings ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
              title="Settings"
            >
              {showSettings ? <ChevronDown className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
            </button>
          )}
          
          <textarea
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:ring-0 resize-none py-3.5 min-h-[52px] max-h-[120px]"
            rows={1}
            disabled={isGenerating}
            style={{ fieldSizing: 'content' } as any} 
          />
          
          <Button
            onClick={() => handleSubmit()}
            disabled={!prompt.trim() || isGenerating}
            isLoading={isGenerating}
            variant="primary"
            className="h-[52px] px-6 rounded-xl shrink-0"
          >
            {!isGenerating && <Send className="w-5 h-5" />}
            {isGenerating && <span className="ml-2">Generate</span>}
          </Button>
        </div>
    </div>
  );
};