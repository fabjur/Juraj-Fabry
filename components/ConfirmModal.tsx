

import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { WarningIcon, TrashIcon } from './Icons.tsx';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmButtonText }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all" role="document">
        <div className="p-6 text-center">
            <WarningIcon className="w-12 h-12 mx-auto text-red-400" />
            <h3 id="confirm-modal-title" className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3">
            <button
                onClick={onConfirm}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:w-auto sm:text-sm"
            >
                <TrashIcon className="w-5 h-5 mr-2 -ml-1" />
                {confirmButtonText || t('delete')}
            </button>
            <button
                onClick={onClose}
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm sm:mr-auto"
            >
                {t('cancelButton')}
            </button>
        </div>
      </div>
    </div>
  );
};