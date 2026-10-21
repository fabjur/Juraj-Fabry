


import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { ArchiveBoxIcon, TrashIcon, WarningIcon } from './Icons.tsx';

interface ClearConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onSaveToArchive: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({ isOpen, onClose, onConfirmDelete, onSaveToArchive }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="clear-modal-title">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md transform transition-all" role="document">
        <div className="p-6 text-center">
            <WarningIcon className="w-12 h-12 mx-auto text-red-400" />
            <h3 id="clear-modal-title" className="mt-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">{t('clearConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{t('clearConfirmMessage')}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-800/60 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3">
            <button
                onClick={onConfirmDelete}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:w-auto sm:text-sm"
            >
                <TrashIcon className="w-5 h-5 mr-2 -ml-1" />
                {t('deleteAnywayButton')}
            </button>
            <button
                onClick={onSaveToArchive}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-lime-600 text-base font-medium text-white hover:bg-lime-700 focus:outline-none sm:w-auto sm:text-sm"
            >
                <ArchiveBoxIcon className="w-5 h-5 mr-2 -ml-1" />
                {t('saveToArchiveButton')}
            </button>
            <button
                onClick={onClose}
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-zinc-700 shadow-sm px-4 py-2 bg-white dark:bg-zinc-900 text-base font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60 sm:mt-0 sm:w-auto sm:text-sm sm:mr-auto"
            >
                {t('cancelButton')}
            </button>
        </div>
      </div>
    </div>
  );
};