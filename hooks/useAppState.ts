import { useState, useDeferredValue } from 'react';
import { ActiveView, Analysis, BrandClassifications, ProductCatalogEntry } from '../types';

export const useAppState = () => {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<'images' | 'products'>('images');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(productSearchTerm);
  const [highlightedProductName, setHighlightedProductName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [brandsForClassification, setBrandsForClassification] = useState<string[]>([]);
  const [brandClassifications, setBrandClassifications] = useState<BrandClassifications>({ ourBrands: [], competitorBrands: [] });
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<ProductCatalogEntry | null>(null);

  const resetAppState = () => {
    setSelectedImageId(null);
    setSelectedProductName(null);
    setHighlightedProductName(null);
    setProductSearchTerm('');
    setBrandClassifications({ ourBrands: [], competitorBrands: [] });
    setActiveAnalysis(null);
    setActiveView('home');
  };

  return {
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
  };
};
