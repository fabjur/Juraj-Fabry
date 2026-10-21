import React, { useState, useMemo } from 'react';
import type { PriceInfo, DetectedProduct, BrandClassifications } from '../types';
import type { ImageState } from '../hooks/useImageAnalysis';
import { parsePrice } from '../utils/priceIntegrity';
import { useTranslation } from '../i18n/index.tsx';
import {
  AlertTriangle,
  CheckCircle2,
  Tag,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Save,
  Check,
  Building2,
  Search,
  ShieldCheck,
  FileText
} from 'lucide-react';

export type ExceptionCategory = 'all' | 'missing_price' | 'price_anomaly' | 'low_confidence' | 'competitor_promo';

export interface AuditExceptionItem {
  id: string; // `${imageId}-${productId}`
  imageId: string;
  productId: string;
  imageName: string;
  imageUrl: string;
  storeName: string;
  product: DetectedProduct;
  category: 'missing_price' | 'price_anomaly' | 'low_confidence' | 'competitor_promo';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  regularPrice: number | null;
  promoPrice: number | null;
  confidencePercent: number;
  isCompetitor: boolean;
  suggestedFix?: string;
}

export interface AuditExceptionTriagePanelProps {
  images: ImageState[];
  brandClassifications?: BrandClassifications;
  onUpdateProductPrices: (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => void;
  onRenameProduct?: (imageId: string, productId: string, origName: string, newName: string) => Promise<void>;
  onNavigateToImage?: (imageId: string, productName?: string, productId?: string) => void;
  onOpenMissingPricesModal?: () => void;
  onOpenPdfReport?: () => void;
  isShelfShare?: boolean;
}

export const AuditExceptionTriagePanel: React.FC<AuditExceptionTriagePanelProps> = ({
  images,
  brandClassifications,
  onUpdateProductPrices,
  onRenameProduct,
  onNavigateToImage,
  onOpenMissingPricesModal,
  onOpenPdfReport,
  isShelfShare = false,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ExceptionCategory>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  
  // Local inline edit state: key = itemId -> { reg: string, promo: string, name: string }
  const [inlineEdits, setInlineEdits] = useState<Record<string, { reg: string; promo: string; name: string }>>({});
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  const compBrandsSet = useMemo(() => {
    return new Set((brandClassifications?.competitorBrands || []).map(b => b.toLowerCase()));
  }, [brandClassifications]);

  // Extract all exceptions across all images
  const exceptions: AuditExceptionItem[] = useMemo(() => {
    const list: AuditExceptionItem[] = [];

    images.forEach(img => {
      if (!img.analysisResult?.products) return;
      const sName = img.assignedStore?.name || img.analysisResult.storeInfo?.chain || t('stores') || 'Store';

      img.analysisResult.products.forEach(p => {
        if (!p || p.type === 'pos_material' || p.isGhost || p.isDiscarded) return; // ignore POS materials, ghosts and discarded in price triage

        const pName = p.name || 'Neznámy produkt';
        const brand = (p.brand || '').toLowerCase();
        const isComp = compBrandsSet.has(brand);

        let regVal: number | null = typeof p.regularPrice === 'number' && p.regularPrice > 0 ? p.regularPrice : null;
        let promoVal: number | null = typeof p.promoPrice === 'number' && p.promoPrice > 0 ? p.promoPrice : null;
        let hasRawAnomalies = false;

        (p.prices || []).forEach(price => {
          const parsed = parsePrice(price.value);
          if (price.type === 'PROMO') {
            if (promoVal === null) promoVal = parsed;
          } else {
            if (regVal === null) regVal = parsed;
          }
          if (price.isAnomalous || (price.integrityFlags && price.integrityFlags.length > 0)) {
            hasRawAnomalies = true;
          }
        });

        const conf = Math.round((p.confidence || 0.85) * 100);
        const itemKey = `${img.id}-${p.id}`;
        const isImgSos = isShelfShare || img.analysisType === 'shelfShare';
        const requirePricesInSos = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;

        // 1. Missing Price Exception (Only for pricing modules or when explicitly requested in SOS)
        if ((!isImgSos || requirePricesInSos) && regVal === null && promoVal === null) {
          list.push({
            id: itemKey,
            imageId: img.id,
            productId: p.id,
            imageName: img.file.name,
            imageUrl: img.imageUrl,
            storeName: sName,
            product: p,
            category: 'missing_price',
            severity: 'high',
            title: t('missingPriceTagTitle') || 'Missing Price Tag',
            description: t('missingPriceTagDesc') || 'Product was detected on shelf, but AI did not identify an assigned price tag.',
            regularPrice: null,
            promoPrice: null,
            confidencePercent: conf,
            isCompetitor: isComp,
            suggestedFix: t('missingPriceTagFix') || 'Add regular or sale price from shelf.',
          });
          return;
        }

        // 2. Price Anomalies (Only when prices are present/relevant)
        if ((!isImgSos || requirePricesInSos) && regVal !== null && promoVal !== null && promoVal > regVal) {
          list.push({
            id: itemKey,
            imageId: img.id,
            productId: p.id,
            imageName: img.file.name,
            imageUrl: img.imageUrl,
            storeName: sName,
            product: p,
            category: 'price_anomaly',
            severity: 'high',
            title: t('invertedPromoTitle') || 'Inverted Promo (Promo > Regular)',
            description: t('invertedPromoDesc', { promo: promoVal.toFixed(2), reg: regVal.toFixed(2) }) || `Akciová cena (${promoVal.toFixed(2)} €) je vyššia ako bežná cena (${regVal.toFixed(2)} €).`,
            regularPrice: regVal,
            promoPrice: promoVal,
            confidencePercent: conf,
            isCompetitor: isComp,
            suggestedFix: t('invertedPromoFix') || 'Swap regular and promo price so discount percentage is logical.',
          });
          return;
        }

        if (regVal !== null && promoVal !== null && regVal > 0) {
          const discount = Math.round(((regVal - promoVal) / regVal) * 100);
          if (discount > 75) {
            list.push({
              id: itemKey,
              imageId: img.id,
              productId: p.id,
              imageName: img.file.name,
              imageUrl: img.imageUrl,
              storeName: sName,
              product: p,
              category: 'price_anomaly',
              severity: 'medium',
              title: t('extremeDiscountTitle', { discount }) || `Extreme Discount (-${discount}%)`,
              description: t('extremeDiscountDesc') || `Discount exceeds 75%. Please verify if decimal point error occurred (e.g. 0.49 instead of 4.90).`,
              regularPrice: regVal,
              promoPrice: promoVal,
              confidencePercent: conf,
              isCompetitor: isComp,
              suggestedFix: t('extremeDiscountFix') || 'Verify price tag correctness on shelf photo.',
            });
            return;
          }
        }

        if (hasRawAnomalies) {
          list.push({
            id: itemKey,
            imageId: img.id,
            productId: p.id,
            imageName: img.file.name,
            imageUrl: img.imageUrl,
            storeName: sName,
            product: p,
            category: 'price_anomaly',
            severity: 'medium',
            title: t('nonStandardPriceFormatTitle') || 'Non-standard Price Tag Format',
            description: t('nonStandardPriceFormatDesc') || 'AI automatically formatted or adjusted cents on price tag.',
            regularPrice: regVal,
            promoPrice: promoVal,
            confidencePercent: conf,
            isCompetitor: isComp,
            suggestedFix: t('nonStandardPriceFormatFix') || 'Verify final price value.',
          });
          return;
        }

        // 3. Low Confidence / Unknown SKU
        if (conf < 70 || pName.toLowerCase().startsWith('neznám') || pName.length <= 3) {
          list.push({
            id: itemKey,
            imageId: img.id,
            productId: p.id,
            imageName: img.file.name,
            imageUrl: img.imageUrl,
            storeName: sName,
            product: p,
            category: 'low_confidence',
            severity: 'medium',
            title: t('lowConfidenceSkuTitle', { confidence: conf }) || `Low SKU Confidence (${conf}%)`,
            description: t('lowConfidenceSkuDesc') || `Product recognition has lower confidence or non-standard name.`,
            regularPrice: regVal,
            promoPrice: promoVal,
            confidencePercent: conf,
            isCompetitor: isComp,
            suggestedFix: t('lowConfidenceSkuFix') || 'Verify canonical product name in list.',
          });
          return;
        }

        // 4. Competitor Promo
        if (isComp && promoVal !== null) {
          list.push({
            id: itemKey,
            imageId: img.id,
            productId: p.id,
            imageName: img.file.name,
            imageUrl: img.imageUrl,
            storeName: sName,
            product: p,
            category: 'competitor_promo',
            severity: 'low',
            title: t('competitorPromoTitle', { brand: p.brand || 'Competitor' }) || `Competitor Promotion: ${p.brand || 'Competitor'}`,
            description: t('competitorPromoDesc', { promo: promoVal.toFixed(2), reg: regVal ? `${regVal.toFixed(2)} €` : 'N/A' }) || `Competitor is selling product on promotion for ${promoVal.toFixed(2)} € (regular ${regVal ? `${regVal.toFixed(2)} €` : 'N/A'}).`,
            regularPrice: regVal,
            promoPrice: promoVal,
            confidencePercent: conf,
            isCompetitor: true,
            suggestedFix: t('competitorPromoFix') || 'Recorded for competitor price comparison.',
          });
        }
      });
    });

    // Sort by severity (high first) then category
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return list.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [images, compBrandsSet, t, isShelfShare]);

  // Extract unique stores
  const uniqueStores = useMemo(() => {
    return Array.from(new Set(exceptions.map(e => e.storeName))).filter(Boolean);
  }, [exceptions]);

  // Counts by category
  const counts = useMemo(() => {
    return {
      all: exceptions.length,
      missing_price: exceptions.filter(e => e.category === 'missing_price').length,
      price_anomaly: exceptions.filter(e => e.category === 'price_anomaly').length,
      low_confidence: exceptions.filter(e => e.category === 'low_confidence').length,
      competitor_promo: exceptions.filter(e => e.category === 'competitor_promo').length,
    };
  }, [exceptions]);

  // Filtered list
  const filteredExceptions = useMemo(() => {
    return exceptions.filter(item => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (selectedStore !== 'all' && item.storeName !== selectedStore) return false;
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchName = item.product.name.toLowerCase().includes(query);
        const matchStore = item.storeName.toLowerCase().includes(query);
        const matchTitle = item.title.toLowerCase().includes(query);
        return matchName || matchStore || matchTitle;
      }
      return true;
    });
  }, [exceptions, activeCategory, selectedStore, searchFilter]);

  // Count of swappable items in currently filtered view
  const swappableItems = useMemo(() => {
    return filteredExceptions.filter(
      item => item.category === 'price_anomaly' &&
      item.regularPrice !== null &&
      item.promoPrice !== null &&
      item.promoPrice > item.regularPrice
    );
  }, [filteredExceptions]);

  // Count of resolved items
  const resolvedCount = useMemo(() => {
    return exceptions.filter(e => savedItems.has(e.id)).length;
  }, [exceptions, savedItems]);

  // Batch swap inverted promo prices across all affected products in 1 click
  const handleBatchSwapInvertedPromos = () => {
    if (swappableItems.length === 0) return;

    const updates = swappableItems.map(item => ({
      imageId: item.imageId,
      productId: item.productId,
      prices: [
        { value: `${item.promoPrice!.toFixed(2)} €`, type: 'REGULAR' as const },
        { value: `${item.regularPrice!.toFixed(2)} €`, type: 'PROMO' as const },
      ],
    }));

    onUpdateProductPrices(updates);
    setSavedItems(prev => {
      const next = new Set(prev);
      swappableItems.forEach(s => next.add(s.id));
      return next;
    });
  };

  // Batch mark all filtered items as reviewed/verified
  const handleBatchMarkAllSaved = () => {
    setSavedItems(prev => {
      const next = new Set(prev);
      filteredExceptions.forEach(item => next.add(item.id));
      return next;
    });
  };

  // Save quick price fix for a single item
  const handleSavePriceFix = (item: AuditExceptionItem) => {
    const edit = inlineEdits[item.id] || {
      reg: item.regularPrice ? String(item.regularPrice) : '',
      promo: item.promoPrice ? String(item.promoPrice) : '',
      name: item.product.name,
    };

    const newPrices: PriceInfo[] = [];

    const regNum = parsePrice(edit.reg);
    if (regNum !== null && regNum > 0) {
      newPrices.push({
        value: `${regNum.toFixed(2)} €`,
        type: 'REGULAR',
      });
    }

    const promoNum = parsePrice(edit.promo);
    if (promoNum !== null && promoNum > 0) {
      newPrices.push({
        value: `${promoNum.toFixed(2)} €`,
        type: 'PROMO',
      });
    }

    if (newPrices.length > 0) {
      onUpdateProductPrices([
        {
          imageId: item.imageId,
          productId: item.productId,
          prices: newPrices,
        },
      ]);
    }

    // If name was edited
    if (edit.name && edit.name !== item.product.name && onRenameProduct) {
      onRenameProduct(item.imageId, item.productId, item.product.name, edit.name);
    }

    setSavedItems(prev => new Set(prev).add(item.id));
  };

  // Swap regular and promo prices with 1 click
  const handleSwapPrices = (item: AuditExceptionItem) => {
    if (item.regularPrice !== null && item.promoPrice !== null) {
      const swapped: PriceInfo[] = [
        { value: `${item.promoPrice.toFixed(2)} €`, type: 'REGULAR' },
        { value: `${item.regularPrice.toFixed(2)} €`, type: 'PROMO' },
      ];

      onUpdateProductPrices([
        {
          imageId: item.imageId,
          productId: item.productId,
          prices: swapped,
        },
      ]);

      setSavedItems(prev => new Set(prev).add(item.id));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 shadow-2xs border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-4 animate-fade-in">
      {/* Header with Title and Overall Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>{t('triageTitle') || 'Exceptions for Review & Triage'}</span>
                <span className="text-xs px-2 py-0.2 rounded font-bold font-mono tabular-nums bg-amber-100 text-amber-900 border border-amber-200">
                  {exceptions.length} {t('toApprove') || 'for approval'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {t('triageSubtitle') || 'Quick review and correction of missing prices, price anomalies, and uncertain SKUs before export.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {swappableItems.length > 0 && (
            <button
              onClick={handleBatchSwapInvertedPromos}
              className="h-8 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-98 cursor-pointer"
              title={t('swapPromosTitle') || 'Swap regular and promo price for all displayed inverted promo products'}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{t('swapPromos') || 'Swap Promos'} ({swappableItems.length})</span>
            </button>
          )}

          {counts.missing_price > 0 && onOpenMissingPricesModal && (
            <button
              onClick={onOpenMissingPricesModal}
              className="h-8 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-98 cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('fillMissingPrices', { count: counts.missing_price }) || `Fill ${counts.missing_price} prices`}</span>
            </button>
          )}

          {filteredExceptions.length > 0 && (
            <button
              onClick={handleBatchMarkAllSaved}
              className="h-8 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-98 cursor-pointer"
              title={t('approveDisplayedTitle') || 'Mark all displayed items as verified'}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('approveDisplayed') || 'Approve Displayed'}</span>
            </button>
          )}

          {onOpenPdfReport && (
            <button
              onClick={onOpenPdfReport}
              className="h-8 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-98 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
              <span>{t('previewPdf') || 'Preview PDF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress tracker */}
      {exceptions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">{t('auditVerificationStatus') || 'Audit verification status:'}</span>
            <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {t('resolvedOfTotal', { resolved: resolvedCount, total: exceptions.length }) || `${resolvedCount} of ${exceptions.length} resolved`} ({Math.round((resolvedCount / exceptions.length) * 100)}%)
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 sm:max-w-xs">
            <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round((resolvedCount / exceptions.length) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
              {Math.round((resolvedCount / exceptions.length) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Zero Exceptions State (All Clear) */}
      {exceptions.length === 0 ? (
        <div className="p-10 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-emerald-950">
              {t('allClearTitle') || 'All items are reviewed and verified!'}
            </h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto mt-1 font-medium">
              {t('allClearDesc') || 'No missing price tags, price anomalies, or unverified items in this audit. Ready for final export.'}
            </p>
          </div>
          {onOpenPdfReport && (
            <button
              onClick={onOpenPdfReport}
              className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center gap-2 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>{t('generateReadyPdf') || 'Generate PDF Report'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Category Tabs & Quick Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-100/90 p-0.5 rounded-lg overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>{t('categoryAll') || 'All'}</span>
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-white/20">
                  {counts.all}
                </span>
              </button>

              <button
                onClick={() => setActiveCategory('missing_price')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeCategory === 'missing_price'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-900 hover:bg-amber-100/50'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>{t('categoryMissingPrice') || 'Missing Prices'}</span>
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-black/10">
                  {counts.missing_price}
                </span>
              </button>

              <button
                onClick={() => setActiveCategory('price_anomaly')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeCategory === 'price_anomaly'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-900 hover:bg-rose-100/50'
                }`}
              >
                <TrendingDown className="w-3 h-3" />
                <span>{t('categoryPriceAnomaly') || 'Price Anomalies'}</span>
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-black/10">
                  {counts.price_anomaly}
                </span>
              </button>

              <button
                onClick={() => setActiveCategory('low_confidence')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeCategory === 'low_confidence'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-sky-900 hover:bg-sky-100/50'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{t('categoryLowConfidence') || 'Low Confidence SKUs'}</span>
                <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-black/10">
                  {counts.low_confidence}
                </span>
              </button>

              {counts.competitor_promo > 0 && (
                <button
                  onClick={() => setActiveCategory('competitor_promo')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeCategory === 'competitor_promo'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-purple-900 hover:bg-purple-100/50'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('categoryCompetitorPromo') || 'Competitor Promotions'}</span>
                  <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-black/10">
                    {counts.competitor_promo}
                  </span>
                </button>
              )}
            </div>

            {/* Quick Filter & Store Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {uniqueStores.length > 1 && (
                <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <select
                    value={selectedStore}
                    onChange={e => setSelectedStore(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">{t('allStoresFilter') || 'All stores'} ({uniqueStores.length})</option>
                    {uniqueStores.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={t('filterProductOrStore') || 'Filter product or store...'}
                  className="w-full pl-7 pr-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-colors font-medium"
                />
              </div>
            </div>
          </div>

          {/* Exceptions List */}
          <div className="space-y-2">
            {filteredExceptions.map(item => {
              const isSaved = savedItems.has(item.id);
              const edit = inlineEdits[item.id] || {
                reg: item.regularPrice ? String(item.regularPrice) : '',
                promo: item.promoPrice ? String(item.promoPrice) : '',
                name: item.product.name,
              };

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-colors ${
                    isSaved
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : item.severity === 'high'
                      ? 'bg-white border-rose-200 hover:border-rose-300 shadow-2xs'
                      : 'bg-white border-zinc-200/80 hover:border-zinc-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                    {/* Thumbnail & Product Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => onNavigateToImage && onNavigateToImage(item.imageId, item.product.name, item.productId)}
                        className="relative w-11 h-11 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shrink-0 cursor-pointer group"
                        title={t('viewOnFullPhoto') || 'View on full shelf photo'}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              item.category === 'missing_price'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : item.category === 'price_anomaly'
                                ? 'bg-rose-100 text-rose-900 border border-rose-200'
                                : item.category === 'low_confidence'
                                ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                : 'bg-purple-100 text-purple-900 border border-purple-200'
                            }`}
                          >
                            {item.title}
                          </span>

                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-zinc-400" />
                            {item.storeName}
                          </span>

                          <span className="text-[10px] text-zinc-400 font-medium tabular-nums">
                            · {t('confidenceLabel') || 'Istota'}: {item.confidencePercent}%
                          </span>

                          {isSaved && (
                            <span className="text-[9px] font-bold uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> {t('saved') || 'Saved'}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5" title={item.product.name}>
                          {item.product.name}
                        </h4>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Quick Inline Triage Actions */}
                    <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-150 dark:border-zinc-800">
                      {/* For swapped prices: 1-click swap */}
                      {item.category === 'price_anomaly' &&
                        item.regularPrice !== null &&
                        item.promoPrice !== null &&
                        item.promoPrice > item.regularPrice && (
                          <button
                            onClick={() => handleSwapPrices(item)}
                            className="h-7 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 active:scale-98 cursor-pointer"
                          >
                            <span>{t('swap') || 'Swap'}</span>
                            <span className="text-[10px] font-mono tabular-nums">
                              ({item.promoPrice.toFixed(2)} € ⇄ {item.regularPrice.toFixed(2)} €)
                            </span>
                          </button>
                        )}

                      {/* Inline Price Inputs */}
                      <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/60 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">{t('regularPriceShort') || 'Regular:'}</span>
                          <input
                            type="text"
                            value={edit.reg}
                            placeholder="0.00"
                            onChange={e =>
                              setInlineEdits(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...edit,
                                  reg: e.target.value,
                                },
                              }))
                            }
                            className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white dark:bg-zinc-900 border border-zinc-250 rounded text-right focus:ring-1 focus:ring-zinc-900"
                          />
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">€</span>
                        </div>

                        <div className="flex items-center gap-1 ml-1">
                          <span className="text-[10px] font-medium text-rose-600 uppercase">{t('promoPriceShort') || 'Akcia:'}</span>
                          <input
                            type="text"
                            value={edit.promo}
                            placeholder="0.00"
                            onChange={e =>
                              setInlineEdits(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...edit,
                                  promo: e.target.value,
                                },
                              }))
                            }
                            className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white dark:bg-zinc-900 border border-rose-200 rounded text-right text-rose-600 focus:ring-1 focus:ring-rose-500"
                          />
                          <span className="text-xs text-rose-600 font-medium">€</span>
                        </div>

                        <button
                          onClick={() => handleSavePriceFix(item)}
                          className="h-6 px-2 ml-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs active:scale-98 cursor-pointer"
                          title={t('savePriceForProduct') || 'Save price for this product'}
                        >
                          <Save className="w-3 h-3 text-zinc-300" />
                          <span>{t('savePrice') || 'Save'}</span>
                        </button>
                      </div>

                      {/* Jump to image button */}
                      {onNavigateToImage && (
                        <button
                          onClick={() => onNavigateToImage(item.imageId, item.product.name, item.productId)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title={t('zoomOnShelfPhoto') || 'Zoom and highlight product on shelf photo'}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
