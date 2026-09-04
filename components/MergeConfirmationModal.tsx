


import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { MergeCandidate } from '../types.ts';
// FIX: Re-importing icons to ensure all exports are recognized. The issue appears to be with module resolution, not the import path or component names themselves.
import { MagicWandIcon } from './Icons.tsx';

interface MergeConfirmationModalProps {
  isOpen: boolean;
  candidate: MergeCandidate | undefined;
  onConfirm: (sourceName: string, targetName: string) => void;
  onReject: () => void;
  onClose: () => void;
}

export const MergeConfirmationModal: React.FC<MergeConfirmationModalProps> = ({ isOpen, candidate, onConfirm, onReject }) => {
  const { t } = useTranslation();

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all">
        <div className="flex items-center gap-3 mb-4 text-lime-600">
            <MagicWandIcon className="w-6 h-6" />
            <h3 className="text-lg font-bold text-gray-900">{t('mergeProductsTitle')}</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
            {t('mergeProductsMessage', { source: candidate.source.name, target: candidate.target.name })}
        </p>

        <div className="bg-gray-50 p-4 rounded-md mb-6 grid gap-3 border border-gray-200">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">{t('productA')}</span>
                <span className="text-sm font-medium text-gray-900 text-right">{candidate.source.name}</span>
            </div>
            <div className="flex justify-center text-gray-400">↓</div>
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">{t('productB')}</span>
                <span className="text-sm font-bold text-lime-700 text-right">{candidate.target.name}</span>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row-reverse gap-3">
            <button
                onClick={() => onConfirm(candidate.source.name, candidate.target.name)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-lime-600 text-base font-medium text-white hover:bg-lime-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 sm:text-sm"
            >
                {t('yesMergeButton')}
            </button>
            <button
                onClick={onReject}
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 sm:text-sm"
            >
                {t('noMergeButton')}
            </button>
        </div>
      </div>
    </div>
  );
};
