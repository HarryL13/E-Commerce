import React, { useState } from 'react';
import { Eye, Code } from 'lucide-react';

interface DescriptionEditorProps {
  html: string;
  onChange: (html: string) => void;
}

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({ html, onChange }) => {
  const [view, setView] = useState<'html' | 'preview'>('preview');

  return (
    <div className="flex flex-col h-full border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <span className="text-sm font-semibold text-zinc-900">Description Body (HTML)</span>
        <div className="flex space-x-1 bg-zinc-200/50 rounded-lg p-1 border border-zinc-200/50">
          <button
            onClick={() => setView('preview')}
            className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50'}`}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Preview
          </button>
          <button
            onClick={() => setView('html')}
            className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${view === 'html' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50'}`}
          >
            <Code className="w-3.5 h-3.5 mr-1.5" />
            HTML
          </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-[400px] bg-white">
        {view === 'html' ? (
          <textarea
            value={html}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full p-5 resize-none focus:outline-none focus:ring-0 border-none font-mono text-sm text-zinc-700 bg-zinc-50/30"
            placeholder="<p>Enter your HTML description here...</p>"
          />
        ) : (
          <div 
            className="w-full h-full p-6 overflow-y-auto prose prose-sm max-w-none prose-zinc"
            dangerouslySetInnerHTML={{ __html: html || '<p class="text-zinc-400 italic">No description generated yet.</p>' }}
          />
        )}
      </div>
    </div>
  );
};
