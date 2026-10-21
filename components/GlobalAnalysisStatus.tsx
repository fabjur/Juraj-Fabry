import React from 'react';
import { SpinnerIcon, CheckCircleIcon, WarningIcon, CpuChipIcon, ArrowPathIcon } from './Icons.tsx';
import { useTranslation } from '../i18n/index.tsx';

interface GlobalAnalysisStatusProps {
  total: number;
  completed: number;
  analyzing: number;
  errors: number;
  onRetryFailed?: () => void;
}

export const GlobalAnalysisStatus: React.FC<GlobalAnalysisStatusProps> = ({ total, completed, analyzing, errors, onRetryFailed }) => {
  const { t } = useTranslation();
  if (total === 0 || (completed === total && analyzing === 0)) return null;

  const processed = completed + errors;
  const progress = Math.round((processed / total) * 100);
  const isFinished = processed === total;
  const isCompletedWithErrors = isFinished && errors > 0;

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
              isCompletedWithErrors
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : isFinished 
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
              ) : isCompletedWithErrors ? (
                <WarningIcon className="w-5 h-5 text-amber-400" />
              ) : isFinished ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
              ) : (
                <CpuChipIcon className="w-5 h-5 text-blue-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  {isCompletedWithErrors
                    ? t('analysisCompletedWithErrors', { completed, errors, count: errors }) || `Analysis completed (${completed} successful, ${errors} ${errors === 1 ? 'error' : 'errors'})`
                    : isFinished 
                    ? t('analysisCompletedSuccessfully') || 'Analysis completed successfully' 
                    : t('aiShelfAnalysisInProgress') || 'AI shelf analysis in progress...'}
                </h4>
                {analyzing > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                      Gemini Vision AI Engine
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
                      {t('autoSaveActive') || 'Auto-Save active'}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
                <span className="font-bold text-slate-300">
                  {t('photosCountShort') || 'Photos:'} <strong className="text-white">{processed}</strong> / {total}
                </span>

                {analyzing > 0 && (
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    {t('activeProcessingCount', { count: analyzing }) || `Active processing: ${analyzing} image${analyzing === 1 ? '' : 's'}`}
                  </span>
                )}

                {errors > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/60">
                      <WarningIcon className="w-3.5 h-3.5 text-rose-400" /> {t('errorCountFormatted', { count: errors }) || `${errors} ${errors === 1 ? 'error' : 'errors'}`}
                    </span>
                    {onRetryFailed && (
                      <button 
                        onClick={onRetryFailed}
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                        title={t('retryFailedImages')}
                      >
                        <ArrowPathIcon className="w-3 h-3" />
                        {t('retryFailedImages') || 'Retry Failed'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="flex-grow max-w-md bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 shadow-inner">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-black text-cyan-300 flex items-center gap-1.5">
                {t('percentCompletedFormatted', { percent: progress }) || `${progress}% completed`}
              </span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                {isFinished 
                  ? (t('completed100Percent') || '100% Completed') 
                  : (t('remainingImagesCount', { count: total - processed }) || `${total - processed} remaining`)}
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