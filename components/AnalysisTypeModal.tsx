

import React from 'react';
import { useTranslation } from '../i18n';
// FIX: Re-importing icons to ensure all exports are recognized. The issue appears to be with module resolution, not the import path or component names themselves.
import { TagIcon, ChartPieIcon, ClipboardDocumentListIcon, CloseIcon } from './Icons';

// FIX: Importing AnalysisType from a specific path relative to the modal to ensure correct type resolution.
import type { AnalysisType } from '../hooks/useImageAnalysis';

interface AnalysisTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: Changed onSelect to accept a Promise<void> or void to match async handler
  onSelect: (type: AnalysisType) => Promise<void> | void;
}

export const AnalysisTypeModal: React.FC<AnalysisTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  const options = [
    {
      type: 'price',
      icon: TagIcon,
      title: t('analysisTypePriceButton'),
      description: t('analysisTypePriceDescription'),
    },
    {
      type: 'shelfShare',
      icon: ChartPieIcon,
      title: t('analysisTypeShelfShareButton'),
      description: t('analysisTypeShelfShareDescription'),
    },
    {
      type: 'both',
      icon: ClipboardDocumentListIcon, // FIX: Changed DocumentDuplicateIcon to ClipboardDocumentListIcon
      title: t('analysisTypeBothButton'),
      description: t('analysisTypeBothDescription'),
    },
  ];

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl transform transition-all">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100" id="modal-title">{t('analysisTypeModalTitle')}</h2>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 dark:text-zinc-500 hover:bg-gray-200 hover:text-gray-600 transition-colors" aria-label={t('close')}>
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{t('analysisTypeModalDescription')}</p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {options.map((option) => (
              <button
                key={option.type}
                onClick={() => onSelect(option.type as AnalysisType)}
                className="text-left p-4 border border-gray-200 dark:border-zinc-800 rounded-lg hover:bg-lime-50 hover:border-lime-500 hover:ring-2 hover:ring-lime-500 transition-all focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2"
              >
                <div className="flex items-center justify-center bg-lime-100 rounded-lg w-12 h-12 mb-4">
                  <option.icon className="w-6 h-6 text-lime-600" />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{option.title}</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};