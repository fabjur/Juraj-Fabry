import { useCallback } from 'react';
import { Analysis, SerializableImageState, BrandClassifications } from '../types';
import { saveAnalysis, loadAnalysis, getSetting } from '../db';
import { fileToBase64, base64ToFile, deepFreeze } from '../utils/helpers';
import { ImageState, AnalysisType } from './useImageAnalysis';

export const useAnalysisPersistence = (
  images: ImageState[],
  activeAnalysis: Analysis | null,
  brandClassifications: BrandClassifications,
  setActiveAnalysis: (a: Analysis | null) => void,
  dispatch: any,
  setBrandClassifications: (b: BrandClassifications) => void,
  setIsSearchModalOpen: (b: boolean) => void,
  setActiveView: (v: any) => void,
  resetAppState: () => void,
  t: (key: string) => string
) => {

  const handleSaveAnalysis = useCallback(async () => {
    if (!activeAnalysis) return;
    try {
        const inputRateOverride = await getSetting('inputTokenRate', 0.15);
        const outputRateOverride = await getSetting('outputTokenRate', 0.60);
        
        let totalInput = 0;
        let totalOutput = 0;
        let totalCost = 0;
        const mainModel = 'gemini-3.6-flash';

        const serializableImages: SerializableImageState[] = await Promise.all(
          images.map(async (image) => {
            const base64Data = await fileToBase64(image.file);
            if (image.analysisResult?.usageMetadata) {
                const meta = image.analysisResult.usageMetadata;
                totalInput += meta.promptTokenCount;
                totalOutput += meta.candidatesTokenCount;
                
                totalCost += (meta.promptTokenCount / 1000000) * inputRateOverride;
                totalCost += (meta.candidatesTokenCount / 1000000) * outputRateOverride;
            }
            return {
              id: image.id,
              file: { name: image.file.name, type: image.file.type, lastModified: image.file.lastModified, data: base64Data },
              imageUrl: '', analysisResult: image.analysisResult, status: image.status, error: image.error,
              uploadDate: image.uploadDate.toISOString(), analysisType: image.analysisType, model: image.model, retryCount: image.retryCount,
              assignedStore: image.assignedStore, assignedStoreId: image.assignedStoreId
            };
          })
        );

        const updatedAnalysis: Analysis = {
          ...activeAnalysis,
          images: serializableImages,
          brandClassifications: brandClassifications,
          storeId: serializableImages[0]?.assignedStoreId,
          costInfo: {
              inputTokens: totalInput,
              outputTokens: totalOutput,
              cost: totalCost,
              modelName: mainModel
          }
        };

        await saveAnalysis(updatedAnalysis);
        setActiveAnalysis(updatedAnalysis);
    } catch (e) {
        console.error("Failed to save analysis:", e);
        alert(t('archiveSaveError'));
    }
  }, [activeAnalysis, images, brandClassifications, t, setActiveAnalysis]);

  const handleLoadAnalysis = useCallback(async (analysisId: string) => {
    try {
        const analysisToLoad = await loadAnalysis(analysisId);
        if (analysisToLoad) {
          images.forEach(img => URL.revokeObjectURL(img.imageUrl));
          dispatch({ type: 'CLEAR_ALL' });
          const loadedImages: ImageState[] = analysisToLoad.images.map(s => {
            const file = base64ToFile(s.file.data, s.file.name, s.file.type, s.file.lastModified);
            return {
              ...s,
              file,
              imageUrl: URL.createObjectURL(file),
              uploadDate: new Date(s.uploadDate),
              status: s.status || 'success', 
              analysisType: (s.analysisType || 'both') as AnalysisType,
              model: s.model || 'gemini-3.6-flash',
              retryCount: s.retryCount || 0,
              analysisResult: s.analysisResult ? deepFreeze(s.analysisResult) : null
            };
          });
          setActiveAnalysis(analysisToLoad);
          dispatch({ type: 'ADD_IMAGES', payload: loadedImages });
          setBrandClassifications(analysisToLoad.brandClassifications || { ourBrands: [], competitorBrands: [] });
          setIsSearchModalOpen(false);
          setActiveView('priceMonitoring');
        }
    } catch (e) {
        console.error("Failed to load analysis:", e);
        alert(t('archiveLoadError'));
    }
  }, [images, t, dispatch, setActiveAnalysis, setBrandClassifications, setIsSearchModalOpen, setActiveView]);

  const endCurrentAnalysisWithoutSaving = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.imageUrl));
    dispatch({ type: 'CLEAR_ALL' });
    resetAppState();
  }, [images, dispatch, resetAppState]);

  const endCurrentAnalysisAndSave = useCallback(async () => {
    if (activeAnalysis) {
        await handleSaveAnalysis();
    }
    endCurrentAnalysisWithoutSaving();
  }, [activeAnalysis, handleSaveAnalysis, endCurrentAnalysisWithoutSaving]);

  return { handleSaveAnalysis, handleLoadAnalysis, endCurrentAnalysisWithoutSaving, endCurrentAnalysisAndSave };
};
