import React, { useMemo, useState } from 'react';
import type { AnalysisResult, PriceInfo, DetectedProduct } from '../types.ts';
import { SpinnerIcon, WarningIcon, EditIcon, MagicWandIcon, ArrowPathIcon, ChartBarIcon } from './Icons.tsx';
import { FilterControls, Filters } from './FilterControls.tsx';
import { getCategoryFromName, findBestMatch } from '../utils/helpers.ts';
import { useTranslation } from '../i18n/index.tsx';
import { TranslatedText } from './TranslatedText.tsx';
import { Box, Printer, AlertTriangle } from 'lucide-react';
import { PdfReportModal } from './PdfReportModal.tsx';

interface ResultsPanelProps {
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  imageId: string;
  onProductNameUpdate: (imageId: string, productId: string, originalName: string, newName: string) => void;
  onCorrectProduct?: (imageId: string, originalName: string, newName: string, prices: PriceInfo[], count: number) => void;
  onUpdateProductPrices?: (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => void;
  onOpenTriage?: () => void;
  onRetry: () => void;
  isImagesSidebarOpen?: boolean;
  onToggleImagesSidebar?: () => void;
  isSOSMode?: boolean;
}

interface ProductSummaryWithCategory {
    id: string; // Keep one of the product IDs for this group
    name: string;
    isCorrected?: boolean;
    originalName?: string; // To keep track of what to save for the catalog
    category: string;
    count: number;
    prices: PriceInfo[];
    confidences: number[];
    avgConfidence: number;
}

const parsePrice = (priceValue: string): number | null => {
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
  analysisResult, 
  isLoading, 
  error, 
  imageId, 
  onProductNameUpdate, 
  onCorrectProduct,
  onUpdateProductPrices,
  onOpenTriage,
  onRetry,
  isSOSMode = false
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingRegular, setEditingRegular] = useState('');
  const [editingPromo, setEditingPromo] = useState('');
  const [editingCount, setEditingCount] = useState<number>(0);
  const [originalName, setOriginalName] = useState('');

  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    minPrice: '',
    maxPrice: '',
    confidence: 0,
    category: '',
    chain: '',
  });
  const { t, language } = useTranslation();
  const unassignedCategory = t('unassignedCategory');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const { filteredProductSummary, allCategories } = useMemo(() => {
    if (!analysisResult?.products || !Array.isArray(analysisResult.products)) return { filteredProductSummary: [], allCategories: [] };

    const summaryMap = new Map<string, { products: DetectedProduct[] }>();

    analysisResult.products.filter(p => p && p.name).forEach(product => {
      const currentName = product.name.trim();
      const existingCanonicalNames = Array.from(summaryMap.keys());
      const matchedCanonicalName = findBestMatch(currentName, existingCanonicalNames);
      
      const canonicalName = matchedCanonicalName || currentName;
      
      const entry = summaryMap.get(canonicalName);
      if (entry) {
        entry.products.push(product);
      } else {
        summaryMap.set(canonicalName, { products: [product] });
      }
    });

    const summarized: ProductSummaryWithCategory[] = Array.from(summaryMap.values()).map(({ products }) => {
      const firstProduct = products[0];
      const allPrices = products.flatMap(p => p.prices || []);
      const allConfidences = products.map(p => p.confidence);

      return {
        id: firstProduct.id,
        name: firstProduct.name,
        isCorrected: firstProduct.isCorrected,
        category: getCategoryFromName(firstProduct.name, unassignedCategory),
        count: products.length,
        prices: allPrices,
        confidences: allConfidences,
        avgConfidence: allConfidences.reduce((acc, val) => acc + val, 0) / allConfidences.length,
      };
    });
    
    const categories = [...new Set(summarized.map(p => p.category))].sort();

    const filtered = summarized.filter(item => {
        if (filters.searchTerm && !item.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
            return false;
        }
        if (filters.category && item.category !== filters.category) {
            return false;
        }
        if (item.avgConfidence * 100 < filters.confidence) {
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

    const sorted = filtered.sort((a, b) => {
        const catCompare = a.category.localeCompare(b.category);
        if (catCompare !== 0) return catCompare;
        
        const getRegularPrice = (item: ProductSummaryWithCategory): number | null => {
            const regularPriceInfo = item.prices.find(p => p.type === 'REGULAR');
            return regularPriceInfo ? parsePrice(regularPriceInfo.value) : null;
        };
        
        const priceA = getRegularPrice(a);
        const priceB = getRegularPrice(b);
        
        if (priceA !== null && priceB !== null) {
            return priceA - priceB;
        }
        if (priceA !== null) {
            return -1;
        }
        if (priceB !== null) {
            return 1;
        }
        return b.count - a.count;
    });

    return { filteredProductSummary: sorted, allCategories: categories };

  }, [analysisResult, filters, unassignedCategory]);
  
  const handleEditClick = (item: ProductSummaryWithCategory) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setOriginalName(item.name);
    
    const regPrice = item.prices.find(p => p.type === 'REGULAR');
    const promoPrice = item.prices.find(p => p.type === 'PROMO');
    
    setEditingRegular(regPrice ? regPrice.value.replace('', '').trim() : '');
    setEditingPromo(promoPrice ? promoPrice.value.replace('', '').trim() : '');
    setEditingCount(item.count);
  };
  
  const handleEditSubmit = () => {
    if (editingId && editingName.trim()) {
      let regVal = editingRegular.trim();
      let promoVal = editingPromo.trim();

      // Logical check and auto-fixing of reversed manual pricing inputs
      if (regVal && promoVal) {
        const rNum = parsePrice(regVal);
        const pNum = parsePrice(promoVal);
        if (rNum !== null && pNum !== null && pNum > rNum) {
          const temp = regVal;
          regVal = promoVal;
          promoVal = temp;
          setEditingRegular(regVal);
          setEditingPromo(promoVal);
        }
      }

      const updatedPrices: PriceInfo[] = [];
      const regNum = parsePrice(regVal);
      if (regNum !== null && regNum > 0) {
        updatedPrices.push({
          value: `${regNum.toFixed(2)} €`,
          type: 'REGULAR'
        });
      }
      const promoNum = parsePrice(promoVal);
      if (promoNum !== null && promoNum > 0) {
        updatedPrices.push({
          value: `${promoNum.toFixed(2)} €`,
          type: 'PROMO'
        });
      }
      
      if (onCorrectProduct) {
        onCorrectProduct(imageId, originalName, editingName.trim(), updatedPrices, editingCount);
      } else {
        onProductNameUpdate(imageId, editingId, originalName, editingName.trim());
      }
    }
    setEditingId(null);
  };

  const productFacings = useMemo(() => {
    if (!analysisResult?.products || !Array.isArray(analysisResult.products)) return [];
    return analysisResult.products.filter(p => p.type !== 'pos_material' && !p.isGhost && !p.isDiscarded);
  }, [analysisResult]);

  const totalProducts = productFacings.length;

  const uniqueProductCount = useMemo(() => {
    return new Set(productFacings.map(p => (p.canonicalSku || p.name).trim())).size;
  }, [productFacings]);
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-20 bg-gray-50 dark:bg-zinc-800/60 rounded-3xl border border-gray-100 dark:border-zinc-800 flex flex-col items-center justify-center animate-fade-in">
          <SpinnerIcon className="w-10 h-10 mx-auto text-lime-500 mb-4" />
          <p className="text-sm font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{t('waitingForResults')}</p>
        </div>
      );
    }

    if (error) {
        return (
             <div className="text-center py-16 bg-red-50/50 border border-red-100 rounded-3xl p-8 flex flex-col items-center justify-center animate-fade-in">
                <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <WarningIcon className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-black text-red-900 mb-2">{t('errorOccurred')}</p>
                <p className="text-sm font-medium text-red-600 max-w-md mb-8">{error}</p>
                <button 
                    onClick={onRetry}
                    className="inline-flex items-center px-6 py-3 bg-white dark:bg-zinc-900 border border-red-200 rounded-xl font-black text-xs text-red-700 uppercase tracking-widest shadow-sm hover:bg-red-50 hover:border-red-300 transition-all active:scale-95"
                >
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    {t('retry')}
                </button>
             </div>
        );
    }
    
    if (!analysisResult) {
       return (
           <div className="text-center py-20 bg-gray-50 dark:bg-zinc-800/60 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-zinc-800">
                    <ChartBarIcon className="w-6 h-6 text-gray-300" />
                </div>
               <p className="text-sm font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{t('noDataForShelfShare')}</p>
           </div>
       );
    }

    if (analysisResult.complianceScore !== undefined) {
      const score = analysisResult.complianceScore;
      const isLow = score < 80;
      const scoreColorClass = isLow 
        ? 'text-red-600 bg-red-50 border-red-100 shadow-red-100/50' 
        : 'text-emerald-600 bg-emerald-50 border-emerald-100 shadow-emerald-100/50';

      return (
        <div className="space-y-6 animate-fade-in font-sans">
          {analysisResult.storeInfo && (analysisResult.storeInfo.chain || analysisResult.storeInfo.address) && (
            <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-[2rem] border border-gray-100 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                  <span className="text-2xl">🏪</span>
              </div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{t('storeInfo') || 'Predajňa'}</p>
                  <p className="text-lg font-black text-gray-900 dark:text-zinc-100">
                  {analysisResult.storeInfo.chain}{analysisResult.storeInfo.chain && analysisResult.storeInfo.address ? ', ' : ''}{analysisResult.storeInfo.address}
                  </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-gray-50/50 dark:bg-zinc-900/60 p-6 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800">
            {/* Circular Gauge */}
            <div className="flex flex-col items-center justify-center text-center p-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    className="stroke-gray-200 fill-none"
                    strokeWidth="10"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="54"
                    className={`fill-none transition-all duration-1000 ${isLow ? 'stroke-red-500' : 'stroke-emerald-500'}`}
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - score / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                    {score}%
                  </span>
                  <span className="text-[9px] uppercase font-black text-gray-400 dark:text-zinc-500 tracking-wider">
                    {t('compliance') || 'Zhoda'}
                  </span>
                </div>
              </div>
            </div>

            {/* Verdict Card */}
            <div className="md:col-span-2 space-y-3">
              <div className={`p-4 rounded-2xl border-2 shadow-sm font-black text-sm uppercase tracking-wider flex items-center gap-3 ${scoreColorClass}`}>
                <span className="text-xl">{isLow ? '⚠️' : '✅'}</span>
                <div>
                  <h4 className="text-xs opacity-60 font-black mb-0.5">{t('qualityAuditResult') || 'Výsledok auditu'}</h4>
                  <p className="text-base font-black">
                    {isLow 
                      ? (t('complianceFailedBadge') || 'CHYBA V SÚLADE (<80%)') 
                      : (t('compliancePassedBadge') || 'V SÚLADE SO VZOROM (OK)')}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 leading-normal font-medium">
                Pravidlo pre audit vyžaduje minimálne <strong>80%</strong> mieru zhody pre uznanie bezchybného stavu expozície. Predajne s nižšou zhodou sú zvýraznené na červeno.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-150 dark:border-zinc-800 shadow-sm space-y-3 text-zinc-900 dark:text-zinc-100">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400 flex items-center gap-2">
              📝 {t('complianceExplanation') || 'Odôvodnenie auditóra'}
            </h4>
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-100/80 dark:border-zinc-700 text-sm font-bold text-gray-700 dark:text-zinc-200 leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
              <TranslatedText text={analysisResult.reason || 'Snímka plne vyhovuje požiadavkám referenčného manuálu a rozloženiu výrobkov.'} targetLanguage={language} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {analysisResult?.storeInfo && (analysisResult.storeInfo.chain || analysisResult.storeInfo.address) && (
          <div className="mb-8 bg-gradient-to-r from-gray-50 to-white p-6 rounded-[2rem] border border-gray-100 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                <span className="text-2xl">🏪</span>
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{t('storeInfo')}</p>
                <p className="text-lg font-black text-gray-900 dark:text-zinc-100">
                {analysisResult.storeInfo.chain}{analysisResult.storeInfo.chain && analysisResult.storeInfo.address ? ', ' : ''}{analysisResult.storeInfo.address}
                </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 leading-tight">{totalProducts}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wider mt-0.5">{t('totalProducts')}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 leading-tight">{uniqueProductCount}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wider mt-0.5">{t('uniqueProducts')}</p>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Položky v snímke</span>
          </div>
          {onOpenTriage && (
            <button
              type="button"
              onClick={onOpenTriage}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Triage výnimiek auditu</span>
            </button>
          )}
        </div>
        <FilterControls filters={filters} onFilterChange={setFilters} searchPlaceholder={t('searchProduct')} categories={allCategories} />
        <div className="space-y-2.5 max-h-[calc(60vh-140px)] overflow-y-auto pr-2 custom-scrollbar mt-4">
          {filteredProductSummary.length > 0 ? filteredProductSummary.map((item, index) => {
            const avgConfidence = item.avgConfidence ?? 0;
            const isHighConfidence = avgConfidence >= 0.9;
            const confidenceColorClass = isHighConfidence
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-amber-50 text-amber-800 border-amber-300';
            const uniquePrices: PriceInfo[] = Array.from(new Map<string, PriceInfo>(item.prices.filter(p => p && p.value && p.type).map(p => [`${p.value}|${p.type}`, p])).values());

            return (
                <div key={`${item.id}-${index}`} className={`bg-white dark:bg-zinc-900 p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start transition-colors border shadow-2xs ${isHighConfidence ? 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700' : 'border-amber-200/90 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-950/20'} group`}>
                  <div className="flex-1 min-w-full sm:min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 inline-block px-1.5 py-0.2 rounded border border-zinc-200/60 dark:border-zinc-700">{item.category}</p>
                      {!isHighConfidence && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.2 rounded border border-amber-200/60">
                          Vyžaduje kontrolu ({Math.round(avgConfidence * 100)}%)
                        </span>
                      )}
                    </div>
                    {editingId === item.id ? (
                      <div className="bg-slate-50/60 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-zinc-700 space-y-3 mt-1.5 shadow-inner">
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-black tracking-wider block mb-1">Názov produktu</label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 w-full rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 dark:border-zinc-700 focus:ring-1 focus:ring-lime-500 font-sans"
                            autoFocus
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-black tracking-wider block mb-1">Bežná cena ()</label>
                            <input
                              type="text"
                              placeholder="Napr. 1.25"
                              value={editingRegular}
                              onChange={(e) => setEditingRegular(e.target.value)}
                              className="bg-white dark:bg-zinc-800 text-gray-950 dark:text-zinc-100 w-full rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 dark:border-zinc-700 focus:ring-1 focus:ring-lime-500 font-sans"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-red-500 uppercase font-black tracking-wider block mb-1">Akciová cena ()</label>
                            <input
                              type="text"
                              placeholder="Napr. 0.99"
                              value={editingPromo}
                              onChange={(e) => setEditingPromo(e.target.value)}
                              className="bg-white dark:bg-zinc-800 text-gray-950 dark:text-zinc-100 w-full rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 dark:border-zinc-700 focus:ring-1 focus:ring-lime-500 font-sans"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-black tracking-wider block mb-1">Počet (ks)</label>
                            <div className="flex items-center bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden h-[38px]">
                              <button 
                                type="button"
                                onClick={() => setEditingCount(c => Math.max(0, c - 1))}
                                className="px-3 h-full bg-gray-50 dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 text-gray-600 dark:text-zinc-200 font-bold transition-colors border-r dark:border-zinc-600"
                              >-</button>
                              <input
                                type="number"
                                value={editingCount}
                                onChange={(e) => setEditingCount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full text-center border-none text-sm font-bold focus:ring-0 p-0 focus:outline-none bg-transparent text-gray-950 dark:text-zinc-100"
                              />
                              <button 
                                type="button"
                                onClick={() => setEditingCount(c => c + 1)}
                                className="px-3 h-full bg-gray-50 dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 text-gray-600 dark:text-zinc-200 font-bold transition-colors border-l dark:border-zinc-600"
                              >+</button>
                            </div>
                          </div>
                        </div>

                        {/* live price verification warning */}
                        {(() => {
                          const rNum = parsePrice(editingRegular);
                          const pNum = parsePrice(editingPromo);
                          const isReversed = rNum !== null && pNum !== null && pNum > rNum;
                          if (!isReversed) return null;
                          return (
                            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-4 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base shrink-0">⚠️</span>
                                <div>
                                  <p className="font-extrabold text-amber-950 dark:text-amber-100">{t('invalidPriceLogic') || 'Incorrect Price Logic'}</p>
                                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                                    {t('invertedPriceWarning', { promo: editingPromo, regular: editingRegular }) || `Sale price (${editingPromo}) is higher than regular price (${editingRegular}). They will be automatically swapped on save.`}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const temp = editingRegular;
                                  setEditingRegular(editingPromo);
                                  setEditingPromo(temp);
                                }}
                                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 text-[10px] uppercase font-black tracking-wider shadow-2xs shrink-0 text-amber-950 dark:text-amber-200 cursor-pointer text-center w-full sm:w-auto"
                              >
                                {t('swapNow') || 'Swap Now'}
                              </button>
                            </div>
                          );
                        })()}

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-250 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 text-xs font-black uppercase tracking-wider transition-all animate-fade-in cursor-pointer"
                          >
                            {t('cancelButton') || 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={handleEditSubmit}
                            className="px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                          >
                            {t('save') || 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <p className="font-black text-gray-900 dark:text-zinc-100 truncate text-lg">{item.name}</p>
                          {item.isCorrected && (
                              <span title={t('autoCorrectedTooltip')} className="bg-purple-50 p-1.5 rounded-lg border border-purple-100 shadow-sm">
                                  <MagicWandIcon className="w-4 h-4 text-purple-600" />
                              </span>
                          )}
                        </div>
                        <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-2 mt-4">
                            {uniquePrices.length === 0 && (
                              <span className="inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-xl text-xs bg-orange-50 text-orange-800 border border-orange-200">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                                <span>Chýba cenovka</span>
                              </span>
                            )}
                            {uniquePrices.map((price, i) => (
                                <span key={i} className={`inline-flex items-center font-black px-3 py-1.5 rounded-xl text-sm border shadow-sm ${price.type === 'PROMO' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white dark:bg-zinc-900 text-gray-900 border-gray-200 dark:border-zinc-800'}`}>
                                {price.value}
                                <span className="ml-2 text-[10px] opacity-60 uppercase tracking-widest font-bold">{price.type === 'PROMO' ? t('promoPrice') : t('regularPrice')}</span>
                                </span>
                            ))}
                            {(() => {
                              const regPrice = uniquePrices.find(p => p.type === 'REGULAR')?.value;
                              const promoPrice = uniquePrices.find(p => p.type === 'PROMO')?.value;
                              if (regPrice && promoPrice) {
                                const r = parsePrice(regPrice);
                                const p = parsePrice(promoPrice);
                                if (r !== null && p !== null && p > r && onUpdateProductPrices) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onUpdateProductPrices([
                                          {
                                            imageId,
                                            productId: item.id,
                                            prices: [
                                              { value: `${p.toFixed(2)} €`, type: 'REGULAR' },
                                              { value: `${r.toFixed(2)} €`, type: 'PROMO' }
                                            ]
                                          }
                                        ]);
                                      }}
                                      className="inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-xl text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
                                      title="Prehodiť obrátené ceny (Akcia > Bežná)"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                      <span>⚡ Prehodiť akciu</span>
                                    </button>
                                  );
                                }
                              }
                              return null;
                            })()}
                            {isSOSMode ? (
                                <span
                                    className="font-black px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border shadow-sm bg-lime-50 text-lime-800 border-lime-300 flex items-center gap-1.5"
                                    title="Počet výskytov (facingov) produktu na tejto snímke"
                                >
                                    <Box className="w-3.5 h-3.5 text-lime-600" />
                                    {item.count === 1 ? '1 facing' : item.count < 5 ? `${item.count} facingy` : `${item.count} facingov`}
                                </span>
                            ) : (
                                <span
                                    className={`font-black px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border shadow-sm ${confidenceColorClass}`}
                                    title={t('confidenceTooltip')}
                                >
                                    {t('confidence')}: {Math.round(avgConfidence * 100)}%
                                </span>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                  {editingId !== item.id && (
                    <div className="flex items-center flex-shrink-0 ml-0 sm:ml-4 mt-3 sm:mt-0 justify-between sm:justify-start w-full sm:w-auto">
                      <div className="text-sm font-bold tabular-nums bg-zinc-50 dark:bg-zinc-800/60 rounded-lg w-9 h-9 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-2xs" title={t('detectedCount')}>
                        {item.count}
                      </div>
                      <button onClick={() => handleEditClick(item)} className="ml-2 p-2 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-70 group-hover:opacity-100 focus:opacity-100 cursor-pointer" title="Upraviť">
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
            );
          }) : (
             <div className="text-center py-12 bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center">
                 <div className="bg-white dark:bg-zinc-900 w-10 h-10 rounded-lg flex items-center justify-center mb-2 shadow-2xs border border-zinc-200 dark:border-zinc-800">
                     <ChartBarIcon className="w-4 h-4 text-zinc-400" />
                 </div>
                 <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{t('noProductsForFilter')}</p>
             </div>
          )}
        </div>
      </>
    );
  };


  const singleImageMock = useMemo(() => {
    if (!analysisResult) return [];
    return [{
      id: imageId,
      file: { name: 'Snímka regálu' } as any,
      imageUrl: '',
      analysisResult,
      status: 'success' as const,
      error: null,
      uploadDate: new Date()
    }];
  }, [imageId, analysisResult]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100">{t('analysisResults')}</h2>
        {analysisResult && (
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all border border-rose-200 active:scale-95 shadow-3xs"
            title="Exportovať výsledky tejto fotografie do PDF reportu pre tím"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF Report</span>
          </button>
        )}
      </div>
      <div className="flex-grow">
          {renderContent()}
      </div>

      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        analysisName={`Analýza regálu - ${analysisResult?.storeInfo?.chain || 'Predajňa'}`}
        storeName={analysisResult?.storeInfo?.chain || 'Predajňa'}
        storeAddress={analysisResult?.storeInfo?.address}
        images={singleImageMock}
      />
    </div>
  );
};