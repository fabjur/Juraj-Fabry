import React, { useMemo } from 'react';
import type { AnalysisResult, BrandClassifications, DetectedProduct } from '../types';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';

interface ImageAnalysisDisplayProps {
  imageUrl: string;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  highlightedProductName?: string | null;
  brandClassifications?: BrandClassifications;
  onSelectProduct?: (product: DetectedProduct) => void;
}

export const ImageAnalysisDisplay: React.FC<ImageAnalysisDisplayProps> = ({ 
  imageUrl, 
  analysisResult, 
  isLoading, 
  highlightedProductName,
  brandClassifications,
  onSelectProduct
}) => {
  const products = useMemo(() => Array.isArray(analysisResult?.products) ? analysisResult.products : [], [analysisResult]);

  return (
    <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
      <BoundingBoxOverlay
        imageUrl={imageUrl}
        products={products}
        isLoading={isLoading}
        highlightedProductName={highlightedProductName}
        brandClassifications={brandClassifications}
        onSelectProduct={onSelectProduct}
        showControls={true}
        allowZoomPan={true}
        allowFullScreen={true}
      />
    </div>
  );
};
