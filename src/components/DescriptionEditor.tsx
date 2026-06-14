// Changes: Professional light theme HTML description editor.
import React, { useState } from 'react';
import { Eye, Code } from 'lucide-react';

interface DescriptionEditorProps {
  html: string;
  onChange: (html: string) => void;
}

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({ html, onChange }) => {
  const [view, setView] = useState<'html' | 'preview'>('preview');

  return (
    <div className="flex flex-col h-full border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <span className="text-sm font-semibold text-zinc-800">Description Body (HTML)</span>
        <div className="studio-tab-group p-1">
          <button
            onClick={() => setView('preview')}
            className={`studio-tab flex items-center gap-1.5 ${view === 'preview' ? 'studio-tab-active' : ''}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setView('html')}
            className={`studio-tab flex items-center gap-1.5 ${view === 'html' ? 'studio-tab-active' : ''}`}
          >
            <Code className="w-3.5 h-3.5" />
            HTML
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[400px] bg-white">
        {view === 'html' ? (
          <textarea
            value={html}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full p-5 resize-none focus:outline-none focus:ring-0 border-none font-mono text-sm text-zinc-700 bg-zinc-50/50"
            placeholder="<p>Enter your HTML description here...</p>"
          />
        ) : (
          <div
            className="w-full h-full p-6 overflow-y-auto prose prose-sm max-w-none prose-zinc"
            dangerouslySetInnerHTML={{
              __html: html || '<p class="text-zinc-400 italic">No description generated yet.</p>',
            }}
          />
        )}
      </div>
    </div>
  );
};
