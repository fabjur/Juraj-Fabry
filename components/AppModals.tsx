import React from 'react';
import type { Analysis, BrandClassifications, ActiveView, Store } from '../types';
import type { AnalysisType, ImageState } from '../hooks/useImageAnalysis';
import { AnalysisTypeModal } from './AnalysisTypeModal';
import { ClearConfirmModal } from './ClearConfirmModal';
import { BrandDefinitionModal } from './BrandDefinitionModal';
import { SearchModal } from './SearchModal';
import { MissingPriceModal } from './MissingPriceModal';
import { NewAnalysisModal } from './NewAnalysisModal';
import { ImageUploader } from './ImageUploader';
import { UploadIcon, CloseIcon } from './Icons';
import { useTranslation } from '../i18n/index';
import { db } from '../db';

export interface AppModalsProps {
  isNewAnalysisModalOpen: boolean;
  setIsNewAnalysisModalOpen: (open: boolean) => void;
  isAnalysisModalOpen: boolean;
  setIsAnalysisModalOpen: (open: boolean) => void;
  isClearConfirmOpen: boolean;
  setIsClearConfirmOpen: (open: boolean) => void;
  isBrandModalOpen: boolean;
  setIsBrandModalOpen: (open: boolean) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  isMissingPriceModalOpen: boolean;
  setIsMissingPriceModalOpen: (open: boolean) => void;
  isImageUploadOverlayOpen: boolean;
  setIsImageUploadOverlayOpen: (open: boolean) => void;
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  activeAnalysis: Analysis | null;
  setActiveAnalysis: (a: Analysis | null) => void;
  setActiveView: (view: ActiveView) => void;
  handleStartAnalysis: (
    type: AnalysisType,
    modelName: string,
    files: File[],
    productCategory?: string,
    qualityCheckId?: string,
    clientName?: string,
    customPrompt?: string,
    isWideShelf?: boolean,
    isVideoMode?: boolean,
    targetAnalysisId?: string,
    initialStore?: Store | null
  ) => void;
  images: ImageState[];
  endCurrentAnalysisWithoutSaving: () => void;
  endCurrentAnalysisAndSave: () => Promise<void>;
  handleConfirmBrands: (newlyClassified: BrandClassifications) => void;
  brandsForClassification: string[];
  brandProductsMap: Record<string, string[]>;
  handleLoadAnalysis: (analysisId: string) => Promise<void>;
  missingPriceItems: Array<{ imageId: string; productId: string; name: string; imageUrl: string }>;
  onUpdatePrices: (updates: Array<{ imageId: string; productId: string; newPrice: string; priceType: string }>) => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isNewAnalysisModalOpen,
  setIsNewAnalysisModalOpen,
  isAnalysisModalOpen,
  setIsAnalysisModalOpen,
  isClearConfirmOpen,
  setIsClearConfirmOpen,
  isBrandModalOpen,
  setIsBrandModalOpen,
  isSearchModalOpen,
  setIsSearchModalOpen,
  isMissingPriceModalOpen,
  setIsMissingPriceModalOpen,
  isImageUploadOverlayOpen,
  setIsImageUploadOverlayOpen,
  pendingFiles,
  setPendingFiles,
  activeAnalysis,
  setActiveAnalysis,
  setActiveView,
  handleStartAnalysis,
  images,
  endCurrentAnalysisWithoutSaving,
  endCurrentAnalysisAndSave,
  handleConfirmBrands,
  brandsForClassification,
  brandProductsMap,
  handleLoadAnalysis,
  missingPriceItems,
  onUpdatePrices,
}) => {
  const { t } = useTranslation();

  return (
    <div className="modal-root">
      <NewAnalysisModal
        isOpen={isNewAnalysisModalOpen}
        onClose={() => {
          setIsNewAnalysisModalOpen(false);
          setPendingFiles([]);
        }}
        onConfirm={async (n, t, m, f, pc, qcId, cName, cPrompt, isWideShelf, isVideoMode, selectedStore) => {
          endCurrentAnalysisWithoutSaving();
          const a: Analysis = {
            id: `analysis-${Date.now()}`,
            name: n,
            createdAt: new Date().toISOString(),
            images: [],
            store: selectedStore || null,
            storeId: selectedStore?.id,
            productCategory: pc,
          };
          await db.analyses.add(a);
          setActiveAnalysis(a);
          const targetView = (t === 'shelfShare') ? 'shelfShare' : (t === 'promo') ? 'promoAlert' : (t === 'qualityCheck') ? 'qualityCheck' : 'priceMonitoring';
          setActiveView(targetView);
          handleStartAnalysis(t, m, f, pc, qcId, cName, cPrompt, isWideShelf, isVideoMode, a.id, selectedStore);
          setIsNewAnalysisModalOpen(false);
          setPendingFiles([]);
        }}
        initialFiles={pendingFiles}
      />

      <AnalysisTypeModal
        isOpen={isAnalysisModalOpen}
        onClose={() => {
          setIsAnalysisModalOpen(false);
          setPendingFiles([]);
        }}
        onSelect={async (type) => {
          if (pendingFiles.length > 0) {
            let targetId = activeAnalysis?.id;
            if (!targetId) {
              const a: Analysis = {
                id: `analysis-${Date.now()}`,
                name: `${t('analysisDefaultName') || 'Audit'} ${new Date().toLocaleDateString('en-US')}`,
                createdAt: new Date().toISOString(),
                images: [],
                store: null,
              };
              await db.analyses.add(a);
              setActiveAnalysis(a);
              targetId = a.id;
            }
            handleStartAnalysis(type, images[0]?.model || 'gemini-3.1-flash-lite', pendingFiles, undefined, undefined, undefined, undefined, false, false, targetId);
          }
          setIsAnalysisModalOpen(false);
          setPendingFiles([]);
        }}
      />

      <ClearConfirmModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirmDelete={() => {
          endCurrentAnalysisWithoutSaving();
          setIsClearConfirmOpen(false);
          setIsNewAnalysisModalOpen(true);
        }}
        onSaveToArchive={async () => {
          await endCurrentAnalysisAndSave();
          setIsClearConfirmOpen(false);
          setIsNewAnalysisModalOpen(true);
        }}
      />

      <BrandDefinitionModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        onConfirm={handleConfirmBrands}
        allBrands={brandsForClassification}
        brandProductsMap={brandProductsMap}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onLoadAnalysis={handleLoadAnalysis}
      />

      <MissingPriceModal
        isOpen={isMissingPriceModalOpen}
        onClose={() => setIsMissingPriceModalOpen(false)}
        items={missingPriceItems}
        onSave={onUpdatePrices}
      />

      {isImageUploadOverlayOpen && (
        <div className="fixed inset-0 bg-zinc-800/75 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/60">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <UploadIcon className="w-5 h-5 text-lime-600" />
                {t('uploadMoreImagesTitle')}
              </h2>
              <button
                onClick={() => setIsImageUploadOverlayOpen(false)}
                className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-10">
              <ImageUploader
                onImageUpload={(f) => {
                  setPendingFiles(f);
                  setIsAnalysisModalOpen(true);
                  setIsImageUploadOverlayOpen(false);
                }}
                isLoading={images.some((i) => i.status === 'analyzing')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
