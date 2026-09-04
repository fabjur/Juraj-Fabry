import React from 'react';
import { SpinnerIcon, CheckCircleIcon, WarningIcon, CpuChipIcon } from './Icons.tsx';

interface GlobalAnalysisStatusProps {
  total: number;
  completed: number;
  analyzing: number;
  errors: number;
}

export const GlobalAnalysisStatus: React.FC<GlobalAnalysisStatusProps> = ({ total, completed, analyzing, errors }) => {
  if (total === 0 || (completed + errors === total && analyzing === 0)) return null;

  const processed = completed + errors;
  const progress = Math.round((processed / total) * 100);
  const isFinished = processed === total;

  return (
    <div className="sticky top-0 z-40 w-full bg-slate-900 text-white border-b border-blue-500/30 shadow-md animate-fade-in-down no-print overflow-hidden">
      {/* Top Animated Laser Line */}
      {analyzing > 0 && (
        <div className="h-1 w-full bg-slate-800 relative overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
        </div>
      )}

      <div className="w-full px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Status Text & Live State */}
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-xl flex-shrink-0 relative border ${
              isFinished 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                : 'bg-blue-600/30 text-cyan-400 border-blue-500/50 shadow-inner'
            }`}>
              {analyzing > 0 ? (
                <>
                  <SpinnerIcon className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                </>
              ) : isFinished ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
              ) : (
                <CpuChipIcon className="w-5 h-5 text-blue-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  {isFinished ? 'Analýza úspešne dokončená' : 'Prebieha AI analýza regálov...'}
                </h4>
                {analyzing > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    Gemini Vision AI Engine
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
                <span className="font-bold text-slate-300">
                  Fotografie: <strong className="text-white">{processed}</strong> / {total}
                </span>

                {analyzing > 0 && (
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    Aktívne spracovanie: {analyzing} {analyzing === 1 ? 'snímka' : 'snímky'}
                  </span>
                )}

                {errors > 0 && (
                  <span className="flex items-center gap-1 font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/60">
                    <WarningIcon className="w-3.5 h-3.5 text-rose-400" /> {errors} chýb
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="flex-grow max-w-md bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 shadow-inner">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-black text-cyan-300 flex items-center gap-1.5">
                {progress}% hotovo
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {isFinished ? '100% Hotovo' : `Zostáva ${total - processed} snímok`}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-cyan-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};