import React, { useMemo } from 'react';
import type { Analysis } from '../types';
import type { ImageState } from '../hooks/useImageAnalysis';
import { calculateAuditMetrics } from '../utils/auditMetrics.ts';
import { useTranslation } from '../i18n/index.tsx';
import {
  Camera,
  Cpu,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Printer,
  ChevronRight,
  Upload
} from 'lucide-react';

export interface AuditProcessStepperProps {
  images: ImageState[];
  activeAnalysis: Analysis | null;
  activeStep: 1 | 2 | 3 | 4;
  onStepClick: (step: 1 | 2 | 3 | 4) => void;
  exceptionCount: number;
  onOpenUploadOverlay: () => void;
  onOpenPdfReport: () => void;
  onEndAndSave: () => Promise<void>;
  onOpenTriage: () => void;
}

export const AuditProcessStepper: React.FC<AuditProcessStepperProps> = ({
  images,
  activeAnalysis,
  activeStep,
  onStepClick,
  exceptionCount,
  onOpenUploadOverlay,
  onOpenPdfReport,
  onEndAndSave,
  onOpenTriage,
}) => {
  const { t } = useTranslation();
  const analyzingCount = images.filter(i => i.status === 'analyzing' || i.status === 'pending').length;
  
  // Consistent common metrics calculation
  const metrics = useMemo(() => {
    return calculateAuditMetrics(images, activeAnalysis);
  }, [images, activeAnalysis]);

  const storeName = activeAnalysis?.store?.name || t('store') || 'Store';

  const steps = [
    {
      num: 1,
      id: 'collection',
      label: t('stepStoreAndPhotos') || 'Store & Photos',
      sublabel: `${images.length} ${t('imagesCountShort') || 'photos'} • ${storeName}`,
      icon: Camera,
      status: images.length > 0 ? 'completed' : 'active',
    },
    {
      num: 2,
      id: 'detection',
      label: t('stepProcessing') || 'Processing',
      sublabel: analyzingCount > 0 ? `${t('analyzingInProgress') || 'Analyzing...'} (${analyzingCount})` : `${metrics.totalFacings} ${t('facingsShort') || 'facings'} • ${metrics.uniqueSkusCount} SKU`,
      icon: Cpu,
      status: analyzingCount > 0 ? 'processing' : 'completed',
    },
    {
      num: 3,
      id: 'triage',
      label: t('stepVerification') || 'Verification',
      sublabel: exceptionCount > 0 ? `${exceptionCount} ${t('itemsForReview') || 'items for review'}` : (t('allVerified') || 'All verified ✓'),
      icon: AlertTriangle,
      status: exceptionCount > 0 ? 'warning' : 'completed',
    },
    {
      num: 4,
      id: 'reports',
      label: t('stepCompletion') || 'Completion',
      sublabel: t('exportAndApproval') || 'Export & Approval',
      icon: FileCheck,
      status: 'ready',
    },
  ];

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-2 sm:p-2.5 mb-3 shadow-2xs transition-all no-print">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
        {/* Stepper Steps Bar */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 xl:pb-0 flex-1">
          {steps.map((step, idx) => {
            const isCurrent = activeStep === step.num;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 shrink-0 hidden sm:block" />
                )}

                <button
                  type="button"
                  onClick={() => onStepClick(step.num as any)}
                  className={`flex items-center gap-2 h-9 px-2.5 rounded-lg text-left transition-colors shrink-0 select-none cursor-pointer ${
                    isCurrent
                      ? 'bg-zinc-900 dark:bg-zinc-950 text-white dark:border dark:border-zinc-800 shadow-2xs'
                      : step.status === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-950 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800'
                      : step.status === 'processing'
                      ? 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-950 dark:text-sky-200 border border-sky-200/80 dark:border-sky-800'
                      : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700'
                  }`}
                  title={t('goToStep', { num: step.num, label: step.label }) || `Go to step ${step.num}: ${step.label}`}
                >
                  {/* Step Icon / Status Avatar */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-lime-400 text-zinc-950 font-black'
                        : step.status === 'warning'
                        ? 'bg-amber-500 text-white'
                        : step.status === 'processing'
                        ? 'bg-sky-500 text-white animate-spin'
                        : step.status === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {step.status === 'warning' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : step.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <step.icon className="w-3 h-3" />
                    )}
                  </div>

                  {/* Step Texts */}
                  <div className="min-w-0 pr-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold tracking-tight leading-tight">
                        {step.num}. {step.label}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] truncate max-w-[130px] font-medium leading-tight tabular-nums ${
                        isCurrent
                          ? 'text-zinc-300'
                          : step.status === 'warning'
                          ? 'text-amber-800 font-semibold'
                          : 'text-zinc-500'
                      }`}
                    >
                      {step.sublabel}
                    </p>
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Quick Context & Actions on the Right */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap pt-1.5 xl:pt-0 border-t xl:border-t-0 border-zinc-150 dark:border-zinc-800">
          {/* Add more photos button */}
          <button
            onClick={onOpenUploadOverlay}
            className="h-8 px-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            title={t('addMoreImagesTitle') || "Add more photos to this analysis"}
          >
            <Upload className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">{t('addMoreImages') || 'Add photos'}</span>
          </button>

          {/* Direct Triage shortcut pill if exceptions exist */}
          {exceptionCount > 0 && (
            <button
              onClick={onOpenTriage}
              className="h-8 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={t('showExceptionsForReview') || "View exceptions requiring review"}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="tabular-nums">{exceptionCount} {t('exceptions') || 'exceptions'}</span>
            </button>
          )}

          {/* 1-Click PDF Report */}
          <button
            onClick={onOpenPdfReport}
            className="h-8 px-2.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="PDF Report"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-300" />
            <span>PDF Report</span>
          </button>

          {/* End & Save */}
          <button
            onClick={onEndAndSave}
            className="h-8 px-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-zinc-200 dark:border-zinc-700"
            title={t('saveAndCloseTitle') || "Complete audit and save to archive"}
          >
            <span>{t('saveAndClose') || 'Save & Close'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
