import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { BrandClassifications, StoreCentricSummary, Analysis, ProductInStore, PriceInfo, DetectedProduct } from '../types';
import type { ImageState } from '../hooks/useImageAnalysis';
import { getCategoryFromName, findBestMatch, removeDateFromStoreName, getImageStoreName } from '../utils/helpers';
import { 
  CloseIcon, 
  TrashIcon, 
  TagIcon, 
  BoxIcon,
  EditIcon,
  ChevronLeftIcon,
  SpinnerIcon,
  MagicWandIcon
} from './Icons';
import { FilterControls, Filters } from './FilterControls';
import { ShelfSharePanel } from './ShelfSharePanel';
import { PromoAlertPanel } from './PromoAlertPanel';
import { useTranslation } from '../i18n';
import { PriceTrendReportBuilder } from './PriceTrendReportBuilder';
import { PriceGapAnalysisPanel } from './PriceGapAnalysisPanel';
import { 
  ArrowLeftRight, 
  AlertTriangle,
  LayoutDashboard,
  TrendingUp,
  PieChart,
  CheckCircle2,
  Camera,
  FileDown,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { AuditExceptionTriagePanel } from './AuditExceptionTriagePanel';
import { AuditExportModal } from './AuditExportModal';
import { calculateAuditMetrics } from '../utils/auditMetrics';
import { generateShelfPreviewSvg } from '../utils/shelfPreview.ts';

export type { StoreCentricSummary };

const parsePrice = (priceValue: string): number | null => {
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

const getLocaleTag = (lang?: string): string => {
  switch (lang) {
    case 'sk': return 'sk-SK';
    case 'cs': return 'cs-CZ';
    case 'de': return 'de-DE';
    case 'hu': return 'hu-HU';
    case 'hr': return 'hr-HR';
    default: return 'en-US';
  }
};

export const ViewportStoreCardLegacy: React.FC<{
    store: StoreCentricSummary;
    setZoomedImage: (url: string | null) => void;
    onCorrectProduct?: (imageId: string, originalName: string, newName: string, prices: PriceInfo[], count: number) => void;
}> = ({ store, setZoomedImage, onCorrectProduct }) => {
    const { t } = useTranslation();
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
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm min-h-[90px] flex items-center justify-center text-gray-400 dark:text-zinc-500 font-sans"
            >
                <div className="flex items-center gap-2">
                    <span className="text-base animate-pulse">🏪</span>
                    <span className="text-xs font-bold tracking-wide text-gray-300">Načítavam {store.storeName}...</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={cardRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-150 dark:border-zinc-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gray-50/50 dark:bg-zinc-950/60 px-5 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                        <span className="text-sm">🏪</span>
                    </div>
                    {store.storeName}
                    {store.storeCode && <span className="bg-blue-50 text-blue-700 text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-blue-100">#{store.storeCode}</span>}
                </h3>
                <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-zinc-700 shadow-sm">
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
                            <div className="h-px bg-gray-100 dark:bg-zinc-800 flex-grow"></div>
                        </div>
                        
                        <div className="bg-gray-50/10 rounded-xl border border-gray-150 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
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
                                        <div key={`edit-${product.type}-${product.name}-${idx}`} className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 my-1 shadow-inner animate-fade-in">
                                            {/* Name */}
                                            <div className="flex flex-col">
                                                <label className="text-[9px] text-gray-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('productName')}</label>
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Price & Count inline */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-gray-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('regularPriceCol')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Napr. 1.25"
                                                        value={editingRegular}
                                                        onChange={(e) => setEditingRegular(e.target.value)}
                                                        className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-red-500 font-bold uppercase mb-0.5">{t('promoActionLabel')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Napr. 0.99"
                                                        value={editingPromo}
                                                        onChange={(e) => setEditingPromo(e.target.value)}
                                                        className="bg-white dark:bg-zinc-900 border text-xs font-bold rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[9px] text-gray-500 dark:text-zinc-400 font-bold uppercase mb-0.5">{t('countPcs')}</label>
                                                    <div className="flex items-center border rounded bg-white dark:bg-zinc-900 overflow-hidden h-7">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingCount(c => Math.max(0, c - 1))}
                                                            className="px-2 h-full bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-650 font-bold border-r text-xs"
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
                                                            className="px-2 h-full bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-655 font-bold border-l text-xs"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex justify-end gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingProductKey(null)}
                                                    className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded text-[9px] font-black uppercase text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
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
                                                className="w-8 h-8 rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900 group-hover:border-blue-400 transition-all cursor-zoom-in shadow-xs relative"
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
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500 font-bold">
                                                <span className="bg-gray-100/60 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-800">
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
                                                        <div className={`px-1.5 py-0.5 rounded text-xs font-bold border shadow-3xs transition-all ${promoPrice ? 'bg-gray-50 text-gray-450 line-through border-gray-150 font-normal text-[10px]' : 'bg-white dark:bg-zinc-900 text-gray-950 border-gray-200 dark:border-zinc-800'}`}>
                                                            {regularPrice}
                                                        </div>
                                                    ) : null}
                                                    {promoPrice ? (
                                                        <div className="px-1.5 py-0.5 rounded text-xs font-extrabold bg-red-50 text-red-650 border border-red-150 shadow-2xs animate-pulse">
                                                            {promoPrice}
                                                        </div>
                                                    ) : null}
                                                    {!regularPrice && !promoPrice && (
                                                        <span className="text-[9px] italic font-bold text-gray-400 dark:text-zinc-500 bg-gray-50/50 dark:bg-zinc-900/60 px-1.5 py-0.5 rounded border border-gray-150 dark:border-zinc-800 uppercase tracking-wider">
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
                                                    className="p-1 px-1.5 text-gray-400 dark:text-zinc-500 hover:text-lime-600 hover:bg-lime-50 rounded border border-transparent hover:border-lime-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95"
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
    initialSubTab?: 'summary' | 'products' | 'shelfShare' | 'availability' | 'promo' | 'photos' | 'priceAnalysis' | 'priceGap' | 'promoAlert' | 'rawData' | 'qualityCheck' | 'triage';
    onUpdateProductPrices?: (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => void;
    onRenameProduct?: (imageId: string, productId: string, origName: string, newName: string) => Promise<void>;
    onNavigateToImage?: (imageId: string, productName?: string, productId?: string) => void;
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
  onOpenBrandDefinition,
  initialSubTab,
  onUpdateProductPrices,
  onRenameProduct,
  onNavigateToImage,
}): React.ReactNode => {
  const { t, language = 'sk' } = useTranslation();

  const [view, setView] = useState<
    'summary' | 'products' | 'shelfShare' | 'availability' | 'promo' | 'photos' | 'priceAnalysis' | 'priceGap' | 'promoAlert' | 'rawData' | 'qualityCheck' | 'triage'
  >(() => {
    if (initialSubTab) return initialSubTab;
    if (initialView === 'shelfShare') return 'shelfShare';
    if (initialView === 'promoAlert') return 'promo';
    return 'summary';
  });

  const getSubSectionLabel = () => {
    switch (view) {
      case 'summary': return t('tabSummary') || 'Súhrn auditu';
      case 'products':
      case 'priceAnalysis': return t('tabProducts') || 'Produkty a ceny';
      case 'shelfShare': return t('tabShelfShare') || 'Podiel na regáli';
      case 'availability':
      case 'qualityCheck': return t('tabAvailability') || 'Dostupnosť (OSA)';
      case 'promo':
      case 'promoAlert':
      case 'priceGap': return t('tabPromo') || 'Promo a akcie';
      case 'photos': return t('tabPhotos') || 'Fotografie';
      case 'triage': return t('stepVerification') || 'Kontrola';
      case 'rawData': return t('subSectionRawData');
      default: return t('tabSummary') || 'Súhrn auditu';
    }
  };

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isAuditExportModalOpen, setIsAuditExportModalOpen] = useState(false);

  const getSafeBatchPhotoUrl = useCallback((img: ImageState): string => {
    if (!img) return '';
    if (img.file instanceof Blob && img.file.size > 0) {
      try {
        return URL.createObjectURL(img.file);
      } catch { /* ignore */ }
    }
    if (img.imageUrl && typeof img.imageUrl === 'string' && !img.imageUrl.startsWith('blob:') && img.imageUrl.trim() !== '') {
      return img.imageUrl;
    }
    const b64 = img.compressedBase64 || (img.file as any)?.data || (img as any)?.base64;
    if (b64 && typeof b64 === 'string' && !b64.startsWith('blob:') && b64.length > 50) {
      if (b64.startsWith('data:') || b64.startsWith('http')) return b64;
      const mime = img.file?.type || 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    }
    if (img.imageUrl && typeof img.imageUrl === 'string' && img.imageUrl.trim() !== '') {
      return img.imageUrl;
    }
    return generateShelfPreviewSvg(img);
  }, []);

  const handleBatchPhotoError = useCallback((currentTarget: HTMLImageElement, img: ImageState) => {
    const b64 = img.compressedBase64 || (img.file as any)?.data || (img as any)?.base64;
    if (b64 && typeof b64 === 'string' && !b64.startsWith('blob:') && !currentTarget.src.startsWith('data:image/svg+xml') && !currentTarget.src.startsWith('data:image/jpeg')) {
      const mime = img.file?.type || 'image/jpeg';
      currentTarget.src = b64.startsWith('data:') ? b64 : `data:${mime};base64,${b64}`;
      return;
    }
    const fallbackSvg = generateShelfPreviewSvg(img);
    if (currentTarget.src !== fallbackSvg) {
      currentTarget.src = fallbackSvg;
    }
  }, []);

  useEffect(() => {
    if (initialSubTab) {
      setView(initialSubTab);
      return;
    }
    if (initialView === 'shelfShare') setView('shelfShare');
    else if (initialView === 'promoAlert') setView('promo');
    else if (initialView === 'priceMonitoring') setView('products');
  }, [initialView, initialSubTab]);

  const isShelfShare = activeAnalysis?.analysisType === 'shelfShare' || initialView === 'shelfShare' || view === 'shelfShare';
  const [requirePricesInShelfShare, setRequirePricesInShelfShare] = useState<boolean>(() => {
    try {
      return localStorage.getItem('salesapp_sos_require_prices') === 'true';
    } catch {
      return false;
    }
  });

  const toggleRequirePricesInShelfShare = useCallback(() => {
    setRequirePricesInShelfShare(prev => {
      const next = !prev;
      try {
        localStorage.setItem('salesapp_sos_require_prices', String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const exceptionCount = useMemo(() => {
    let count = 0;
    images.forEach(img => {
      const isImgSos = isShelfShare || img.analysisType === 'shelfShare';
      (img.analysisResult?.products || []).forEach(p => {
        if (p.type === 'pos_material' || p.isGhost || p.isDiscarded) return;

        // Pre modul Shelf Share (SOS) je vyžadovanie cien predvolene vypnuté
        if (!isImgSos || requirePricesInShelfShare) {
          const hasDirectPrice = (typeof p.regularPrice === 'number' && p.regularPrice > 0) ||
                                 (typeof p.promoPrice === 'number' && p.promoPrice > 0);
          if ((!p.prices || p.prices.length === 0) && !hasDirectPrice) {
            count++;
            return;
          }
          const reg = typeof p.regularPrice === 'number' && p.regularPrice > 0 
            ? p.regularPrice 
            : parsePrice(p.prices?.find(pr => pr.type === 'REGULAR')?.value || '');
          const promo = typeof p.promoPrice === 'number' && p.promoPrice > 0 
            ? p.promoPrice 
            : parsePrice(p.prices?.find(pr => pr.type === 'PROMO')?.value || '');
          if (reg !== null && promo !== null && promo > reg) {
            count++;
            return;
          }
        }

        if ((p.confidence || 0.85) < 0.70) {
          count++;
          return;
        }
      });
    });
    return count;
  }, [images, isShelfShare, requirePricesInShelfShare]);

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

  // Common calculation layer: guarantees identical numbers across views & exports
  const auditMetrics = useMemo(() => {
    return calculateAuditMetrics(images, activeAnalysis, {
      category: filters.category,
      searchQuery: filters.searchTerm,
      includeGhosts: !filters.hideGhosts,
      includePos: filters.posFilter !== 'products_only',
    }, brandClassifications);
  }, [images, activeAnalysis, filters, brandClassifications]);

  const missingPriceCount = useMemo(() => {
      // Ak ide o modul Shelf Share a ceny nie sú vyžadované, nevznikajú žiadne chýbajúce ceny
      if (isShelfShare && !requirePricesInShelfShare) return 0;

      return images.reduce((count, img) => {
          if (!img.analysisResult?.products) return count;
          if (img.analysisType === 'shelfShare' && !requirePricesInShelfShare) return count;
          // Pre výpočet chýbajúcich cien berieme len reálne produkty bez POS a duchov
          const missingInImage = img.analysisResult.products.filter(p => {
              if (p.type === 'pos_material' || p.isGhost || p.isDiscarded) return false;
              const hasPrices = (p.prices || []).some(pr => parsePrice(pr.value) !== null);
              const hasDirectPrice = (typeof p.regularPrice === 'number' && p.regularPrice > 0) || 
                                     (typeof p.promoPrice === 'number' && p.promoPrice > 0);
              return !hasPrices && !hasDirectPrice;
          }).length;
          return count + missingInImage;
      }, 0);
  }, [images, isShelfShare, requirePricesInShelfShare]);

  const { storeData, allCategories, allChains } = useMemo(() => {
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
                if (p && p.name && !p.isDiscarded) {
                    storeGroup.items.push({ ...p, uploadDate: img.uploadDate, imageUrl: img.imageUrl, imageId: img.id });
                }
            });
        }
    });

    const finalData: StoreCentricSummary[] = Array.from(productsByStore.entries())
        .map(([key, data]): StoreCentricSummary => {
            const productsMap = new Map<string, (DetectedProduct & { uploadDate: Date; imageUrl: string; imageId: string })[]>();

            data.items.forEach(p => {
                if (p.isDiscarded) return;
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
                        imageOccurrences.forEach(o => {
                          const hasDirectReg = typeof o.regularPrice === 'number' && o.regularPrice > 0;
                          const hasDirectPromo = typeof o.promoPrice === 'number' && o.promoPrice > 0;
                          const hasDirectClub = typeof o.clubPrice === 'number' && o.clubPrice > 0;

                          if (hasDirectReg) {
                            uniquePricesOnImage.set(`${o.regularPrice!.toFixed(2)} €|REGULAR`, { value: `${o.regularPrice!.toFixed(2)} €`, type: 'REGULAR' });
                          }
                          if (hasDirectPromo) {
                            uniquePricesOnImage.set(`${o.promoPrice!.toFixed(2)} €|PROMO`, { value: `${o.promoPrice!.toFixed(2)} €`, type: 'PROMO' });
                          }
                          if (hasDirectClub) {
                            uniquePricesOnImage.set(`${o.clubPrice!.toFixed(2)} €|CLUB`, { value: `${o.clubPrice!.toFixed(2)} €`, type: 'CLUB' });
                          }

                          (o.prices || []).forEach(price => {
                            if (price && price.value) {
                              const pType = (price.type || 'REGULAR').toUpperCase();
                              if (pType === 'REGULAR' && hasDirectReg) return;
                              if ((pType === 'PROMO' || pType === 'AKCIA') && hasDirectPromo) return;
                              if ((pType === 'CLUB' || pType === 'KLUB') && hasDirectClub) return;
                              uniquePricesOnImage.set(`${price.value}|${pType}`, price);
                            }
                          });
                        });
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
      allCategories: Array.from(new Set(finalData.flatMap(s => s.products.map(p => p.category)))).sort(),
      allChains: Array.from(new Set(finalData.map(s => s.storeName))).sort()
    };
  }, [images, filters, t, unassignedCategory]);
  
  return (
    <div ref={panelRef} className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 h-full flex flex-col printable-content text-zinc-900 dark:text-zinc-100">
      {zoomedImage && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setZoomedImage(null)}>
            <img src={zoomedImage} className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl animate-fade-in-up" alt="Zoom" />
            <button className="absolute top-8 right-8 text-white bg-black/40 p-4 rounded-full hover:bg-black/60 transition-colors backdrop-blur-md"><CloseIcon className="w-6 h-6" /></button>
        </div>
      )}

      {/* 🚀 AKTÍVNA NOTIFIKÁCIA O PREBIEHAJÚCEJ ANALÝZE */}
      {images.some(img => img.status === 'analyzing' || img.status === 'pending') && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl shadow-md border border-blue-500/40 flex items-center justify-between gap-4 animate-fade-in no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-cyan-400/40 relative">
              <SpinnerIcon className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></span>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
                {t('asyncProcessingInProgress') || 'Asynchronous processing of additional images in progress'}
              </p>
              <p className="text-[11px] text-slate-300">
                {t('asyncProcessingDesc') || 'Displayed data updates continuously in real time with each newly processed photo.'}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs font-black text-white px-2.5 py-1 bg-blue-800/80 rounded-lg border border-blue-400/30">
              {t('inProcessingCount', { count: images.filter(i => i.status === 'analyzing' || i.status === 'pending').length }) || `${images.filter(i => i.status === 'analyzing' || i.status === 'pending').length} in progress`}
            </span>
          </div>
        </div>
      )}

      {/* 🔮 KOMPAKTNÝ DASHBOARD HEADER PRE PODROBNOSTI ANALÝZY */}
      <div className="mb-3 pb-3 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2.5 select-none">
        {/* Názov analýzy, inline metadáta a hlavné akcie */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight leading-tight truncate max-w-[280px] sm:max-w-md md:max-w-lg">
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
                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors border border-transparent no-print cursor-pointer"
                  title={t('renameAnalysisTooltip')}
                >
                  <EditIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {/* Ultra-sleek inline metadata row with typographic separators */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-none select-text">
              <span className="text-zinc-900 dark:text-zinc-200 font-semibold">
                {getSubSectionLabel()}
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="truncate max-w-[150px] sm:max-w-[280px]" title={activeAnalysis?.store ? `${activeAnalysis.store.name}, ${activeAnalysis.store.city || ''}` : undefined}>
                {activeAnalysis?.store ? `${activeAnalysis.store.name}, ${activeAnalysis.store.city || ''}` : t('detectedFromImages')}
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="tabular-nums">
                {activeAnalysis?.createdAt 
                  ? `${new Date(activeAnalysis.createdAt).toLocaleDateString(getLocaleTag(language))} ${language === 'sk' ? 'o' : language === 'cs' ? 'v' : language === 'de' ? 'um' : '@'} ${new Date(activeAnalysis.createdAt).toLocaleTimeString(getLocaleTag(language), { hour: '2-digit', minute: '2-digit' })}` 
                  : new Date().toLocaleDateString(getLocaleTag(language))}
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                {activeAnalysis?.costInfo 
                  ? `${activeAnalysis.costInfo.cost.toFixed(4)} € (${activeAnalysis.costInfo.modelName || 'Gemini Flash'})` 
                  : `Gemini Flash`}
              </span>
            </div>
          </div>

          {/* Ovládacie prvky na jednom riadku */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 no-print">
            {exceptionCount > 0 && (
              <button
                onClick={() => setView('triage')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all shadow-sm shadow-amber-200 animate-pulse active:scale-95"
                title={t('viewExceptionsForReview') || "View exceptions requiring review"}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{exceptionCount} {t('exceptions') || 'exceptions'}</span>
              </button>
            )}

            {isShelfShare && (
              <button
                type="button"
                onClick={toggleRequirePricesInShelfShare}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  requirePricesInShelfShare
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title={t('pricesForSosTooltip') || "Prices are optional for Shelf Share audits. Click to toggle price requirement."}
              >
                <span>{t('pricesForSos') || 'Prices for SOS:'}</span>
                <span className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded ${
                  requirePricesInShelfShare 
                    ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100' 
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {requirePricesInShelfShare ? (t('required') || 'Required') : (t('disabled') || 'Disabled')}
                </span>
              </button>
            )}

            {missingPriceCount > 0 && (
                <button 
                  onClick={onOpenMissingPrices} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg border border-orange-300 dark:border-orange-800 transition-all font-extrabold text-xs uppercase tracking-wider active:scale-95 shadow-3xs"
                  title={t('fillMissingPricesTitle') || "Fill missing prices for detected products"}
                >
                    <TagIcon className="w-3.5 h-3.5 text-orange-500" />
                    <span>{t('fixMissingPrices', { count: missingPriceCount }) || `Fill missing prices (${missingPriceCount})`}</span>
                </button>
            )}
            
            {onViewChange && (
              <button
                onClick={() => onViewChange('competitorComparison' as any)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all border border-indigo-200 active:scale-95 shadow-3xs"
                title={t('directCompetitorPriceComparison') || "Direct price comparison with competitors"}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('competitorComparison') || 'Competitor Comparison'}</span>
              </button>
            )}

            {/* Single Unified Export Action with format & scope */}
            <button
              onClick={() => setIsAuditExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all shadow-3xs cursor-pointer active:scale-95"
              title={t('exportAuditResultsTitle') || "Export audit results (PDF, Excel, CSV) with active filters and verification status"}
            >
              <FileDown className="w-3.5 h-3.5 text-lime-400" />
              <span>{t('export') || 'Export'}</span>
            </button>

            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all border border-gray-200 dark:border-zinc-700 active:scale-95 shadow-3xs"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span>{activeAnalysis ? (t('backToArchive') || 'Back to Archive') : (t('endAndSave') || 'End & Save')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Highly integrated and compact Tabs & Stats Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-2 mb-3 gap-2 no-print select-none">
          {/* Tabs on Left (Súhrn, Produkty a ceny, Podiel na regáli, Dostupnosť, Promo, Fotografie) */}
          <div className="flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 rounded-lg overflow-x-auto custom-scrollbar">
              {[
                  { id: 'summary', label: t('tabSummary') || 'Summary', icon: LayoutDashboard },
                  { id: 'products', label: t('tabProducts') || 'Products & Prices', icon: TrendingUp },
                  { id: 'shelfShare', label: t('tabShelfShare') || 'Share of Shelf', icon: PieChart },
                  { id: 'availability', label: t('tabAvailability') || 'Availability (OSA)', icon: CheckCircle2 },
                  { id: 'promo', label: t('tabPromo') || 'Promo & Discounts', icon: TagIcon },
                  { id: 'photos', label: t('tabPhotos') || 'Photos', icon: Camera, badge: images.length },
              ].map(tab => {
                const isActive = view === tab.id || 
                  (tab.id === 'products' && view === 'priceAnalysis') ||
                  (tab.id === 'availability' && view === 'qualityCheck') ||
                  (tab.id === 'promo' && (view === 'promoAlert' || view === 'priceGap'));
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setView(tab.id as any);
                      if (onViewChange) {
                        if (tab.id === 'products') onViewChange('priceMonitoring');
                        else if (tab.id === 'shelfShare') onViewChange('shelfShare');
                        else if (tab.id === 'promo') onViewChange('promoAlert');
                      }
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-950 text-white dark:border dark:border-zinc-750 shadow-2xs font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-lime-400' : 'text-zinc-400'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded font-bold ${
                        isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Clean Unboxed Stats Strip on Right with Typographic Separators */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium tabular-nums flex-wrap">
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{auditMetrics.totalImages}</strong> {t('imagesCountShort') || 'snímok'}
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{auditMetrics.totalFacings}</strong> {t('facingsCountShort') || 'facingov'}
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{auditMetrics.posCount}</strong> POS
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{auditMetrics.uniqueSkusCount}</strong> SKU
              </span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span className="text-emerald-700 font-bold">
                {auditMetrics.priceCoveragePercent}% {t('priceCoverage') || 'pokrytie cien'}
              </span>
          </div>
      </div>

      <div className="flex-grow">
        {/* 1. SÚHRN (Summary tab) */}
        {view === 'summary' && (
          <div className="animate-fade-in space-y-6">
            {/* 4 Bento KPI Cards with shared calculation engine */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Facingy a viditeľné kusy */}
              <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('shelfFacings') || 'Shelf Facings'}</span>
                    <TrendingUp className="w-4 h-4 text-zinc-400" />
                  </div>
                  <p className="text-3xl font-black text-zinc-950 dark:text-zinc-100 tabular-nums">
                    {auditMetrics.totalFacings} <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t('pcs') || 'pcs'}</span>
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                  <p>{t('visiblePacks') || 'Visible packs:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.totalVisiblePacks} {t('pcs') || 'pcs'}</strong></p>
                  <p>{t('depthStock') || 'Depth stock:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.totalEstimatedStock !== null ? `${auditMetrics.totalEstimatedStock} ${t('pcs') || 'pcs'}` : (t('notMeasuredFrontOnly') || 'Not measured (front only)')}</strong></p>
                  <p>{t('uniqueSkus') || 'Unique SKUs:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.uniqueSkusCount}</strong></p>
                </div>
              </div>

              {/* Card 2: Pokrytie cien */}
              <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('priceCoverage') || 'Price Coverage'}</span>
                    <TagIcon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-3xl font-black text-emerald-950 tabular-nums">
                    {auditMetrics.priceCoveragePercent}%
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                  <p>{t('priceTagFound') || 'Price tag found:'} <strong className="text-emerald-700">{auditMetrics.withPriceCount} {t('pcs') || 'pcs'}</strong></p>
                  <p>{t('missingPriceTag') || 'Missing price tag:'} <strong className={auditMetrics.missingPriceCount > 0 ? "text-amber-700 font-bold" : "text-zinc-800 dark:text-zinc-200"}>{auditMetrics.missingPriceCount} {t('pcs') || 'pcs'} {t('unknownValue') || '(unknown value)'}</strong></p>
                  <p>{t('avgRegularPrice') || 'Average regular:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.avgRegularPrice ? `${auditMetrics.avgRegularPrice.toFixed(2)} €` : '—'}</strong></p>
                </div>
              </div>

              {/* Card 3: Stav overenia dát */}
              <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('resultsVerification') || 'Verification Status'}</span>
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-3xl font-black text-zinc-950 dark:text-zinc-100 tabular-nums">
                    {auditMetrics.verificationProgressPercent}%
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                  <p>{t('humanVerified') || 'Human verified:'} <strong className="text-emerald-700">{auditMetrics.verifiedCount} {t('pcs') || 'pcs'}</strong></p>
                  <p>{t('autoAccepted') || 'Auto-accepted:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.autoAcceptedCount} {t('pcs') || 'pcs'}</strong></p>
                  <p>{t('pendingReview') || 'Pending review:'} <strong className={auditMetrics.pendingReviewCount > 0 ? "text-amber-700 font-bold" : "text-zinc-800 dark:text-zinc-200"}>{auditMetrics.pendingReviewCount} {t('pcs') || 'pcs'}</strong></p>
                </div>
              </div>

              {/* Card 4: Rozsah regálu & geometria */}
              <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-3xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('shelfScopeGeometry') || 'Scope & Geometry'}</span>
                    <PieChart className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-xl font-black text-zinc-950 dark:text-zinc-100 truncate mt-1">
                    {auditMetrics.isAreaEvaluatable ? (t('areaShareAvailable') || 'Area share available') : (t('cannotEvaluate') || 'Cannot evaluate')}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                  <p>{auditMetrics.areaEvaluationNote}</p>
                  <p>{t('posMaterials') || 'POS materials:'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.posCount} {t('pcs') || 'pcs'}</strong> {t('separatedFromFacings') || '(separated from facings)'}</p>
                  <p>{t('unverifiedGhost') || 'Unverified AI (ghost):'} <strong className="text-zinc-800 dark:text-zinc-200">{auditMetrics.ghostsCount} {t('pcs') || 'pcs'}</strong></p>
                </div>
              </div>
            </div>

            {/* Exception Warning Banner if items need review */}
            {(exceptionCount > 0 || auditMetrics.pendingReviewCount > 0) && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                      {t('detectedItemsRequiringReview', { count: exceptionCount || auditMetrics.pendingReviewCount }) || `Detected items requiring review (${exceptionCount || auditMetrics.pendingReviewCount} items)`}
                    </h4>
                    <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-medium">
                      {t('exceptionsDescription') || 'Missing prices, uncertain price tag assignment, or deviation from recommended RRP.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onViewChange) {
                      onViewChange('verificationQueue' as any);
                    } else {
                      setView('triage');
                    }
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  {t('verifyExceptionsOnPhoto') || 'Verify exceptions on photo →'}
                </button>
              </div>
            )}

            {/* Category breakdown table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-3xs">
              <div className="px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-950/60 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    {t('categoryShelfShares') || 'Podiely kategórií na regáli (Facing Share & Plošný podiel)'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    {t('denominatorDesc', { count: auditMetrics.totalFacings }) || `Menovateľ: ${auditMetrics.totalFacings} ks facingov (vrátane nezaradených položiek, žiadna položka nevypadáva)`}
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                  {auditMetrics.categoryShares.length} {t('categoriesCountShort') || 'kategórií'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-150 dark:border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 bg-zinc-50/40">
                      <th className="py-2.5 px-4">{t('category') || 'Kategória'}</th>
                      <th className="py-2.5 px-4 text-right">{t('facings') || 'Facingy'}</th>
                      <th className="py-2.5 px-4 text-right">{t('facingShare') || 'Podiel facingov'}</th>
                      <th className="py-2.5 px-4 text-right">{t('areaShare') || 'Plošný podiel'}</th>
                      <th className="py-2.5 px-4 text-right">{t('uniqueSkus') || 'Unikátne SKU'}</th>
                      <th className="py-2.5 px-4">{t('methodAndDenominator') || 'Metóda a menovateľ'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium">
                    {auditMetrics.categoryShares.map((cat) => (
                      <tr key={cat.key} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          <span>{cat.label}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {cat.facings} {t('pcs') || 'pcs'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {cat.facingSharePercent.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                          {cat.areaSharePercent !== null ? `${cat.areaSharePercent.toFixed(1)}%` : (
                            <span className="text-zinc-400 italic">{t('cannotEvaluate') || 'Cannot evaluate'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {cat.uniqueSkus}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {t('baseCountDenominator', { count: cat.facingDenominator }) || `Base ${cat.facingDenominator} pcs · 100% denominator`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active filters transparency note */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
              <div>
                <strong>{t('activeDataScope')}</strong>{' '}
                {filters.searchTerm || filters.category || filters.chain ? (
                  <span>
                    {t('filteredScope')} ({filters.searchTerm ? `${t('search') || 'Search'}: "${filters.searchTerm}", ` : ''}
                    {filters.category ? `${t('category') || 'Category'}: ${filters.category}, ` : ''}
                    {filters.chain ? `${t('store') || 'Store'}: ${filters.chain}` : ''})
                  </span>
                ) : (
                  <span>{t('completeAuditWithoutFilters')}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setView('products')}
                className="text-blue-600 font-bold hover:underline shrink-0 ml-2"
              >
                {t('adjustFiltersInTable')}
              </button>
            </div>
          </div>
        )}

        {/* 2. PRODUKTY A CENY (Products tab) */}
        {(view === 'products' || view === 'priceAnalysis') && (
          <div className="animate-fade-in">
            <FilterControls filters={filters} onFilterChange={setFilters} searchPlaceholder={t('searchProduct')} categories={allCategories} chains={allChains} />
            <PriceTrendReportBuilder 
              _images={images}
              storeData={storeData}
              onZoomImage={setZoomedImage}
              _filters={filters}
              onCorrectProduct={onCorrectProduct}
            />
          </div>
        )}

        {/* 3. PODIEL NA REGÁLI (Shelf Share tab) */}
        {view === 'shelfShare' && (
          <ShelfSharePanel 
            images={images} 
            onUpdateProductPrices={onUpdateProductPrices} 
            brandClassifications={brandClassifications}
          />
        )}

        {/* 4. DOSTUPNOSŤ & OSA (Availability tab) */}
        {(view === 'availability' || view === 'qualityCheck') && (
          <div className="animate-fade-in space-y-6">
            <div className="p-6 bg-gradient-to-r from-lime-500/10 to-emerald-500/10 rounded-3xl border border-lime-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="text-base font-black text-lime-900 uppercase tracking-wide">
                  {t('productAvailabilityOsa') || 'Product Availability & Planogram Compliance (OSA)'}
                </h3>
                <p className="text-xs text-lime-750 font-medium mt-1">
                  {t('availabilityTabDesc') || 'Check presence of key items, missing facings, and stock-outs.'}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-900 px-5 py-3 rounded-2xl border border-lime-200 shadow-sm text-center flex-shrink-0">
                <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest block">{t('averageCompliance') || 'Average Compliance'}</span>
                <span className="text-2xl font-black text-lime-600">
                  {Math.round(images.reduce((acc, img) => acc + (img.analysisResult?.complianceScore || 0), 0) / (images.filter(img => img.analysisResult?.complianceScore !== undefined).length || 1))}%
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {images.map((img) => {
                const score = img.analysisResult?.complianceScore ?? 88;
                const reason = img.analysisResult?.reason || t('defaultComplianceReason') || 'Shelf meets standard requirements, items arranged facing front.';
                const isLow = score < 80;
                const storeName = getImageStoreName(img, t('unknownStore'), null);

                return (
                  <div key={img.id} className="p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row gap-6 shadow-xs">
                    <div 
                      className="w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900 cursor-zoom-in relative group"
                      onClick={() => setZoomedImage(getSafeBatchPhotoUrl(img))}
                    >
                      <img 
                        src={getSafeBatchPhotoUrl(img)} 
                        alt={img.file?.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        onError={(e) => handleBatchPhotoError(e.currentTarget, img)}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">🔍</div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">🏪</span>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{storeName}</h4>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${isLow ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                          {isLow ? (t('deviationsDetected') || '⚠️ Deviations detected') : (t('compliantStatus') || '✅ Compliant status')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                        {reason}
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center flex-shrink-0 self-center md:px-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-black shadow-xs ${isLow ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                        {score}%
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-1">{t('osaCompliance') || 'OSA Compliance'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. PROMO (Promotions and Price Gap tab) */}
        {(view === 'promo' || view === 'promoAlert' || view === 'priceGap') && (
          <div className="space-y-6">
            <PromoAlertPanel images={images} brandClassifications={brandClassifications} onOpenBrandDefinition={onOpenBrandDefinition} />
            <PriceGapAnalysisPanel 
              storeData={storeData}
              brandClassifications={brandClassifications}
              onOpenBrandDefinition={onOpenBrandDefinition}
            />
          </div>
        )}

        {/* 6. FOTOGRAFIE (Shelf Photos gallery tab) */}
        {view === 'photos' && (
          <div className="animate-fade-in space-y-5">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  {t('auditPhotoDoc', { count: images.length }) || `Audit Photo Documentation (${images.length} photos)`}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                  {t('clickPhotoToVerifyDesc') || 'Click on a photo to open the interactive verification center with product and price tag bounding boxes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onViewChange) onViewChange('verificationQueue' as any);
                }}
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                {t('openVerificationOnPhoto') || 'Open verification on photo →'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {images.map((img, idx) => {
                const facingsOnImg = img.analysisResult?.products?.length || 0;
                const storeName = getImageStoreName(img, t('unknownStore'), activeAnalysis?.store?.name || null);
                const dateStr = img.uploadDate ? new Date(img.uploadDate).toLocaleDateString(getLocaleTag(language)) : (t('today') || 'Today');
                const isAnalyzing = img.status === 'analyzing';

                return (
                  <div
                    key={img.id}
                    className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between group"
                  >
                    <div 
                      className="aspect-4/3 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative cursor-pointer"
                      onClick={() => {
                        if (onNavigateToImage) onNavigateToImage(img.id);
                      }}
                    >
                      <img 
                        src={getSafeBatchPhotoUrl(img)} 
                        alt={img.file?.name} 
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200" 
                        onError={(e) => handleBatchPhotoError(e.currentTarget, img)}
                      />
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded">
                        #{idx + 1}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-lime-400 text-[10px] font-bold px-2 py-0.5 rounded">
                        {facingsOnImg} {t('facingsCountShort') || 'facings'}
                      </div>
                    </div>

                    <div className="pt-3 space-y-1">
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate" title={img.file?.name}>
                        {img.file?.name || `${t('photo') || 'Photo'} #${idx + 1}`}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={storeName}>
                        {storeName} · {dateStr}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isAnalyzing ? 'bg-sky-100 text-sky-800' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isAnalyzing ? (t('processing') || 'Processing...') : (t('processed') || 'Processed ✓')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToImage) onNavigateToImage(img.id);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('inspect') || 'Inspect'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. TRIAGE / VÝNIMKY */}
        {view === 'triage' && (
          <AuditExceptionTriagePanel
            images={images}
            brandClassifications={brandClassifications}
            onUpdateProductPrices={onUpdateProductPrices || (() => {})}
            onRenameProduct={onRenameProduct}
            onNavigateToImage={onNavigateToImage}
            onOpenMissingPricesModal={onOpenMissingPrices}
            onOpenPdfReport={() => setIsAuditExportModalOpen(true)}
            isShelfShare={isShelfShare}
          />
        )}

        {/* 8. TECHNICKÉ RAW DATA */}
        {view === 'rawData' && (
          <div className="bg-zinc-900 text-lime-400 p-6 rounded-2xl overflow-x-auto font-mono text-xs max-h-[calc(100vh-320px)] custom-scrollbar border border-zinc-800 shadow-2xl animate-fade-in">
            <pre>{JSON.stringify(images, null, 2)}</pre>
          </div>
        )}
      </div>

       <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-4 no-print">
        <button
          onClick={onReset}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 uppercase tracking-widest text-sm cursor-pointer"
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

      <AuditExportModal
        isOpen={isAuditExportModalOpen}
        onClose={() => setIsAuditExportModalOpen(false)}
        images={images}
        activeAnalysis={activeAnalysis}
        brandClassifications={brandClassifications}
        activeFilters={{
          searchTerm: filters.searchTerm,
          category: filters.category,
          chain: filters.chain,
          confidence: filters.confidence,
          hideGhosts: filters.hideGhosts,
          posFilter: filters.posFilter,
        }}
      />
    </div>
  );
};