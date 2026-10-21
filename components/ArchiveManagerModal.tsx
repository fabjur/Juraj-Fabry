


import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { Analysis } from '../types.ts';
import { CloseIcon, SaveIcon, FolderOpenIcon, EditIcon, TrashIcon, ArchiveBoxIcon, WarningIcon } from './Icons.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { getAnalyses } from '../db.ts';

interface ArchiveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
  hasDataToSave: boolean;
}

type ConfirmAction = {
    type: 'delete_archive';
    id: string;
    name: string;
};

export const ArchiveManagerModal: React.FC<ArchiveManagerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onLoad,
  onDelete,
  onRename,
  hasDataToSave
}) => {
  const { t } = useTranslation();
  const [archives, setArchives] = useState<Analysis[]>([]);
  const [newArchiveName, setNewArchiveName] = useState('');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchArchives = async () => {
        setLoadingError(null);
        try {
          const storedArchives = await getAnalyses();
          setArchives(storedArchives);
        } catch (error) {
          console.error("Failed to load archives from DB:", error);
          setLoadingError(t('archiveLoadError'));
          setArchives([]);
        }
      };
      fetchArchives();
    }
  }, [isOpen, t]);

  const getAnalysisTypeLabel = (analysis: Analysis) => {
    let rawType = analysis.analysisType;
    if (!rawType && analysis.images && analysis.images.length > 0) {
      rawType = analysis.images.find(img => img.analysisType)?.analysisType;
    }
    if (!rawType) {
      rawType = 'both';
    }

    switch (rawType) {
      case 'price':
        return t('analysisTypePriceButton') || 'OSP (Pricing)';
      case 'shelfShare':
        return t('analysisTypeShelfShareButton') || 'SOS (Shelf Share)';
      case 'osa':
        return t('analysisTypeOsaButton') || 'OSA (Availability)';
      case 'qualityCheck':
        return t('qualityCheck') || 'Kontrola kvality';
      case 'both':
      default:
        return t('analysisTypeBothButton') || 'Kompletná analýza';
    }
  };

  const handleSave = async () => {
    if (newArchiveName.trim()) {
      await onSave(newArchiveName.trim());
      setNewArchiveName('');
      // Refresh list after saving
      const updatedArchives = await getAnalyses();
      setArchives(updatedArchives);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmAction({ type: 'delete_archive', id, name });
  };
  
  const handleRename = async (id: string, oldName: string) => {
    const newName = window.prompt(t('renamePrompt', { name: oldName }), oldName);
    if (newName && newName.trim() && newName !== oldName) {
        await onRename(id, newName.trim());
        setArchives(prev => prev.map(a => a.id === id ? { ...a, name: newName.trim() } : a));
    }
  };
  
  const handleConfirm = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete_archive') {
        await onDelete(confirmAction.id);
        setArchives(prev => prev.filter(a => a.id !== confirmAction.id));
    }

    setConfirmAction(null);
  }

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-40 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex justify-between items-start">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2" id="modal-title">
                <ArchiveBoxIcon className="w-6 h-6 text-lime-600" />
                {t('archiveManager')}
            </h2>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 dark:text-zinc-500 hover:bg-gray-200 hover:text-gray-600 transition-colors" aria-label={t('close')}>
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
            <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{t('saveCurrentAnalysis')}</h3>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newArchiveName}
                    onChange={(e) => setNewArchiveName(e.target.value)}
                    placeholder={t('analysisNamePlaceholder')}
                    className="flex-grow block w-full rounded-md border-0 bg-white dark:bg-zinc-900 py-1.5 pl-3 pr-3 text-gray-900 dark:text-zinc-100 ring-1 ring-inset ring-gray-300 dark:ring-zinc-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-lime-500 sm:text-sm sm:leading-6"
                    disabled={!hasDataToSave}
                />
                <button
                    onClick={handleSave}
                    disabled={!newArchiveName.trim() || !hasDataToSave}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-lime-600 text-white hover:bg-lime-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <SaveIcon className="w-5 h-5" />
                    {t('save')}
                </button>
            </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex-grow overflow-y-auto">
            <h3 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">{t('savedAnalyses')}</h3>
             {loadingError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm mb-4">
                    <div className="flex items-start gap-3">
                        <WarningIcon className="w-5 h-5 mt-0.5 text-red-400 flex-shrink-0" />
                        <p>{loadingError}</p>
                    </div>
                </div>
            )}
            {archives.length > 0 ? (
                <ul className="space-y-3">
                    {archives.map(archive => (
                        <li key={archive.id} className="bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-md flex items-center justify-between gap-4 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 dark:text-zinc-100">{archive.name}</p>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-lime-100 text-lime-800 border border-lime-200">
                                        {getAnalysisTypeLabel(archive)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    {t('createdAt')}: {new Date(archive.createdAt).toLocaleString()} | {t('imageCountInArchive', { count: archive.images.length })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => onLoad(archive.id)} title={t('load')} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-lime-600 rounded-full hover:bg-lime-100 transition-colors">
                                    <FolderOpenIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleRename(archive.id, archive.name)} title={t('rename')} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                                    <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDelete(archive.id, archive.name)} title={t('delete')} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                !loadingError && <div className="text-center py-10 text-sm text-gray-500 dark:text-zinc-400">{t('noSavedAnalyses')}</div>
            )}
        </div>
      </div>
    </div>
    <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={t('deleteConfirmTitle')}
        message={t('deleteConfirmArchive', { name: confirmAction?.name || '' })}
        confirmButtonText={t('delete')}
    />
    </>
  );
};