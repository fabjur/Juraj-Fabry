import React, { useMemo, useState } from 'react';
import type { PriceInfo } from '../types.ts';
import type { ImageState } from '../hooks/useImageAnalysis.ts';
import { CloseIcon } from './Icons.tsx';
import { FilterControls, Filters } from './FilterControls.tsx';
import { useTranslation } from '../i18n/index.tsx';
import { findBestMatch, removeDateFromStoreName } from '../utils/helpers.ts';

interface ProductOccurrence {
    chain: string;
    prices?: PriceInfo[];
    confidence: number;
    imageUrl: string;
    imageId: string;
}

interface SummaryByChain {
    chainName: string;
    count: number;
    prices: PriceInfo[];
    confidences: number[];
    imageUrls: string[];
    imageIdMap: Map<string, string>;
}

const parsePrice = (priceValue: string): number | null => {
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

interface ProductSummaryPanelProps {
    productName: string;
    images: ImageState[];
    onImageSelect: (imageId: string, productName: string) => void;
    isImagesSidebarOpen?: boolean;
    onToggleImagesSidebar?: () => void;
}


export const ProductSummaryPanel: React.FC<ProductSummaryPanelProps> = ({ productName, images, onImageSelect }) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    minPrice: '',
    maxPrice: '',
    confidence: 0,
    category: '',
    chain: '',
  });
  const { t } = useTranslation();


  const { filteredSummary, totalCount } = useMemo(() => {
    const unknownStore = t('unknownStore');
    const allOccurrences: ProductOccurrence[] = images.flatMap(img => {
        const storeInfo = img.analysisResult?.storeInfo;
        let storeIdentifier = unknownStore;
        if (storeInfo) {
            const { chain, address } = storeInfo;
            const cleanedChain = removeDateFromStoreName(chain);
            const cleanedAddress = removeDateFromStoreName(address);

            if (cleanedChain && cleanedAddress) {
                storeIdentifier = `${cleanedChain}, ${cleanedAddress}`;
            } else {
                storeIdentifier = cleanedChain || cleanedAddress || unknownStore;
            }
        }
        const products = img.analysisResult?.products;
        return (Array.isArray(products) ? products : [])
            .filter(p => {
                if (!p || !p.name) return false;
                return findBestMatch(p.name.trim(), [productName]) === productName;
            })
            .map(p => ({
                ...p,
                chain: storeIdentifier,
                imageUrl: img.imageUrl,
                imageId: img.id,
            }));
    });

    const chainMap = new Map<string, { count: number; prices: PriceInfo[], confidences: number[], imageUrls: Set<string>, imageIdMap: Map<string, string> }>();

    allOccurrences.forEach(occurrence => {
        if (!chainMap.has(occurrence.chain)) {
            chainMap.set(occurrence.chain, { count: 0, prices: [], confidences: [], imageUrls: new Set(), imageIdMap: new Map() });
        }
        const chainEntry = chainMap.get(occurrence.chain)!;
        chainEntry.count++;
        if (occurrence.prices && Array.isArray(occurrence.prices)) {
            chainEntry.prices.push(...occurrence.prices);
        }
        chainEntry.confidences.push(occurrence.confidence);
        chainEntry.imageUrls.add(occurrence.imageUrl);
        if (!chainEntry.imageIdMap.has(occurrence.imageUrl)) {
            chainEntry.imageIdMap.set(occurrence.imageUrl, occurrence.imageId);
        }
    });
    
    const summary: SummaryByChain[] = Array.from(chainMap.entries()).map(([chainName, data]) => ({
        chainName,
        count: data.count,
        prices: data.prices,
        confidences: data.confidences,
        imageUrls: Array.from(data.imageUrls),
        imageIdMap: data.imageIdMap,
    })).sort((a,b) => b.count - a.count);
    
    const filteredSummary = summary.filter(item => {
        if (filters.searchTerm && !item.chainName.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
            return false;
        }
        
        const avgConfidence = item.confidences.length > 0 ? item.confidences.reduce((acc, val) => acc + val, 0) / item.confidences.length : 0;
        if (avgConfidence * 100 < filters.confidence) {
            return false;
        }
        
        if (filters.minPrice !== '' || filters.maxPrice !== '') {
            const numericPrices = item.prices.map(p => parsePrice(p.value)).filter((v): v is number => v !== null);
            if (numericPrices.length === 0) return false;
            
            const min = filters.minPrice === '' ? -Infinity : Number(filters.minPrice);
            const max = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice);

            const hasMatchingPrice = numericPrices.some(p => p >= min && p <= max);
            if (!hasMatchingPrice) {
                return false;
            }
        }
        return true;
    });

    return { filteredSummary, totalCount: allOccurrences.length };
  }, [images, productName, filters, t]);


  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
       {zoomedImage && (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out" 
            onClick={() => setZoomedImage(null)}
        >
            <img src={zoomedImage} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" alt={t('zoomedView')} />
            <button className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors">
                <CloseIcon className="w-6 h-6" />
            </button>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
            <h2 className="text-xl font-bold text-gray-900">{t('productSummary')}</h2>
            <p className="text-sm text-gray-600 font-semibold">{productName}</p>
        </div>
        <div className="text-right">
            <p className="text-2xl font-bold text-lime-600">{totalCount}</p>
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider -mt-1">{t('totalFound')}</p>
        </div>
      </div>
      
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('foundInStores')}</h3>
      <FilterControls filters={filters} onFilterChange={setFilters} searchPlaceholder={t('searchStore')} />

      <div className="flex-grow space-y-2 overflow-y-auto pr-2 max-h-[calc(100vh-320px)]">
        {filteredSummary.length > 0 ? filteredSummary.map((item) => {
          const uniquePrices: PriceInfo[] = Array.from(new Map<string, PriceInfo>((Array.isArray(item.prices) ? item.prices : []).filter(p => p && p.value && p.type).map(p => [`${p.value}|${p.type}`, p])).values());
          const avgConfidence = item.confidences.length > 0 ? item.confidences.reduce((acc, val) => acc + val, 0) / item.confidences.length : 0;
          const confidenceColorClass = avgConfidence >= 0.9 ? 'text-green-600' : 'text-red-600';

          return (
            <button
                key={item.chainName}
                onClick={() => item.imageUrls.length > 0 && onImageSelect(item.imageIdMap.get(item.imageUrls[0])!, productName)}
                className="w-full text-left p-3 border rounded-lg hover:bg-lime-50 hover:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-500 transition-all grid grid-cols-[minmax(0,_3fr)_minmax(0,_2fr)_auto] items-center gap-4"
                disabled={item.imageUrls.length === 0}
            >
                <div>
                    <p className="font-semibold text-gray-800 break-words">{item.chainName}</p>
                    <p className={`text-xs font-semibold ${confidenceColorClass}`} title={t('confidenceTooltip')}>
                        {t('confidence')}: {Math.round(avgConfidence * 100)}%
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-start items-center">
                    {uniquePrices.length > 0 ? uniquePrices.map((price, i) => (
                        <span key={i} className={`inline-flex items-center font-bold px-2 py-0.5 rounded-full text-xs ${price.type === 'PROMO' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                            {price.value}
                            <span className="ml-1.5 text-xs opacity-70 font-medium">({price.type === 'PROMO' ? t('promoPrice') : t('regularPrice')})</span>
                        </span>
                    )) : <span className="text-xs text-gray-500">{t('noPriceData')}</span>}
                </div>
            
                <div className="flex items-center justify-self-end">
                     <div className="text-base font-bold bg-gray-200 rounded-full w-8 h-7 flex items-center justify-center text-gray-700 flex-shrink-0">
                        {item.count}
                    </div>
                </div>
            </button>
          );

        }) : (
          <div className="text-center py-10 text-sm text-gray-500">{t('noStoresForFilter')}</div>
        )}
      </div>
    </div>
  );
};