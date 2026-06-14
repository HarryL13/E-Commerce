// Changes: Professional light theme prompt bar.
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
  placeholder = 'Describe the image you want to create...',
  showAspectRatio = true,
  defaultAspectRatio = '1:1',
  className = '',
  value,
  onInputChange,
}) => {
  const [localPrompt, setLocalPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [showSettings, setShowSettings] = useState(false);

  const isControlled = value !== undefined;
  const prompt = isControlled ? value : localPrompt;

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (!isControlled) setLocalPrompt(val);
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

  const ratios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

  return (
    <div className={`relative ${className}`}>
      {showSettings && showAspectRatio && (
        <div className="absolute bottom-full left-0 mb-4 p-4 bg-white border border-zinc-200 rounded-2xl shadow-lg z-20 w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <h4 className="text-sm font-medium text-zinc-600 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Image Configuration
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-2 block uppercase tracking-wider font-semibold">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {ratios.map((r) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      aspectRatio === r
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
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

      <div className="bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm flex items-end gap-2 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-300 transition-all">
        {showAspectRatio && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 rounded-xl transition-colors h-[52px] w-[52px] flex items-center justify-center shrink-0 ${
              showSettings
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
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
          className="w-full bg-transparent border-none text-zinc-900 placeholder-zinc-400 focus:ring-0 resize-none py-3.5 min-h-[52px] max-h-[120px]"
          rows={1}
          disabled={isGenerating}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
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
