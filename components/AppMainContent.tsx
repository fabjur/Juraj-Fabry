import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { ActiveView, Analysis, BrandClassifications, ProductCatalogEntry, PriceInfo } from '../types';
import type { ImageState } from '../hooks/useImageAnalysis';
import { HomeScreen } from './HomeScreen';
import { DashboardPanel } from './DashboardPanel';
import { ChatPanel } from './ChatPanel';
import { AnalysesPanel } from './AnalysesPanel';
import { StoresPanel } from './StoresPanel';
import { GalleryPanel } from './GalleryPanel';
import { PosMaterialPanel } from './PosMaterialPanel';
import { QualityCheckPanel } from './QualityCheckPanel';
import { ProductCardPanel, ProductCatalogPanel } from './ProductCatalogPanel';
import { DistributionPanel } from './DistributionPanel';
import { CompetitorPriceComparisonPanel } from './CompetitorPriceComparisonPanel';
import { ExportReportsPanel } from './ExportReportsPanel';
import { ListingPanel } from './ListingPanel';
import { CostPanel } from './CostPanel';
import { PromptManagerPanel } from './PromptManagerPanel';
import { ModuleLandingPage } from './ModuleLandingPage';
import { ImageUploader } from './ImageUploader';
import { BatchSummaryPanel } from './BatchSummaryPanel';
import { ImageAnalysisDisplay } from './ImageAnalysisDisplay';
import { ResultsPanel } from './ResultsPanel';
import { ProductSummaryPanel } from './ProductSummaryPanel';
import { ImagesProductsSidebar } from './ImagesProductsSidebar';
import { CameraIcon } from './Icons';
import { AuditProcessStepper } from './AuditProcessStepper';
import { PdfReportModal } from './PdfReportModal.tsx';
import { PhotoAuditVerificationScreen } from './PhotoAuditVerificationScreen';
import { SystemDiagnosticsPanel } from './SystemDiagnosticsPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { db } from '../db';

export interface AppMainContentProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  images: ImageState[];
  activeAnalysis: Analysis | null;
  selectedCatalogProduct: ProductCatalogEntry | null;
  setSelectedCatalogProduct: (p: ProductCatalogEntry | null) => void;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  selectedProductName: string | null;
  setSelectedProductName: (name: string | null) => void;
  highlightedProductName: string | null;
  setHighlightedProductName: (name: string | null) => void;
  brandClassifications: BrandClassifications;
  isImagesSidebarOpen: boolean;
  setIsImagesSidebarOpen: (open: boolean) => void;
  sidebarView: 'images' | 'products';
  setSidebarView: (view: 'images' | 'products') => void;
  imageStatusFilter: 'all' | 'success' | 'analyzing' | 'error';
  setImageStatusFilter: (filter: 'all' | 'success' | 'analyzing' | 'error') => void;
  imageStats: { all: number; success: number; analyzing: number; error: number };
  productSearchTerm: string;
  setProductSearchTerm: (s: string) => void;
  filteredSidebarImages: ImageState[];
  productList: Array<{ name: string; count: number; category: string }>;
  retryFailedImages: () => void;
  retrySingleImage: (id: string) => void;
  onOpenUploadOverlay: () => void;
  onStartNewAnalysis: (files?: File[]) => void;
  onLoadAnalysis: (id: string) => Promise<void>;
  endCurrentAnalysisAndSave: () => Promise<void>;
  onRenameProduct: (imageId: string, productId: string, origName: string, newName: string) => Promise<void>;
  onCorrectProduct: (imgId: string, origName: string, newName: string, prices: PriceInfo[], count?: number) => void;
  onRetryImage: (imageId: string) => void;
  setIsMissingPriceModalOpen: (open: boolean) => void;
  setIsBrandModalOpen: (open: boolean) => void;
  onRenameAnalysis: (newName: string) => Promise<void>;
  onUpdateProductPrices?: (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => void;
  onUpdateActiveAnalysis?: (analysis: Analysis) => void;
}

export const AppMainContent: React.FC<AppMainContentProps> = ({
  activeView,
  setActiveView,
  images,
  activeAnalysis,
  selectedCatalogProduct,
  setSelectedCatalogProduct,
  selectedImageId,
  setSelectedImageId,
  selectedProductName,
  setSelectedProductName,
  highlightedProductName,
  setHighlightedProductName,
  brandClassifications,
  isImagesSidebarOpen,
  setIsImagesSidebarOpen,
  sidebarView,
  setSidebarView,
  imageStatusFilter,
  setImageStatusFilter,
  imageStats,
  productSearchTerm,
  setProductSearchTerm,
  filteredSidebarImages,
  productList,
  retryFailedImages,
  retrySingleImage,
  onOpenUploadOverlay,
  onStartNewAnalysis,
  onLoadAnalysis,
  endCurrentAnalysisAndSave,
  onRenameProduct,
  onCorrectProduct,
  onRetryImage,
  setIsMissingPriceModalOpen,
  setIsBrandModalOpen,
  onRenameAnalysis,
  onUpdateProductPrices,
  onUpdateActiveAnalysis,
}) => {
  const { t } = useTranslation();
  const [batchSubTab, setBatchSubTab] = React.useState<
    'priceAnalysis' | 'priceGap' | 'shelfShare' | 'promoAlert' | 'rawData' | 'qualityCheck' | 'triage'
  >('priceAnalysis');
  const [isPdfReportModalOpen, setIsPdfReportModalOpen] = React.useState(false);

  // Selected image entity
  const selectedImage = selectedImageId ? images.find(i => i.id === selectedImageId) || null : null;

  // Calculate exception count across all images
  const exceptionCount = React.useMemo(() => {
    let count = 0;
    const isShelfShare = activeView === 'shelfShare' || activeAnalysis?.analysisType === 'shelfShare';
    const requirePrices = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;

    images.forEach(img => {
      const isImgSos = isShelfShare || img.analysisType === 'shelfShare';
      (img.analysisResult?.products || []).forEach(p => {
        if (p.type === 'pos_material' || p.isGhost || p.isDiscarded) return;

        // In Shelf Share, missing prices are NOT exceptions unless explicitly required
        if (!isImgSos || requirePrices) {
          if (!p.prices || p.prices.length === 0) {
            count++;
            return;
          }
          const reg = p.prices.find(pr => pr.type === 'REGULAR')?.value;
          const promo = p.prices.find(pr => pr.type === 'PROMO')?.value;
          if (reg && promo) {
            const rNum = parseFloat(reg.replace(',', '.').replace(/[^\d.]/g, ''));
            const pNum = parseFloat(promo.replace(',', '.').replace(/[^\d.]/g, ''));
            if (!isNaN(rNum) && !isNaN(pNum) && pNum > rNum) {
              count++;
              return;
            }
          }
        }
        if ((p.confidence || 0.85) < 0.70) {
          count++;
          return;
        }
      });
    });
    return count;
  }, [images, activeView, activeAnalysis]);

  // Standalone Views
  switch (activeView) {
    case 'home':
      return <HomeScreen onStartAnalysis={() => onStartNewAnalysis()} />;

    case 'dashboard':
      return (
        <DashboardPanel
          onLoadAnalysis={async (id) => {
            await onLoadAnalysis(id);
            setActiveView('priceMonitoring');
          }}
          onNavigateToView={setActiveView}
          onStartNewAnalysis={() => onStartNewAnalysis()}
        />
      );

    case 'verificationQueue':
      return (
        <ErrorBoundary 
          fallbackTitle={t('verificationCenterError') || 'Chyba vo verifikačnom centre'}
          onReset={() => setActiveView(images.length > 0 ? 'priceMonitoring' : 'dashboard')}
        >
          <PhotoAuditVerificationScreen
            images={images}
            activeAnalysis={activeAnalysis}
            catalogProducts={productList.map(p => ({ id: p.name, name: p.name, category: p.category })) as any}
            initialImageId={selectedImageId}
            initialProductId={null}
            brandClassifications={brandClassifications}
            onClose={() => setActiveView(images.length > 0 ? 'priceMonitoring' : 'dashboard')}
            onLoadAnalysis={async (id) => {
              await onLoadAnalysis(id);
              setActiveView('verificationQueue');
            }}
            onStartAnalysis={onStartNewAnalysis}
            onUpdateAnalysis={async (updatedAnalysis) => {
              if (onUpdateActiveAnalysis) {
                await onUpdateActiveAnalysis(updatedAnalysis);
              } else {
                await db.analyses.put(updatedAnalysis);
              }
            }}
          />
        </ErrorBoundary>
      );

    case 'chat':
      return (
        <ChatPanel
          activeImages={images}
          activeAnalysis={activeAnalysis}
          onNavigateToView={setActiveView}
        />
      );

    case 'analyses':
      return (
        <AnalysesPanel
          onNewAnalysis={() => onStartNewAnalysis()}
          onLoadAnalysis={onLoadAnalysis}
        />
      );

    case 'stores':
      return <StoresPanel />;

    case 'gallery':
      return (
        <GalleryPanel
          activeImages={images}
          activeAnalysis={activeAnalysis}
          onNavigateToImage={(id) => {
            setSelectedImageId(id);
            setActiveView(activeAnalysis?.analysisType === 'shelfShare' ? 'shelfShare' : 'priceMonitoring');
          }}
          onLoadAnalysis={onLoadAnalysis}
          onStartAnalysis={(files) => onStartNewAnalysis(files)}
        />
      );

    case 'posMaterial':
      return <PosMaterialPanel />;

    case 'qualityCheck':
      if (images.length === 0) {
        return <QualityCheckPanel />;
      }
      break;

    case 'productCatalog':
      return selectedCatalogProduct ? (
        <ProductCardPanel product={selectedCatalogProduct} onBack={() => setSelectedCatalogProduct(null)} />
      ) : (
        <ProductCatalogPanel onProductSelect={setSelectedCatalogProduct} />
      );

    case 'distribution':
      return <DistributionPanel activeImages={images} />;

    case 'competitorComparison':
      return (
        <CompetitorPriceComparisonPanel
          activeImages={images}
          activeAnalysis={activeAnalysis}
          onNavigateToImage={(id) => {
            setSelectedImageId(id);
            setActiveView('home');
          }}
          onNavigateToView={setActiveView}
        />
      );

    case 'exportReports':
      return (
        <ExportReportsPanel
          activeImages={images}
          activeAnalysis={activeAnalysis}
          onNavigateToImage={(id) => {
            setSelectedImageId(id);
            setActiveView('home');
          }}
          onNavigateToView={setActiveView}
          onStartNewAnalysis={() => onStartNewAnalysis()}
        />
      );

    case 'listing':
      return <ListingPanel />;

    case 'costs':
      return <CostPanel />;

    case 'prompts':
      return <PromptManagerPanel />;

    case 'systemTests':
      return <SystemDiagnosticsPanel />;

    default:
      break;
  }

  // If no images are loaded and this is one of the specialized analysis views
  if (images.length === 0) {
    if (activeAnalysis) {
      return (
        <div className="w-full flex flex-col gap-4 animate-fade-in">
          <AuditProcessStepper
            images={images}
            activeAnalysis={activeAnalysis}
            activeStep={1}
            onStepClick={(step) => {
              if (step === 1) onOpenUploadOverlay();
            }}
            exceptionCount={0}
            onOpenUploadOverlay={onOpenUploadOverlay}
            onOpenPdfReport={() => {}}
            onEndAndSave={endCurrentAnalysisAndSave}
            onOpenTriage={() => {}}
          />
          <div className="h-96 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="p-4 bg-lime-50 dark:bg-lime-950/40 text-lime-600 rounded-2xl mb-4 border border-lime-200 dark:border-lime-900">
              <CameraIcon className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              {t('uploadPhotosForAudit') || 'Upload photos for this audit'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-5">
              {t('uploadPhotosDesc') || 'Add shelf photos to begin AI recognition and price audit.'}
            </p>
            <button 
              onClick={onOpenUploadOverlay}
              className="px-5 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
            >
              <CameraIcon className="w-4 h-4" />
              <span>{t('addPhotos') || 'Add Photos'}</span>
            </button>
          </div>
        </div>
      );
    }

    if (
      activeView === 'priceMonitoring' ||
      activeView === 'shelfShare' ||
      activeView === 'promoAlert' ||
      activeView === 'qualityCheck'
    ) {
      return (
        <ModuleLandingPage
          type={activeView}
          onStart={() => onStartNewAnalysis()}
          onLoad={() => setActiveView('analyses')}
        />
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <ImageUploader
          onImageUpload={(f) => onStartNewAnalysis(f)}
          isLoading={images.some(i => i.status === 'analyzing')}
        />
      </div>
    );
  }

  // Active Analysis Workspace (when images are loaded)
  return (
    <div className="w-full flex flex-col gap-4">
      {/* 4-Step Retail Audit Process Stepper */}
      <AuditProcessStepper
        images={images}
        activeAnalysis={activeAnalysis}
        activeStep={
          isPdfReportModalOpen
            ? 4
            : batchSubTab === 'triage'
            ? 3
            : images.some(i => i.status === 'analyzing' || i.status === 'pending')
            ? 2
            : 3
        }
        onStepClick={(step) => {
          if (step === 1) {
            onOpenUploadOverlay();
          } else if (step === 2) {
            setSelectedImageId(null);
            setSelectedProductName(null);
            setActiveView('priceMonitoring');
          } else if (step === 3) {
            setActiveView('verificationQueue');
          } else if (step === 4) {
            setIsPdfReportModalOpen(true);
          }
        }}
        exceptionCount={exceptionCount}
        onOpenUploadOverlay={onOpenUploadOverlay}
        onOpenPdfReport={() => setIsPdfReportModalOpen(true)}
        onEndAndSave={endCurrentAnalysisAndSave}
        onOpenTriage={() => setActiveView('verificationQueue')}
      />

      <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
        {isImagesSidebarOpen && (
          <ImagesProductsSidebar
            sidebarView={sidebarView}
            setSidebarView={setSidebarView}
            imageStatusFilter={imageStatusFilter}
            setImageStatusFilter={setImageStatusFilter}
            imageStats={imageStats}
            retryFailedImages={retryFailedImages}
            retrySingleImage={retrySingleImage}
            productSearchTerm={productSearchTerm}
            setProductSearchTerm={setProductSearchTerm}
            filteredSidebarImages={filteredSidebarImages}
            selectedImageId={selectedImageId}
            onSelectImage={(id) => {
              setSelectedImageId(id);
              setSelectedProductName(null);
            }}
            productList={productList}
            selectedProductName={selectedProductName}
            onSelectProduct={(name) => {
              setSelectedProductName(name);
              setSelectedImageId(null);
            }}
            onOpenUploadOverlay={onOpenUploadOverlay}
          />
        )}

        <main className={`${isImagesSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} flex flex-col gap-6 transition-all duration-300 relative`}>
          {!selectedImage &&
            !selectedProductName &&
            (activeView === 'priceMonitoring' ||
              activeView === 'shelfShare' ||
              activeView === 'promoAlert' ||
              activeView === 'qualityCheck') && (
              <BatchSummaryPanel
                images={images}
                brandClassifications={brandClassifications}
                onReset={endCurrentAnalysisAndSave}
                initialView={activeView as any}
                initialSubTab={batchSubTab}
                onOpenMissingPrices={() => setIsMissingPriceModalOpen(true)}
                onViewChange={setActiveView}
                activeAnalysis={activeAnalysis}
                isImagesSidebarOpen={isImagesSidebarOpen}
                onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
                onOpenBrandDefinition={() => setIsBrandModalOpen(true)}
                onRenameAnalysis={onRenameAnalysis}
                onUpdateProductPrices={onUpdateProductPrices}
                onRenameProduct={onRenameProduct}
                onNavigateToImage={(id, prodName) => {
                  setSelectedImageId(id);
                  setSelectedProductName(null);
                  if (prodName) {
                    setHighlightedProductName(prodName);
                  }
                }}
              />
            )}

        {selectedImage && (
          <>
            <ImageAnalysisDisplay
              isVideo={Boolean(selectedImage.file?.type?.startsWith('video/') || selectedImage.isVideoMode)}
              imageUrl={selectedImage.imageUrl}
              analysisResult={selectedImage.analysisResult}
              isLoading={selectedImage.status === 'analyzing'}
              highlightedProductName={highlightedProductName}
              brandClassifications={brandClassifications}
              isSOSMode={activeView === 'shelfShare'}
              onSelectProduct={(p) => setHighlightedProductName(p.name)}
              onProductNameUpdate={(pid, origName, newName) =>
                onRenameProduct(selectedImage.id, pid, origName, newName)
              }
              onUpdateProductPrices={(updates) => onUpdateProductPrices && onUpdateProductPrices(updates.map(u => ({ ...u, imageId: selectedImage.id })))}
              onOpenTriage={() => {
                setSelectedImageId(null);
                setSelectedProductName(null);
                setBatchSubTab('triage');
              }}
            />
            <ResultsPanel
              imageId={selectedImage.id}
              analysisResult={selectedImage.analysisResult}
              isLoading={selectedImage.status === 'analyzing'}
              error={selectedImage.error}
              onProductNameUpdate={(i, pid, o, n) => onRenameProduct(i, pid, o, n)}
              onCorrectProduct={onCorrectProduct}
              onRetry={() => onRetryImage(selectedImage.id)}
              isImagesSidebarOpen={isImagesSidebarOpen}
              onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
              isSOSMode={activeView === 'shelfShare'}
              onUpdateProductPrices={onUpdateProductPrices}
              onOpenTriage={() => {
                setSelectedImageId(null);
                setSelectedProductName(null);
                setBatchSubTab('triage');
              }}
            />
          </>
        )}

        {selectedProductName && (
          <ProductSummaryPanel
            productName={selectedProductName}
            images={images}
            onReset={endCurrentAnalysisAndSave}
            onImageSelect={(id, name) => {
              setSelectedImageId(id);
              setSelectedProductName(null);
              setHighlightedProductName(name);
            }}
            isImagesSidebarOpen={isImagesSidebarOpen}
            onToggleImagesSidebar={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
          />
        )}

        {/* Floating Quick Action Cluster for Field Auditing (Ergonomic One-Hand Operation) */}
        <div className="fixed bottom-6 right-6 z-45 flex items-center gap-2 no-print">
          {/* Direct Camera Snap FAB */}
          <label 
            className="w-12 h-12 bg-lime-500 hover:bg-lime-600 text-zinc-950 dark:text-zinc-100 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-2 border-white"
            title={t('captureCameraInstant') || 'Okamžite odfotiť regál kamerou'}
          >
            <CameraIcon className="w-5 h-5 text-zinc-950 dark:text-zinc-100" />
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onStartNewAnalysis(Array.from(e.target.files));
                }
                e.target.value = '';
              }}
            />
          </label>

          {/* Toggle Snímky & Produkty List */}
          <button
            onClick={() => setIsImagesSidebarOpen(!isImagesSidebarOpen)}
            className="bg-zinc-900 border border-zinc-800 text-white rounded-full px-4 sm:px-5 py-3.5 shadow-2xl hover:bg-zinc-800 hover:-translate-y-0.5 transition-all duration-300 active:scale-95 group font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"
            title={t('toggleImagesProductsPanel') || 'Zobraziť panel snímok a produktov'}
          >
            <span>{isImagesSidebarOpen ? (t('closeList') || 'Zavrieť zoznam') : (t('imagesAndProducts') || 'Snímky & Produkty')}</span>
            <span className="bg-lime-950/80 text-lime-400 px-2 py-0.5 rounded-md text-[10px] font-black border border-lime-800/50">
              {images.length}
            </span>
          </button>
        </div>
      </main>
    </div>

    <PdfReportModal
      isOpen={isPdfReportModalOpen}
      onClose={() => setIsPdfReportModalOpen(false)}
      analysisName={activeAnalysis?.name || t('shelfAnalysis') || 'Analýza regálu'}
      storeName={activeAnalysis?.store?.name || t('retailStore') || 'Maloobchod'}
      storeAddress={activeAnalysis?.store?.address || activeAnalysis?.store?.city}
      analysisDate={activeAnalysis?.createdAt}
      images={images}
      brandClassifications={brandClassifications}
    />
  </div>
  );
};
