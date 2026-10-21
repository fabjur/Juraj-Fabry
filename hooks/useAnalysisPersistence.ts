import { useCallback, useRef } from 'react';
import { Analysis, SerializableImageState, BrandClassifications } from '../types';
import { saveAnalysis, loadAnalysis, getSetting, healFailedAnalyses } from '../db';
import { fileToBase64, base64ToFile, deepFreeze } from '../utils/helpers';
import { ImageState, AnalysisType } from './useImageAnalysis';
import { generateShelfPreviewSvg } from '../utils/shelfPreview.ts';

export const useAnalysisPersistence = (
  images: ImageState[],
  activeAnalysis: Analysis | null,
  brandClassifications: BrandClassifications,
  setActiveAnalysis: (a: Analysis | null) => void,
  dispatch: any,
  setBrandClassifications: (b: BrandClassifications) => void,
  setIsSearchModalOpen: (b: boolean) => void,
  setActiveView: (v: any) => void,
  resetAppState: () => void
) => {

  const handleSaveAnalysis = useCallback(async () => {
    if (!activeAnalysis) return;
    try {
        const inputRateOverride = await getSetting('inputTokenRate', 0.15);
        const outputRateOverride = await getSetting('outputTokenRate', 0.60);
        
        let totalInput = 0;
        let totalOutput = 0;
        let totalCost = 0;
        const mainModel = images[0]?.model || activeAnalysis?.costInfo?.modelName || 'gemini-3.1-flash-lite';

        const serializableImages: SerializableImageState[] = await Promise.all(
          images.map(async (image) => {
            const base64Data = image.compressedBase64 || await fileToBase64(image.file);
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
    }
  }, [activeAnalysis, images, brandClassifications, setActiveAnalysis]);

  const isLoadingRef = useRef(false);

  const handleLoadAnalysis = useCallback(async (analysisId: string, targetView?: any) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
        let analysisToLoad = await loadAnalysis(analysisId);
        if (analysisToLoad) {
          const hasZeroImages = !analysisToLoad.images || analysisToLoad.images.length === 0;
          const hasAllFailedImages = !hasZeroImages && analysisToLoad.images.every(img => img.status === 'error' || !img.analysisResult || (img.analysisResult.products || []).length === 0);
          
          if (hasZeroImages || hasAllFailedImages) {
            await healFailedAnalyses(analysisId);
            const reloaded = await loadAnalysis(analysisId);
            if (reloaded) {
              analysisToLoad = reloaded;
            }
          }

          images.forEach(img => URL.revokeObjectURL(img.imageUrl));
          dispatch({ type: 'CLEAR_ALL' });
          const loadedImages: ImageState[] = await Promise.all(analysisToLoad.images.map(async s => {
            const rawData = s.file?.data || (s as any).compressedBase64 || (s as any).base64 || '';
            const file = await base64ToFile(rawData, s.file?.name || 'photo.jpg', s.file?.type || 'image/jpeg', s.file?.lastModified || Date.now());
            
            // Prioritize freshly revived object URL or data URL
            let safeUrl = '';
            if (file instanceof Blob && file.size > 0) {
              try {
                safeUrl = URL.createObjectURL(file);
              } catch (e) {
                console.warn('Could not create object URL from file', e);
              }
            }
            if (!safeUrl && typeof rawData === 'string' && rawData.startsWith('data:')) {
              safeUrl = rawData;
            }
            if (!safeUrl && typeof rawData === 'string' && !rawData.startsWith('blob:') && rawData.length > 50) {
              const mime = s.file?.type || 'image/jpeg';
              safeUrl = `data:${mime};base64,${rawData.replace(/^data:[^;]+;base64,/, '')}`;
            }
            if (!safeUrl && s.imageUrl && typeof s.imageUrl === 'string' && !s.imageUrl.startsWith('blob:') && s.imageUrl.trim() !== '') {
              safeUrl = s.imageUrl;
            }
            if (!safeUrl) {
              safeUrl = generateShelfPreviewSvg({
                file: s.file,
                analysisResult: s.analysisResult,
                assignedStore: s.assignedStore
              });
            }

            return {
              ...s,
              file,
              compressedBase64: (typeof rawData === 'string' && !rawData.startsWith('blob:')) ? rawData : '',
              imageUrl: safeUrl,
              uploadDate: new Date(s.uploadDate),
              status: s.status || 'success', 
              analysisType: (s.analysisType || 'both') as AnalysisType,
              model: s.model || 'gemini-3.1-flash-lite',
              retryCount: s.retryCount || 0,
              analysisResult: s.analysisResult ? deepFreeze(s.analysisResult) : null
            };
          }));
          const analysisWithUrls: Analysis = {
            ...analysisToLoad,
            images: analysisToLoad.images.map((img, idx) => ({
              ...img,
              imageUrl: loadedImages[idx]?.imageUrl || img.imageUrl || ''
            }))
          };
          setActiveAnalysis(analysisWithUrls);
          dispatch({ type: 'ADD_IMAGES', payload: loadedImages });
          setBrandClassifications(analysisToLoad.brandClassifications || { ourBrands: [], competitorBrands: [] });
          setIsSearchModalOpen(false);
          if (targetView) {
            setActiveView(targetView);
          } else if (analysisToLoad.analysisType === 'shelfShare') {
            setActiveView('shelfShare');
          } else if (analysisToLoad.analysisType === 'promo') {
            setActiveView('promoAlert');
          } else if (analysisToLoad.analysisType === 'qualityCheck') {
            setActiveView('qualityCheck');
          } else {
            setActiveView('priceMonitoring');
          }
        }
    } catch (e) {
        console.error("Failed to load analysis:", e);
    } finally {
        isLoadingRef.current = false;
    }
  }, [images, dispatch, setActiveAnalysis, setBrandClassifications, setIsSearchModalOpen, setActiveView]);

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
