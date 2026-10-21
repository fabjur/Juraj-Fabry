import React, { useMemo } from 'react';
import type { AnalysisResult, BrandClassifications, DetectedProduct, PriceInfo } from '../types';
import { BoundingBoxOverlay, detectProductAnomaly } from './BoundingBoxOverlay';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n/index.tsx';

interface ImageAnalysisDisplayProps {
  imageUrl: string;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  highlightedProductName?: string | null;
  isVideo?: boolean;
  brandClassifications?: BrandClassifications;
  onSelectProduct?: (product: DetectedProduct) => void;
  onProductNameUpdate?: (productId: string, originalName: string, newName: string) => void | Promise<void>;
  onUpdateProductPrices?: (updates: { productId: string; prices: PriceInfo[] }[]) => void;
  onOpenTriage?: () => void;
  isSOSMode?: boolean;
}

export const ImageAnalysisDisplay: React.FC<ImageAnalysisDisplayProps> = ({ 
  imageUrl, 
  analysisResult, 
  isLoading, 
  highlightedProductName,
  brandClassifications,
  onSelectProduct,
  onProductNameUpdate,
  onUpdateProductPrices,
  onOpenTriage,
  isVideo,
  isSOSMode = false
}) => {
  const { t } = useTranslation();
  const products = useMemo(() => Array.isArray(analysisResult?.products) ? analysisResult.products : [], [analysisResult]);

  const anomalyCount = useMemo(() => {
    return products.filter(p => Boolean(detectProductAnomaly(p))).length;
  }, [products]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
      {/* ⚠️ Image Anomaly Notice & Direct Return to Triage */}
      {anomalyCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl mb-2 text-xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            <span>
              {t('imageAnomalyNotice', { count: anomalyCount }) || (
                <>
                  AI detected <strong className="text-amber-900">{anomalyCount} {anomalyCount === 1 ? 'exception' : 'exceptions'}</strong> requiring review (missing price or non-standard promotion) on this shelf photo.
                </>
              )}
            </span>
          </div>
          {onOpenTriage && (
            <button
              onClick={onOpenTriage}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>{t('backToTriage') || 'Back to Triage'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <BoundingBoxOverlay
        imageUrl={imageUrl}
        products={products}
        isLoading={isLoading}
        highlightedProductName={highlightedProductName}
        isVideo={isVideo}
        brandClassifications={brandClassifications}
        onSelectProduct={onSelectProduct}
        onProductNameUpdate={onProductNameUpdate}
        onUpdateProductPrices={onUpdateProductPrices}
        onOpenTriage={onOpenTriage}
        isSOSMode={isSOSMode}
        showControls={true}
        allowZoomPan={true}
        allowFullScreen={true}
      />
    </div>
  );
};
