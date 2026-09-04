import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { BrandClassifications, StoreCentricSummary, Analysis } from '../types';
import type { ImageState } from '../hooks/useImageAnalysis';
import { getCategoryFromName, findBestMatch, removeDateFromStoreName, getImageStoreName } from '../utils/helpers';
import { 
  CloseIcon, 
  SpinnerIcon,
  ChartBarIcon, 
  ChartPieIcon, 
  ArrowDownTrayIcon, 
  TrashIcon, 
  DocumentTextIcon, 
  ShieldExclamationIcon, 
  MagicWandIcon, 
  CpuChipIcon, 
  TagIcon, 
  BoxIcon,
  EditIcon,
  ClockIcon,
  ChevronLeftIcon
} from './Icons';
import { FilterControls, Filters } from './FilterControls';
import { ShelfSharePanel } from './ShelfSharePanel';
import { PromoAlertPanel } from './PromoAlertPanel';
import { useTranslation } from '../i18n';
import { exportPriceMonitoringToXLS, exportToPDF, exportQualityCheckToXLS } from '../utils/export';
import { PriceTrendReportBuilder } from './PriceTrendReportBuilder';
import { PriceGapAnalysisPanel } from './PriceGapAnalysisPanel';
import { Scale } from 'lucide-react';
import { TranslatedText } from './TranslatedText';

const parsePrice = (priceValue: string): number | null => {
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

export const ViewportStoreCardLegacy: React.FC<{
    store: StoreCentricSummary;
    setZoomedImage: (url: string | null) => void;
    onCorrectProduct?: (imageId: string, originalName: string, newName: string, prices: PriceInfo[], count: number) => void;
}> = ({ store, setZoomedImage, onCorrectProduct }) => {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingRegular, setEditingRegular] = useState('');
    const [editingPromo, setEditingPromo] = useState('');
    const [editingCount, setEditingCount] = useState(0);

    const handleEditClick = (product: ProductInStore) => {
        setEditingProductKey(`${product.type}-${product.name}-${product.isGhost}`);
        setEditingName(product.name);
        
        const regularPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'REGULAR')?.price.value || 
                             product.priceHistory.find(ph => ph.price.type && ['regular', 'regular_price', 'regularprice'].includes(ph.price.type.toLowerCase()))?.price.value;
        const promoPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'PROMO')?.price.value || 
                           product.priceHistory.find(ph => ph.price.type && ['promo', 'promo_price', 'promoprice', 'action', 'action_price', 'akcia'].includes(ph.price.type.toLowerCase()))?.price.value;
        
        setEditingRegular(regularPrice ? regularPrice.replace('€', '').trim() : '');
        setEditingPromo(promoPrice ? promoPrice.replace('€', '').trim() : '');
        setEditingCount(product.count);
    };

    const handleEditSubmit = (product: ProductInStore) => {
        if (editingName.trim() && onCorrectProduct && product.imageId) {
            const updatedPrices: PriceInfo[] = [];
            if (editingRegular.trim()) {
                const val = editingRegular.trim();
                updatedPrices.push({
                    value: val.includes('€') ? val : `${val} €`,
                    type: 'REGULAR'
                });
            }
            if (editingPromo.trim()) {
                const val = editingPromo.trim();
                updatedPrices.push({
                    value: val.includes('€') ? val : `${val} €`,
                    type: 'PROMO'
                });
            }
            onCorrectProduct(product.imageId, product.name, editingName.trim(), updatedPrices, editingCount);
        }
        setEditingProductKey(null);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            },
            {
                rootMargin: '200px 0px', // Načítaj skor než vojde do viewportu
                threshold: 0.1,
            }
        );

        const currentElem = cardRef.current;
        if (currentElem) {
            observer.observe(currentElem);
        }

        return () => {
            if (currentElem) {
                observer.unobserve(currentElem);
            }
        };
    }, []);

    const groupedByCategory = useMemo(() => {
        if (!isVisible) return {};
        return store.products.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = [];
            acc[p.category].push(p);
            return acc;
        }, {} as Record<string, ProductInStore[]>);
    }, [store.products, isVisible]);

    if (!isVisible) {
        return (
            <div 
                ref={cardRef} 
                className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[90px] flex items-center justify-center text-gray-400 font-sans"
            >
                <div className="flex items-center gap-2">
                    <span className="text-base animate-pulse">🏪</span>
                    <span className="text-xs font-bold tracking-wide text-gray-300">Načítavam {store.storeName}...</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={cardRef} className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                        <span className="text-sm">🏪</span>
                    </div>
                    {store.storeName}
                    {store.storeCode && <span className="bg-blue-50 text-blue-700 text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-blue-100">#{store.storeCode}</span>}
                </h3>
                <span className="text-[10px] font-bold text-gray-500 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm">
                    {store.products.length} položiek
                </span>
            </div>
            
            <div className="p-2.5 space-y-2.5">
                {Object.entries(groupedByCategory).map(([catName, products]: [string, ProductInStore[]]) => (
                    <div key={catName} className="space-y-1">
                        {/* Compact Category Header */}
                        <div className="flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="text-[9px] font-black text-blue-700 uppercase tracking-wider bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100/50">{catName}</span>
                            <div className="h-px bg-gray-100 flex-grow"></div>
                        </div>
                        
                        <div className="bg-gray-50/10 rounded-xl border border-gray-150 divide-y divide-gray-100 overflow-hidden">
                            {products.map((product, idx) => {
                                // Robust price matching (case-insensitive & aliases friendly)
                                let regularPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'REGULAR')?.price.value || 
                                                     product.priceHistory.find(ph => ph.price.type && ['regular', 'regular_price', 'regularprice'].includes(ph.price.type.toLowerCase()))?.price.value;
                                let promoPrice = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'PROMO')?.price.value || 
                                                   product.priceHistory.find(ph => ph.price.type && ['promo', 'promo_price', 'promoprice', 'action', 'action_price', 'akcia'].includes(ph.price.type.toLowerCase()))?.price.value;
                                
                                // Fallback for general values if not identified as regular or promo specifically
                                if (!regularPrice && !promoPrice && product.priceHistory.length > 0) {
                                    const first = product.priceHistory[0];
                                    if (first.price.type?.toUpperCase() === 'PROMO') {
                                        promoPrice = first.price.value;
                                    } else {
                                        regularPrice = first.price.value;
                                    }
                                }
                                
                                const isPOS = product.type === 'pos_material';
                                const isEditing = editingProductKey === `${product.type}-${product.name}-${product.isGhost}`;
                                
                                if (isEditing) {
                                    return (
                                        <div key={`edit-${product.type}-${product.name}-${idx}`} className="bg-slate-50 p-3.5 flex flex-col gap-2 rounded-xl border border-slate-200 my-1 shadow-inner animate-fade-in">
                                            {/* Name */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">{t('productName')}</label>
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    className="bg-white border text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Price & Count inline */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">{t('regularPriceCol')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Napr. 1.25"
                                                        value={editingRegular}
                                                        onChange={(e) => setEditingRegular(e.target.value)}
                                                        className="bg-white border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-red-500 font-bold uppercase mb-0.5">{t('promoActionLabel')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Napr. 0.99"
                                                        value={editingPromo}
                                                        onChange={(e) => setEditingPromo(e.target.value)}
                                                        className="bg-white border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">{t('countPcs')}</label>
                                                    <div className="flex items-center border rounded bg-white overflow-hidden h-7">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingCount(c => Math.max(0, c - 1))}
                                                            className="px-2 h-full bg-gray-50 hover:bg-gray-100 text-gray-650 font-bold border-r text-xs"
                                                        >-</button>
                                                        <input
                                                            type="number"
                                                            value={editingCount}
                                                            onChange={(e) => setEditingCount(Math.max(0, parseInt(e.target.value) || 0))}
                                                            className="w-full text-center border-none text-xs font-bold p-0 focus:ring-0 focus:outline-none h-full"
                                                        />
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingCount(c => c + 1)}
                                                            className="px-2 h-full bg-gray-50 hover:bg-gray-100 text-gray-655 font-bold border-l text-xs"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex justify-end gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingProductKey(null)}
                                                    className="px-2 py-1 bg-white border rounded text-[9px] font-black uppercase text-gray-500 hover:bg-gray-50"
                                                >
                                                    {t('cancel')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditSubmit(product)}
                                                    className="px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-black uppercase hover:bg-blue-750"
                                                >
                                                    {t('save')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={`${product.type}-${product.name}-${product.isGhost}-${idx}`} className="group flex items-center justify-between gap-2.5 px-3 py-1.5 hover:bg-blue-50/25 transition-all">
                                        {/* Left Side: Thumbnail on far left + product name in 1 row */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                                            {/* Thumbnail */}
                                            <div 
                                                className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 bg-white group-hover:border-blue-400 transition-all cursor-zoom-in shadow-xs relative"
                                                onClick={() => setZoomedImage(product.imageUrl || null)}
                                            >
                                                {product.imageUrl ? (
                                                    <img 
                                                        src={product.imageUrl} 
                                                        alt="P" 
                                                        className={`w-full h-full object-cover transition-all duration-300 ${product.isGhost ? 'grayscale opacity-60' : 'grayscale-[0.1] group-hover:grayscale-0 scale-100 group-hover:scale-105'}`} 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[8px] font-bold">No img</div>
                                                )}
                                            </div>
 
                                            {/* Name & Badges in single line */}
                                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                                <p className={`text-xs truncate max-w-[130px] sm:max-w-[280px] md:max-w-[340px] leading-tight ${product.isGhost ? 'text-gray-450 italic font-medium' : 'text-gray-900 font-extrabold'}`}>
                                                    {product.name}
                                                </p>
                                                {product.isGhost && (
                                                    <span className="bg-amber-50 text-amber-700 text-[8px] px-1 py-0.2 rounded font-bold border border-amber-100/60 shadow-2xs">
                                                        GHOST
                                                    </span>
                                                )}
                                                {isPOS && (
                                                    <span className="bg-purple-50 text-purple-700 text-[8px] px-1 py-0.2 rounded font-black uppercase tracking-wider border border-purple-100 shadow-2xs">
                                                        POS: {product.posType}
                                                    </span>
                                                )}
                                                {product.isCorrected && (
                                                    <span className="bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 shadow-2xs" title="Upravené používateľom">
                                                        <MagicWandIcon className="w-2.5 h-2.5 text-indigo-600 inline-block animate-bounce" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
 
                                        {/* Right Side: Metadata (Confidence/Faces) & Prices on far right */}
                                        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                                            {/* Compact Specs Row (Confidence & Facing Counts) */}
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                                                <span className="bg-gray-100/60 px-1.5 py-0.5 rounded border border-gray-200">
                                                    {Math.round(product.avgConfidence * 100)}%
                                                </span>
                                                {!isPOS && (
                                                    <div className="flex items-center gap-1 bg-blue-50/40 text-blue-800 px-1.5 py-0.5 rounded border border-blue-100">
                                                        <BoxIcon className="w-2.5 h-2.5 text-blue-600/75" />
                                                        <span>{product.count} ks</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Prices Block */}
                                            {!isPOS && (
                                                <div className="flex items-center gap-1.5 flex-shrink-0 min-w-[70px] justify-end">
                                                    {regularPrice ? (
                                                        <div className={`px-1.5 py-0.5 rounded text-xs font-bold border shadow-3xs transition-all ${promoPrice ? 'bg-gray-50 text-gray-450 line-through border-gray-150 font-normal text-[10px]' : 'bg-white text-gray-950 border-gray-200'}`}>
                                                            {regularPrice}
                                                        </div>
                                                    ) : null}
                                                    {promoPrice ? (
                                                        <div className="px-1.5 py-0.5 rounded text-xs font-extrabold bg-red-50 text-red-650 border border-red-150 shadow-2xs animate-pulse">
                                                            {promoPrice}
                                                        </div>
                                                    ) : null}
                                                    {!regularPrice && !promoPrice && (
                                                        <span className="text-[9px] italic font-bold text-gray-400 bg-gray-50/50 px-1.5 py-0.5 rounded border border-gray-150 uppercase tracking-wider">
                                                            bez ceny
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quick Edit triggering button */}
                                            {onCorrectProduct && product.imageId && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditClick(product);
                                                    }}
                                                    className="p-1 px-1.5 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded border border-transparent hover:border-lime-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95"
                                                    title="Upraviť produkt"
                                                >
                                                    <EditIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface BatchSummaryPanelProps {
    images: ImageState[];
    brandClassifications: BrandClassifications;
    onReset: () => void;
    initialView: 'priceMonitoring' | 'shelfShare' | 'promoAlert' | 'home' | 'productCatalog' | 'analyses' | 'stores' | 'costs';
    onOpenMissingPrices: () => void;
    onViewChange?: (view: any) => void;
    activeAnalysis?: Analysis | null;
    onRenameAnalysis?: (newName: string) => Promise<void>;
    isImagesSidebarOpen?: boolean;
    onToggleImagesSidebar?: () => void;
    onCorrectProduct?: (imageId: string, originalName: string, newName: string, prices: PriceInfo[], count: number) => void;
    onOpenBrandDefinition?: () => void;
}

export const BatchSummaryPanel: React.FC<BatchSummaryPanelProps> = ({ 
  images, 
  brandClassifications, 
  onReset, 
  initialView, 
  onOpenMissingPrices, 
  onViewChange,
  activeAnalysis,
  onRenameAnalysis,
  onCorrectProduct,
  onOpenBrandDefinition
}): React.ReactNode => {
  const { t, language } = useTranslation();

  const getSubSectionLabel = () => {
    switch (view) {
      case 'priceAnalysis': return t('subSectionPriceAnalysis');
      case 'priceGap': return 'Price Gap & MOC';
      case 'shelfShare': return t('subSectionShelfShare');
      case 'promoAlert': return t('subSectionPromoAlert');
      case 'rawData': return t('subSectionRawData');
      case 'qualityCheck': return t('subSectionQualityCheck');
      default: return t('analysesOverview');
    }
  };

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [view, setView] = useState<'priceAnalysis' | 'priceGap' | 'shelfShare' | 'promoAlert' | 'rawData' | 'qualityCheck'>(() => {
    if (images.some(img => img.analysisType === 'qualityCheck')) return 'qualityCheck';
    if (initialView === 'priceMonitoring') return 'priceAnalysis';
    if (initialView === 'shelfShare') return 'shelfShare';
    if (initialView === 'promoAlert') return 'promoAlert';
    if (initialView === 'costs') return 'rawData';
    return 'priceAnalysis';
  });

  const hasQualityChecks = useMemo(() => images.some(img => img.analysisType === 'qualityCheck'), [images]);

  useEffect(() => {
    if (images.some(img => img.analysisType === 'qualityCheck')) setView('qualityCheck');
    else if (initialView === 'priceMonitoring') setView('priceAnalysis');
    else if (initialView === 'shelfShare') setView('shelfShare');
    else if (initialView === 'promoAlert') setView('promoAlert');
    else if (initialView === 'costs') setView('rawData');
  }, [initialView, images]);

  const [filters, setFilters] = useState<Filters>({
    searchTerm: '',
    minPrice: '',
    maxPrice: '',
    confidence: 0,
    category: '',
    chain: '',
    posFilter: 'all',
    hideGhosts: true
  });
  const unassignedCategory = t('unassignedCategory');
  const panelRef = useRef<HTMLDivElement>(null);

  const missingPriceCount = useMemo(() => {
      return images.reduce((count, img) => {
          if (!img.analysisResult?.products) return count;
          // Pre výpočet chýbajúcich cien berieme len reálne produkty
          const missingInImage = img.analysisResult.products.filter(p => p.type === 'product' && !p.isGhost && (!p.prices || p.prices.length === 0)).length;
          return count + missingInImage;
      }, 0);
  }, [images]);

  const { storeData, analyzedImagesCount, allCategories, allChains } = useMemo(() => {
    const unknownStore = t('unknownStore');
    const productsByStore = new Map<string | number, { name: string, code?: string, items: (DetectedProduct & { uploadDate: Date; imageUrl: string; imageId: string })[] }>();
    
    images.forEach(img => {
        if (!img.analysisResult) return;
        
        let storeKey: string | number;
        let storeDisplayName = unknownStore;
        const storeCode = img.assignedStore?.code;

        if (img.assignedStoreId) {
            storeKey = img.assignedStoreId;
            if (img.assignedStore) {
                 const components = [img.assignedStore.name, img.assignedStore.address, img.assignedStore.city].filter(p => p && p.trim());
                 storeDisplayName = [...new Set(components)].join(', ');
            }
        } else {
            const storeInfo = img.analysisResult.storeInfo;
            if (storeInfo) {
                const { chain, address } = storeInfo;
                const cleanedChain = removeDateFromStoreName(chain);
                const cleanedAddress = removeDateFromStoreName(address);
                if (cleanedChain && cleanedAddress) storeDisplayName = `${cleanedChain}, ${cleanedAddress}`;
                else storeDisplayName = cleanedChain || cleanedAddress || unknownStore;
            } else if (img.assignedStore) {
                 storeDisplayName = img.assignedStore.name;
            }
            storeKey = storeDisplayName;
        }
        
        if (!productsByStore.has(storeKey)) {
            productsByStore.set(storeKey, { name: storeDisplayName, code: storeCode, items: [] });
        }
        
        const storeGroup = productsByStore.get(storeKey)!;
        if (storeGroup.name === unknownStore && img.assignedStore?.name) {
             storeGroup.name = img.assignedStore.name;
        }

        if (Array.isArray(img.analysisResult.products)) {
            img.analysisResult.products.forEach(p => {
                if (p && p.name) {
                    storeGroup.items.push({ ...p, uploadDate: img.uploadDate, imageUrl: img.imageUrl, imageId: img.id });
                }
            });
        }
    });

    const finalData: StoreCentricSummary[] = Array.from(productsByStore.entries())
        .map(([key, data]): StoreCentricSummary => {
            const productsMap = new Map<string, (DetectedProduct & { uploadDate: Date; imageUrl: string; imageId: string })[]>();

            data.items.forEach(p => {
                let groupKey = p.catalogProductId ? `ID_${p.catalogProductId}` : findBestMatch(p.name.trim(), Array.from(productsMap.keys()).filter(k => !k.startsWith('ID_'))) || p.name.trim();
                // Rozlišujeme POS od Produktov v kľúči
                groupKey = `${p.type}_${groupKey}`;
                if (p.isGhost) groupKey += '_ghost';

                if (!productsMap.has(groupKey)) productsMap.set(groupKey, []);
                productsMap.get(groupKey)!.push(p);
            });

            const summarizedProducts: ProductInStore[] = Array.from(productsMap.values())
                .filter((occurrences) => occurrences.length > 0)
                .map((occurrences): ProductInStore => {
                    const representative = occurrences[0];
                    const name = representative.name; 
                    const confidences = occurrences.map(o => o.confidence);
                    
                    const priceHistory: { price: PriceInfo; date: Date; imageUrl: string }[] = [];
                    const occurrencesByImage = occurrences.reduce((acc, o) => { (acc[o.imageId] = acc[o.imageId] || []).push(o); return acc; }, {} as Record<string, typeof occurrences>);
                    
                    Object.values(occurrencesByImage).forEach(imageOccurrences => {
                        const uniquePricesOnImage = new Map<string, PriceInfo>();
                        imageOccurrences.forEach(o => (o.prices || []).forEach(price => uniquePricesOnImage.set(`${price.value}|${price.type}`, price)));
                        uniquePricesOnImage.forEach(price => priceHistory.push({ price, date: imageOccurrences[0].uploadDate, imageUrl: imageOccurrences[0].imageUrl }));
                    });

                    return {
                        name,
                        isCorrected: occurrences.some(o => o.isCorrected),
                        category: getCategoryFromName(name, unassignedCategory),
                        count: occurrences.length,
                        priceHistory: priceHistory.sort((a, b) => a.date.getTime() - b.date.getTime()),
                        avgConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
                        imageUrl: priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].imageUrl : occurrences[0].imageUrl,
                        catalogProductId: representative.catalogProductId,
                        type: representative.type,
                        posType: representative.posType,
                        isGhost: representative.isGhost,
                        imageId: representative.imageId
                    };
                });
            
            return {
                storeName: data.name,
                storeId: typeof key === 'number' ? key : undefined,
                storeCode: data.code,
                products: summarizedProducts.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
            };
        }).sort((a,b) => a.storeName.localeCompare(b.storeName));

    const filteredData = finalData
        .map(store => {
            if (filters.chain && store.storeName !== filters.chain) return null;
            const filteredProducts = store.products.filter(item => {
                if (filters.hideGhosts && item.isGhost) return false;
                
                if (filters.posFilter === 'products_only' && item.type !== 'product') return false;
                if (filters.posFilter === 'pos_only' && item.type !== 'pos_material') return false;
                if (filters.posFilter && ['wobbler', 'stopper', 'stand', 'pallet', 'secondary_display'].includes(filters.posFilter) && item.posType !== filters.posFilter) return false;

                if (filters.searchTerm && !item.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
                if (filters.category && item.category !== filters.category) return false;
                if (item.avgConfidence * 100 < filters.confidence) return false;
                
                if (filters.minPrice !== '' || filters.maxPrice !== '') {
                    const numericPrices = item.priceHistory.map(h => parsePrice(h.price.value)).filter((v): v is number => v !== null);
                    const min = filters.minPrice === '' ? -Infinity : Number(filters.minPrice);
                    const max = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice);
                    if (!numericPrices.some(p => p >= min && p <= max)) return false;
                }
                return true;
            });
            if (filteredProducts.length === 0) return null;
            return { ...store, products: filteredProducts };
        })
        .filter((s): s is StoreCentricSummary => s !== null);

    return {
      storeData: filteredData,
      analyzedImagesCount: images.filter(img => img.analysisResult || img.error).length,
      allCategories: Array.from(new Set(finalData.flatMap(s => s.products.map(p => p.category)))).sort(),
      allChains: Array.from(new Set(finalData.map(s => s.storeName))).sort()
    };
  }, [images, filters, t, unassignedCategory]);

  const stats = useMemo(() => {
    let totalFacings = 0;
    let posCount = 0;
    const unique = new Set();
    storeData.forEach(s => s.products.forEach(p => { 
        if (p.type === 'product' && !p.isGhost) totalFacings += p.count; 
        if (p.type === 'pos_material') posCount += p.count;
        unique.add(p.catalogProductId ? `ID_${p.catalogProductId}` : p.name); 
    }));
    return { totalFacings, posCount, unique: unique.size };
  }, [storeData]);
  
  return (
    <div ref={panelRef} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col printable-content">
      {zoomedImage && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setZoomedImage(null)}>
            <img src={zoomedImage} className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl animate-fade-in-up" alt="Zoom" />
            <button className="absolute top-8 right-8 text-white bg-black/40 p-4 rounded-full hover:bg-black/60 transition-colors backdrop-blur-md"><CloseIcon className="w-6 h-6" /></button>
        </div>
      )}

      {/* 🚀 AKTÍVNA NOTIFIKÁCIA O PREBIEHAJÚCEJ ANALÝZE */}
      {images.some(img => img.status === 'analyzing') && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl shadow-md border border-blue-500/40 flex items-center justify-between gap-4 animate-fade-in no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-cyan-400/40 relative">
              <SpinnerIcon className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></span>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Prebieha asynchrónne spracovanie ďalších snímok
              </p>
              <p className="text-[11px] text-slate-300">
                Zobrazené dáta sa priebežne aktualizujú v reálnom čase s každou novo spracovanou fotografiou.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-black text-white px-2.5 py-1 bg-blue-800/80 rounded-lg border border-blue-400/30">
              {images.filter(i => i.status === 'analyzing').length} v procese
            </span>
          </div>
        </div>
      )}

      {/* 🔮 ULTRA-KOMPAKTNÝ PRÉMIOVÝ DASHBOARD HEADER PRE PODROBNOSTI ANALÝZY */}
      <div className="mb-4 pb-3.5 border-b border-gray-155 flex flex-col gap-3 select-none">
        {/* Názov analýzy, inline metadáta a hlavné akcie */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 text-base leading-none">📂</span>
              <h1 className="text-lg md:text-xl font-black text-gray-950 tracking-tight leading-none truncate max-w-[280px] sm:max-w-md md:max-w-lg">
                {activeAnalysis?.name || t('batchSummary')}
              </h1>
              {onRenameAnalysis && activeAnalysis && (
                <button 
                  onClick={() => {
                    const newName = window.prompt(t('renameAnalysisPrompt'), activeAnalysis.name);
                    if (newName && newName.trim() && newName.trim() !== activeAnalysis.name) {
                      onRenameAnalysis(newName.trim());
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-lime-600 hover:bg-lime-50 rounded-lg transition-all border border-transparent hover:border-lime-200/50 no-print"
                  title={t('renameAnalysisTooltip')}
                >
                  <EditIcon className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {/* Ultra-sleek inline metadata row instead of separate block */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 font-bold leading-none select-text">
              <span className="text-lime-750 font-black uppercase tracking-wider bg-lime-50 px-1.5 py-0.5 rounded border border-lime-100 shadow-3xs">
                {getSubSectionLabel()}
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1 text-gray-750">
                <span>🏪</span>
                <span className="font-extrabold truncate max-w-[150px] sm:max-w-[280px]" title={activeAnalysis?.store ? `${activeAnalysis.store.name}, ${activeAnalysis.store.city || ''}` : undefined}>
                  {activeAnalysis?.store ? `${activeAnalysis.store.name}, ${activeAnalysis.store.city || ''}` : t('detectedFromImages')}
                </span>
              </span>
              <span className="text-gray-300">&bull;</span>
              <span className="flex items-center gap-1 text-gray-650">
                <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  {activeAnalysis?.createdAt 
                    ? `${new Date(activeAnalysis.createdAt).toLocaleDateString("sk-SK")} o ${new Date(activeAnalysis.createdAt).toLocaleTimeString("sk-SK", { hour: '2-digit', minute: '2-digit' })}` 
                    : new Date().toLocaleDateString("sk-SK")}
                </span>
              </span>
              <span className="text-gray-300">&bull;</span>
              <span className="flex items-center gap-1 text-gray-605">
                <CpuChipIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  {activeAnalysis?.costInfo 
                    ? `${activeAnalysis.costInfo.cost.toFixed(4)} € (${activeAnalysis.costInfo.modelName || 'Gemini 2.5 Flash'})` 
                    : `Gemini 2.5 Flash`}
                </span>
              </span>
            </div>
          </div>

          {/* Ovládacie prvky na jednom riadku */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 no-print">
            {missingPriceCount > 0 && (
                <button onClick={onOpenMissingPrices} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-255 transition-all font-black text-xs animate-pulse">
                    <TagIcon className="w-3.5 h-3.5 text-orange-500" />
                    <span>{t('fixMissingPrices', { count: missingPriceCount }) || `Doplniť ${missingPriceCount} cien`}</span>
                </button>
            )}
            
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all border border-gray-200 active:scale-95 shadow-3xs"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span>{activeAnalysis ? t('backToArchive') : t('endAndSave')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Highly integrated and compact Tabs & Stats Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-150 pb-2 mb-3.5 gap-2.5 no-print select-none">
          {/* Tabs on Left */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar -mb-2 pb-2">
              {[
                  { id: 'qualityCheck', label: 'Quality Check', icon: ShieldExclamationIcon, cond: hasQualityChecks },
                  { id: 'priceAnalysis', label: t('priceAnalysis'), icon: ChartBarIcon, cond: !hasQualityChecks },
                  { id: 'priceGap', label: 'Price Gap & MOC', icon: Scale as any, cond: !hasQualityChecks },
                  { id: 'shelfShare', label: t('shelfShare'), icon: ChartPieIcon, cond: !hasQualityChecks },
                  { id: 'promoAlert', label: t('promoAlert'), icon: TagIcon, cond: !hasQualityChecks },
                  { id: 'rawData', label: t('rawData'), icon: CpuChipIcon, cond: true }
              ].filter(tab => tab.cond).map(tab => (
                <button
                    key={tab.id}
                    onClick={() => {
                      setView(tab.id as any);
                      if (onViewChange) {
                        if (tab.id === 'priceAnalysis') onViewChange('priceMonitoring');
                        else if (tab.id === 'shelfShare') onViewChange('shelfShare');
                        else if (tab.id === 'promoAlert') onViewChange('promoAlert');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${view === tab.id ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-950 hover:bg-gray-100/60'}`}
                >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                </button>
              ))}
          </div>

          {/* Compact Mini Stats-Pills on Right */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-black uppercase tracking-wider">
              {/* Spracované fotky */}
              <div className="bg-slate-100 text-slate-705 px-2 py-1 rounded-md border border-slate-200/80 shadow-3xs flex items-center gap-1">
                  <span className="text-gray-400">📷</span>
                  <span className="text-gray-550 font-bold">{t('photosCount')}:</span>
                  <span className="text-slate-950 font-black">{analyzedImagesCount}</span>
              </div>

              {/* Kusov / Facing */}
              <div className="bg-lime-50/70 text-lime-850 px-2 py-1 rounded-md border border-lime-150/50 shadow-3xs flex items-center gap-1">
                  <span className="text-lime-550">📦</span>
                  <span className="text-lime-600 font-bold">{t('facesLabel') || 'FACINGY'}:</span>
                  <span className="text-lime-900 font-black">{stats.totalFacings}</span>
              </div>

              {/* POS */}
              <div className="bg-purple-50 text-purple-855 px-2 py-1 rounded-md border border-purple-150/50 shadow-3xs flex items-center gap-1">
                  <span className="text-purple-400">✨</span>
                  <span className="text-purple-550 font-bold">{t('posCount')}:</span>
                  <span className="text-purple-900 font-black">{stats.posCount}</span>
              </div>

              {/* Unikátne SKU */}
              <div className="bg-blue-50 text-blue-805 px-2 py-1 rounded-md border border-blue-150/50 shadow-3xs flex items-center gap-1">
                  <span className="text-blue-400">🎯</span>
                  <span className="text-blue-550 font-bold">{t('uniqueSku')}:</span>
                  <span className="text-blue-900 font-black">{stats.unique}</span>
              </div>
          </div>
      </div>

      <div className="flex-grow">
        {view === 'qualityCheck' && (
          <div className="animate-fade-in space-y-6">
            <div className="p-6 bg-gradient-to-r from-lime-500/10 to-emerald-500/10 rounded-3xl border border-lime-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="text-base font-black text-lime-900 uppercase tracking-wide">{t('qualityCheckTitle')}</h3>
                <p className="text-xs text-lime-750 font-medium mt-1">{t('qualityCheckSubtitle')}</p>
              </div>
              <div className="bg-white px-5 py-3 rounded-2xl border border-lime-200 shadow-sm text-center flex-shrink-0">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">{t('avgTotalCompliance')}</span>
                <span className="text-2xl font-black text-lime-600">
                  {Math.round(images.reduce((acc, img) => acc + (img.analysisResult?.complianceScore || 0), 0) / (images.filter(img => img.analysisResult?.complianceScore !== undefined).length || 1))}%
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mb-2 no-print animate-fade-in">
                <button onClick={() => exportQualityCheckToXLS(images, t)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-lime-600 text-white hover:bg-lime-700 shadow-md shadow-lime-150">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" /> {t('exportToXLS')}
                </button>
                <button onClick={() => exportToPDF(panelRef.current)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200">
                    <DocumentTextIcon className="w-3.5 h-3.5" /> {t('exportToPDF')}
                </button>
            </div>

            <div className="space-y-4">
              {images.filter(img => img.analysisType === 'qualityCheck').map((img) => {
                const score = img.analysisResult?.complianceScore ?? 0;
                const reason = img.analysisResult?.reason || 'Snímka plne vyhovuje požiadavkám referenčného manuálu a rozloženiu výrobkov.';
                const isLow = score < 80;
                
                const storeName = getImageStoreName(img, t('unknownStore'), null);

                const cardBgClass = isLow 
                  ? 'bg-red-50/40 border-red-200 hover:bg-red-50/60 shadow-red-50/10' 
                  : 'bg-white border-gray-150 hover:bg-gray-50 hover:border-gray-250';
                const scoreBadgeClass = isLow 
                  ? 'bg-red-600 text-white shadow-red-100/50' 
                  : 'bg-emerald-600 text-white shadow-emerald-100/50';

                return (
                  <div key={img.id} className={`p-6 rounded-[2rem] border-2 transition-all duration-200 flex flex-col md:flex-row gap-6 shadow-sm ${cardBgClass}`}>
                    {/* Left - Image preview */}
                    <div 
                      className="w-24 h-24 rounded-2xl overflow-hidden border border-gray-200 flex-shrink-0 bg-white cursor-zoom-in relative group shadow-sm"
                      onClick={() => setZoomedImage(img.imageUrl)}
                    >
                      <img src={img.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">🔍</div>
                    </div>

                    {/* Middle - Store Location and Audit Details */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl">🏪</span>
                          <h4 className="text-base font-black text-gray-900 truncate">{storeName}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl shadow-2xs border ${isLow ? 'bg-red-100 text-red-805 border-red-200' : 'bg-emerald-50 text-emerald-805 border-emerald-100'}`}>
                            {isLow ? `⚠️ ${t('statusNonCompliant')}` : `✅ ${t('statusCompliant')}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-450 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                          🗓️ {img.uploadDate?.toLocaleDateString()} {img.uploadDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Reasons block */}
                      <div className="bg-white/80 p-4 rounded-xl border border-gray-150/80 shadow-3xs text-xs font-bold text-gray-705 leading-relaxed">
                        <strong className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">{t('complianceReason')}</strong>
                        <TranslatedText text={reason} targetLanguage={language} />
                      </div>
                    </div>

                    {/* Right - Percentage score dial */}
                    <div className="flex flex-col items-center justify-center flex-shrink-0 self-center md:px-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-black shadow-md ${scoreBadgeClass}`}>
                        {score}%
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-2">{t('complianceRate')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {view === 'priceAnalysis' && (
          <div className="animate-fade-in">
            <FilterControls filters={filters} onFilterChange={setFilters} searchPlaceholder={t('searchProduct')} categories={allCategories} chains={allChains} />
            <div className="flex justify-end gap-3 mb-4 no-print">
                <button onClick={() => exportPriceMonitoringToXLS(storeData, t)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-lime-600 text-white hover:bg-lime-700 shadow-md shadow-lime-200">
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" /> {t('exportToXLS')}
                </button>
                <button onClick={() => exportToPDF(panelRef.current)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200">
                    <DocumentTextIcon className="w-3.5 h-3.5" /> {t('exportToPDF')}
                </button>
            </div>
            
            <PriceTrendReportBuilder 
              _images={images}
              storeData={storeData}
              onZoomImage={setZoomedImage}
              _filters={filters}
              onCorrectProduct={onCorrectProduct}
            />
          </div>
        )}
        {view === 'priceGap' && (
          <div className="animate-fade-in">
            <PriceGapAnalysisPanel 
              storeData={storeData}
              brandClassifications={brandClassifications}
              onOpenBrandDefinition={onOpenBrandDefinition}
            />
          </div>
        )}
        {view === 'shelfShare' && <ShelfSharePanel images={images} />}
        {view === 'promoAlert' && <PromoAlertPanel images={images} brandClassifications={brandClassifications} onOpenBrandDefinition={onOpenBrandDefinition} />}
        {view === 'rawData' && (
            <div className="bg-gray-900 text-lime-400 p-8 rounded-[2rem] overflow-x-auto font-mono text-sm max-h-[calc(100vh-320px)] custom-scrollbar border border-gray-800 shadow-2xl animate-fade-in">
                <pre>{JSON.stringify(images, null, 2)}</pre>
            </div>
        )}
      </div>

       <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4 no-print">
        <button
          onClick={onReset}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
        >
          <TrashIcon className="w-5 h-5" />
          {t('endVisit')}
        </button>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};