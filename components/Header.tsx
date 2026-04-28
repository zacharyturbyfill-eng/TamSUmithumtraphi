import React from 'react';
import { SparklesIcon } from './Icon';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-lg shadow-lg shadow-indigo-500/30">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">TranscriptFlow</h1>
              <p className="text-xs text-slate-400 font-medium">AI Editor & Podcast Diarization</p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300 font-medium">Gemini 3.0 Pro Active</span>
             </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;