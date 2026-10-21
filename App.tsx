import React, { useEffect, useCallback, useState, useMemo } from 'react';
import type { BrandClassifications, ActiveView, PriceInfo } from './types';
import { useTranslation } from './i18n/index';
import { db, addOrUpdateProductCorrection, seedDefaultPrompts, seedSampleAnalyses, renameAnalysis, healFailedAnalyses } from './db';
import { parsePrice } from './utils/priceIntegrity';
import { Header } from './components/Header';
import Sidebar from './components/Sidebar';
import { GlobalAnalysisStatus } from './components/GlobalAnalysisStatus';
import { AppMainContent } from './components/AppMainContent';
import { AppModals } from './components/AppModals';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { useAppModals } from './hooks/useAppModals';
import { useAppState } from './hooks/useAppState';
import { useDerivedAnalysisData } from './hooks/useDerivedAnalysisData';
import { useAnalysisPersistence } from './hooks/useAnalysisPersistence';

export const App: React.FC = () => {
  const {
    selectedImageId, setSelectedImageId,
    selectedProductName, setSelectedProductName,
    sidebarView, setSidebarView,
    productSearchTerm, setProductSearchTerm,
    deferredSearchTerm,
    highlightedProductName, setHighlightedProductName,
    activeView, setActiveView,
    setHasApiKey,
    pendingFiles, setPendingFiles,
    brandsForClassification, setBrandsForClassification,
    brandClassifications, setBrandClassifications,
    activeAnalysis, setActiveAnalysis,
    selectedCatalogProduct, setSelectedCatalogProduct,
    resetAppState
  } = useAppState();

  const {
    isAnalysisModalOpen, setIsAnalysisModalOpen,
    isClearConfirmOpen, setIsClearConfirmOpen,
    isBrandModalOpen, setIsBrandModalOpen,
    isSearchModalOpen, setIsSearchModalOpen,
    isMissingPriceModalOpen, setIsMissingPriceModalOpen,
    isNewAnalysisModalOpen, setIsNewAnalysisModalOpen,
    isImageUploadOverlayOpen, setIsImageUploadOverlayOpen
  } = useAppModals();

  const { t } = useTranslation();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Collapsible Images & Products Sidebar state (UX Optimization)
  const [isImagesSidebarOpen, setIsImagesSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('images_sidebar_open');
      return saved !== null ? JSON.parse(saved) : false; // Default to collapsed for premium fullscreen metrics
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('images_sidebar_open', JSON.stringify(isImagesSidebarOpen));
  }, [isImagesSidebarOpen]);
  
  const { images, dispatch, handleStartAnalysis, retryFailedImages, retrySingleImage } = useImageAnalysis(
    brandClassifications,
    setBrandClassifications,
    setBrandsForClassification,
    setIsBrandModalOpen,
    setHasApiKey,
    activeAnalysis?.id || null
  );

  const [imageStatusFilter, setImageStatusFilter] = useState<'all' | 'success' | 'analyzing' | 'error'>('all');

  const imageStats = useMemo(() => {
    let success = 0;
    let analyzing = 0;
    let error = 0;
    images.forEach(img => {
      if (img.status === 'success') success++;
      else if (img.status === 'analyzing' || img.status === 'pending') analyzing++;
      else if (img.status === 'error') error++;
    });
    return { all: images.length, success, analyzing, error };
  }, [images]);

  const filteredSidebarImages = useMemo(() => {
    return images.filter(img => {
      if (imageStatusFilter === 'success' && img.status !== 'success') return false;
      if (imageStatusFilter === 'analyzing' && img.status !== 'analyzing' && img.status !== 'pending') return false;
      if (imageStatusFilter === 'error' && img.status !== 'error') return false;
      if (productSearchTerm.trim()) {
        const term = productSearchTerm.toLowerCase();
        const matchName = img.file.name.toLowerCase().includes(term);
        const matchStore = (img.assignedStore?.name || '').toLowerCase().includes(term);
        const matchProduct = (img.analysisResult?.products || []).some(p => p.name.toLowerCase().includes(term));
        return matchName || matchStore || matchProduct;
      }
      return true;
    });
  }, [images, imageStatusFilter, productSearchTerm]);

  useEffect(() => {
    const init = async () => {
      try {
        await seedDefaultPrompts(t);
        await seedSampleAnalyses();
        await healFailedAnalyses();
      } catch (err) {
        console.warn('Initialization error in App:', err);
      }
    };
    init();
  }, [t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K => Quick Search in Archive
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      }
      // Cmd/Ctrl + N => New Analysis
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (activeAnalysis) {
          setIsClearConfirmOpen(true);
        } else {
          setIsNewAnalysisModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnalysis, setIsSearchModalOpen, setIsClearConfirmOpen, setIsNewAnalysisModalOpen]);

  const { productList, brandProductsMap } = useDerivedAnalysisData(images, deferredSearchTerm, t);

  const handleNavClick = useCallback((v: ActiveView) => {
    setActiveView(v);
    if (v !== 'home' && images.length) { 
      setSelectedImageId(null); 
      setSelectedProductName(null); 
      setHighlightedProductName(null); 
    }
  }, [images.length, setActiveView, setSelectedImageId, setSelectedProductName, setHighlightedProductName]);

  const handleConfirmBrands = useCallback((newlyClassified: BrandClassifications) => {
    setBrandClassifications(prev => ({
      ourBrands: Array.from(new Set([...prev.ourBrands, ...newlyClassified.ourBrands])),
      competitorBrands: Array.from(new Set([...prev.competitorBrands, ...newlyClassified.competitorBrands]))
    }));
    setIsBrandModalOpen(false);
    setBrandsForClassification([]);
  }, [setBrandClassifications, setIsBrandModalOpen, setBrandsForClassification]);

  const missingPriceItems = useMemo(() => {
    if (!isMissingPriceModalOpen) return [];
    const isSos = activeAnalysis?.analysisType === 'shelfShare' || activeView === 'shelfShare';
    const requirePrices = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;
    if (isSos && !requirePrices) return [];

    return images.flatMap(img => {
      if (img.analysisType === 'shelfShare' && !requirePrices) return [];
      return (img.analysisResult?.products || [])
        .filter(p => {
          if (p.type === 'pos_material' || p.isGhost || p.isDiscarded) return false;
          const hasValidPrices = (p.prices || []).some(pr => parsePrice(pr.value) !== null);
          const hasDirectPrice = (typeof p.regularPrice === 'number' && p.regularPrice > 0) || 
                                 (typeof p.promoPrice === 'number' && p.promoPrice > 0);
          return !hasValidPrices && !hasDirectPrice;
        })
        .map(p => ({ imageId: img.id, productId: p.id, name: p.name, imageUrl: img.imageUrl }));
    });
  }, [images, isMissingPriceModalOpen, activeAnalysis?.analysisType, activeView]);

  const {
    endCurrentAnalysisWithoutSaving,
    endCurrentAnalysisAndSave,
    handleLoadAnalysis
  } = useAnalysisPersistence(
    images,
    activeAnalysis,
    brandClassifications,
    setActiveAnalysis,
    dispatch,
    setBrandClassifications,
    setIsSearchModalOpen,
    setActiveView,
    resetAppState
  );

  const handleLoadAnalysisWithCleanSelection = useCallback(async (analysisId: string, targetView?: any) => {
    setSelectedImageId(null);
    setSelectedProductName(null);
    setHighlightedProductName(null);
    await handleLoadAnalysis(analysisId, targetView);
  }, [handleLoadAnalysis, setSelectedImageId, setSelectedProductName, setHighlightedProductName]);

  const handleRenameProduct = useCallback(async (imageId: string, productId: string, origName: string, newName: string) => {
    await addOrUpdateProductCorrection(origName, newName);
    dispatch({
      type: 'RENAME_PRODUCT',
      payload: { imageId, productId, newName }
    });
    if (activeAnalysis) {
      try {
        const existing = await db.analyses.get(activeAnalysis.id);
        if (existing) {
          const updatedImages = existing.images.map(img => {
            if (img.id === imageId && img.analysisResult) {
              return {
                ...img,
                analysisResult: {
                  ...img.analysisResult,
                  products: img.analysisResult.products.map(p => p.id === productId ? { ...p, name: newName } : p)
                }
              };
            }
            return img;
          });
          const sanitizedForDb = updatedImages.map(img => ({
            ...img,
            imageUrl: (img.imageUrl && !img.imageUrl.startsWith('blob:')) ? img.imageUrl : ''
          }));
          await db.analyses.update(activeAnalysis.id, { images: sanitizedForDb });
        }
      } catch (e) {
        console.warn('Could not sync rename to db', e);
      }
    }
  }, [activeAnalysis, dispatch]);

  const handleSyncAnalysis = useCallback(async (updatedAnalysis: Analysis) => {
    setActiveAnalysis(updatedAnalysis);
    dispatch({ type: 'SYNC_ANALYSIS_IMAGES', payload: updatedAnalysis.images });
    try {
      const sanitizedForDb = updatedAnalysis.images.map(img => ({
        ...img,
        imageUrl: (img.imageUrl && !img.imageUrl.startsWith('blob:')) ? img.imageUrl : ''
      }));
      await db.analyses.put({
        ...updatedAnalysis,
        images: sanitizedForDb
      });
    } catch (e) {
      console.warn('Could not sync analysis to db', e);
    }
  }, [dispatch, setActiveAnalysis]);

  const handleUpdateProductPrices = useCallback(async (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => {
    dispatch({ type: 'UPDATE_PRICES', payload: updates });
    if (activeAnalysis) {
      try {
        const existing = await db.analyses.get(activeAnalysis.id);
        if (existing) {
          const updatedImages = existing.images.map(img => {
            const imgUpdates = updates.filter(u => u.imageId === img.id);
            if (!imgUpdates.length || !img.analysisResult) return img;
            return {
              ...img,
              analysisResult: {
                ...img.analysisResult,
                products: img.analysisResult.products.map(p => {
                  const u = imgUpdates.find(item => item.productId === p.id);
                  if (!u) return p;
                  let regNum: number | null = null;
                  let promoNum: number | null = null;
                  let clubNum: number | null = null;
                  (u.prices || []).forEach(pr => {
                    const val = parseFloat(String(pr.value).replace(',', '.').replace(/[^\d.]/g, ''));
                    if (!isNaN(val) && val > 0) {
                      const t = (pr.type || '').toUpperCase();
                      if (t.includes('PROMO') || t.includes('AKCIA')) promoNum = val;
                      else if (t.includes('CLUB') || t.includes('KLUB')) clubNum = val;
                      else regNum = val;
                    }
                  });
                  return {
                    ...p,
                    prices: u.prices,
                    regularPrice: regNum !== null ? regNum : p.regularPrice,
                    promoPrice: promoNum !== null ? promoNum : p.promoPrice,
                    clubPrice: clubNum !== null ? clubNum : p.clubPrice,
                    isCorrected: true,
                    verificationStatus: 'human_verified',
                    priceReadabilityStatus: 'readable'
                  };
                })
              }
            };
          });
          const updatedAnalysisObj = { ...existing, images: updatedImages };
          const sanitizedForDb = updatedImages.map(img => ({
            ...img,
            imageUrl: (img.imageUrl && !img.imageUrl.startsWith('blob:')) ? img.imageUrl : ''
          }));
          await db.analyses.update(activeAnalysis.id, { images: sanitizedForDb });
          setActiveAnalysis(updatedAnalysisObj);
        }
      } catch (e) {
        console.warn('Could not sync price updates to db', e);
      }
    }
  }, [activeAnalysis, dispatch, setActiveAnalysis]);

  const handleCorrectProduct = useCallback(async (imgId: string, origName: string, newName: string, prices: PriceInfo[], count?: number) => {
    if (origName !== newName) {
      await addOrUpdateProductCorrection(origName, newName);
    }
    const finalCount = count ?? 1;
    dispatch({ type: 'CORRECT_PRODUCT', payload: { imageId: imgId, name: origName, newName, prices, count: finalCount } });

    if (activeAnalysis) {
      try {
        const existing = await db.analyses.get(activeAnalysis.id);
        if (existing) {
          let reg: number | null = null;
          let promo: number | null = null;
          let club: number | null = null;
          (prices || []).forEach(pr => {
            const val = parseFloat(String(pr.value).replace(',', '.').replace(/[^\d.]/g, ''));
            if (!isNaN(val) && val > 0) {
              const t = (pr.type || '').toUpperCase();
              if (t.includes('PROMO') || t.includes('AKCIA')) promo = val;
              else if (t.includes('CLUB') || t.includes('KLUB')) club = val;
              else reg = val;
            }
          });

          const updatedImages = existing.images.map(img => {
            if (img.id !== imgId || !img.analysisResult) return img;
            const prods = img.analysisResult.products || [];
            const otherProds = prods.filter(p => !p || p.name !== origName);
            const targetProds = prods.filter(p => p && p.name === origName);
            const currentCount = targetProds.length;
            const finalTargets = [];

            for (let i = 0; i < finalCount; i++) {
              const base = targetProds[i] || targetProds[0] || {
                id: `${imgId}-${newName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                boundingBox: { x: 0.45, y: 0.45, width: 0.1, height: 0.1 },
                confidence: 1.0,
                type: 'product'
              };
              finalTargets.push({
                ...base,
                name: newName,
                prices,
                regularPrice: reg !== null ? reg : base.regularPrice ?? null,
                promoPrice: promo !== null ? promo : base.promoPrice ?? null,
                clubPrice: club !== null ? club : base.clubPrice ?? null,
                isCorrected: true,
                verificationStatus: 'human_verified',
                priceReadabilityStatus: prices.length > 0 ? 'readable' : base.priceReadabilityStatus || 'missing',
                id: i < currentCount ? base.id : `${imgId}-${newName}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`
              });
            }

            return {
              ...img,
              analysisResult: {
                ...img.analysisResult,
                products: [...otherProds, ...finalTargets]
              }
            };
          });

          const updatedAnalysisObj = { ...existing, images: updatedImages };
          const sanitizedForDb = updatedImages.map(img => ({
            ...img,
            imageUrl: (img.imageUrl && !img.imageUrl.startsWith('blob:')) ? img.imageUrl : ''
          }));
          await db.analyses.update(activeAnalysis.id, { images: sanitizedForDb });
          setActiveAnalysis(updatedAnalysisObj);
        }
      } catch (e) {
        console.warn('Could not sync product correction to db', e);
      }
    }
  }, [activeAnalysis, dispatch, setActiveAnalysis]);

  const handleRenameAnalysis = useCallback(async (newName: string) => {
    if (activeAnalysis) {
      await renameAnalysis(activeAnalysis.id, newName);
      setActiveAnalysis({ ...activeAnalysis, name: newName });
    }
  }, [activeAnalysis, setActiveAnalysis]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col antialiased font-sans transition-colors duration-200">
      <Header 
        onNewAnalysis={() => activeAnalysis ? setIsClearConfirmOpen(true) : setIsNewAnalysisModalOpen(true)} 
        onOpenSearch={() => setIsSearchModalOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeView={activeView}
        onNavigate={handleNavClick}
      />
      <GlobalAnalysisStatus 
        total={imageStats.all} 
        completed={imageStats.success} 
        analyzing={imageStats.analyzing} 
        errors={imageStats.error}
        onRetryFailed={retryFailedImages}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
          <>
            {/* Mobile backdrop */}
            <div 
              className="fixed inset-0 top-16 bg-black/30 z-30 md:hidden backdrop-blur-xs transition-opacity" 
              onClick={() => setIsSidebarOpen(false)} 
            />
            <div className="fixed top-16 bottom-0 left-0 z-40 md:static md:top-auto md:bottom-auto md:z-auto flex-shrink-0 h-[calc(100vh-4rem)] md:h-auto">
              <Sidebar 
                activeView={activeView} 
                onNavClick={handleNavClick} 
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
          </>
        )}
        <div className="flex-1 p-6 overflow-y-auto scroll-smooth custom-scrollbar">
          <AppMainContent
            activeView={activeView}
            setActiveView={setActiveView}
            images={images}
            activeAnalysis={activeAnalysis}
            selectedCatalogProduct={selectedCatalogProduct}
            setSelectedCatalogProduct={setSelectedCatalogProduct}
            selectedImageId={selectedImageId}
            setSelectedImageId={setSelectedImageId}
            selectedProductName={selectedProductName}
            setSelectedProductName={setSelectedProductName}
            highlightedProductName={highlightedProductName}
            setHighlightedProductName={setHighlightedProductName}
            brandClassifications={brandClassifications}
            isImagesSidebarOpen={isImagesSidebarOpen}
            setIsImagesSidebarOpen={setIsImagesSidebarOpen}
            sidebarView={sidebarView}
            setSidebarView={setSidebarView}
            imageStatusFilter={imageStatusFilter}
            setImageStatusFilter={setImageStatusFilter}
            imageStats={imageStats}
            productSearchTerm={productSearchTerm}
            setProductSearchTerm={setProductSearchTerm}
            filteredSidebarImages={filteredSidebarImages}
            productList={productList}
            retryFailedImages={retryFailedImages}
            retrySingleImage={retrySingleImage}
            onOpenUploadOverlay={() => setIsImageUploadOverlayOpen(true)}
            onStartNewAnalysis={(files) => {
              if (files && files.length > 0) {
                setPendingFiles(files);
              }
              setIsNewAnalysisModalOpen(true);
            }}
            onLoadAnalysis={handleLoadAnalysisWithCleanSelection}
            endCurrentAnalysisAndSave={endCurrentAnalysisAndSave}
            onRenameProduct={handleRenameProduct}
            onCorrectProduct={handleCorrectProduct}
            onRetryImage={(imgId) => dispatch({ type: 'SET_PENDING', payload: imgId })}
            setIsMissingPriceModalOpen={setIsMissingPriceModalOpen}
            setIsBrandModalOpen={setIsBrandModalOpen}
            onRenameAnalysis={handleRenameAnalysis}
            onUpdateProductPrices={handleUpdateProductPrices}
            onUpdateActiveAnalysis={handleSyncAnalysis}
          />
        </div>
      </div>
      <AppModals
        isNewAnalysisModalOpen={isNewAnalysisModalOpen}
        setIsNewAnalysisModalOpen={setIsNewAnalysisModalOpen}
        isAnalysisModalOpen={isAnalysisModalOpen}
        setIsAnalysisModalOpen={setIsAnalysisModalOpen}
        isClearConfirmOpen={isClearConfirmOpen}
        setIsClearConfirmOpen={setIsClearConfirmOpen}
        isBrandModalOpen={isBrandModalOpen}
        setIsBrandModalOpen={setIsBrandModalOpen}
        isSearchModalOpen={isSearchModalOpen}
        setIsSearchModalOpen={setIsSearchModalOpen}
        isMissingPriceModalOpen={isMissingPriceModalOpen}
        setIsMissingPriceModalOpen={setIsMissingPriceModalOpen}
        isImageUploadOverlayOpen={isImageUploadOverlayOpen}
        setIsImageUploadOverlayOpen={setIsImageUploadOverlayOpen}
        pendingFiles={pendingFiles}
        setPendingFiles={setPendingFiles}
        activeAnalysis={activeAnalysis}
        setActiveAnalysis={setActiveAnalysis}
        setActiveView={setActiveView}
        handleStartAnalysis={handleStartAnalysis}
        images={images}
        endCurrentAnalysisWithoutSaving={endCurrentAnalysisWithoutSaving}
        endCurrentAnalysisAndSave={endCurrentAnalysisAndSave}
        handleConfirmBrands={handleConfirmBrands}
        brandsForClassification={brandsForClassification}
        brandProductsMap={brandProductsMap}
        handleLoadAnalysis={handleLoadAnalysisWithCleanSelection}
        missingPriceItems={missingPriceItems}
        onUpdatePrices={handleUpdateProductPrices}
      />
    </div>
  );
};

export default App;
