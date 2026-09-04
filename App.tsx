
import React, { useEffect, useCallback } from 'react'; 
import { ImageUploader } from './components/ImageUploader';
import { ImageAnalysisDisplay } from './components/ImageAnalysisDisplay';
import { ResultsPanel } from './components/ResultsPanel';
import { BatchSummaryPanel } from './components/BatchSummaryPanel';
import { ProductSummaryPanel } from './components/ProductSummaryPanel';
import type { BrandClassifications, ActiveView } from './types';
import { UploadIcon, CircleStackIcon, CloseIcon, AppIcon, CameraIcon } from './components/Icons';
import { useTranslation } from './i18n/index';
import { AnalysisTypeModal } from './components/AnalysisTypeModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { HomeScreen } from './components/HomeScreen';
import { db, addOrUpdateProductCorrection, seedDefaultPrompts, renameAnalysis } from './db';
import { BrandDefinitionModal } from './components/BrandDefinitionModal';
import { Header } from './components/Header';
import { SearchModal } from './components/SearchModal';
import { ProductCardPanel, ProductCatalogPanel } from './components/ProductCatalogPanel';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { DistributionPanel } from './components/DistributionPanel';
import { StoresPanel } from './components/StoresPanel';
import { AnalysesPanel } from './components/AnalysesPanel';
import { ApiKeySelectionScreen } from './components/ApiKeySelectionScreen';
import { MissingPriceModal } from './components/MissingPriceModal';
import Sidebar from './components/Sidebar';
import { GlobalAnalysisStatus } from './components/GlobalAnalysisStatus';
import { GalleryPanel } from './components/GalleryPanel';
import { CostPanel } from './components/CostPanel';
import { PromptManagerPanel } from './components/PromptManagerPanel';
import { PosMaterialPanel } from './components/PosMaterialPanel';
import { ModuleLandingPage } from './components/ModuleLandingPage';
import { QualityCheckPanel } from './components/QualityCheckPanel';
import { ListingPanel } from './components/ListingPanel';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { DashboardPanel } from './components/DashboardPanel';

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
    hasApiKey, setHasApiKey,
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

  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(() => {
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
  const [isImagesSidebarOpen, setIsImagesSidebarOpen] = React.useState<boolean>(() => {
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
  
  const { images, dispatch, handleStartAnalysis } = useImageAnalysis(
      brandClassifications,
      setBrandClassifications,
      setBrandsForClassification,
      setIsBrandModalOpen,
      setHasApiKey
  );

  useEffect(() => {
    const init = async () => {
        await seedDefaultPrompts(t);
        if ((window as any).aistudio) { 
            const hasKey = await (window as any).aistudio.hasSelectedApiKey(); 
            setHasApiKey(hasKey);
        }
    };
    init();
  }, [t, setHasApiKey]);

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

  const handleSelectApiKey = async () => {
    if ((window as any).aistudio) { 
      await (window as any).aistudio.openSelectKey(); 
      setHasApiKey(true);
    }
  };

  const { productList, brandProductsMap } = useDerivedAnalysisData(images, deferredSearchTerm, t);

  const handleNavClick = useCallback((v: ActiveView) => {
    setActiveView(v);
    if (v !== 'home' && images.length) { setSelectedImageId(null); setSelectedProductName(null); setHighlightedProductName(null); }
  }, [images.length, setActiveView, setSelectedImageId, setSelectedProductName, setHighlightedProductName]);

  const handleConfirmBrands = useCallback((newlyClassified: BrandClassifications) => {
    setBrandClassifications(prev => ({
      ourBrands: Array.from(new Set([...prev.ourBrands, ...newlyClassified.ourBrands])),
      competitorBrands: Array.from(new Set([...prev.competitorBrands, ...newlyClassified.competitorBrands]))
    }));
    setIsBrandModalOpen(false);
    setBrandsForClassification([]);
  }, [setBrandClassifications, setIsBrandModalOpen, setBrandsForClassification]);

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
    resetAppState,
    t
  );

  if (!hasApiKey) return <ApiKeySelectionScreen onSelectApiKey={handleSelectApiKey} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased font-sans">
      <Header 
        onNewAnalysis={() => activeAnalysis ? setIsClearConfirmOpen(true) : setIsNewAnalysisModalOpen(true)} 
        onOpenSearch={() => setIsSearchModalOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <GlobalAnalysisStatus total={images.length} completed={images.filter(i => i.status === 'success').length} analyzing={images.filter(i => i.status === 'analyzing').length} errors={images.filter(i => i.status === 'error').length} />
      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && <Sidebar activeView={activeView} onNavClick={handleNavClick} />}
        <div className="flex-1 p-6 overflow-y-auto scroll-smooth custom-scrollbar">
          {activeView === 'home' ? <HomeScreen onStartAnalysis={() => setIsNewAnalysisModalOpen(true)} /> :
           activeView === 'dashboard' ? <DashboardPanel /> :
           activeView === 'analyses' ? <AnalysesPanel onNewAnalysis={() => setIsNewAnalysisModalOpen(true)} onLoadAnalysis={handleLoadAnalysis} /> :
           activeView === 'stores' ? <StoresPanel /> :
           activeView === 'gallery' ? <GalleryPanel /> :
           activeView === 'posMaterial' ? <PosMaterialPanel /> :
           activeView === 'qualityCheck' ? <QualityCheckPanel /> :
           activeView === 'productCatalog' ? (selectedCatalogProduct ? <ProductCardPanel product={selectedCatalogProduct} onBack={() => setSelectedCatalogProduct(null)} /> : <ProductCatalogPanel onProductSelect={setSelectedCatalogProduct} />) :
           activeView === 'distribution' ? <DistributionPanel activeImages={images} /> :
           activeView === 'listing' ? <ListingPanel /> :
           activeView === 'costs' ? <CostPanel /> :
           activeView === 'prompts' ? <PromptManagerPanel /> :
           images.length === 0 && (activeView === 'priceMonitoring' || activeView === 'shelfShare' || activeView === 'promoAlert') ? 
           <ModuleLandingPage type={activeView} onStart={() => setIsNewAnalysisModalOpen(true)} onLoad={() => setActiveView('analyses')} /> :
           images.length === 0 ? <div className="h-full flex items-center justify-center"><ImageUploader onImageUpload={(f) => { setPendingFiles(f); setIsNewAnalysisModalOpen(true); }} isLoading={images.some(i => i.status === 'analyzing')} /></div> :
           <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
             {isImagesSidebarOpen && (
                <aside className="lg:col-span-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 self-start no-print transition-all duration-300 animate-[fadeIn_0.2s_ease-out]">
               <div className="flex justify-between items-center px-1">
                 <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">{sidebarView === 'images' ? t('images') : t('products')}</h3>
                 <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                   <button onClick={() => setSidebarView('images')} className={`p-1.5 rounded-md transition-all ${sidebarView === 'images' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-400'}`}><AppIcon className="w-4 h-4"/></button>
                   <button onClick={() => setSidebarView('products')} className={`p-1.5 rounded-md transition-all ${sidebarView === 'products' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-400'}`}><CircleStackIcon className="w-4 h-4"/></button>
                 </div>
               </div>
               <div className="relative px-1">
                   <input type="text" className="w-full bg-gray-50 border-none rounded-xl text-[11px] p-2 pr-8 focus:ring-1 focus:ring-lime-500" placeholder={sidebarView === 'images' ? t('searchImages') : t('searchProduct')} value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
               </div>
               <div className="max-h-[calc(100vh-360px)] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                 {sidebarView === 'images' ? 
                   images.map(img => (
                     <div key={img.id} onClick={() => { setSelectedImageId(img.id); setSelectedProductName(null); }} className={`flex gap-3 p-2 rounded-xl cursor-pointer border transition-all duration-200 ${selectedImageId === img.id ? 'bg-lime-50 border-lime-400 scale-[1.02] shadow-sm shadow-lime-100' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                       <img src={img.imageUrl} className="w-10 h-10 object-cover rounded-lg bg-gray-100" />
                       <div className="min-w-0 flex-1">
                         <p className="text-[11px] font-bold truncate text-gray-800">{img.file.name}</p>
                         <p className="text-[9px] font-black uppercase text-gray-400">{img.status === 'analyzing' ? <span className="text-red-600 animate-pulse font-black normal-case">{t('analyzing')}</span> : img.uploadDate.toLocaleDateString()}</p>
                       </div>
                       {img.status === 'success' && <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-2"></div>}
                     </div>
                   )) : 
                   productList.map(p => (
                     <button key={p.name} onClick={() => { setSelectedProductName(p.name); setSelectedImageId(null); }} className={`flex justify-between w-full p-3 rounded-xl border text-left transition-all duration-200 ${selectedProductName === p.name ? 'bg-lime-50 border-lime-400 shadow-sm shadow-lime-100' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                       <span className="text-[11px] font-bold truncate pr-2 text-gray-700">{p.name}</span>
                       <span className="text-[11px] font-black text-lime-600 bg-lime-100/50 px-2 py-0.5 rounded-lg">{p.count}</span>
                     </button>
                   ))
                 }
               </div>
               <button onClick={() => setIsImageUploadOverlayOpen(true)} className="w-full py-3 bg-lime-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-lime-700 transition-all shadow-lg shadow-lime-100 active:scale-95"><UploadIcon className="w-4 h-4"/>{t('addMoreImages')}</button>
             </aside>
             )}
             <main className={`${isImagesSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} flex flex-col gap-6 transition-all duration-300 relative`}>
                {!selectedImageId && !selectedProductName && (activeView === 'priceMonitoring' || activeView === 'shelfShare' || activeView === 'promoAlert') && 
                  <BatchSummaryPanel 
                    images={images} 
                    brandClassifications={brandClassifications} 
                    onReset={endCurrentAnalysisAndSave} 
                    initialView={activeView as any} 
                    onOpenMissingPrices={() => setIsMissingPriceModalOpen(true)} 
                    onViewChange={setActiveView}
                    activeAnalysis={activeAnalysis}
                    isImagesSidebarOpen={isImagesSidebarOpen}
                    onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
                    onOpenBrandDefinition={() => setIsBrandModalOpen(true)}
                    onRenameAnalysis={async (newName) => {
                      if (activeAnalysis) {
                        await renameAnalysis(activeAnalysis.id, newName);
                        setActiveAnalysis({ ...activeAnalysis, name: newName });
                      }
                    }}
                  />}
                {selectedImageId && images.find(i => i.id === selectedImageId) && <>
                  <ImageAnalysisDisplay imageUrl={images.find(i => i.id === selectedImageId)!.imageUrl} analysisResult={images.find(i => i.id === selectedImageId)!.analysisResult} isLoading={images.find(i => i.id === selectedImageId)!.status === 'analyzing'} highlightedProductName={highlightedProductName} />
                  <ResultsPanel 
                    imageId={selectedImageId} 
                    analysisResult={images.find(i => i.id === selectedImageId)!.analysisResult} 
                    isLoading={images.find(i => i.id === selectedImageId)!.status === 'analyzing'} 
                    error={images.find(i => i.id === selectedImageId)!.error} 
                    onReset={endCurrentAnalysisAndSave} 
                    onProductNameUpdate={async (i, pid, o, n) => { 
                      await addOrUpdateProductCorrection(o, n); 
                      dispatch({type:'RENAME_PRODUCT', payload:{imageId:i, productId:pid, newName:n}}); 
                    }} 
                    onCorrectProduct={async (imgId, origName, newName, prices, count) => {
                      if (origName !== newName) {
                        await addOrUpdateProductCorrection(origName, newName);
                      }
                      dispatch({type: 'CORRECT_PRODUCT', payload: { imageId: imgId, name: origName, newName, prices, count }});
                    }}
                    onRetry={() => dispatch({type:'SET_PENDING', payload:selectedImageId})} 
                    isImagesSidebarOpen={isImagesSidebarOpen} 
                    onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)} 
                  />
                </>}
                {selectedProductName && <ProductSummaryPanel productName={selectedProductName} images={images} onReset={endCurrentAnalysisAndSave} onImageSelect={(id, name) => { setSelectedImageId(id); setSelectedProductName(null); setHighlightedProductName(name); }} isImagesSidebarOpen={isImagesSidebarOpen} onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)} />}

                 {/* FAB Trigger Button to quickly toggle sidebar from ANY page */}
                 <button
                   onClick={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
                   className="fixed bottom-6 right-6 z-45 bg-slate-900 border border-slate-800 text-white rounded-full px-5 py-3.5 shadow-2xl hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-300 active:scale-95 group font-bold text-[10px] uppercase tracking-widest no-print flex items-center gap-2.5"
                   title="Zobraziť panel"
                 >
                   <CameraIcon className="w-4 h-4 text-lime-400 group-hover:rotate-12 transition-transform" />
                   <span>{isImagesSidebarOpen ? "Zavrieť zoznam" : "Snímky & Produkty"}</span>
                   <span className="bg-lime-950/80 text-lime-400 px-2 py-0.5 rounded-md text-[10px] font-black border border-lime-800/50">
                     {images.length}
                   </span>
                 </button>
             </main>
           </div>
          }
        </div>
      </div>
      <div className="modal-root">
        <NewAnalysisModal isOpen={isNewAnalysisModalOpen} onClose={() => { setIsNewAnalysisModalOpen(false); setPendingFiles([]); }} onConfirm={async (n, t, m, f, pc, qcId) => { const a = { id: `analysis-${Date.now()}`, name: n, createdAt: new Date().toISOString(), images: [], store: null, productCategory: pc }; await db.analyses.add(a); setActiveAnalysis(a); setActiveView('priceMonitoring'); handleStartAnalysis(t, m, f, pc, qcId); setIsNewAnalysisModalOpen(false); setPendingFiles([]); }} initialFiles={pendingFiles} />
        <AnalysisTypeModal isOpen={isAnalysisModalOpen} onClose={() => { setIsAnalysisModalOpen(false); setPendingFiles([]); }} onSelect={async type => { if (pendingFiles.length > 0) handleStartAnalysis(type, images[0]?.model || 'gemini-3.6-flash', pendingFiles); setIsAnalysisModalOpen(false); setPendingFiles([]); }} />
        <ClearConfirmModal isOpen={isClearConfirmOpen} onClose={() => setIsClearConfirmOpen(false)} onConfirmDelete={endCurrentAnalysisWithoutSaving} onSaveToArchive={endCurrentAnalysisAndSave} />
        <BrandDefinitionModal isOpen={isBrandModalOpen} onClose={() => setIsBrandModalOpen(false)} onConfirm={handleConfirmBrands} allBrands={brandsForClassification} brandProductsMap={brandProductsMap} />
        <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} onLoadAnalysis={handleLoadAnalysis} />
        <MissingPriceModal isOpen={isMissingPriceModalOpen} onClose={() => setIsMissingPriceModalOpen(false)} items={images.flatMap(img => (img.analysisResult?.products || []).filter(p => !p.prices?.length).map(p => ({ imageId: img.id, productId: p.id, name: p.name, imageUrl: img.imageUrl })))} onSave={updates => dispatch({type:'UPDATE_PRICES', payload: updates})} />
        {isImageUploadOverlayOpen && <div className="fixed inset-0 bg-gray-800/75 flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden"><div className="p-6 border-b flex justify-between items-center bg-gray-50"><h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-gray-700"><UploadIcon className="w-5 h-5 text-lime-600" />{t('uploadMoreImagesTitle')}</h2><button onClick={() => setIsImageUploadOverlayOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400"><CloseIcon className="w-5 h-5"/></button></div><div className="p-10"><ImageUploader onImageUpload={(f) => { setPendingFiles(f); setIsAnalysisModalOpen(true); setIsImageUploadOverlayOpen(false); }} isLoading={images.some(i => i.status === 'analyzing')} /></div></div></div>}
      </div>
    </div>
  );
};

export default App;
